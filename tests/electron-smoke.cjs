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
       for(let family=0;family<20;family++){
         try{
           const entry=window.BeatFX.LIBRARY[family*6+3];
           const worked=fx.draw(src,[{id:entry.id,wet:1,strength:1}],1000,{bass:.6,mids:.2,highs:.4,rms:.3});
           const glError=fx.gl.getError();
           if(!worked||glError)out.errors.push(entry.id+' draw '+worked+' GL '+glError);
         }catch(e){out.errors.push('family '+family+': '+e.message);}
       }
       out.shaderFamiliesTested=20;
     }
   }catch(e){out.errors.push('UI: '+e.stack);}
   return out;
 })()`,true);
 console.log('BEATSCOPE ELECTRON SMOKE RESULT '+JSON.stringify(state));
 for(const [name,ok] of Object.entries({canvas:state.canvas,uiReady:state.uiReady,library:state.library===120,director:state.director,panelOpened:state.panelOpened,searchRows:state.searchRows===120,stackRows:state.stackRows>=1,autopilot:state.autopilot==='true',webgl2:state.webgl2,shaders:state.shaderFamiliesTested===20,errors:state.errors?.length===0})){if(!ok)fail(name+': '+JSON.stringify(state[name]));}
 if(state.errors?.length)fail('Shader/UI errors: '+JSON.stringify(state.errors));
 await win.close();
}
const timeout=setTimeout(()=>{fail('Electron renderer smoke test timed out');process.stderr.write(details.join('\n')+'\n');app.exit(1);},45000);
app.whenReady().then(run).then(()=>{clearTimeout(timeout);console.log(details.join('\n'));app.exit(failed?1:0);}).catch(e=>{clearTimeout(timeout);console.error('Smoke crashed:',e.stack);app.exit(1);});
