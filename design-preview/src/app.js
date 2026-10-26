'use strict';
(()=> {
 const Model=window.LuminaModules;
 const $=id=>document.getElementById(id);
 const state={module:'dashboard',history:[],mode:'pro',aiTab:0,category:'Mind',search:'',color:'#00c8e8',intensity:72,speed:64,hue:28,frame:0};
 const categories=['Mind',...new Set(Model.visuals.map(v=>v.category))];
 const placeholder=Model.PLACEHOLDER;
 let toastTimer=0;
 function el(tag,attributes={},content=''){
   const e=document.createElement(tag);
   for(const [k,v] of Object.entries(attributes)){
     if(k==='class')e.className=v;
     else if(k==='data-action')e.dataset.action=v;
     else if(k==='data-module')e.dataset.module=v;
     else if(k==='data-tab')e.dataset.tab=v;
     else if(k==='data-category')e.dataset.category=v;
     else if(k==='data-visual')e.dataset.visual=v;
     else e.setAttribute(k,v);
   }
   if(content!==undefined)e.textContent=content;
   return e;
 }
 function toast(action=''){
   $('toast-text').textContent=placeholder;
   $('toast').hidden=false;
   clearTimeout(toastTimer);
   toastTimer=setTimeout(()=>$('toast').hidden=true,4600);
 }
 $('toast-close').addEventListener('click',()=>{$('toast').hidden=true;clearTimeout(toastTimer);});
 function moduleOf(id){return Model.modules.find(m=>m.id===id)||Model.modules[0];}
 function navigate(id,remember=true){
   const module=moduleOf(id);
   if(module.id!==id)return false;
   if(remember&&state.module!==id)state.history.push(state.module);
   state.module=id;
   state.category='Mind';state.search='';
   render();
   $('main').scrollTop=0;
   return true;
 }
 function back(){
   if(state.history.length)navigate(state.history.pop(),false);
   else navigate('dashboard',false);
 }
 $('go-back').addEventListener('click',back);
 function setMode(mode){
   state.mode=mode==='simple'?'simple':'pro';
   $('simple-mode').classList.toggle('active',state.mode==='simple');
   $('pro-mode').classList.toggle('active',state.mode==='pro');
   $('app').dataset.mode=state.mode;
   navigate(state.mode==='simple'?'simple':'studio');
 }
 $('simple-mode').addEventListener('click',()=>setMode('simple'));
 $('pro-mode').addEventListener('click',()=>setMode('pro'));
 $('fullscreen').addEventListener('click',()=>{
   if(window.luminaBridge?.toggleFullscreen)window.luminaBridge.toggleFullscreen();
   else if(document.fullscreenElement)document.exitFullscreen?.();
   else document.documentElement.requestFullscreen?.().catch(()=>toast());
 });
 function renderNavigation(){
   const nav=$('main-nav');nav.replaceChildren();
   for(const mod of Model.modules){
     const b=el('button',{type:'button',class:'nav-item'+(state.module===mod.id?' active':''),'data-module':mod.id,'aria-current':state.module===mod.id?'page':'false',title:mod.name});
     b.append(el('span',{class:'nav-icon','aria-hidden':'true'},mod.icon),el('span',{class:'nav-text'},mod.name),el('span',{class:'nav-chevron','aria-hidden':'true'},'›'));
     b.addEventListener('click',()=>navigate(mod.id));
     nav.append(b);
   }
 }
 function appendSection(parent,title,subtitle){
   const header=el('div',{class:'content-heading'});
   header.append(el('strong',{},title),el('small',{},subtitle));
   parent.append(header);
 }
 function actionButton(name,cls=''){
   return el('button',{type:'button',class:cls,'data-action':name},name);
 }
 function features(parent,module){
   appendSection(parent,'MODULE FEATURES','DESIGN SPEC / '+String(module.features.length).padStart(2,'0'));
   const grid=el('div',{class:'feature-grid'});
   for(const [i,name] of module.features.entries()){
     const btn=el('button',{class:'feature-tile','data-action':name,type:'button'});
     btn.append(el('span',{},name),el('span',{},'0'+(i+1)+' / PLANNED →'));
     grid.append(btn);
   }
   parent.append(grid);
 }
 function drawDashboard(parent){
   appendSection(parent,'CONTROL CENTER','SYSTEM / MOCK DATA');
   const quick=el('div',{class:'quick-grid'});
   for(const [n,label] of [['01','AKTÍV PROJEKT'],['30','VIZUÁLTERV'],['120','FX REFERENCIA'],['OFF','CORE KAPCSOLAT']]){
     const b=el('button',{class:'quick-card','data-action':label,type:'button'});
     b.append(el('b',{},n),el('span',{},label));quick.append(b);
   }
   parent.append(quick);
 }
 function drawLibrary(parent){
   appendSection(parent,'VISUAL COLLECTION','30 CONCEPTS / NOT IMPLEMENTED');
   const row=el('div',{class:'filter-row'});
   const input=el('input',{type:'search',placeholder:'Vizuál keresése...',id:'visual-search','aria-label':'Vizuál keresése'});
   input.value=state.search;
   input.addEventListener('input',e=>{state.search=e.target.value;drawVisualResults();});
   row.append(input);parent.append(row);
   const tabs=el('div',{class:'category-tabs'});
   for(const category of categories){
     const b=el('button',{type:'button','data-category':category,class:category===state.category?'selected':''},category);
     b.addEventListener('click',()=>{state.category=category;tabs.querySelectorAll('button').forEach(x=>x.classList.toggle('selected',x.dataset.category===category));drawVisualResults();});
     tabs.append(b);
   }
   parent.append(tabs);
   parent.append(el('div',{id:'visual-results',class:'visual-grid'}));
   drawVisualResults();
 }
 function drawVisualResults(){
   const holder=$('visual-results');if(!holder)return;
   holder.replaceChildren();
   const query=state.search.trim().toLowerCase();
   const list=Model.visuals.filter(v=>(state.category==='Mind'||v.category===state.category)&&(!query||v.name.toLowerCase().includes(query)));
   for(const [i,v] of list.entries()){
     const b=el('button',{type:'button',class:'visual-tile','data-visual':v.id,title:v.name+' – tervezett vizualizáció'});
     const art=el('div',{class:'visual-art'});art.style.setProperty('--art-hue',String((i*42+183)%360));
     b.append(art,el('b',{},v.name),el('small',{},v.category.toUpperCase()+' · CONCEPT'));
     holder.append(b);
   }
   if(!list.length)holder.append(el('p',{class:'muted'},'Nincs találat a keresési feltételekre.'));
 }
 function addField(parent,name,index=0){
   const label=el('label',{class:'module-field'});
   label.append(document.createTextNode(name));
   const low=name.toLowerCase();
   if(/prompt|utasítás|szöveges módosítás|szöveges/.test(low)){
     label.append(el('textarea',{placeholder:'Írd ide az elképzelésed…','aria-label':name}));
   }else if(/sebesség|intenzitás|reakció/.test(low)){
     const range=el('input',{type:'range',min:'0',max:'100',value:String(40+index*18),'aria-label':name});
     range.addEventListener('change',()=>toast());
     label.append(range);
   }else if(/feltöltés/.test(low)){
     label.append(actionButton('FÁJL KIVÁLASZTÁSA','outline-btn'));
   }else if(/stílus|módja|forrásvizuál/.test(low)){
     const select=el('select',{'aria-label':name});
     for(const text of ['Válassz…','Cinematic','Neon','Abstract','Particles'])select.append(el('option',{},text));
     select.addEventListener('change',()=>toast());label.append(select);
   }else{
     label.append(el('input',{type:'text',placeholder:name,'aria-label':name}));
   }
   parent.append(label);
 }
 function drawAI(parent){
   appendSection(parent,'AI CREATOR','THREE WORKFLOWS / INTERACTIVE MOCKUP');
   const tabs=el('div',{class:'ai-tabs','aria-label':'AI-generálási módok'});
   Model.aiWorkflows.forEach((w,i)=>{
     const button=el('button',{type:'button','data-tab':String(i),class:state.aiTab===i?'selected':''},w.name.toUpperCase());
     button.addEventListener('click',()=>{state.aiTab=i;drawContent();});
     tabs.append(button);
   });
   parent.append(tabs);
   const workflow=Model.aiWorkflows[state.aiTab];
   parent.append(el('p',{class:'muted'},workflow.description));
   const form=el('div',{class:'module-form'});workflow.fields.forEach((f,i)=>addField(form,f,i));parent.append(form);
   const acts=el('div',{class:'module-actions'});
   workflow.actions.forEach(a=>acts.append(actionButton(a)));
   parent.append(acts);
   const pending=el('div',{class:'notice'});
   pending.append(el('span',{class:'notice-flag'},'NOT CONNECTED'),el('span',{},'A három AI-mód csak kezelőfelületi terv. Nincs modellhívás, generálás vagy feltöltés.'));
   parent.append(pending);
 }
 function drawStudio(parent){
   appendSection(parent,'LIVE CONTROL DECK','8 LAYERS / 8 SCENES / PREVIEW');
   const grid=el('div',{class:'quick-grid'});
   for(const [title,subtitle] of [['CLIP GRID','8 × 8'],['FX ROUTING','CLIP → LAYER → COMP'],['SCENE DIRECTOR','BPM / AUTO'],['OUTPUT MATRIX','PREVIEW / PROGRAM']]){
     const b=el('button',{type:'button',class:'quick-card','data-action':title});
     b.append(el('b',{},title),el('span',{},subtitle));grid.append(b);
   }
   parent.append(grid);
 }
 function drawSettingsLike(parent,module){
   if(['designer','audio','output','mixer','settings'].includes(module.id)){
     appendSection(parent,'CONTROL PARAMETERS','VISUAL MOCKUP');
     const form=el('div',{class:'module-form'});
     const fields=module.id==='designer'?['Animációk','Sebesség','Intenzitás']:
       module.id==='output'?['Kimeneti felbontás','FPS-beállítás','Második monitor']:
       module.id==='audio'?['Bemeneti érzékenység','BPM-felismerés','Hangfájl']:
       module.id==='mixer'?['Effektlista','Átmenetek','Automatikus effektváltás']:
       ['Nyelv','Megjelenés','Teljesítmény'];
     fields.forEach((name,i)=>addField(form,name,i));
     parent.append(form);
   }
 }
 function drawContent(){
   const parent=$('module-content');parent.replaceChildren();
   const mod=moduleOf(state.module);
   if(mod.id==='dashboard')drawDashboard(parent);
   if(mod.id==='studio')drawStudio(parent);
   if(mod.id==='library')drawLibrary(parent);
   if(mod.id==='ai')drawAI(parent);
   if(mod.id!=='ai'&&mod.id!=='library')drawSettingsLike(parent,mod);
   features(parent,mod);
 }
 function render(){
   const mod=moduleOf(state.module);
   $('module-tag').textContent=mod.tag+' / '+String(Model.modules.indexOf(mod)+1).padStart(2,'0');
   $('module-title').replaceChildren(document.createTextNode(mod.name.toUpperCase()+' '),el('span',{class:'slash'},'//'));
   $('module-description').textContent=mod.description;
   $('inspect-name').textContent=mod.name;
   $('inspect-desc').textContent=mod.description;
   $('go-back').disabled=state.history.length===0;
   renderNavigation();drawContent();
 }
 document.addEventListener('click',e=>{
   const action=e.target.closest('[data-action]'),visual=e.target.closest('[data-visual]');
   if(action||visual)toast(action?.dataset.action||visual?.dataset.visual);
 });
 for(const id of ['intensity','speed','hue']){
   $(id).addEventListener('input',e=>{
     const n=Number(e.target.value);state[id]=n;
     $(id+'-value').textContent=n+'%';
   });
 }
 for(const btn of document.querySelectorAll('[data-color]')){
   btn.addEventListener('click',()=>{
     state.color=btn.dataset.color;
     document.querySelectorAll('[data-color]').forEach(b=>b.classList.toggle('selected',b===btn));
   });
 }
 const canvas=$('visual-canvas'),ctx=canvas.getContext('2d',{alpha:false});
 let width=1,height=1,lastFps=0,fpsTicks=0;
 function resize(){
   const dpr=Math.min(2,window.devicePixelRatio||1),rect=canvas.getBoundingClientRect();
   width=Math.max(1,Math.round(rect.width*dpr));height=Math.max(1,Math.round(rect.height*dpr));
   if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
 }
 function paint(time){
   if(!document.hidden){
     resize();
     const t=time*.001*(.2+state.speed/110),amp=state.intensity/100;
     ctx.fillStyle='#020609';ctx.fillRect(0,0,width,height);
     const hue=188+state.hue*.75;
     const cx=width*.5,cy=height*.48;
     const bg=ctx.createRadialGradient(cx,cy,8,cx,cy,width*.65);
     bg.addColorStop(0,'hsla('+hue+',100%,46%,'+(.08+.12*amp)+')');
     bg.addColorStop(1,'transparent');
     ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
     // Perspective grid.
     ctx.strokeStyle='hsla('+hue+',90%,57%,.18)';ctx.lineWidth=Math.max(.5,width/850);
     for(let i=-8;i<=8;i++){
       ctx.beginPath();ctx.moveTo(cx+i*10,cy);ctx.lineTo(cx+i*width*.13,height);ctx.stroke();
     }
     for(let i=1;i<=13;i++){
       const y=cy+(height-cy)*Math.pow(i/13,1.75);
       ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();
     }
     // Pulsating nested polygons.
     const beat=1+.07*amp*Math.sin(t*4.7);
     for(let ring=11;ring>=0;ring--){
       const radius=(36+ring*24)*(width/900)*beat;
       const phase=t*(ring%2?.14:-.09)+ring*.11;
       ctx.beginPath();
       for(let k=0;k<=6;k++){
         const theta=k*Math.PI/3+phase;
         const x=cx+Math.cos(theta)*radius,y=cy+Math.sin(theta)*radius*.68;
         if(k===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
       }
       const a=.05+(.28*(1-ring/13))*amp;
       ctx.strokeStyle='hsla('+hue+',100%,'+(45+ring*2)+'%,'+a+')';
       ctx.lineWidth=Math.max(.5,(width/1000)*(1+ring*.02));
       ctx.stroke();
     }
     // Soft cyan beams.
     for(let i=0;i<16;i++){
       const x=cx+Math.sin(t*.9+i*1.71)*width*.35;
       const y=cy+Math.cos(t*1.4+i*.98)*height*.3;
       const a=.2+.18*Math.sin(t*2+i);
       ctx.strokeStyle='hsla('+(hue+i*2)+',100%,70%,'+a+')';
       ctx.lineWidth=Math.max(.5,(i%3?1:2)*(width/900));
       ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(cx+Math.sin(i)*40,cy+Math.cos(i)*20);ctx.stroke();
     }
     for(let i=0;i<75;i++){
       const x=((i*127.1+t*(11+i%7)*3)%width+width)%width;
       const y=((i*73.7+t*(8+i%11)*2)%height+height)%height;
       ctx.fillStyle='rgba(145,241,250,'+(.12+(i%5)*.055)+')';
       ctx.fillRect(x,y,Math.max(1,width/950),Math.max(1,width/950));
     }
     fpsTicks++;
     if(time-lastFps>2000){$('demo-fps').textContent='ANIMATED DEMO';lastFps=time;fpsTicks=0;}
   }
   requestAnimationFrame(paint);
 }
 window.addEventListener('resize',resize);
 render();requestAnimationFrame(paint);
 window.__luminaPreview={getModule:()=>state.module,getMode:()=>state.mode,moduleCount:()=>Model.modules.length,visualCount:()=>Model.visuals.length,toastMessage:()=>$('toast-text').textContent};
})();
