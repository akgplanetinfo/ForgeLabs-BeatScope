'use strict';
// Runs in Electron, on the GitHub-hosted Windows machine.
// Verifies real renderer initialization, actual UI clicks, and all FX shader variants.
const {app,BrowserWindow}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');
const smokeProfile=fs.mkdtempSync(path.join(os.tmpdir(),'beatscope-smoke-'));
app.setPath('userData',smokeProfile);
require('../src/main.cjs'); // Test real production IPC handlers and durable preference storage.
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
let failed=false;
const details=[];
function fail(msg){details.push('FAIL: '+msg);failed=true;}
async function run(){
 const win=new BrowserWindow({show:false,width:1470,height:890,webPreferences:{preload:path.join(__dirname,'../src/preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true,backgroundThrottling:false}});
 win.webContents.on('console-message',(_event,level,message)=>{if(level>=3)details.push('RENDERER: '+message.slice(0,700));});
 win.webContents.on('render-process-gone',(_e,d)=>fail('Renderer crashed: '+JSON.stringify(d)));
 await win.loadFile(path.join(__dirname,'../index.html'));
 await new Promise(resolve=>setTimeout(resolve,1200));
 const state=await win.webContents.executeJavaScript(`(async()=>{
   const out={};
   out.canvas=Boolean(document.querySelector('#visualizer'));
   out.uiReady=Boolean(document.querySelector('#fx-browser-open'));
   out.library=window.BeatFX?.LIBRARY?.length??-1;
   out.director=Boolean(window.BeatDirector);
   out.errors=[];
   try {
     out.gridRows=document.querySelectorAll('.vj-layer-row').length;
     out.clipCells=document.querySelectorAll('.vj-clip').length;
     document.querySelectorAll('.vj-layer-row')[0]?.querySelectorAll('.vj-clip')[2]?.click();
     out.layer1ClipStarted=Boolean(document.querySelectorAll('.vj-layer-row')[0]?.querySelectorAll('.vj-clip')[2]?.classList.contains('playing'));
     document.querySelectorAll('.vj-layer-row')[1]?.querySelectorAll('.vj-clip')[0]?.click();
     out.layer2ClipStarted=Boolean(document.querySelectorAll('.vj-layer-row')[1]?.querySelectorAll('.vj-clip')[0]?.classList.contains('playing'));
     document.querySelectorAll('.vj-layer-row')[1]?.querySelector('button[aria-label$="némítás"]')?.click();
     out.muteToggled=document.querySelectorAll('.vj-layer-row')[1]?.querySelector('button[aria-label$="némítás"]')?.getAttribute('aria-pressed')==='true';
     document.querySelectorAll('.vj-layer-row')[1]?.querySelector('button[aria-label$="Solo"]')?.click();
     out.soloToggled=document.querySelectorAll('.vj-layer-row')[1]?.querySelector('button[aria-label$="Solo"]')?.getAttribute('aria-pressed')==='true';

     out.generatorOptions=[...document.querySelectorAll('#clip-source-picker option')].map(o=>o.value);
     out.generatorCount=window.BeatGenerators?.IDS?.length??0;
     out.extraGeneratorCount=window.BeatExtraGenerators?.IDS?.length??0;
     out.newGeneratorsDrawn=[];
     out.generatorHashes=[];
     for(const source of window.BeatGenerators.IDS){
       const canvas=document.createElement('canvas');canvas.width=420;canvas.height=240;
       const context=canvas.getContext('2d',{willReadFrequently:true});
       context.fillStyle='#091626';context.fillRect(0,0,canvas.width,canvas.height);
       const result=window.BeatGenerators.draw(source,context,{
         width:420,height:240,time:4200,bass:.4,mids:.3,highs:.2,rms:.2,intensity:1.15,
         color:(i,n,a=1)=>'rgba('+[80,190,245].map((c,k)=>k===i%3?Math.min(255,c+7*i):c).join(',')+','+a+')'
       });
       const pixels=context.getImageData(0,0,420,240).data;
       let differences=0,hash=2166136261;
       for(let i=0;i<pixels.length;i+=32){
         differences+=pixels[i]!==9||pixels[i+1]!==22||pixels[i+2]!==38?1:0;
         hash=Math.imul(hash^pixels[i],16777619);
         hash=Math.imul(hash^pixels[i+1],16777619);
       }
       out.newGeneratorsDrawn.push(Boolean(result)&&differences>20);
       out.generatorHashes.push(hash>>>0);
     }
     out.newGridSources=[];
     for(const [i,source] of window.BeatGenerators.IDS.entries()){
       const picker=document.getElementById('clip-source-picker');
       picker.value=source;
       const row=document.querySelectorAll('.vj-layer-row')[i+2];
       row.querySelectorAll('.vj-clip')[5].click();
       const newRow=document.querySelectorAll('.vj-layer-row')[i+2];
       const cell=newRow.querySelectorAll('.vj-clip')[5];
       out.newGridSources.push(cell?.classList.contains('playing')&&cell.textContent===window.BeatGenerators.NAMES[source]);
     }

     out.extraGeneratorsDrawn=[];
     out.extraGeneratorHashes=[];
     for(const source of window.BeatExtraGenerators.IDS){
       const canv=document.createElement('canvas');canv.width=420;canv.height=240;
       const context=canv.getContext('2d',{willReadFrequently:true});
       context.fillStyle='#091626';context.fillRect(0,0,420,240);
       const drawn=window.BeatExtraGenerators.draw(source,context,{
         width:420,height:240,time:4150,bass:.43,mids:.31,highs:.22,intensity:1.1,
         color:(i,n,a=1)=>'rgba('+[80,190,245].map((v,k)=>k===i%3?Math.min(255,v+7*i):v).join(',')+','+a+')'
       });
       const img=context.getImageData(0,0,420,240).data;
       let changed=0,hash=2166136261;
       for(let i=0;i<img.length;i+=32){
         if(img[i]!==9||img[i+1]!==22||img[i+2]!==38)changed++;
         hash=Math.imul(hash^img[i],16777619);
         hash=Math.imul(hash^img[i+1],16777619);
       }
       out.extraGeneratorsDrawn.push(Boolean(drawn)&&changed>20);
       out.extraGeneratorHashes.push(hash>>>0);
     }
     out.extraGridSources=[];
     for(const [i,source] of window.BeatExtraGenerators.IDS.entries()){
       document.getElementById('clip-source-picker').value=source;
       document.querySelectorAll('.vj-layer-row')[i+2].querySelectorAll('.vj-clip')[6].click();
       const newRow=document.querySelectorAll('.vj-layer-row')[i+2];
       const cell=newRow.querySelectorAll('.vj-clip')[6];
       out.extraGridSources.push(cell?.classList.contains('playing')&&cell.textContent===window.BeatExtraGenerators.NAMES[source]);
     }
     // Two different clips must retain distinct parameters and be saved to Electron settings.
     document.querySelectorAll('.vj-layer-row')[2].querySelectorAll('.vj-clip')[6].click();
     const speed=document.getElementById('vj-speed');
     speed.value='260';speed.dispatchEvent(new Event('input',{bubbles:true}));
     const scale=document.getElementById('vj-scale');
     scale.value='155';scale.dispatchEvent(new Event('input',{bubbles:true}));
     const rotation=document.getElementById('vj-rotation');
     rotation.value='-75';rotation.dispatchEvent(new Event('input',{bubbles:true}));
     const audio=document.getElementById('vj-audio');
     audio.value='40';audio.dispatchEvent(new Event('input',{bubbles:true}));
     document.querySelectorAll('.vj-layer-row')[3].querySelectorAll('.vj-clip')[6].click();
     out.otherClipDefault=document.getElementById('vj-speed').value==='100'&&document.getElementById('vj-audio').value==='100';
     speed.value='65';speed.dispatchEvent(new Event('input',{bubbles:true}));
     document.querySelectorAll('.vj-layer-row')[2].querySelectorAll('.vj-clip')[6].click();
     out.paramsRestored=Number(document.getElementById('vj-speed').value)===260
       &&Number(document.getElementById('vj-scale').value)===155
       &&Number(document.getElementById('vj-rotation').value)===-75
       &&Number(document.getElementById('vj-audio').value)===40;
     await new Promise(resolve=>setTimeout(resolve,550));
     const prefs=await window.beatAPI.loadPreferences();
     out.paramsSaved=prefs?.composition?.layers?.[2]?.clips?.[6]?.params?.speed===2.6
       &&prefs?.composition?.layers?.[3]?.clips?.[6]?.params?.speed===.65;
     document.getElementById('vj-reset').click();
     out.paramsReset=document.getElementById('vj-speed').value==='100'&&document.getElementById('vj-rotation').value==='0';

     // Clip editing and scene launch: exercise actual Electron buttons and persisted parameters.
     document.querySelectorAll('.vj-layer-row')[2].querySelectorAll('.vj-clip')[6].click();
     const sceneBefore=document.querySelectorAll('.vj-scene-trigger').length;
     const speedBefore=document.getElementById('vj-speed').value;
     document.getElementById('vj-copy').click();
     document.querySelectorAll('.vj-layer-row')[0].querySelectorAll('.vj-clip')[7].dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:40,clientY:80}));
     out.contextMenuOpen=!document.getElementById('vj-clip-menu').hidden;
     document.getElementById('vj-paste').click();
     out.pastedClip=document.querySelectorAll('.vj-layer-row')[0].querySelectorAll('.vj-clip')[7].textContent==='Hex Matrix';
     out.pastedParams=document.getElementById('vj-speed').value===speedBefore;
     document.getElementById('vj-duplicate').click();
     out.duplicateCreated=document.querySelectorAll('.vj-layer-row')[0].querySelectorAll('.vj-clip')[4].textContent==='Hex Matrix';
     document.getElementById('vj-delete').click();
     out.deleteWorked=document.querySelectorAll('.vj-layer-row')[0].querySelectorAll('.vj-clip')[4].textContent==='＋';
     document.querySelectorAll('.vj-layer-row')[0].querySelectorAll('.vj-clip')[7].dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:40,clientY:80}));
     document.getElementById('vj-cut').click();
     out.cutWorked=document.querySelectorAll('.vj-layer-row')[0].querySelectorAll('.vj-clip')[7].textContent==='＋';
     document.querySelectorAll('.vj-layer-row')[0].querySelectorAll('.vj-clip')[7].click();
     document.querySelectorAll('.vj-scene-trigger')[7].click();
     out.sceneButtons=sceneBefore===8;
     out.sceneLaunchWorks=Boolean(document.querySelectorAll('.vj-layer-row')[0].querySelectorAll('.vj-clip')[7].classList.contains('playing'));
     await new Promise(resolve=>setTimeout(resolve,460));
     const finalPrefs=await window.beatAPI.loadPreferences();
     out.sceneSaved=finalPrefs?.composition?.selectedSlot===7&&finalPrefs?.composition?.layers?.[0]?.activeSlot===7;

     // Earlier UI tests deliberately enable Mute and Solo. Restore normal layer mixing
     // before checking real-time GPU processing on Layer 3.
     let restoreRow=document.querySelectorAll('.vj-layer-row')[1];
     if(restoreRow.querySelector('button[aria-label$="Solo"]').getAttribute('aria-pressed')==='true')
       restoreRow.querySelector('button[aria-label$="Solo"]').click();
     restoreRow=document.querySelectorAll('.vj-layer-row')[1];
     if(restoreRow.querySelector('button[aria-label$="némítás"]').getAttribute('aria-pressed')==='true')
       restoreRow.querySelector('button[aria-label$="némítás"]').click();
     out.clipFXLayerMixingRestored=
       document.querySelectorAll('.vj-layer-row')[1].querySelector('button[aria-label$="Solo"]').getAttribute('aria-pressed')==='false';
     // Real clip FX: independent per-clip chains, reorder, bypass and GPU processing.
     const realRenderer=window.BeatFX.renderer;
     let clipDrawCalls=0,clipRendererCreated=0;
     window.BeatFX.renderer=function(...args){
       const renderer=realRenderer(...args);
       if(renderer){clipRendererCreated++;const oldDraw=renderer.draw;
         renderer.draw=(...params)=>{clipDrawCalls++;return oldDraw(...params);};
       }
       return renderer;
     };
     out.clipFXLibraryCount=document.querySelectorAll('#vj-cfx-library option').length;
     document.querySelectorAll('.vj-layer-row')[2].querySelectorAll('.vj-clip')[6].click();
     const fxPicker=document.getElementById('vj-cfx-library');
     fxPicker.value='fx-021';document.getElementById('vj-cfx-add').click();
     out.clipFXAdded=document.querySelectorAll('.vj-cfx-item').length===1&&document.getElementById('vj-cfx-count').textContent==='1/3';
     const wetSlider=document.getElementById('vj-cfx-wet');wetSlider.value='35';wetSlider.dispatchEvent(new Event('input',{bubbles:true}));
     const strengthSlider=document.getElementById('vj-cfx-strength');strengthSlider.value='145';strengthSlider.dispatchEvent(new Event('input',{bubbles:true}));
     fxPicker.value='fx-073';document.getElementById('vj-cfx-add').click();
     out.clipFXStackCount=document.querySelectorAll('.vj-cfx-item').length===2;
     document.querySelectorAll('.vj-cfx-item')[1].querySelectorAll('button')[2].click(); // Move second FX up
     out.clipFXReordered=document.querySelectorAll('.vj-cfx-item')[0].textContent.includes('fx')===false
       &&document.querySelectorAll('.vj-cfx-item')[0].textContent.includes(window.BeatFX.byId('fx-073').name);
     document.querySelectorAll('.vj-cfx-item')[0].querySelectorAll('button')[1].click(); // Disable first FX
     out.clipFXDisabled=document.querySelectorAll('.vj-cfx-item')[0].querySelector('.vj-cfx-name').classList.contains('disabled');
     document.getElementById('vj-cfx-bypass').click();
     out.clipFXBypass=document.getElementById('vj-cfx-bypass').getAttribute('aria-pressed')==='true';
     document.getElementById('vj-cfx-bypass').click();
     // Verify the actual composite renderer invokes WebGL GPU processing for the clip.
     await new Promise(resolve=>setTimeout(resolve,1100));
     out.clipFXRendererCreated=clipRendererCreated;
     out.clipFXDrawCount=clipDrawCalls;
     out.clipFXGPU=clipRendererCreated>=1&&clipDrawCalls>=1;
     window.BeatFX.renderer=realRenderer;
     await new Promise(resolve=>setTimeout(resolve,460));
     const clipPrefs=await window.beatAPI.loadPreferences();
     const clipFX=clipPrefs?.composition?.layers?.[2]?.clips?.[6]?.fxStack;
     out.clipFXPersisted=clipFX?.length===2&&clipFX[0].id==='fx-073'&&clipFX[0].disabled===true
       &&clipFX[1].id==='fx-021'&&clipFX[1].wet===.35&&clipFX[1].strength===1.45;
     document.querySelectorAll('.vj-layer-row')[3].querySelectorAll('.vj-clip')[6].click();
     out.clipFXIndependent=document.querySelectorAll('.vj-cfx-item').length===0;
     document.querySelectorAll('.vj-layer-row')[2].querySelectorAll('.vj-clip')[6].click();
     document.querySelectorAll('.vj-cfx-item')[0].querySelectorAll('button')[4].click();
     out.clipFXRemoved=document.querySelectorAll('.vj-cfx-item').length===1;

     // Separate layer FX chain: persist per layer and test GPU order after clip effects.
     out.layerFXLibraryCount=document.querySelectorAll('#vj-lfx-library option').length;
     document.querySelectorAll('.vj-layer-row')[2].querySelector('.vj-layer-select').click();
     const layerFxPicker=document.getElementById('vj-lfx-library');
     const originalLayerRenderer=window.BeatFX.renderer;
     const pipelineCalls=[];
     let layerNewRendererCount=0;
     window.BeatFX.renderer=function(...args){
       const engine=originalLayerRenderer(...args);
       if(engine){
         layerNewRendererCount++;
         const draw=engine.draw;
         engine.draw=(...params)=>{
           pipelineCalls.push({ids:params[1].map(e=>e.id).join('|'),
             inputIsGPU:Boolean(params[0]?.getContext?.('webgl2'))});
           return draw(...params);
         };
       }
       return engine;
     };
     layerFxPicker.value='fx-046';document.getElementById('vj-lfx-add').click();
     out.layerFXAdded=document.querySelectorAll('.vj-layer-effects .vj-cfx-item').length===1
       &&document.getElementById('vj-lfx-count').textContent==='1/3';
     const lwet=document.getElementById('vj-lfx-wet');lwet.value='65';lwet.dispatchEvent(new Event('input',{bubbles:true}));
     const lstrength=document.getElementById('vj-lfx-strength');lstrength.value='150';lstrength.dispatchEvent(new Event('input',{bubbles:true}));
     layerFxPicker.value='fx-077';document.getElementById('vj-lfx-add').click();
     document.querySelectorAll('.vj-layer-effects .vj-cfx-item')[1].querySelectorAll('button')[2].click(); // Move 2nd FX up
     out.layerFXReordered=document.querySelector('.vj-layer-effects .vj-cfx-item')?.textContent.includes(window.BeatFX.byId('fx-077').name);
     document.querySelectorAll('.vj-layer-effects .vj-cfx-item')[0].querySelectorAll('button')[1].click(); // Disable FX 077
     out.layerFXDisabled=document.querySelector('.vj-layer-effects .vj-cfx-name')?.classList.contains('disabled');
     document.getElementById('vj-lfx-bypass').click();
     out.layerFXBypass=document.getElementById('vj-lfx-bypass').getAttribute('aria-pressed')==='true';
     document.getElementById('vj-lfx-bypass').click();
     await new Promise(resolve=>setTimeout(resolve,1100));
     out.layerFXGPU=layerNewRendererCount>=1&&pipelineCalls.some(c=>c.ids==='fx-046');
     // Layer FX must use the clip FX WebGL result as its input, not the unfiltered source.
     out.layerFXOrder=pipelineCalls.some(c=>c.ids==='fx-046'&&c.inputIsGPU);
     window.BeatFX.renderer=originalLayerRenderer;
     await new Promise(resolve=>setTimeout(resolve,520));
     const layerPrefs=await window.beatAPI.loadPreferences();
     const layerFX=layerPrefs?.composition?.layers?.[2]?.fxStack;
     out.layerFXSaved=layerFX?.length===2&&layerFX[0].id==='fx-077'&&layerFX[0].disabled===true
       &&layerFX[1].id==='fx-046'&&layerFX[1].wet===.65&&layerFX[1].strength===1.5;
     document.querySelectorAll('.vj-layer-row')[3].querySelector('.vj-layer-select').click();
     out.layerFXSeparate=document.querySelectorAll('.vj-layer-effects .vj-cfx-item').length===0;
     document.querySelectorAll('.vj-layer-row')[2].querySelector('.vj-layer-select').click();
     document.querySelector('.vj-layer-effects .vj-cfx-item').querySelectorAll('button')[4].click();
     out.layerFXDelete=document.querySelectorAll('.vj-layer-effects .vj-cfx-item').length===1;

     // Live Layer Mixer: verify all Canvas2D blend modes with real output pixels.
     out.mixModes=[...document.querySelectorAll('#vj-blend-mode option')].map(o=>o.value);
     const sampleMix=(mode)=>{
       const sample=document.createElement('canvas');sample.width=4;sample.height=4;
       const sc=sample.getContext('2d',{willReadFrequently:true});
       sc.fillStyle='rgb(40,100,200)';sc.fillRect(0,0,4,4);
       sc.globalCompositeOperation=window.BeatComposition.canvasBlendMode(mode);
       sc.fillStyle='rgb(160,130,60)';sc.fillRect(0,0,4,4);
       return [...sc.getImageData(0,0,1,1).data].slice(0,3).join(',');
     };
     out.mixSamples=Object.fromEntries(out.mixModes.map(m=>[m,sampleMix(m)]));
     out.mixPixelDistinct=new Set(Object.values(out.mixSamples)).size===8;
     document.querySelectorAll('.vj-layer-row')[2].querySelector('.vj-layer-select').click();
     const blendSelect=document.getElementById('vj-blend-mode');
     blendSelect.value='multiply';blendSelect.dispatchEvent(new Event('change',{bubbles:true}));
     out.mixModeSelected=document.getElementById('vj-blend-mode').value==='multiply';
     const mixOpacity=document.getElementById('vj-mix-opacity');
     mixOpacity.value='45';mixOpacity.dispatchEvent(new Event('input',{bubbles:true}));
     out.mixOpacitySynced=document.querySelectorAll('.vj-layer-row')[2].querySelector('.vj-layer-opacity').value==='45';
     const previousLayerLabel=document.querySelectorAll('.vj-layer-row')[2].querySelector('.vj-layer-select').textContent;
     const prevLayerFX=document.querySelectorAll('.vj-layer-effects .vj-cfx-item').length;
     document.getElementById('vj-layer-up').click();
     out.layerReordered=document.querySelectorAll('.vj-layer-row')[1].querySelector('.vj-layer-select').textContent===previousLayerLabel
       &&document.querySelectorAll('.vj-layer-row')[2].querySelector('.vj-layer-select').textContent!==previousLayerLabel
       &&document.getElementById('vj-blend-mode').value==='multiply';
     out.layerFXMoved=document.querySelectorAll('.vj-layer-effects .vj-cfx-item').length===prevLayerFX;
     out.moveBoundaryProtected=document.getElementById('vj-layer-up').disabled===false;
     await new Promise(resolve=>setTimeout(resolve,700));
     const blendPreferences=await window.beatAPI.loadPreferences();
     out.blendPersisted=blendPreferences?.composition?.selectedLayer===1
       &&blendPreferences.composition.layers[1].blendMode==='multiply'
       &&blendPreferences.composition.layers[1].opacity===.45;
     document.getElementById('vj-layer-down').click();
     out.layerRestoreIndex=document.getElementById('vj-blend-mode').value==='multiply'
       &&document.querySelectorAll('.vj-layer-row')[2].querySelector('.vj-layer-select').textContent===previousLayerLabel;
     // Verify the main renderer uses the actual new blend mode, not only a saved UI label.
     const canvas=document.getElementById('visualizer');
     const mainCanvasCtx=canvas.getContext('2d');
     const proto=Object.getPrototypeOf(mainCanvasCtx);
     const descriptor=Object.getOwnPropertyDescriptor(proto,'globalCompositeOperation');
     let blendWasApplied=false;
     if(descriptor?.get&&descriptor?.set){
       Object.defineProperty(mainCanvasCtx,'globalCompositeOperation',{
         configurable:true,
         get(){return descriptor.get.call(this);},
         set(value){if(value==='multiply')blendWasApplied=true;return descriptor.set.call(this,value);}
       });
     }
     await new Promise(resolve=>setTimeout(resolve,300));
     out.blendUsedInRenderer=blendWasApplied;
     if(Object.hasOwn(mainCanvasCtx,'globalCompositeOperation'))delete mainCanvasCtx.globalCompositeOperation;
     document.getElementById('fx-browser-open').click();
     out.panelOpened=!document.getElementById('fx-drawer').hidden;
     out.searchRows=document.querySelectorAll('.fx-result').length;
     const button=document.querySelector('.fx-entry-name');
     button?.click();
     out.stackRows=document.querySelectorAll('.fx-stack-entry').length;
     out.selectedText=document.querySelector('#fx-status')?.textContent;
     document.getElementById('fx-auto')?.click();
     out.autopilot=document.getElementById('fx-auto')?.getAttribute('aria-checked');
     out.fxReorder=Boolean(document.querySelector('.fx-stack-entry button'));
     const src=document.createElement('canvas');src.width=320;src.height=180;
     const c=src.getContext('2d');c.fillStyle='#31c9ec';c.fillRect(0,0,320,180);c.fillStyle='#f60';c.fillRect(30,20,100,60);
     const output=document.createElement('canvas');
     const fx=window.BeatFX?.renderer(output,{debug:true});
     out.webgl2=Boolean(fx);
     if(fx){
       out.shaders=[];
       for(let variant=0;variant<120;variant++){
         try{
           const entry=window.BeatFX.LIBRARY[variant];
           const worked=fx.draw(src,[{id:entry.id,wet:1,strength:1}],1000,{bass:.6,mids:.2,highs:.4,rms:.3});
           const glError=fx.gl.getError();
           if(!worked||glError)out.errors.push(entry.id+' draw '+worked+' GL '+glError);
         }catch(e){out.errors.push('effect '+variant+': '+e.message);}
       }
       out.shaderVariantsTested=120;
       try{
         const stack=[{id:'fx-005',wet:1,strength:1},{id:'fx-064',wet:.85,strength:1.3},{id:'fx-118',wet:1,strength:.6}];
         out.threeLayersWorked=fx.draw(src,stack,2100,{bass:.5,mids:.6,highs:.4,rms:.3});
         const err=fx.gl.getError();if(err)out.errors.push('3-layer stack GL '+err);
       }catch(e){out.errors.push('3-layer stack: '+e.message);}

     }
   }catch(e){out.errors.push('UI: '+e.stack);}
   return out;
 })()`,true);
 console.log('BEATSCOPE ELECTRON SMOKE RESULT '+JSON.stringify(state));
 for(const [name,ok] of Object.entries({canvas:state.canvas,uiReady:state.uiReady,gridRows:state.gridRows===8,clipCells:state.clipCells===64,sceneButtons:state.sceneButtons,sceneLaunch:state.sceneLaunchWorks,sceneSaved:state.sceneSaved,clipMenu:state.contextMenuOpen,clipPasted:state.pastedClip,clipParameters:state.pastedParams,clipDuplicated:state.duplicateCreated,clipDeleted:state.deleteWorked,clipCut:state.cutWorked,clipFXLibrary:state.clipFXLibraryCount===121,clipFXAdded:state.clipFXAdded,clipFXStack:state.clipFXStackCount,clipFXOrder:state.clipFXReordered,clipFXOff:state.clipFXDisabled,clipFXBypass:state.clipFXBypass,clipFXLayerMixing:state.clipFXLayerMixingRestored,clipFXGPU:state.clipFXGPU,clipFXSaved:state.clipFXPersisted,clipFXSeparate:state.clipFXIndependent,clipFXRemove:state.clipFXRemoved,layerFXLibrary:state.layerFXLibraryCount===121,layerFXAdded:state.layerFXAdded,layerFXReordered:state.layerFXReordered,layerFXDisabled:state.layerFXDisabled,layerFXBypass:state.layerFXBypass,layerFXGPU:state.layerFXGPU,layerFXOrder:state.layerFXOrder,layerFXSaved:state.layerFXSaved,layerFXSeparate:state.layerFXSeparate,layerFXDelete:state.layerFXDelete,blendCount:state.mixModes?.length===8,blendPixelResults:state.mixPixelDistinct,blendUI:state.mixModeSelected,blendOpacity:state.mixOpacitySynced,blendReorder:state.layerReordered,blendFxCarried:state.layerFXMoved,blendSaved:state.blendPersisted,blendRestore:state.layerRestoreIndex,blendRendered:state.blendUsedInRenderer,layer1:state.layer1ClipStarted,layer2:state.layer2ClipStarted,mute:state.muteToggled,solo:state.soloToggled,generatorCount:state.generatorCount===6,sourceOptions:state.generatorOptions?.length===16,extraCount:state.extraGeneratorCount===6,extraDraws:state.extraGeneratorsDrawn?.every(Boolean),extraDistinct:new Set(state.extraGeneratorHashes||[]).size===6,extraGrid:state.extraGridSources?.every(Boolean),otherClipDefault:state.otherClipDefault,paramsRestored:state.paramsRestored,paramsSaved:state.paramsSaved,paramsReset:state.paramsReset,sourceDraws:state.newGeneratorsDrawn?.every(Boolean),sourceDistinct:new Set(state.generatorHashes||[]).size===6,sourceGrid:state.newGridSources?.every(Boolean),library:state.library===120,director:state.director,panelOpened:state.panelOpened,searchRows:state.searchRows===120,stackRows:state.stackRows>=1,autopilot:state.autopilot==='true',webgl2:state.webgl2,shaders:state.shaderVariantsTested===120,threeLayers:state.threeLayersWorked===true,errors:state.errors?.length===0})){if(!ok)fail(name+': '+JSON.stringify(state[name]));}
 if(state.errors?.length)fail('Shader/UI errors: '+JSON.stringify(state.errors));
 await win.close();
}
const timeout=setTimeout(()=>{fail('Electron renderer smoke test timed out');process.stderr.write(details.join('\n')+'\n');app.exit(1);},45000);
app.whenReady().then(run).then(()=>{clearTimeout(timeout);console.log(details.join('\n'));app.exit(failed?1:0);}).catch(e=>{clearTimeout(timeout);console.error('Smoke crashed:',e.stack);app.exit(1);});
