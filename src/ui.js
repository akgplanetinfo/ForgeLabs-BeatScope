'use strict';
(() => {
  const $=id=>document.getElementById(id);
  const math=window.BeatMath;
  const aiDirector=window.BeatDirector.createDirector();
  const FX=window.BeatFX;
  const Composition=window.BeatComposition;
  const VideoTiming=window.BeatVideoTiming;
  const BeatClock=window.BeatClock;
  const Generators=window.BeatGenerators;
  const ExtraGenerators=window.BeatExtraGenerators;
  let fxRenderer=null,fxDisabled=false,fxSelected=-1,fxFavFilter=false,fxAICount=0,fxLastSwitch=0,fxRecent=[];

  const UI={
    canvas:$('visualizer'),file:$('audio-file'),audio:$('audio'),play:$('play-pause'),seek:$('seek'),volume:$('volume'),
    title:$('title-status'),titleLed:$('title-led'),liveDot:$('live-dot'),placeholder:$('visual-placeholder'),
    trackName:$('track-name'),trackMeta:$('track-meta'),modeLabel:$('mode-label'),sourceTag:$('source-tag'),
    microphone:$('microphone'),micCaption:$('mic-caption'),micDevices:$('mic-devices'),
    bassMeter:$('bass-meter'),midMeter:$('mid-meter'),highMeter:$('high-meter'),levelMeter:$('level-meter')
  };
  const fxCanvas=document.createElement('canvas');
  fxCanvas.className='fx-overlay';fxCanvas.hidden=true;
  UI.canvas.after(fxCanvas);
  const mainCtx=UI.canvas.getContext('2d',{alpha:false});
  let ctx=mainCtx;
  // One GPU processor per concurrently active layer, created only on demand.
  const layerFxCache=Array.from({length:Composition.ROWS},()=>null);
  const layerFxFailed=new Set();
  let clipFxSelected=0;
  const presetColors={
    azure:['#4adcf8','#32a3f2','#9beeff'],mint:['#50f7bb','#1fb6b1','#bbffe0'],
    violet:['#c1a0ff','#7178f5','#f3c1ff'],sunset:['#ffc06c','#ff647c','#ffe2ae'],rainbow:['#45d8fc','#a85fff','#f2bc63']
  };
  const settings={mode:'bars',palette:'azure',intensity:1.15,smooth:0.75,barCount:56,showGrid:true,micDevice:'default',volume:0.85,aiEnabled:false,aiSpeed:'balanced',aiPalette:false,fxStack:[],fxBypass:false,fxAuto:false,fxFavorites:[],composition:Composition.createComposition(),bpm:120,quantize:'off'};
  let audioCtx=null,analyser=null,fileAnalyser=null,micSource=null,micStream=null,sourceNode=null,sourceMode='none',fileURL=null;
  let bins=new Uint8Array(1024),wave=new Uint8Array(2048),freq={bass:0,mids:0,highs:0,total:0,dominantHz:0};
  let rms=0,peak=0,pulse=0,lastPulse=0,sceneWidth=0,sceneHeight=0,dpr=1,lastMeters=0;
  let isSeeking=false,saveTimer=null,repeat=false,lastFrame=0,modeTransition=null,lastAIStatus=0,clipTouched=false,initializing=true;
  const supported=Boolean(window.AudioContext||window.webkitAudioContext);

  function notify(message,error=false){
    const div=document.createElement('div');div.className='toast'+(error?' error':'');div.textContent=message;
    $('toasts').append(div);setTimeout(()=>div.remove(),4200);
  }
  function persist(){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>window.beatAPI?.savePreferences({...settings}).catch(()=>notify('A beállításokat nem sikerült elmenteni.',true)),300);
  }

  const tempoClock=BeatClock.createClock({bpm:120,quantize:'off',origin:performance.now()});
  const waitingClips=new Map();
  let waitingScene=null,lastTempoRefresh=0,waitingTimer=null;
  function waitingCount(){return waitingClips.size+(waitingScene?1:0);}
  function armWaitingTimer(){
    if(waitingTimer!==null){clearTimeout(waitingTimer);waitingTimer=null;}
    if(!waitingCount())return;
    const due=waitingScene?waitingScene.due:Math.min(...[...waitingClips.values()].map(a=>a.due));
    waitingTimer=setTimeout(()=>{
      waitingTimer=null;
      flushQueued(performance.now());
      if(waitingCount())armWaitingTimer();
    },Math.max(1,Math.ceil(due-performance.now())));
  }
  function clearWaiting(){
    waitingClips.clear();waitingScene=null;
    if(waitingTimer!==null){clearTimeout(waitingTimer);waitingTimer=null;}
    $('vj-queue-cancel').disabled=true;
  }
  function cancelPendingLayer(row){
    waitingClips.delete(row);
    waitingScene=null;
    armWaitingTimer();
  }
  function reschedulePending(now){
    const due=tempoClock.next(now);
    if(waitingScene)waitingScene.due=due;
    for(const action of waitingClips.values())action.due=due;
    if(tempoClock.quantize==='off')flushQueued(now);
    else if(waitingCount())renderClipGrid();
    armWaitingTimer();
  }
  function refreshTempoUI(now=performance.now()){
    const count=waitingCount();
    $('vj-bpm').value=String(tempoClock.bpm);
    $('vj-quantize').value=tempoClock.quantize;
    $('vj-queue-cancel').disabled=!count;
    if(count){
      const targets=waitingScene?[waitingScene]:[...waitingClips.values()];
      const remaining=Math.max(0,Math.min(...targets.map(a=>a.due))-now);
      $('vj-tempo-status').textContent=(waitingScene?'Jelenet':'Klip')+' várakozik: '+count+' · '+(remaining/1000).toFixed(2)+' s';
    }else{
      $('vj-tempo-status').textContent=tempoClock.quantize==='off'?
        'Azonnali indítás':'Kvantálás: '+$('vj-quantize').selectedOptions[0].textContent;
    }
    const step=Math.floor((now-tempoClock.origin)/BeatClock.beatDuration(tempoClock.bpm));
    const lit=((step%4)+4)%4;
    for(const [index,led] of [...$('vj-beat-leds').children].entries())led.classList.toggle('on',index===lit);
  }
  function launchClipNow(row,slot){
    if(!settings.composition.layers[row]?.clips[slot])return false;
    settings.composition=Composition.launch(settings.composition,row,slot);
    const clip=settings.composition.layers[row].clips[slot];
    clipTouched=true;modeTransition=null;settings.mode=clip.source;
    for(const button of document.querySelectorAll('[data-mode]'))
      button.classList.toggle('active',button.dataset.mode===clip.source);
    UI.modeLabel.textContent='LIVE / '+(clip.mediaName||SOURCE_NAMES[clip.source]).toUpperCase();
    return true;
  }
  function launchSceneNow(slot){
    settings.composition=Composition.launchScene(settings.composition,slot);
    clipTouched=true;
  }
  function scheduleClip(row,slot){
    const now=performance.now();
    if(tempoClock.quantize==='off'){
      launchClipNow(row,slot);renderClipGrid();setSourceLabel();persist();return;
    }
    waitingScene=null;
    const due=tempoClock.next(now);
    waitingClips.set(row,{kind:'clip',row,slot,due});
    settings.composition=Composition.selectClip(settings.composition,row,slot);
    renderClipGrid();refreshTempoUI(now);armWaitingTimer();persist();
  }
  function scheduleScene(slot){
    const now=performance.now();
    if(tempoClock.quantize==='off'){
      clearWaiting();launchSceneNow(slot);renderClipGrid();setSourceLabel();persist();return;
    }
    waitingClips.clear();
    waitingScene={kind:'scene',slot,due:tempoClock.next(now)};
    renderClipGrid();refreshTempoUI(now);armWaitingTimer();
  }
  function flushQueued(now){
    let changed=false;
    if(waitingScene&&now>=waitingScene.due){
      const action=waitingScene;clearWaiting();
      launchSceneNow(action.slot);changed=true;
    }else{
      for(const [row,action] of waitingClips){
        if(now>=action.due){
          waitingClips.delete(row);
          if(launchClipNow(action.row,action.slot))changed=true;
        }
      }
    }
    if(changed){
      renderClipGrid();setSourceLabel();persist();
      armWaitingTimer();
    }
    if(changed||!waitingCount())$('vj-queue-cancel').disabled=!waitingCount();
  }
  function bindTempo(){
    $('vj-bpm').addEventListener('change',event=>{
      const bpm=BeatClock.normalizeBpm(Number(event.target.value));
      tempoClock.setBpm(bpm,performance.now());
      settings.bpm=bpm;
      reschedulePending(performance.now());refreshTempoUI();persist();
    });
    $('vj-quantize').addEventListener('change',event=>{
      const quant=tempoClock.setQuantize(event.target.value);
      settings.quantize=quant;
      reschedulePending(performance.now());refreshTempoUI();persist();
    });
    $('vj-tap-tempo').addEventListener('click',()=>{
      const now=performance.now(),result=tempoClock.tap(now);
      if(result!==null){
        settings.bpm=result;
        reschedulePending(now);persist();
      }
      refreshTempoUI(now);
    });
    $('vj-beat-reset').addEventListener('click',()=>{
      const now=performance.now();tempoClock.reset(now);
      reschedulePending(now);refreshTempoUI(now);
    });
    $('vj-queue-cancel').addEventListener('click',()=>{
      clearWaiting();renderClipGrid();refreshTempoUI();
    });
    refreshTempoUI();
  }
  function refreshLayerMixer(){
    const index=settings.composition.selectedLayer,layer=settings.composition.layers[index];
    $('vj-mix-target').textContent=layer.name+' · pozíció '+(index+1)+'/8'+(index===0?' (legfelső)':index===7?' (legalsó)':'');
    $('vj-blend-mode').value=layer.blendMode;
    $('vj-mix-opacity').value=Math.round(layer.opacity*100);
    $('vj-mix-opacity-value').textContent=Math.round(layer.opacity*100)+'%';
    $('vj-layer-up').disabled=index<=0;
    $('vj-layer-down').disabled=index>=Composition.ROWS-1;
  }
  function shiftSelectedLayer(offset){
    if(waitingCount())clearWaiting();
    const oldIndex=settings.composition.selectedLayer;
    const newIndex=oldIndex+offset;
    if(newIndex<0||newIndex>=Composition.ROWS)return;
    settings.composition=Composition.moveLayer(settings.composition,oldIndex,offset);
    // Temporal FX history must travel with its owning layer when reordering.
    [layerFxCache[oldIndex],layerFxCache[newIndex]]=[layerFxCache[newIndex],layerFxCache[oldIndex]];
    const oldFailed=layerFxFailed.has(oldIndex),newFailed=layerFxFailed.has(newIndex);
    layerFxFailed.delete(oldIndex);layerFxFailed.delete(newIndex);
    if(oldFailed)layerFxFailed.add(newIndex);
    if(newFailed)layerFxFailed.add(oldIndex);
    renderClipGrid();setSourceLabel();persist();
  }
  function bindLayerMixer(){
    $('vj-blend-mode').addEventListener('change',event=>{
      const index=settings.composition.selectedLayer;
      settings.composition=Composition.layerAction(settings.composition,index,{blendMode:event.target.value});
      refreshLayerMixer();persist();
    });
    $('vj-mix-opacity').addEventListener('input',event=>{
      const index=settings.composition.selectedLayer;
      settings.composition=Composition.layerAction(settings.composition,index,{opacity:Number(event.target.value)/100});
      const row=document.querySelectorAll('.vj-layer-row')[index];
      const opacity=row?.querySelector('.vj-layer-opacity');
      if(opacity)opacity.value=event.target.value;
      refreshLayerMixer();persist();
    });
    $('vj-layer-up').addEventListener('click',()=>shiftSelectedLayer(-1));
    $('vj-layer-down').addEventListener('click',()=>shiftSelectedLayer(1));
    refreshLayerMixer();
  }
  const SOURCE_NAMES={bars:'Spectrum Bars',wave:'Waveform',orbit:'Orbit Pulse',particles:'Particles',media:'Importált média',...Generators.NAMES,...ExtraGenerators.NAMES};
  const PARAM_KEYS=['speed','scale','rotation','audio'];
  let clipClipboard=null,draggedClip=null;

  const mediaPlayers=new Map();
  let videoClockUpdated=0;
  const mediaURL=id=>'beatscope-media://local/'+id; // ID validated and generated in Electron main.
  function mediaType(id){return /\.(mp4|webm|mov|m4v)$/.test(id)?'video':'image';}
  function activeMediaLayer(index){
    return Composition.activeLayers(settings.composition).find(layer=>layer.index===index&&layer.source==='media')||null;
  }
  function applyVideoTiming(item,layer){
    if(item.type!=='video'||!layer)return;
    const video=item.element,p=VideoTiming.normalizePlayback(layer.playback);
    if(!Number.isFinite(video.duration)||video.duration<=0)return;
    const {start,end}=VideoTiming.bounds(p,video.duration);
    if(video.currentTime<start-.045||VideoTiming.atOut(video.currentTime,p,video.duration)){
      if(video.currentTime>=end-.035&&!p.loop){
        item.userPaused=true;video.pause();
        const freeze=Math.max(start,end-.055);
        if(video.currentTime>freeze+.01)video.currentTime=freeze;
      }else{
        video.currentTime=start;
        if(!item.userPaused&&video.paused)video.play().catch(()=>{});
      }
    }
  }
  function selectedVideoInfo(){
    const {row,slot,clip}=selectedCell();
    if(!clip||clip.source!=='media'||mediaType(clip.mediaId)!=='video')return null;
    const layer=settings.composition.layers[row];
    const item=layer?.activeSlot===slot?mediaPlayers.get(row):null;
    return {row,slot,clip,item:item?.id===clip.mediaId?item:null};
  }
  function updateVideoClock(){
    const info=selectedVideoInfo(),video=info?.item?.element;
    if(!info||!video||!Number.isFinite(video.duration)||video.duration<=0)return;
    const t=VideoTiming.seekTime(video.currentTime,info.clip.playback,video.duration);
    const d=video.duration;
    $('vj-video-clock').textContent=VideoTiming.formatTime(t)+' / '+VideoTiming.formatTime(d);
    const seek=$('vj-video-seek');seek.max=String(d);seek.value=String(t);seek.disabled=false;
    $('vj-video-play').textContent=video.paused?'▶ Lejátszás':'Ⅱ Szünet';
  }
  function refreshVideoTransport(){
    const info=selectedVideoInfo();
    const enabled=Boolean(info);
    const clip=info?.clip;
    const playback=VideoTiming.normalizePlayback(clip?.playback);
    $('vj-video-target').textContent=clip?clip.mediaName:'Válassz ki egy videoklipet';
    $('vj-video-loop').checked=playback.loop;
    $('vj-video-in').value=String(playback.inPoint);
    $('vj-video-out').value=playback.outPoint===null?'':String(playback.outPoint);
    $('vj-video-speed').value=String(Math.round((clip?.params?.speed??1)*100));
    $('vj-video-speed-value').textContent=(clip?.params?.speed??1).toFixed(2)+'×';
    for(const id of ['vj-video-loop','vj-video-in','vj-video-out','vj-video-speed',
      'vj-video-play','vj-video-restart','vj-video-mark-in','vj-video-mark-out','vj-video-reset'])
      $(id).disabled=!enabled;
    const video=info?.item?.element,available=Boolean(video&&Number.isFinite(video.duration)&&video.duration>0);
    $('vj-video-seek').disabled=!available;
    $('vj-video-seek').max=available?String(video.duration):'100';
    $('vj-video-seek').value=available?String(VideoTiming.seekTime(video.currentTime,playback,video.duration)):'0';
    $('vj-video-clock').textContent=available?
      VideoTiming.formatTime(video.currentTime)+' / '+VideoTiming.formatTime(video.duration):'00:00.0 / 00:00.0';
    $('vj-video-play').textContent=video&&!video.paused?'Ⅱ Szünet':'▶ Lejátszás';
  }
  function updateVideoPlayback(patch){
    const info=selectedVideoInfo();if(!info)return;
    settings.composition=Composition.setMediaPlayback(settings.composition,info.row,info.slot,patch);
    const updated=settings.composition.layers[info.row].clips[info.slot].playback;
    if(info.item){
      const v=info.item.element;
      if(Number.isFinite(v.duration)&&v.duration>0){
        const {start,end}=VideoTiming.bounds(updated,v.duration);
        if(v.currentTime<start||v.currentTime>end)v.currentTime=start;
      }
    }
    refreshVideoTransport();persist();
  }
  function bindVideoTransport(){
    $('vj-video-loop').addEventListener('change',event=>updateVideoPlayback({loop:event.target.checked}));
    for(const [key,field] of [['inPoint','vj-video-in'],['outPoint','vj-video-out']]){
      $(field).addEventListener('change',event=>{
        const raw=event.target.value.trim();
        const value=raw===''&&key==='outPoint'?null:Number(raw);
        const info=selectedVideoInfo();
        if(!info||!(value===null||Number.isFinite(value))){refreshVideoTransport();return;}
        if(value!==null&&value<0){refreshVideoTransport();notify('Az időpont nem lehet negatív.',true);return;}
        updateVideoPlayback({[key]:value});
      });
    }
    $('vj-video-mark-in').addEventListener('click',()=>{
      const info=selectedVideoInfo();
      if(!info?.item)return;
      updateVideoPlayback({inPoint:Math.floor(info.item.element.currentTime*10)/10});
    });
    $('vj-video-mark-out').addEventListener('click',()=>{
      const info=selectedVideoInfo();if(!info?.item)return;
      updateVideoPlayback({outPoint:Math.ceil(info.item.element.currentTime*10)/10});
    });
    $('vj-video-reset').addEventListener('click',()=>updateVideoPlayback({inPoint:0,outPoint:null}));
    $('vj-video-speed').addEventListener('input',event=>{
      const info=selectedVideoInfo();if(!info)return;
      const speed=Number(event.target.value)/100;
      settings.composition=Composition.updateClipParams(settings.composition,info.row,info.slot,{speed});
      refreshClipParams();refreshVideoTransport();persist();
    });
    $('vj-video-seek').addEventListener('input',event=>{
      const info=selectedVideoInfo(),video=info?.item?.element;
      if(!video||!Number.isFinite(video.duration)||video.duration<=0)return;
      video.currentTime=VideoTiming.seekTime(Number(event.target.value),info.clip.playback,video.duration);
      updateVideoClock();
    });
    $('vj-video-play').addEventListener('click',()=>{
      let info=selectedVideoInfo();if(!info)return;
      if(!info.item){
        settings.composition=Composition.launch(settings.composition,info.row,info.slot);
        renderClipGrid();setSourceLabel();persist();info=selectedVideoInfo();
      }
      const item=info?.item;if(!item)return;
      const video=item.element;
      if(!video.paused){item.userPaused=true;video.pause();}
      else{
        item.userPaused=false;
        if(Number.isFinite(video.duration)&&VideoTiming.atOut(video.currentTime,info.clip.playback,video.duration))
          video.currentTime=VideoTiming.bounds(info.clip.playback,video.duration).start;
        video.play().catch(e=>notify('A videó nem indul: '+e.message,true));
      }
      refreshVideoTransport();
    });
    $('vj-video-restart').addEventListener('click',()=>{
      let info=selectedVideoInfo();if(!info)return;
      if(!info.item){
        settings.composition=Composition.launch(settings.composition,info.row,info.slot);
        renderClipGrid();persist();info=selectedVideoInfo();
      }
      const item=info?.item;if(!item)return;
      item.userPaused=false;
      item.element.currentTime=VideoTiming.bounds(info.clip.playback,item.element.duration).start;
      item.element.play().catch(e=>notify('A videó nem indul: '+e.message,true));
      refreshVideoTransport();
    });
    refreshVideoTransport();
  }
  function stopMediaPlayer(item){
    if(item.type==='video'){
      item.element.pause();
      item.element.removeAttribute('src');
      item.element.load();
    }
  }
  function syncMediaPlayers(){
    const active=Composition.activeLayers(settings.composition);
    const wanted=new Map(active.filter(l=>l.source==='media').map(l=>[l.index,l]));
    for(const [index,item] of mediaPlayers){
      const layer=wanted.get(index);
      if(!layer||item.id!==layer.mediaId||item.slot!==layer.slot){
        stopMediaPlayer(item);
        mediaPlayers.delete(index);
      }
    }
    for(const [index,layer] of wanted){
      if(mediaPlayers.has(index))continue;
      if(!Composition.MEDIA_ID.test(layer.mediaId))continue;
      const type=mediaType(layer.mediaId);
      const element=document.createElement(type==='video'?'video':'img');
      const item={type,id:layer.mediaId,slot:layer.slot,element,userPaused:false};
      mediaPlayers.set(index,item);
      element.onerror=()=>notify('Nem sikerült megnyitni: '+(layer.mediaName||'média')+'. Ellenőrizd a formátumot.',true);
      if(type==='video'){
        element.muted=true;element.defaultMuted=true;element.loop=false;
        element.playsInline=true;element.autoplay=true;element.preload='auto';
        element.crossOrigin='anonymous';
        element.onloadedmetadata=()=>{
          const current=activeMediaLayer(index);
          if(!current||item.id!==current.mediaId)return;
          element.currentTime=VideoTiming.bounds(current.playback,element.duration).start;
          refreshVideoTransport();
          if(!item.userPaused)element.play().catch(e=>notify('A videó nem indul: '+e.message,true));
        };
        element.ontimeupdate=()=>applyVideoTiming(item,activeMediaLayer(index));
        element.onended=()=>applyVideoTiming(item,activeMediaLayer(index));
      }else{
        element.crossOrigin='anonymous';
      }
      element.src=mediaURL(layer.mediaId);
      if(type==='video')element.play().catch(err=>notify('A videó nem indul: '+err.message,true));
    }
  }
  function drawImportedMedia(layer){
    const item=mediaPlayers.get(layer.index);
    if(!item||item.id!==layer.mediaId)return;
    const element=item.element;
    if(item.type==='video'){
      if(element.readyState<2||!element.videoWidth)return;
      const p=Composition.sanitizeParams(layer.params);
      if(Math.abs(element.playbackRate-p.speed)>.02)element.playbackRate=p.speed;
      applyVideoTiming(item,layer);
    }else if(!element.complete||!element.naturalWidth)return;
    const width=item.type==='video'?element.videoWidth:element.naturalWidth;
    const height=item.type==='video'?element.videoHeight:element.naturalHeight;
    if(!width||!height)return;
    const scale=Math.max(sceneWidth/width,sceneHeight/height);
    const dw=width*scale,dh=height*scale;
    ctx.drawImage(element,(sceneWidth-dw)/2,(sceneHeight-dh)/2,dw,dh);
  }
  async function importClipMedia(){
    const layer=settings.composition.layers[settings.composition.selectedLayer];
    const requested=settings.composition.selectedSlot;
    const target=layer.clips[requested]===null?requested:
      Array.from({length:Composition.COLUMNS},(_,i)=>(requested+i)%Composition.COLUMNS).find(i=>!layer.clips[i]);
    if(target===undefined){notify('A kiválasztott réteg tele van. Törölj vagy helyezz át egy klipet.',true);return;}
    $('vj-import-media').disabled=true;
    try{
      const files=await window.beatAPI.importMedia();
      if(!Array.isArray(files)||!files.length)return;
      const asset=files[0];
      if(!Composition.MEDIA_ID.test(asset.id))throw new Error('Az importált média azonosítója nem megfelelő.');
      let updated=Composition.putMediaClip(settings.composition,settings.composition.selectedLayer,target,asset);
      updated=Composition.launch(updated,updated.selectedLayer,target);
      settings.composition=updated;
      clipTouched=true;
      renderClipGrid();setSourceLabel();persist();
      notify((asset.type==='video'?'Videó':'Kép')+' importálva: '+asset.name);
    }catch(e){notify('Importálás sikertelen: '+(e?.message||'ismeretlen hiba'),true);}
    finally{$('vj-import-media').disabled=false;}
  }
  function selectedCell(){
    const c=settings.composition;
    const row=c.selectedLayer,slot=c.selectedSlot;
    return {row,slot,clip:c.layers[row]?.clips[slot]||null};
  }
  function updateClipToolbar(){
    const {row,slot,clip}=selectedCell();
    $('vj-clip-selection').textContent='Layer '+(row+1)+' · '+(slot+1)+'. hely'+(clip?' · '+(clip.mediaName||SOURCE_NAMES[clip.source]):' · üres');
    for(const action of ['copy','cut','delete','duplicate'])
      $('vj-'+action).disabled=!clip;
    $('vj-paste').disabled=!clipClipboard;
    for(const btn of document.querySelectorAll('#vj-clip-menu [data-clip-action]')){
      const action=btn.dataset.clipAction;
      btn.disabled=action==='paste'?!clipClipboard:!clip;
    }
  }
  function editClip(action){
    const {row,slot,clip}=selectedCell();
    if(action==='copy'||action==='cut'){
      if(!clip)return;
      clipClipboard=Composition.getClip(settings.composition,row,slot);
      if(action==='cut')settings.composition=Composition.removeClip(settings.composition,row,slot);
    }else if(action==='paste'){
      if(!clipClipboard)return;
      settings.composition=Composition.pasteClip(settings.composition,row,slot,clipClipboard);
    }else if(action==='duplicate'){
      if(!clip)return;
      const next=Composition.duplicateClip(settings.composition,row,slot);
      if(next.selectedSlot===slot){notify('Nincs üres kliphely ebben a rétegben.',true);return;}
      settings.composition=next;
    }else if(action==='delete'){
      if(!clip)return;
      settings.composition=Composition.removeClip(settings.composition,row,slot);
    }else return;
    $('vj-clip-menu').hidden=true;
    cancelPendingLayer(row);
    renderClipGrid();setSourceLabel();persist();
  }
  function openClipMenu(event,row,slot){
    event.preventDefault();
    settings.composition=Composition.selectClip(settings.composition,row,slot);
    renderClipGrid();persist();
    const menu=$('vj-clip-menu');
    menu.hidden=false;
    menu.style.left=Math.min(event.clientX,window.innerWidth-180)+'px';
    menu.style.top=Math.min(event.clientY,window.innerHeight-195)+'px';
    updateClipToolbar();
  }
  function selectedClipInfo(){
    const layerIndex=settings.composition.selectedLayer;
    const layer=settings.composition.layers[layerIndex];
    if(!layer||!Number.isInteger(settings.composition.selectedSlot))return null;
    const slot=settings.composition.selectedSlot;
    const clip=layer.clips[slot];
    return clip?{layerIndex,slot,clip,layer}:null;
  }
  function refreshClipParams(){
    const selected=selectedClipInfo();
    $('vj-selected-clip').textContent=selected?(selected.layer.name+' · '+(selected.clip.mediaName||SOURCE_NAMES[selected.clip.source])+' · '+(selected.slot+1)+'. klip'):'Válassz egy aktív klipet';
    const p=selected?Composition.sanitizeParams(selected.clip.params):Composition.DEFAULT_PARAMS;
    const format={speed:v=>v.toFixed(2)+'×',scale:v=>Math.round(v*100)+'%',rotation:v=>Math.round(v)+'°',audio:v=>Math.round(v*100)+'%'};
    for(const key of PARAM_KEYS){
      const range=$('vj-'+key),out=$('vj-'+key+'-value');
      range.value=key==='rotation'?p[key]:Math.round(p[key]*100);
      range.disabled=!selected;
      out.textContent=format[key](p[key]);
    }
    $('vj-reset').disabled=!selected;
  }
  function bindClipParams(){
    for(const key of PARAM_KEYS){
      const input=$('vj-'+key);
      input.addEventListener('input',()=>{
        const s=selectedClipInfo();if(!s)return;
        const v=key==='rotation'?+input.value:+input.value/100;
        settings.composition=Composition.updateClipParams(settings.composition,s.layerIndex,s.slot,{[key]:v});
        refreshClipParams();
        if(key==='speed')refreshVideoTransport();
        persist();
      });
    }
    $('vj-reset').addEventListener('click',()=>{
      const s=selectedClipInfo();if(!s)return;
      settings.composition=Composition.updateClipParams(settings.composition,s.layerIndex,s.slot,Composition.DEFAULT_PARAMS);
      refreshClipParams();refreshVideoTransport();persist();
    });
  }


  let layerFxSelected=0;
  function selectedLayerEffects(){
    return settings.composition.layers[settings.composition.selectedLayer];
  }
  function selectedLayerFXEntry(){
    return selectedLayerEffects()?.fxStack?.[layerFxSelected]||null;
  }
  function refreshLayerFX(){
    const layer=selectedLayerEffects();
    const stack=layer?.fxStack||[];
    if(layerFxSelected>=stack.length)layerFxSelected=Math.max(0,stack.length-1);
    $('vj-lfx-target').textContent=layer?layer.name+' · minden klip':'Nincs réteg';
    $('vj-lfx-count').textContent=stack.length+'/'+Composition.MAX_LAYER_FX;
    $('vj-lfx-add').disabled=!layer||stack.length>=Composition.MAX_LAYER_FX;
    $('vj-lfx-library').disabled=!layer;
    $('vj-lfx-bypass').disabled=!layer;
    $('vj-lfx-bypass').textContent=layer?.fxBypass?'FX kikapcsolva':'FX bekapcsolva';
    $('vj-lfx-bypass').setAttribute('aria-pressed',String(!!layer?.fxBypass));
    $('vj-lfx-bypass').classList.toggle('off',!!layer?.fxBypass);
    const list=$('vj-lfx-stack');list.replaceChildren();
    if(!stack.length)list.textContent='Ehhez a réteghez még nincs effekt.';
    for(let index=0;index<stack.length;index++){
      const entry=stack[index],definition=FX.byId(entry.id);
      if(!definition)continue;
      const line=document.createElement('div');line.className='vj-cfx-item'+(index===layerFxSelected?' selected':'');
      const choose=fxButton(definition.name,'vj-cfx-name'+(entry.disabled?' disabled':''),()=>{layerFxSelected=index;refreshLayerFX();});
      const toggle=fxButton(entry.disabled?'○':'●','',()=>changeLayerFX(index,{disabled:!entry.disabled}));
      toggle.title=entry.disabled?'Réteg FX bekapcsolása':'Réteg FX kikapcsolása';
      const up=fxButton('↑','',()=>moveLayerFX(index,-1));up.disabled=index===0;
      const down=fxButton('↓','',()=>moveLayerFX(index,1));down.disabled=index===stack.length-1;
      const remove=fxButton('✕','',()=>removeLayerFX(index));
      line.append(choose,toggle,up,down,remove);list.append(line);
    }
    const selected=selectedLayerFXEntry();
    for(const key of ['wet','strength']){
      const slider=$('vj-lfx-'+key);
      slider.disabled=!selected;
      slider.value=selected?Math.round(selected[key]*100):100;
      $('vj-lfx-'+key+'-value').textContent=slider.value+'%';
    }
  }
  function commitLayerFX(stack,bypass){
    const index=settings.composition.selectedLayer;
    settings.composition=Composition.setLayerEffects(settings.composition,index,stack,bypass);
    refreshLayerFX();persist();
  }
  function changeLayerFX(index,patch){
    const layer=selectedLayerEffects();
    if(!layer?.fxStack?.[index])return;
    const stack=layer.fxStack.map(x=>({...x}));
    stack[index]={...stack[index],...patch};
    commitLayerFX(stack);
  }
  function moveLayerFX(index,offset){
    const layer=selectedLayerEffects();
    if(!layer||index+offset<0||index+offset>=layer.fxStack.length)return;
    const stack=layer.fxStack.map(x=>({...x}));
    [stack[index],stack[index+offset]]=[stack[index+offset],stack[index]];
    layerFxSelected=index+offset;commitLayerFX(stack);
  }
  function removeLayerFX(index){
    const layer=selectedLayerEffects();if(!layer)return;
    const stack=layer.fxStack.map(x=>({...x}));
    stack.splice(index,1);
    layerFxSelected=Math.max(0,Math.min(layerFxSelected,stack.length-1));
    commitLayerFX(stack);
  }
  function bindLayerFX(){
    const picker=$('vj-lfx-library');
    for(const category of [...new Set(FX.LIBRARY.map(e=>e.category))]){
      const group=document.createElement('optgroup');group.label=category;
      for(const definition of FX.LIBRARY.filter(e=>e.category===category)){
        const option=document.createElement('option');option.value=definition.id;option.textContent=definition.name;
        group.append(option);
      }
      picker.append(group);
    }
    $('vj-lfx-add').addEventListener('click',()=>{
      const layer=selectedLayerEffects(),definition=FX.byId(picker.value);
      if(!layer||!definition)return;
      if(layer.fxStack.length>=Composition.MAX_LAYER_FX){notify('Ebben a részben legfeljebb három réteg FX adható hozzá.',true);return;}
      const stack=[...layer.fxStack,{id:definition.id,wet:1,strength:1,disabled:false}];
      layerFxSelected=stack.length-1;commitLayerFX(stack);
    });
    $('vj-lfx-bypass').addEventListener('click',()=>{
      const layer=selectedLayerEffects();if(!layer)return;
      commitLayerFX(undefined,!layer.fxBypass);
    });
    for(const key of ['wet','strength']){
      $('vj-lfx-'+key).addEventListener('input',()=>{
        if(!selectedLayerFXEntry())return;
        changeLayerFX(layerFxSelected,{[key]:Number($('vj-lfx-'+key).value)/100});
      });
    }
    refreshLayerFX();
  }
  function selectedFX(){
    const clip=selectedCell().clip;
    return clip?.fxStack?.[clipFxSelected]||null;
  }
  function refreshClipFX(){
    const {row,slot,clip}=selectedCell();
    const stack=clip?.fxStack||[];
    $('vj-cfx-target').textContent='Layer '+(row+1)+' · Clip '+(slot+1)+(clip?' · '+SOURCE_NAMES[clip.source]:' · üres');
    $('vj-cfx-count').textContent=stack.length+'/'+Composition.MAX_CLIP_FX;
    $('vj-cfx-library').disabled=!clip;
    $('vj-cfx-add').disabled=!clip||stack.length>=Composition.MAX_CLIP_FX;
    $('vj-cfx-bypass').disabled=!clip;
    $('vj-cfx-bypass').textContent=clip?.fxBypass?'FX kikapcsolva':'FX bekapcsolva';
    $('vj-cfx-bypass').setAttribute('aria-pressed',String(!!clip?.fxBypass));
    $('vj-cfx-bypass').classList.toggle('off',!!clip?.fxBypass);
    const list=$('vj-cfx-stack');list.replaceChildren();
    if(!clip){list.textContent='Válassz egy klipet a rácsban.';}
    else if(!stack.length){list.textContent='Még nincs hozzáadott effekt.';}
    if(clipFxSelected>=stack.length)clipFxSelected=Math.max(0,stack.length-1);
    for(let index=0;index<stack.length;index++){
      const entry=stack[index],definition=FX.byId(entry.id);
      if(!definition)continue;
      const rowElement=document.createElement('div');rowElement.className='vj-cfx-item'+(index===clipFxSelected?' selected':'');
      const choose=fxButton(definition.name,'vj-cfx-name'+(entry.disabled?' disabled':''),()=>{clipFxSelected=index;refreshClipFX();});
      const toggle=fxButton(entry.disabled?'○':'●','',()=>changeClipFX(index,{disabled:!entry.disabled}));
      toggle.title=entry.disabled?'Effekt bekapcsolása':'Effekt kikapcsolása';
      const up=fxButton('↑','',()=>moveClipFX(index,-1));up.disabled=index===0;
      const down=fxButton('↓','',()=>moveClipFX(index,1));down.disabled=index===stack.length-1;
      const remove=fxButton('✕','',()=>removeClipFX(index));
      rowElement.append(choose,toggle,up,down,remove);list.append(rowElement);
    }
    const selected=selectedFX();
    for(const [key,unit] of [['wet',1],['strength',2]]){
      const el=$('vj-cfx-'+key);
      el.disabled=!selected;
      el.value=selected?Math.round(selected[key]*100):100;
      $('vj-cfx-'+key+'-value').textContent=el.value+'%';
    }
  }
  function commitClipFX(stack,bypass){
    const {row,slot,clip}=selectedCell();if(!clip)return;
    settings.composition=Composition.setClipEffects(settings.composition,row,slot,stack,bypass);
    refreshClipFX();persist();
  }
  function changeClipFX(index,patch){
    const clip=selectedCell().clip;if(!clip||!clip.fxStack[index])return;
    const stack=clip.fxStack.map(x=>({...x}));
    stack[index]={...stack[index],...patch};
    commitClipFX(stack);
  }
  function moveClipFX(index,offset){
    const clip=selectedCell().clip;
    if(!clip||index+offset<0||index+offset>=clip.fxStack.length)return;
    const next=clip.fxStack.map(x=>({...x}));
    [next[index],next[index+offset]]=[next[index+offset],next[index]];
    clipFxSelected=index+offset;commitClipFX(next);
  }
  function removeClipFX(index){
    const clip=selectedCell().clip;if(!clip)return;
    const next=clip.fxStack.map(x=>({...x}));next.splice(index,1);
    clipFxSelected=Math.min(clipFxSelected,next.length-1);
    commitClipFX(next);
  }
  function bindClipFX(){
    const selector=$('vj-cfx-library');
    for(const category of [...new Set(FX.LIBRARY.map(x=>x.category))]){
      const group=document.createElement('optgroup');group.label=category;
      for(const entry of FX.LIBRARY.filter(x=>x.category===category)){
        const opt=document.createElement('option');opt.value=entry.id;opt.textContent=entry.name;
        group.append(opt);
      }
      selector.append(group);
    }
    $('vj-cfx-add').addEventListener('click',()=>{
      const clip=selectedCell().clip,definition=FX.byId(selector.value);
      if(!clip||!definition)return;
      if(clip.fxStack.length>=Composition.MAX_CLIP_FX){notify('Legfeljebb három klip FX használható ebben a részben.',true);return;}
      const stack=[...clip.fxStack,{id:definition.id,wet:1,strength:1,disabled:false}];
      clipFxSelected=stack.length-1;commitClipFX(stack);
    });
    $('vj-cfx-bypass').addEventListener('click',()=>{
      const clip=selectedCell().clip;if(!clip)return;
      commitClipFX(undefined,!clip.fxBypass);
    });
    for(const key of ['wet','strength']){
      const slider=$('vj-cfx-'+key);
      slider.addEventListener('input',()=>{
        if(!selectedFX())return;
        changeClipFX(clipFxSelected,{[key]:Number(slider.value)/100});
      });
    }
    refreshClipFX();
  }
  function makeLayerFX(index){
    const source=document.createElement('canvas');
    const sourceCtx=source.getContext('2d');
    const output=document.createElement('canvas');
    if(!sourceCtx)throw new Error('Canvas 2D nem érhető el.');
    const processor=FX.renderer(output);
    if(!processor)throw new Error('WebGL2 nem érhető el.');
    return {source,sourceCtx,output,processor};
  }
  function prepareLayerFX(index){
    if(layerFxFailed.has(index))return null;
    try{
      let buffer=layerFxCache[index];
      if(!buffer)buffer=layerFxCache[index]=makeLayerFX(index);
      if(buffer.source.width!==UI.canvas.width||buffer.source.height!==UI.canvas.height){
        buffer.source.width=UI.canvas.width;buffer.source.height=UI.canvas.height;
      }
      buffer.sourceCtx.setTransform(dpr,0,0,dpr,0,0);
      buffer.sourceCtx.clearRect(0,0,sceneWidth,sceneHeight);
      return buffer;
    }catch(e){
      layerFxFailed.add(index);
      notify('Klip FX nem érhető el a '+(index+1)+'. rétegen: '+e.message,true);
      return null;
    }
  }
  function renderClipGrid(){
    const root=$('clip-grid'),composition=settings.composition;
    root.replaceChildren();
    const scenes=document.createElement('div');scenes.className='vj-scene-row';
    const header=document.createElement('span');header.textContent='SCENES →';header.className='vj-scene-label';scenes.append(header);
    for(let slot=0;slot<Composition.COLUMNS;slot++){
      const btn=document.createElement('button');
      btn.type='button';btn.className='vj-scene-trigger'+(waitingScene?.slot===slot?' pending':'');
      btn.dataset.scene=String(slot);btn.textContent='▶ '+(slot+1);
      btn.title='Scene '+(slot+1)+': az ebben az oszlopban lévő klipek indítása egyszerre';
      btn.setAttribute('aria-label','Scene '+(slot+1)+' indítása');
      btn.addEventListener('click',()=>scheduleScene(slot));
      scenes.append(btn);
    }
    root.append(scenes);
    for(let rowIndex=0;rowIndex<Composition.ROWS;rowIndex++){
      const layer=composition.layers[rowIndex];
      const row=document.createElement('div');
      row.className='vj-layer-row'+(rowIndex===composition.selectedLayer?' selected':'');
      const header=document.createElement('div');header.className='vj-layer-header';
      const select=document.createElement('button');select.type='button';select.className='vj-layer-select';
      select.textContent=layer.name;select.title='Réteg kiválasztása';
      select.addEventListener('click',()=>{
        settings.composition=Composition.selectLayer(settings.composition,rowIndex);
        renderClipGrid();persist();
      });
      const mute=document.createElement('button');mute.type='button';
      mute.className='vj-layer-tool'+(layer.muted?' on':'');
      mute.textContent='M';mute.title='Mute – réteg kikapcsolása';
      mute.setAttribute('aria-label',layer.name+' némítás');
      mute.setAttribute('aria-pressed',String(layer.muted));
      mute.addEventListener('click',()=>{
        settings.composition=Composition.layerAction(settings.composition,rowIndex,{muted:!layer.muted});
        renderClipGrid();persist();
      });
      const solo=document.createElement('button');solo.type='button';
      solo.className='vj-layer-tool'+(layer.solo?' on':'');
      solo.textContent='S';solo.title='Solo – csak ez a réteg';
      solo.setAttribute('aria-label',layer.name+' Solo');
      solo.setAttribute('aria-pressed',String(layer.solo));
      solo.addEventListener('click',()=>{
        settings.composition=Composition.layerAction(settings.composition,rowIndex,{solo:!layer.solo});
        renderClipGrid();persist();
      });
      const stop=document.createElement('button');stop.type='button';
      stop.className='vj-layer-tool stop';stop.textContent='■';
      stop.title='Réteg leállítása';
      stop.setAttribute('aria-label',layer.name+' leállítása');
      stop.addEventListener('click',()=>{
        cancelPendingLayer(rowIndex);
        settings.composition=Composition.stop(settings.composition,rowIndex);
        renderClipGrid();setSourceLabel();persist();
      });
      const opacity=document.createElement('input');opacity.type='range';
      opacity.min=0;opacity.max=100;opacity.step=5;opacity.value=Math.round(layer.opacity*100);
      opacity.className='vj-layer-opacity';
      opacity.title='Réteg átlátszósága: '+opacity.value+'%';
      opacity.setAttribute('aria-label',layer.name+' átlátszósága');
      opacity.addEventListener('input',()=>{
        settings.composition=Composition.layerAction(settings.composition,rowIndex,{opacity:Number(opacity.value)/100});
        opacity.title='Réteg átlátszósága: '+opacity.value+'%';
        if(settings.composition.selectedLayer===rowIndex)refreshLayerMixer();
        persist();
      });
      header.append(select,mute,solo,stop,opacity);row.append(header);
      for(let slot=0;slot<Composition.COLUMNS;slot++){
        const clip=layer.clips[slot];
        const cell=document.createElement('button');cell.type='button';
        cell.className='vj-clip'+(clip?' populated':'')+(clip?.source==='media'?' media-clip':'')+(layer.activeSlot===slot?' playing':'')+(composition.selectedLayer===rowIndex&&composition.selectedSlot===slot?' selected':'')+((waitingClips.get(rowIndex)?.slot===slot||(waitingScene?.slot===slot&&Boolean(clip)))?' pending':'');
        cell.draggable=Boolean(clip);
        cell.dataset.row=String(rowIndex);cell.dataset.slot=String(slot);
        const label=clip?(clip.mediaName||SOURCE_NAMES[clip.source]):'＋';
        cell.textContent=label;
        cell.title=clip?'Indítás: '+label:'Hozzáadás és indítás: '+SOURCE_NAMES[$('clip-source-picker').value];
        cell.setAttribute('aria-label',layer.name+' / '+(slot+1)+'. klip / '+label);
        cell.addEventListener('contextmenu',e=>openClipMenu(e,rowIndex,slot));
        cell.addEventListener('dragstart',e=>{
          if(!clip){e.preventDefault();return;}
          draggedClip={row:rowIndex,slot};
          e.dataTransfer.effectAllowed='move';
          e.dataTransfer.setData('text/plain','beatscope-clip');
        });
        cell.addEventListener('dragend',()=>{draggedClip=null;});
        cell.addEventListener('dragover',e=>{
          if(!draggedClip)return;
          e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';
        });
        cell.addEventListener('drop',e=>{
          if(!draggedClip)return;
          e.preventDefault();e.stopPropagation();
          const from=draggedClip;draggedClip=null;
          cancelPendingLayer(from.row);cancelPendingLayer(rowIndex);
          settings.composition=Composition.moveClip(settings.composition,from.row,from.slot,rowIndex,slot);
          renderClipGrid();setSourceLabel();persist();
        });
        cell.addEventListener('click',()=>{
          if(!clip)settings.composition=Composition.putClip(settings.composition,rowIndex,slot,$('clip-source-picker').value);
          scheduleClip(rowIndex,slot);
        });
        row.append(cell);
      }
      root.append(row);
    }
    refreshClipParams();refreshClipFX();refreshLayerFX();refreshLayerMixer();updateClipToolbar();syncMediaPlayers();refreshVideoTransport();
  }
  function setSourceLabel(){
    const active=(sourceMode==='mic'&&!!micStream)||(sourceMode==='file'&&!UI.audio.paused&&!UI.audio.ended);
    UI.titleLed.classList.toggle('on',active);UI.liveDot.classList.toggle('on',active);
    UI.placeholder.style.display=(active||Composition.activeLayers(settings.composition).length>0)?'none':'';
    UI.title.textContent=active?(sourceMode==='mic'?'Élő mikrofon':'Lejátszás folyamatban'):(Composition.activeLayers(settings.composition).length?'Vizuál aktív · hangforrás nélkül':(sourceMode==='file'?'Zenefájl betöltve':'Nincs hangforrás'));
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
    if(!Composition.SOURCES.includes(next))return;
    if(!automatic&&settings.aiEnabled)setAI(false);
    if(settings.mode!==next)modeTransition={from:settings.mode,startedAt:now};
    settings.mode=next;
    if(!initializing){
      const layerIndex=settings.composition.selectedLayer;
      const layer=settings.composition.layers[layerIndex];
      const slot=layer.activeSlot>=0?layer.activeSlot:0;
      settings.composition=Composition.launch(Composition.putClip(settings.composition,layerIndex,slot,next),layerIndex,slot);
      renderClipGrid();
    }
    for(const btn of document.querySelectorAll('[data-mode]'))btn.classList.toggle('active',btn.dataset.mode===next);
    UI.modeLabel.textContent=({bars:'SPECTRUM / REAL TIME',wave:'WAVEFORM / OSCILLOSCOPE',orbit:'ORBIT / RADIAL SPECTRUM',particles:'PARTICLES / AUDIO REACTIVE'}[next]||SOURCE_NAMES[next].toUpperCase()+' / GENERATOR');
    if(automatic)updateAIDisplay('Automatikus váltás aktív',reason||'Hang alapján új effekt');
    persist();
  }
  function setPalette(p){if(!presetColors[p])return;
    settings.palette=p;document.querySelectorAll('[data-palette]').forEach(b=>b.classList.toggle('selected',b.dataset.palette===p));persist();
  }
  function renderMode(mode,t,layer){
    switch(mode){case 'media':drawImportedMedia(layer);break;case 'bars':drawBars(t);break;case 'wave':drawWave(t);break;case 'orbit':drawOrbit(t);break;case 'particles':drawParticles(t);break;
      default:{
        const props={width:sceneWidth,height:sceneHeight,time:t,bass:freq.bass,mids:freq.mids,highs:freq.highs,rms,intensity:settings.intensity,color:paletteColor};
        if(!Generators.draw(mode,ctx,props))ExtraGenerators.draw(mode,ctx,props);
        break;
      }
    }
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
    if(waitingCount())flushQueued(t);
    if(t-lastTempoRefresh>90){lastTempoRefresh=t;refreshTempoUI(t);}
    const active=(sourceMode==='mic'&&!!micStream)||(sourceMode==='file'&&!UI.audio.paused&&!UI.audio.ended);
    const hasVisuals=Composition.activeLayers(settings.composition).length>0;
    if(!active&&t-lastFrame<(hasVisuals?33:85))return;
    lastFrame=t;
    if(t-videoClockUpdated>170){videoClockUpdated=t;updateVideoClock();}
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
    // Layer 8 is at the bottom, Layer 1 at the top.
    for(const layer of Composition.activeLayers(settings.composition)){
      const p=Composition.sanitizeParams(layer.params);
      const chain=layer.fxBypass?[]:(layer.fxStack||[]).filter(fx=>!fx.disabled);
      const layerChain=layer.layerFxBypass?[]:(layer.layerFxStack||[]).filter(fx=>!fx.disabled);
      const buffer=(chain.length||layerChain.length)?prepareLayerFX(layer.index):null;
      const originalCtx=ctx;
      const oldFreq=freq,oldBins=bins,oldWave=wave;
      let saved=false;
      try{
        if(buffer)ctx=buffer.sourceCtx;
        if(p.audio!==1){
          freq={...freq,bass:Math.min(1,freq.bass*p.audio),mids:Math.min(1,freq.mids*p.audio),
            highs:Math.min(1,freq.highs*p.audio),total:Math.min(1,freq.total*p.audio)};
          if(layer.source==='bars')
            bins=Uint8Array.from(oldBins,v=>Math.round(Math.min(255,v*p.audio)));
          if(layer.source==='wave')
            wave=Uint8Array.from(oldWave,v=>Math.max(0,Math.min(255,128+(v-128)*p.audio)));
        }
        ctx.save();saved=true;
        ctx.globalAlpha=buffer?1:layer.opacity;
        ctx.globalCompositeOperation=buffer?'source-over':Composition.canvasBlendMode(layer.blendMode);
        ctx.translate(sceneWidth*.5,sceneHeight*.5);
        ctx.rotate(p.rotation*Math.PI/180);
        ctx.scale(p.scale,p.scale);
        ctx.translate(-sceneWidth*.5,-sceneHeight*.5);
        renderMode(layer.source,t*p.speed,layer);
        ctx.restore();saved=false;
        if(buffer){
          ctx=originalCtx;
          let drawable=buffer.source;
          try{
            if(chain.length&&buffer.processor.draw(drawable,chain,t,{...freq,rms}))
              drawable=buffer.output;
            if(layerChain.length){
              // Apply layer FX after this clip's FX, and before the global composition FX.
              // A second processor is only needed when both effect stages are active.
              let processor=buffer.processor,output=buffer.output;
              if(chain.length){
                if(!buffer.layerProcessor){
                  buffer.layerOutput=document.createElement('canvas');
                  buffer.layerProcessor=FX.renderer(buffer.layerOutput);
                  if(!buffer.layerProcessor)throw new Error('Nem hozható létre a layer WebGL2 processzor.');
                }
                processor=buffer.layerProcessor;output=buffer.layerOutput;
              }
              if(processor.draw(drawable,layerChain,t,{...freq,rms}))
                drawable=output;
            }
          }catch(e){
            layerFxFailed.add(layer.index);
            notify('Réteg vagy klip FX rajzolási hiba a '+(layer.index+1)+'. rétegen: '+e.message,true);
          }
          ctx.save();
          ctx.globalAlpha=layer.opacity;ctx.globalCompositeOperation=Composition.canvasBlendMode(layer.blendMode);
          ctx.drawImage(drawable,0,0,sceneWidth,sceneHeight);
          ctx.restore();
        }
      }finally{
        if(saved)ctx.restore();
        ctx=originalCtx;freq=oldFreq;bins=oldBins;wave=oldWave;
      }
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
    bindTempo();
    $('vj-import-media').addEventListener('click',importClipMedia);
    for(const action of ['copy','cut','paste','duplicate','delete']){
      $('vj-'+action).addEventListener('click',()=>editClip(action));
    }
    for(const btn of document.querySelectorAll('#vj-clip-menu [data-clip-action]'))
      btn.addEventListener('click',()=>editClip(btn.dataset.clipAction));
    window.addEventListener('pointerdown',e=>{
      const menu=$('vj-clip-menu');
      if(!menu.hidden&&!menu.contains(e.target))menu.hidden=true;
    });

    bindClipParams();
    bindVideoTransport();
    bindClipFX();
    bindLayerFX();
    bindLayerMixer();
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
      const typing=e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement;
      if(!typing&&e.ctrlKey&&!e.altKey&&!e.shiftKey&&['c','v','x','d'].includes(e.key.toLowerCase())){
        e.preventDefault();editClip({c:'copy',v:'paste',x:'cut',d:'duplicate'}[e.key.toLowerCase()]);return;
      }
      if(!typing&&e.key==='Delete'){e.preventDefault();editClip('delete');return;}
      if(e.key==='Escape'&&!$('vj-clip-menu').hidden){$('vj-clip-menu').hidden=true;return;}
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
    window.addEventListener('beforeunload',()=>{stopMic();if(fileURL)URL.revokeObjectURL(fileURL);for(const item of mediaPlayers.values())stopMediaPlayer(item);mediaPlayers.clear();});
    window.addEventListener('resize',sizeCanvas);
  }
  async function init(){
    bind();
    try{Object.assign(settings,await window.beatAPI.loadPreferences());}catch{}
    settings.fxStack=Array.isArray(settings.fxStack)?settings.fxStack:[];
    settings.fxFavorites=Array.isArray(settings.fxFavorites)?settings.fxFavorites:[];
    settings.composition=Composition.normalize(settings.composition);
    settings.bpm=tempoClock.setBpm(settings.bpm,performance.now());
    settings.quantize=tempoClock.setQuantize(settings.quantize);
    refreshTempoUI();
    renderClipGrid();
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
    initializing=false;
    sizeCanvas();setSourceLabel();requestAnimationFrame(animate);
  }
  init();
})();