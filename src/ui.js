'use strict';
(() => {
  const $=id=>document.getElementById(id);
  const math=window.BeatMath;
  const aiDirector=window.BeatDirector.createDirector();
  const FX=window.BeatFX;
  const fxCanvas=document.createElement('canvas');
  fxCanvas.className='fx-overlay';fxCanvas.hidden=true;
  UI.canvas.after(fxCanvas);
  let fxRenderer=null,fxDisabled=false,fxSelected=-1,fxFavFilter=false,fxAICount=0,fxLastSwitch=0,fxRecent=[];

  const UI={
    canvas:$('visualizer'),file:$('audio-file'),audio:$('audio'),play:$('play-pause'),seek:$('seek'),volume:$('volume'),
    title:$('title-status'),titleLed:$('title-led'),liveDot:$('live-dot'),placeholder:$('visual-placeholder'),
    trackName:$('track-name'),trackMeta:$('track-meta'),modeLabel:$('mode-label'),sourceTag:$('source-tag'),
    microphone:$('microphone'),micCaption:$('mic-caption'),micDevices:$('mic-devices'),
    bassMeter:$('bass-meter'),midMeter:$('mid-meter'),highMeter:$('high-meter'),levelMeter:$('level-meter')
  };
  const ctx=UI.canvas.getContext('2d',{alpha:false});
  const presetColors={
    azure:['#4adcf8','#32a3f2','#9beeff'],mint:['#50f7bb','#1fb6b1','#bbffe0'],
    violet:['#c1a0ff','#7178f5','#f3c1ff'],sunset:['#ffc06c','#ff647c','#ffe2ae'],rainbow:['#45d8fc','#a85fff','#f2bc63']
  };
  const settings={mode:'bars',palette:'azure',intensity:1.15,smooth:0.75,barCount:56,showGrid:true,micDevice:'default',volume:0.85,aiEnabled:false,aiSpeed:'balanced',aiPalette:false,fxStack:[],fxBypass:false,fxAuto:false,fxFavorites:[]};
  let audioCtx=null,analyser=null,fileAnalyser=null,micSource=null,micStream=null,sourceNode=null,sourceMode='none',fileURL=null;
  let bins=new Uint8Array(1024),wave=new Uint8Array(2048),freq={bass:0,mids:0,highs:0,total:0,dominantHz:0};
  let rms=0,peak=0,pulse=0,lastPulse=0,sceneWidth=0,sceneHeight=0,dpr=1,lastMeters=0;
  let isSeeking=false,saveTimer=null,repeat=false,lastFrame=0,modeTransition=null,lastAIStatus=0;
  const supported=Boolean(window.AudioContext||window.webkitAudioContext);

  function notify(message,error=false){
    const div=document.createElement('div');div.className='toast'+(error?' error':'');div.textContent=message;
    $('toasts').append(div);setTimeout(()=>div.remove(),4200);
  }
  function persist(){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>window.beatAPI?.savePreferences({...settings}).catch(()=>notify('A beállításokat nem sikerült elmenteni.',true)),300);
  }
  function setSourceLabel(){
    const active=(sourceMode==='mic'&&!!micStream)||(sourceMode==='file'&&!UI.audio.paused&&!UI.audio.ended);
    UI.titleLed.classList.toggle('on',active);UI.liveDot.classList.toggle('on',active);
    UI.placeholder.style.display=active?'none':'';
    UI.title.textContent=active?(sourceMode==='mic'?'Élő mikrofon':'Lejátszás folyamatban'):(sourceMode==='file'?'Zenefájl betöltve':'Nincs hangforrás');
    UI.sourceTag.textContent=active?(sourceMode==='mic'?'MIC LIVE':'FILE LIVE'):(sourceMode==='file'?'PAUSED':'NO INPUT');
    UI.microphone.classList.toggle('active',sourceMode==='mic');
    $('open-file').classList.toggle('active',sourceMode!=='mic');
    UI.micCaption.textContent=micStream?'Mikrofon bekapcsolva':'Élő hangbemenet';
    $('mic-toggle-mark').textContent=micStream?'●':'○';
    UI.play.textContent=sourceMode==='mic'?'■':UI.audio.paused?'▶':'❚❚';
    UI.play.title=sourceMode==='mic'?'Mikrofon leállítása':UI.audio.paused?'Lejátszás':'Szünet';
    return active;
  }
  async function initAudio(){
    if(!supported)throw new Error('A Web Audio API nem érhető el.');
    if(!audioCtx){
      audioCtx=new (window.AudioContext||window.webkitAudioContext)();
      fileAnalyser=audioCtx.createAnalyser();fileAnalyser.fftSize=2048;fileAnalyser.smoothingTimeConstant=settings.smooth;
      sourceNode=audioCtx.createMediaElementSource(UI.audio);
      sourceNode.connect(fileAnalyser);fileAnalyser.connect(audioCtx.destination);
    }
    if(audioCtx.state==='suspended')await audioCtx.resume();
    $('sample-info').textContent=`${(audioCtx.sampleRate/1000).toFixed(1)} kHz / FFT ${fileAnalyser.fftSize}`;
    refreshAnalyser();
    return audioCtx;
  }
  function refreshAnalyser(){
    if(sourceMode==='mic'&&micSource){analyser=micSource._analyser || null;}
    else if(sourceMode==='file'){analyser=fileAnalyser;}
    else analyser=null;
    if(analyser){analyser.smoothingTimeConstant=settings.smooth;
      if(bins.length!==analyser.frequencyBinCount)bins=new Uint8Array(analyser.frequencyBinCount);
      if(wave.length!==analyser.fftSize)wave=new Uint8Array(analyser.fftSize);
    }
  }
  function stopMic(){
    if(micStream){for(const track of micStream.getTracks())track.stop();micStream=null;}
    if(micSource){try{micSource.disconnect();}catch{}micSource=null;}
    if(sourceMode==='mic'){sourceMode=fileURL?'file':'none';refreshAnalyser();}
    setSourceLabel();
  }
  async function toggleMic(){
    if(micStream){stopMic();return;}
    if(!navigator.mediaDevices?.getUserMedia){notify('A mikrofon nem érhető el ebben a környezetben.',true);return;}
    try{
      await initAudio();
      UI.audio.pause();
      const selected=UI.micDevices.value;
      const constraint={audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,...(selected!=='default'?{deviceId:{ideal:selected}}:{})}};
      const stream=await navigator.mediaDevices.getUserMedia(constraint);
      micStream=stream;
      micSource=audioCtx.createMediaStreamSource(stream);
      const micAnalyser=audioCtx.createAnalyser();micAnalyser.fftSize=2048;micAnalyser.smoothingTimeConstant=settings.smooth;
      micSource.connect(micAnalyser); // Nem kötjük a hangszóróra: nincs visszacsatolás.
      micSource._analyser=micAnalyser;
      sourceMode='mic';refreshAnalyser();setSourceLabel();
      for(const track of stream.getTracks())track.addEventListener('ended',stopMic,{once:true});
      refreshDevices();
      notify('Mikrofon bekapcsolva · a hang nem kerül feltöltésre');
    }catch(e){
      stopMic();const message=e?.name==='NotAllowedError'?'A mikrofonhoz nem kaptunk engedélyt.':(e?.message||'A mikrofon nem indítható.');
      notify(message,true);
    }
  }
  async function refreshDevices(){
    try{
      const devices=await navigator.mediaDevices.enumerateDevices();
      const list=devices.filter(d=>d.kind==='audioinput');
      const before=UI.micDevices.value;
      UI.micDevices.replaceChildren();
      const opt=document.createElement('option');opt.value='default';opt.textContent='Alapértelmezett mikrofon';UI.micDevices.append(opt);
      list.forEach((dev,i)=>{const o=document.createElement('option');o.value=dev.deviceId;o.textContent=dev.label||`Mikrofon ${i+1}`;UI.micDevices.append(o);});
      UI.micDevices.value=[...UI.micDevices.options].some(o=>o.value===before)?before:'default';
    }catch{}
  }
  async function loadFile(file){
    if(!file)return;
    const ext=file.name.toLowerCase().split('.').pop();
    if(!file.type.startsWith('audio/')&&!['mp3','wav','ogg','flac','m4a','aac','opus','webm'].includes(ext)){notify('Válassz egy hangfájlt.',true);return;}
    if(file.size===0){notify('A hangfájl üres.',true);return;}
    stopMic();UI.audio.pause();
    if(fileURL){URL.revokeObjectURL(fileURL);fileURL=null;}
    fileURL=URL.createObjectURL(file);
    UI.audio.src=fileURL;UI.audio.load();sourceMode='file';refreshAnalyser();
    UI.trackName.textContent=file.name;
    UI.trackMeta.textContent=`${(file.size/1048576).toFixed(1)} MB · ${ext.toUpperCase()} · helyi fájl`;
    UI.seek.disabled=false;
    setSourceLabel();
    try{await initAudio();await UI.audio.play();setSourceLabel();notify('Zene betöltve: '+file.name.slice(0,70));}
    catch(e){notify('A fájl betöltődött, de a lejátszás nem indult. Nyomd meg a ▶ gombot.',true);setSourceLabel();}
  }
  async function togglePlay(){
    if(sourceMode==='mic'){stopMic();return;}
    if(!fileURL){UI.file.click();return;}
    if(UI.audio.paused){try{await initAudio();await UI.audio.play();}catch(e){notify('A hangot nem sikerült lejátszani: '+(e?.message||'Ismeretlen hiba'),true);}}
    else UI.audio.pause();
    setSourceLabel();
  }
  function updateAIDisplay(status,reason){
    const toggle=$('ai-toggle');
    toggle.classList.toggle('enabled',settings.aiEnabled);
    toggle.setAttribute('aria-checked',String(settings.aiEnabled));
    $('ai-indicator').classList.toggle('active',settings.aiEnabled);
    $('ai-status').textContent=status||(settings.aiEnabled?'Figyelés...':'Kikapcsolva');
    if(reason)$('ai-reason').textContent=reason;
  }
  function setAI(enabled){
    settings.aiEnabled=Boolean(enabled);
    aiDirector.reset();
    modeTransition=null;
    updateAIDisplay(settings.aiEnabled?'Hangra vár...':'Kikapcsolva',settings.aiEnabled?'A zene ritmusa alapján váltogatja az effekteket.':'Kézi effektválasztás.');
    $('ai-bpm').textContent='Ritmus: elemzésre vár';
    persist();
  }
  function setMode(next,{automatic=false,reason='',now=performance.now()}={}){
    if(!['bars','wave','orbit','particles'].includes(next))return;
    if(!automatic&&settings.aiEnabled)setAI(false);
    if(settings.mode!==next)modeTransition={from:settings.mode,startedAt:now};
    settings.mode=next;
    for(const btn of document.querySelectorAll('[data-mode]'))btn.classList.toggle('active',btn.dataset.mode===next);
    UI.modeLabel.textContent={bars:'SPECTRUM / REAL TIME',wave:'WAVEFORM / OSCILLOSCOPE',orbit:'ORBIT / RADIAL SPECTRUM',particles:'PARTICLES / AUDIO REACTIVE'}[next];
    if(automatic)updateAIDisplay('Automatikus váltás aktív',reason||'Hang alapján új effekt');
    persist();
  }
  function setPalette(p){if(!presetColors[p])return;
    settings.palette=p;document.querySelectorAll('[data-palette]').forEach(b=>b.classList.toggle('selected',b.dataset.palette===p));persist();
  }
  function renderMode(mode,t){
    switch(mode){case 'bars':drawBars(t);break;case 'wave':drawWave(t);break;case 'orbit':drawOrbit(t);break;case 'particles':drawParticles(t);break;}
  }
  function paletteColor(index,total,alpha=1){
    const colors=presetColors[settings.palette];
    if(settings.palette==='rainbow')return`hsla(${(index/Math.max(1,total)*360+190)%360},90%,65%,${alpha})`;
    const hex=colors[index%colors.length];
    if(alpha===1)return hex;
    return hex+Math.round(Math.max(0,Math.min(1,alpha))*255).toString(16).padStart(2,'0');
  }
  function sizeCanvas(){
    const bounds=UI.canvas.getBoundingClientRect();
    const scale=Math.min(window.devicePixelRatio||1,2);
    const w=Math.max(1,Math.floor(bounds.width*scale)),h=Math.max(1,Math.floor(bounds.height*scale));
    if(UI.canvas.width!==w||UI.canvas.height!==h){UI.canvas.width=w;UI.canvas.height=h;}
    dpr=scale;sceneWidth=bounds.width;sceneHeight=bounds.height;
    ctx.setTransform(scale,0,0,scale,0,0);
  }
  function backdrop(t){
    const w=sceneWidth,h=sceneHeight;
    ctx.fillStyle='#091626';ctx.fillRect(0,0,w,h);
    const halo=ctx.createRadialGradient(w*.5,h*.55,12,w*.5,h*.55,w*.6);
    halo.addColorStop(0,'#1c3552');halo.addColorStop(.55,'#101f35');halo.addColorStop(1,'#091626');
    ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
    if(settings.showGrid){ctx.strokeStyle='#76b4d40d';ctx.lineWidth=1;ctx.beginPath();
      for(let x=0;x<w;x+=38){ctx.moveTo(x,0);ctx.lineTo(x,h);}for(let y=0;y<h;y+=38){ctx.moveTo(0,y);ctx.lineTo(w,y);}ctx.stroke();
      ctx.strokeStyle='#6094bc1d';ctx.beginPath();ctx.moveTo(24,h*.5);ctx.lineTo(w-24,h*.5);ctx.stroke();}
  }
  function drawBars(t){
    const w=sceneWidth,h=sceneHeight, count=settings.barCount;
    const padding=36,gap=count>85?2:3.8,available=w-padding*2;
    const bw=Math.max(1,(available-gap*(count-1))/count),bottom=h-52,maxHeight=Math.max(25,h-126);
    const amp=settings.intensity;
    for(let i=0;i<count;i++){
      const raw=math.audioBarLevel(bins,i,count),v=Math.max(.012,Math.pow(raw,1.08)*amp);
      const bh=Math.min(maxHeight,Math.max(2,v*maxHeight));
      const x=padding+(bw+gap)*i;
      const grad=ctx.createLinearGradient(x,bottom-bh,x,bottom);
      grad.addColorStop(0,paletteColor(i,count));grad.addColorStop(.75,paletteColor(Math.floor(i/3),count,.7));grad.addColorStop(1,paletteColor(i,count,.19));
      ctx.fillStyle=grad;ctx.shadowColor=paletteColor(i,count,.45);ctx.shadowBlur=raw>0.08?14:0;
      ctx.fillRect(x,bottom-bh,bw,bh);
      ctx.shadowBlur=0;
      ctx.fillStyle=paletteColor(i,count,.17);
      ctx.fillRect(x,bottom+5,bw,Math.min(bh*.26,25));
    }
    if(freq.bass>.4){ctx.fillStyle=`rgba(64,195,249,${Math.min(.13,freq.bass*.16)})`;ctx.fillRect(0,0,w,h);}
  }
  function drawWave(t){
    const w=sceneWidth,h=sceneHeight,cy=h*.51;
    ctx.lineWidth=2.3;ctx.strokeStyle=paletteColor(0,4);ctx.shadowColor=paletteColor(0,4);ctx.shadowBlur=19;
    ctx.beginPath();const count=Math.min(wave.length,1100);
    for(let i=0;i<count;i++){
      const x=28+i/(count-1)*(w-56);
      const v=(wave[Math.floor(i/count*wave.length)]-128)/128;
      const y=cy+v*(h*.39)*settings.intensity;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }ctx.stroke();ctx.shadowBlur=0;
    ctx.lineWidth=1;ctx.strokeStyle=paletteColor(2,4,.21);ctx.beginPath();
    for(let i=0;i<count;i++){
      const x=28+i/(count-1)*(w-56);const v=(wave[Math.floor(i/count*wave.length)]-128)/128;
      const y=cy-v*(h*.32)*settings.intensity;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }ctx.stroke();
  }
  function drawOrbit(t){
    const w=sceneWidth,h=sceneHeight,cx=w*.5,cy=h*.51;
    const radius=Math.max(25,Math.min(w*.25,h*.26));
    const glow=ctx.createRadialGradient(cx,cy,4,cx,cy,radius*1.7);
    glow.addColorStop(0,paletteColor(1,4,.27));glow.addColorStop(1,paletteColor(0,4,0));
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,radius*1.7,0,Math.PI*2);ctx.fill();
    ctx.lineWidth=1.6;ctx.strokeStyle=paletteColor(0,4,.36);ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.stroke();
    const n=144;ctx.lineCap='round';
    for(let i=0;i<n;i++){
      const angle=i/n*Math.PI*2-Math.PI/2+t*.000045;
      const v=math.audioBarLevel(bins,i%n,n);const spike=Math.max(3,v*Math.max(15,radius*.7)*settings.intensity);
      const x1=cx+Math.cos(angle)*(radius+4),y1=cy+Math.sin(angle)*(radius+4);
      const x2=cx+Math.cos(angle)*(radius+4+spike),y2=cy+Math.sin(angle)*(radius+4+spike);
      ctx.strokeStyle=paletteColor(i,n);ctx.lineWidth=i%5===0?2.8:1.4;
      ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    }
    ctx.lineWidth=1;ctx.strokeStyle=paletteColor(1,4,.5);ctx.beginPath();ctx.arc(cx,cy,radius*.7+pulse*9,0,Math.PI*2);ctx.stroke();
    ctx.textAlign='center';ctx.fillStyle='#e1f9ff';ctx.font='800 19px Segoe UI, sans-serif';ctx.fillText('BEATSCOPE',cx,cy-1);
    ctx.fillStyle='#87afca';ctx.font='10px Segoe UI, sans-serif';ctx.fillText('AUDIO REACTIVE',cx,cy+16);
  }
  const seeds=Array.from({length:240},(_,i)=>({x:((i*73)%241)/241,y:((i*139)%239)/239,phase:i*1.73,scale:.45+(i%9)/9}));
  function drawParticles(t){
    const w=sceneWidth,h=sceneHeight,cx=w*.5,cy=h*.5;
    const energy=Math.max(.025,(freq.bass*.7+freq.mids*.3)*settings.intensity);
    const burst=Math.min(1,energy+pulse*.7);
    const halo=ctx.createRadialGradient(cx,cy,5,cx,cy,Math.max(w,h)*.36);
    halo.addColorStop(0,paletteColor(0,4,.32*burst));halo.addColorStop(1,paletteColor(1,4,0));
    ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
    for(let i=0;i<seeds.length;i++){
      const s=seeds[i],a=s.phase+t*.00012*(.35+s.scale);
      const rr=(.05+s.x*.52)*(Math.min(w,h))*(.7+burst*.55);
      const x=cx+Math.cos(a)*rr*(1.2+s.scale*.4),y=cy+Math.sin(a)*rr*(.6+s.scale*.5);
      const size=(.45+s.scale*1.8)*(1+burst*1.4);
      ctx.fillStyle=paletteColor(i,seeds.length,Math.min(1,.35+s.scale*.5+burst*.12));
      ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill();
    }
    ctx.strokeStyle=paletteColor(0,4,.17+pulse*.2);ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(cx,cy,30+burst*30,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=paletteColor(1,4,.6);ctx.beginPath();ctx.arc(cx,cy,5+burst*8,0,Math.PI*2);ctx.fill();
  }

  function fxStatus(value){$('fx-status').textContent=value;}
  function fxButton(label,className,handler){
    const b=document.createElement('button');
    b.type='button';b.className=className;b.textContent=label;b.addEventListener('click',handler);
    return b;
  }
  function fxSelectedItem(){return settings.fxStack[fxSelected]||null;}
  function drawFXCatalog(){
    const query=$('fx-search').value.trim().toLowerCase(),category=$('fx-category').value;
    const matches=FX.LIBRARY.filter(e=>(!category||e.category===category)&&(!fxFavFilter||settings.fxFavorites.includes(e.id))&&(!query||(e.name+' '+e.category+' '+e.id).toLowerCase().includes(query)));
    const list=$('fx-results');list.replaceChildren();
    if(!matches.length){
      const p=document.createElement('p');p.textContent='Nincs találat.';p.style.padding='14px';list.append(p);return;
    }
    const fragment=document.createDocumentFragment();
    for(const entry of matches){
      const row=document.createElement('div');row.className='fx-result';row.setAttribute('role','listitem');
      const badge=document.createElement('span');badge.className='fx-id';badge.textContent=entry.id.slice(3);
      const name=fxButton(entry.name,'fx-entry-name',()=>addFX(entry.id));
      const hint=document.createElement('small');hint.textContent=entry.category;name.append(hint);
      const fav=fxButton(settings.fxFavorites.includes(entry.id)?'★':'☆','fx-fav'+(settings.fxFavorites.includes(entry.id)?' selected':''),()=>{
        const idx=settings.fxFavorites.indexOf(entry.id);
        if(idx>=0)settings.fxFavorites.splice(idx,1);else settings.fxFavorites.push(entry.id);
        persist();drawFXCatalog();
      });
      fav.title='Kedvencek';fav.setAttribute('aria-label','Kedvenc: '+entry.name);
      row.append(badge,name,fav);fragment.append(row);
    }
    list.append(fragment);
  }
  function refreshFXStack(){
    const stack=$('fx-stack');stack.replaceChildren();
    $('fx-stack-count').textContent=settings.fxStack.length+'/3';
    for(let i=0;i<settings.fxStack.length;i++){
      const item=settings.fxStack[i],entry=FX.byId(item.id);if(!entry)continue;
      const row=document.createElement('div');row.className='fx-stack-entry'+(i===fxSelected?' selected':'');
      row.append(fxButton(entry.name,'fx-stack-name'+(item.disabled?' inactive':''),()=>{fxSelected=i;refreshFXStack();}));
      row.append(fxButton(item.disabled?'○':'●','',()=>{item.disabled=!item.disabled;persist();refreshFXStack();}));
      row.append(fxButton('↑','',()=>{if(i>0){const t=settings.fxStack[i-1];settings.fxStack[i-1]=item;settings.fxStack[i]=t;fxSelected=i-1;persist();refreshFXStack();}}));
      row.append(fxButton('↓','',()=>{if(i<settings.fxStack.length-1){const t=settings.fxStack[i+1];settings.fxStack[i+1]=item;settings.fxStack[i]=t;fxSelected=i+1;persist();refreshFXStack();}}));
      row.append(fxButton('✕','',()=>{settings.fxStack.splice(i,1);fxSelected=Math.min(fxSelected,settings.fxStack.length-1);persist();refreshFXStack();}));
      stack.append(row);
    }
    if(!settings.fxStack.length)stack.textContent='Nincs aktív effekt. Válassz a listából.';
    const item=fxSelectedItem();
    for(const id of ['fx-wet','fx-strength'])$(id).disabled=!item;
    $('fx-wet').value=item?Math.round(item.wet*100):100;
    $('fx-strength').value=item?Math.round(item.strength*100):100;
    $('fx-wet-value').textContent=$('fx-wet').value+'%';
    $('fx-strength-value').textContent=$('fx-strength').value+'%';
    $('fx-bypass').classList.toggle('active',settings.fxBypass);
    $('fx-bypass').setAttribute('aria-pressed',String(settings.fxBypass));
    $('fx-bypass').textContent=settings.fxBypass?'◌ Effektek kikapcsolva':'◉ Effektek aktívak';
    $('fx-auto').classList.toggle('active',settings.fxAuto);
    $('fx-auto').setAttribute('aria-checked',String(settings.fxAuto));
    $('fx-auto').textContent=settings.fxAuto?'BE':'KI';
    if(item)fxStatus(FX.byId(item.id)?.name||'Választott effekt');
    else fxStatus('Válassz effektet; maximum három használható egyszerre.');
  }
  function addFX(id){
    if(!FX.byId(id))return;
    if(settings.fxStack.length>=3){notify('Maximum három effekt rakható egymásra.',true);return;}
    settings.fxAuto=false;settings.fxBypass=false;
    settings.fxStack.push({id,wet:1,strength:1,disabled:false});
    fxSelected=settings.fxStack.length-1;persist();refreshFXStack();
  }
  function fxAutoUpdate(t,active){
    if(!settings.fxAuto||!active)return;
    const interval={calm:12500,balanced:7100,party:3900}[settings.aiSpeed]||7100;
    if(t-fxLastSwitch<interval)return;
    fxLastSwitch=t;
    const fx=FX.recommend(freq,fxRecent,fxAICount++);
    if(!fx)return;
    fxRecent.push(fx.id);fxRecent=fxRecent.slice(-8);
    settings.fxStack=[{id:fx.id,wet:1,strength:1,disabled:false}];
    settings.fxBypass=false;
    fxSelected=0;
    persist();refreshFXStack();
    fxStatus('AI választotta: '+fx.name);
  }
  function drawPostFX(t){
    const stack=settings.fxBypass?[]:settings.fxStack.filter(x=>!x.disabled);
    if(!stack.length||fxDisabled){fxCanvas.hidden=true;return;}
    if(!fxRenderer){
      try{fxRenderer=FX.renderer(fxCanvas);if(!fxRenderer)throw new Error('WebGL2 nem érhető el ezen a gépen.');}
      catch(e){fxDisabled=true;fxCanvas.hidden=true;notify('GPU-effektek nem elérhetők: '+e.message,true);fxStatus('WebGL2 szükséges a GPU-effektekhez.');return;}
    }
    try{
      fxCanvas.hidden=false;
      fxRenderer.draw(UI.canvas,stack,t,{...freq,rms});
    }catch(e){fxDisabled=true;fxCanvas.hidden=true;notify('GPU renderelési hiba: '+e.message,true);}
  }
  function initFXControls(){
    const category=$('fx-category');
    for(const item of [...new Set(FX.LIBRARY.map(e=>e.category))]){
      const option=document.createElement('option');option.value=item;option.textContent=item;category.append(option);
    }
    const toggle=()=>{$('fx-drawer').hidden=!$('fx-drawer').hidden;if(!$('fx-drawer').hidden){drawFXCatalog();refreshFXStack();$('fx-search').focus();}};
    $('fx-browser-open').addEventListener('click',toggle);
    $('fx-close').addEventListener('click',()=>{$('fx-drawer').hidden=true;});
    $('fx-search').addEventListener('input',drawFXCatalog);
    category.addEventListener('change',drawFXCatalog);
    $('fx-favorites').addEventListener('click',()=>{
      fxFavFilter=!fxFavFilter;$('fx-favorites').classList.toggle('active',fxFavFilter);drawFXCatalog();
    });
    $('fx-bypass').addEventListener('click',()=>{settings.fxBypass=!settings.fxBypass;persist();refreshFXStack();});
    $('fx-auto').addEventListener('click',()=>{
      settings.fxAuto=!settings.fxAuto;fxLastSwitch=0;fxRecent=[];persist();refreshFXStack();
      notify(settings.fxAuto?'AI FX Autopilot bekapcsolva':'AI FX Autopilot kikapcsolva');
    });
    for(const [id,key,scale] of [['fx-wet','wet',100],['fx-strength','strength',100]]){
      $(id).addEventListener('input',e=>{const item=fxSelectedItem();if(!item)return;item[key]=+e.target.value/scale;$(id+'-value').textContent=e.target.value+'%';persist();});
    }
    drawFXCatalog();fxSelected=settings.fxStack.length?0:-1;refreshFXStack();
  }
  function updateMeters(now){
    if(now-lastMeters<75)return;
    lastMeters=now;
    const round=v=>Math.round(Math.min(1,v)*100)+'%';
    for(const [bar,name,val] of [[UI.bassMeter,'bass',freq.bass],[UI.midMeter,'mid',freq.mids],[UI.highMeter,'high',freq.highs]]){
      bar.style.width=round(val);$(name+'-pct').textContent=round(val);
    }
    const db=rms>0.0005?Math.max(-60,20*Math.log10(rms)):-Infinity;
    $('level-val').textContent=Number.isFinite(db)?db.toFixed(1):'-∞';
    UI.levelMeter.style.width=Number.isFinite(db)?Math.max(0,Math.min(100,(db+60)/60*100))+'%':'0%';
    $('dominant').textContent='DOMINÁNS: '+(freq.dominantHz?freq.dominantHz+' Hz':'— Hz');
  }
  function animate(t){
    requestAnimationFrame(animate);
    const active=(sourceMode==='mic'&&!!micStream)||(sourceMode==='file'&&!UI.audio.paused&&!UI.audio.ended);
    if(!active&&t-lastFrame<85)return;
    lastFrame=t;
    if(!sceneWidth||UI.canvas.clientWidth!==sceneWidth||UI.canvas.clientHeight!==sceneHeight)sizeCanvas();
    if(active&&analyser&&audioCtx){
      analyser.getByteFrequencyData(bins);analyser.getByteTimeDomainData(wave);
      freq=math.frequencyBands(bins,audioCtx.sampleRate,analyser.fftSize);
      rms=math.rmsOfWave(wave);
      const impact=freq.bass*.74+freq.mids*.26;
      if(impact>peak*.94&&impact>.19&&t-lastPulse>190){pulse=1;lastPulse=t;}
      peak=Math.max(peak*.94,impact);
    }else{
      bins.fill(0);wave.fill(128);freq={bass:0,mids:0,highs:0,total:0,dominantHz:0};rms=0;
    }
    pulse*=.92;
    if(settings.aiEnabled){
      const suggestion=aiDirector.update({...freq,rms},t,settings.mode,settings.aiSpeed);
      if(suggestion?.change){
        setMode(suggestion.mode,{automatic:true,reason:suggestion.reason,now:t});
        if(settings.aiPalette){
          const choices={bars:'azure',wave:'violet',orbit:'mint',particles:'rainbow'};
          setPalette(choices[suggestion.mode]);
        }
      }
      if(t-lastAIStatus>500){
        lastAIStatus=t;
        if(!suggestion?.active)updateAIDisplay('Hangra vár...', 'Az AI csak aktív hangforrás mellett vált.');
        else if(!suggestion?.change)updateAIDisplay('Hangot elemzi');
        $('ai-bpm').textContent='Ritmus: '+(suggestion?.bpm?suggestion.bpm+' BPM (becslés)':'elemzés alatt');
      }
    }
    backdrop(t);
    if(active){
      if(modeTransition){
        const progress=Math.max(0,Math.min(1,(t-modeTransition.startedAt)/650));
        if(progress<1){
          ctx.save();ctx.globalAlpha=1-progress;renderMode(modeTransition.from,t);ctx.restore();
          ctx.save();ctx.globalAlpha=progress;renderMode(settings.mode,t);ctx.restore();
        }else{modeTransition=null;renderMode(settings.mode,t);}
      }else renderMode(settings.mode,t);
    }
    fxAutoUpdate(t,active);
    drawPostFX(t);
    updateMeters(t);
  }
  async function saveImage(){
    const combined=document.createElement('canvas');
    combined.width=UI.canvas.width;combined.height=UI.canvas.height;
    const cc=combined.getContext('2d');cc.drawImage(UI.canvas,0,0);
    if(!fxCanvas.hidden)cc.drawImage(fxCanvas,0,0);
    const png=combined.toDataURL('image/png');
    try{const result=await window.beatAPI?.saveScreenshot(png);if(result?.saved)notify('Kép sikeresen elmentve.');}
    catch(e){notify('Nem sikerült elmenteni a képet: '+e.message,true);}
  }
  function setWindowState(state){document.body.classList.toggle('fullscreen',Boolean(state.fullscreen));sizeCanvas();}
  function bind(){
    initFXControls();
    $('window-min').addEventListener('click',()=>window.beatAPI?.windowAction('minimize'));
    $('window-max').addEventListener('click',()=>window.beatAPI?.windowAction('toggle-maximize'));
    $('window-close').addEventListener('click',()=>window.beatAPI?.windowAction('close'));
    $('fullscreen').addEventListener('click',()=>window.beatAPI?.windowAction('toggle-fullscreen'));
    $('save-image').addEventListener('click',saveImage);
    window.beatAPI?.onWindowState(setWindowState);
    $('ai-toggle').addEventListener('click',()=>setAI(!settings.aiEnabled));
    $('ai-speed').addEventListener('change',e=>{settings.aiSpeed=e.target.value;aiDirector.reset();persist();updateAIDisplay(settings.aiEnabled?'Sebesség frissítve':undefined);});
    $('ai-palette').addEventListener('change',e=>{settings.aiPalette=e.target.checked;persist();});
    document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>setMode(btn.dataset.mode)));
    document.querySelectorAll('[data-palette]').forEach(btn=>btn.addEventListener('click',()=>setPalette(btn.dataset.palette)));
    $('intensity').addEventListener('input',e=>{settings.intensity=+e.target.value/100;$('intensity-val').textContent=e.target.value+'%';persist();});
    $('smooth').addEventListener('input',e=>{settings.smooth=+e.target.value/100;$('smooth-val').textContent=e.target.value+'%';if(analyser)analyser.smoothingTimeConstant=settings.smooth;if(fileAnalyser)fileAnalyser.smoothingTimeConstant=settings.smooth;persist();});
    $('bars-count').addEventListener('input',e=>{settings.barCount=+e.target.value;$('bars-val').textContent=e.target.value;persist();});
    $('show-grid').addEventListener('change',e=>{settings.showGrid=e.target.checked;persist();});
    $('open-file').addEventListener('click',()=>UI.file.click());
    $('placeholder-open').addEventListener('click',()=>UI.file.click());
    UI.file.addEventListener('change',async e=>{await loadFile(e.target.files?.[0]);UI.file.value='';});
    UI.microphone.addEventListener('click',toggleMic);
    UI.micDevices.addEventListener('change',e=>{settings.micDevice=e.target.value;persist();if(micStream)notify('Az eszköz váltásához állítsd le és indítsd újra a mikrofont.');});
    UI.play.addEventListener('click',togglePlay);
    $('repeat').addEventListener('click',()=>{repeat=!repeat;UI.audio.loop=repeat;$('repeat').classList.toggle('toggled',repeat);notify(repeat?'Ismétlés bekapcsolva':'Ismétlés kikapcsolva');});
    $('previous').addEventListener('click',()=>{if(Number.isFinite(UI.audio.duration))UI.audio.currentTime=0;});
    $('next').addEventListener('click',()=>{if(Number.isFinite(UI.audio.duration))UI.audio.currentTime=Math.max(0,UI.audio.duration-0.1);});
    $('stop').addEventListener('click',()=>{if(micStream)stopMic();else{UI.audio.pause();UI.audio.currentTime=0;}setSourceLabel();});
    $('mute').addEventListener('click',()=>{UI.audio.muted=!UI.audio.muted;$('mute').classList.toggle('toggled',UI.audio.muted);$('mute').textContent=UI.audio.muted?'◖×':'◖))';});
    UI.volume.addEventListener('input',e=>{settings.volume=+e.target.value/100;UI.audio.volume=settings.volume;persist();});
    UI.audio.addEventListener('loadedmetadata',()=>{$('duration').textContent=math.formatTime(UI.audio.duration);});
    UI.audio.addEventListener('timeupdate',()=>{if(!isSeeking&&Number.isFinite(UI.audio.duration)&&UI.audio.duration>0)UI.seek.value=Math.round(UI.audio.currentTime/UI.audio.duration*1000);$('current-time').textContent=math.formatTime(UI.audio.currentTime);});
    UI.audio.addEventListener('pause',setSourceLabel);UI.audio.addEventListener('play',setSourceLabel);
    UI.audio.addEventListener('ended',()=>{setSourceLabel();notify('Lejátszás vége');});
    UI.audio.addEventListener('error',()=>{notify('Ezt a hangformátumot a Chromium nem tudja lejátszani.',true);setSourceLabel();});
    UI.seek.addEventListener('pointerdown',()=>isSeeking=true);
    UI.seek.addEventListener('pointerup',()=>isSeeking=false);
    UI.seek.addEventListener('input',()=>{if(Number.isFinite(UI.audio.duration)&&UI.audio.duration>0){UI.audio.currentTime=UI.audio.duration*(+UI.seek.value/1000);$('current-time').textContent=math.formatTime(UI.audio.currentTime);}});
    window.addEventListener('keydown',e=>{
      if(e.ctrlKey&&e.key.toLowerCase()==='o'){e.preventDefault();UI.file.click();return;}
      if(e.key==='F11'){e.preventDefault();window.beatAPI?.windowAction('toggle-fullscreen');return;}
      if(e.ctrlKey&&e.key.toLowerCase()==='e'){e.preventDefault();$('fx-browser-open').click();return;}
      if(e.key==='Escape'&&!$('fx-drawer').hidden){$('fx-drawer').hidden=true;return;}
      const target=e.target;if(target instanceof HTMLInputElement||target instanceof HTMLSelectElement)return;
      if(e.code==='Space'){e.preventDefault();togglePlay();return;}
      if(e.key.toLowerCase()==='a'&&!e.ctrlKey&&!e.altKey){setAI(!settings.aiEnabled);return;}
      if(['1','2','3','4'].includes(e.key)){setMode(['bars','wave','orbit','particles'][Number(e.key)-1]);}
    });
    window.addEventListener('dragover',e=>{e.preventDefault();document.body.classList.add('drag-over');});
    window.addEventListener('dragleave',e=>{if(!e.relatedTarget)document.body.classList.remove('drag-over');});
    window.addEventListener('drop',e=>{e.preventDefault();document.body.classList.remove('drag-over');const file=[...e.dataTransfer.files].find(f=>f.type.startsWith('audio/')||/\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(f.name));if(file)loadFile(file);else notify('Húzz ide egy zenefájlt.',true);});
    window.addEventListener('beforeunload',()=>{stopMic();if(fileURL)URL.revokeObjectURL(fileURL);});
    window.addEventListener('resize',sizeCanvas);
  }
  async function init(){
    bind();
    try{Object.assign(settings,await window.beatAPI.loadPreferences());}catch{}
    settings.fxStack=Array.isArray(settings.fxStack)?settings.fxStack:[];
    settings.fxFavorites=Array.isArray(settings.fxFavorites)?settings.fxFavorites:[];
    fxSelected=settings.fxStack.length?0:-1;
    refreshFXStack();drawFXCatalog();
    setMode(settings.mode,{automatic:true});setPalette(settings.palette);
    $('ai-speed').value=settings.aiSpeed;
    $('ai-palette').checked=settings.aiPalette;
    updateAIDisplay(settings.aiEnabled?'Hangra vár...':'Kikapcsolva',settings.aiEnabled?'Zene betöltése után automatikus váltás.':'Kézi effektválasztás.');
    $('intensity').value=Math.round(settings.intensity*100);$('intensity-val').textContent=Math.round(settings.intensity*100)+'%';
    $('smooth').value=Math.round(settings.smooth*100);$('smooth-val').textContent=Math.round(settings.smooth*100)+'%';
    $('bars-count').value=settings.barCount;$('bars-val').textContent=settings.barCount;
    $('show-grid').checked=settings.showGrid;
    UI.volume.value=Math.round(settings.volume*100);UI.audio.volume=settings.volume;
    try{setWindowState(await window.beatAPI.windowState());}catch{}
    if(!supported)notify('Web Audio API nem érhető el.',true);
    sizeCanvas();setSourceLabel();requestAnimationFrame(animate);
  }
  init();
})();