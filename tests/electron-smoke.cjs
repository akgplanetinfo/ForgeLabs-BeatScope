'use strict';
// Runs in Electron, on the GitHub-hosted Windows machine.
// Verifies real renderer initialization, actual UI clicks, and all FX shader variants.
const {app,BrowserWindow}=require('electron');
const path=require('node:path');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
let failed=false;
const details=[];
function fail(msg){details.push('FAIL: '+msg);failed=true;}
async function run(){
 const win=new BrowserWindow({show:false,width:1470,height:890,webPreferences:{preload:path.join(__dirname,'../src/preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true}});
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
 for(const [name,ok] of Object.entries({canvas:state.canvas,uiReady:state.uiReady,gridRows:state.gridRows===8,clipCells:state.clipCells===64,layer1:state.layer1ClipStarted,layer2:state.layer2ClipStarted,mute:state.muteToggled,solo:state.soloToggled,generatorCount:state.generatorCount===6,sourceOptions:state.generatorOptions?.length===10,sourceDraws:state.newGeneratorsDrawn?.every(Boolean),sourceDistinct:new Set(state.generatorHashes||[]).size===6,sourceGrid:state.newGridSources?.every(Boolean),library:state.library===120,director:state.director,panelOpened:state.panelOpened,searchRows:state.searchRows===120,stackRows:state.stackRows>=1,autopilot:state.autopilot==='true',webgl2:state.webgl2,shaders:state.shaderVariantsTested===120,threeLayers:state.threeLayersWorked===true,errors:state.errors?.length===0})){if(!ok)fail(name+': '+JSON.stringify(state[name]));}
 if(state.errors?.length)fail('Shader/UI errors: '+JSON.stringify(state.errors));
 await win.close();
}
const timeout=setTimeout(()=>{fail('Electron renderer smoke test timed out');process.stderr.write(details.join('\n')+'\n');app.exit(1);},45000);
app.whenReady().then(run).then(()=>{clearTimeout(timeout);console.log(details.join('\n'));app.exit(failed?1:0);}).catch(e=>{clearTimeout(timeout);console.error('Smoke crashed:',e.stack);app.exit(1);});
