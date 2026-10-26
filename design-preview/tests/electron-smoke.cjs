'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {app,BrowserWindow}=require('electron');
const report={checks:{},errors:[]};
let finished=false;
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function testCheck(key,result){
 report.checks[key]=!!result;
 if(!result)report.errors.push(key);
}
require('../src/main.cjs');
app.whenReady().then(async()=>{
 let win;
 for(let i=0;i<80;i++){
  win=BrowserWindow.getAllWindows().find(w=>!w.isDestroyed());
  if(win)break;
  await sleep(100);
 }
 if(!win)throw Error('Lumina Pulse Electron window did not start');
 await new Promise((resolve,reject)=>{
  if(!win.webContents.isLoadingMainFrame())return resolve();
  win.webContents.once('did-finish-load',resolve);
  win.webContents.once('did-fail-load',(_e,code,description)=>reject(new Error(description+' '+code)));
 });
 const result=await win.webContents.executeJavaScript(`(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const out={pages:[],failedActions:[],errors:[]};
  window.addEventListener('error',e=>out.errors.push(String(e.message)));
  const api=window.__luminaPreview;
  out.api=!!api;
  out.initial=api?.getModule()==='dashboard';
  out.moduleCount=api?.moduleCount();
  out.visualCount=api?.visualCount();
  for(const item of window.LuminaModules.modules){
   const button=document.querySelector('[data-module="'+item.id+'"]');
   if(!button){out.failedActions.push('Missing nav '+item.id);continue;}
   button.click();
   const ok=api.getModule()===item.id
     &&document.querySelectorAll('.feature-tile').length===item.features.length
     &&document.querySelector('[aria-current="page"]')?.dataset.module===item.id;
   out.pages.push({id:item.id,ok,features:item.features.length});
  }
  document.querySelector('[data-module="library"]').click();
  out.libraryTiles=document.querySelectorAll('.visual-tile').length;
  const search=document.getElementById('visual-search');
  search.value='Neon Tunnel';search.dispatchEvent(new Event('input',{bubbles:true}));
  out.librarySearch=document.querySelectorAll('.visual-tile').length===1;
  search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));
  out.libraryReset=document.querySelectorAll('.visual-tile').length===30;
  document.querySelector('[data-module="ai"]').click();
  out.aiTabs=document.querySelectorAll('.ai-tabs button').length;
  out.aiSteps=[];
  for(let i=0;i<3;i++){
   document.querySelectorAll('.ai-tabs button')[i].click();
   out.aiSteps.push(document.querySelector('.ai-tabs button.selected')?.dataset.tab===String(i)
     &&document.querySelectorAll('.module-actions button').length>=4
     &&document.querySelectorAll('.module-field').length>=3);
  }
  document.querySelector('.module-actions button').click();
  out.notice=document.getElementById('toast-text').textContent;
  out.toastVisible=!document.getElementById('toast').hidden;
  document.getElementById('simple-mode').click();
  out.simple=api.getMode()==='simple'&&api.getModule()==='simple';
  document.getElementById('pro-mode').click();
  out.pro=api.getMode()==='pro'&&api.getModule()==='studio';
  document.querySelector('[data-module="dashboard"]').click();
  out.backEnabled=!document.getElementById('go-back').disabled;
  document.getElementById('go-back').click();
  out.backWorks=api.getModule()==='studio';
  const knob=document.getElementById('intensity');
  knob.value=87;knob.dispatchEvent(new Event('input',{bubbles:true}));
  out.previewControl=document.getElementById('intensity-value').textContent==='87%';
  document.querySelectorAll('.swatch')[2].click();
  out.colorControl=document.querySelectorAll('.swatch')[2].classList.contains('selected');
  const canvas=document.getElementById('visual-canvas');
  await sleep(400);
  out.canvas=canvas.width>100&&canvas.height>100;
  out.offlineNotice=document.querySelector('.notice')?.textContent.includes('nem aktív');
  out.noRemoteStyles=Array.from(document.styleSheets).every(sheet=>sheet.href===null||sheet.href.startsWith('file:'));
  out.navCount=document.querySelectorAll('#main-nav button').length;
  return out;
 })()`,true);
 testCheck('Electron native startup',true);
 testCheck('14 modules visible',result.navCount===14&&result.moduleCount===14);
 testCheck('All module pages and submenus',result.pages.length===14&&result.pages.every(p=>p.ok));
 testCheck('30 Visual Library cards and search',result.visualCount===30&&result.libraryTiles===30&&result.librarySearch&&result.libraryReset);
 testCheck('AI three workflows',result.aiTabs===3&&result.aiSteps.every(Boolean));
 testCheck('Exact development placeholder',result.notice==='Ez a funkció még nem működik – fejlesztés alatt.'&&result.toastVisible);
 testCheck('Simple and Pro navigation',result.simple&&result.pro);
 testCheck('Back navigation',result.backEnabled&&result.backWorks);
 testCheck('Clickable demo controls',result.previewControl&&result.colorControl);
 testCheck('Animated canvas',result.canvas);
 testCheck('Offline indication and resources',result.offlineNotice&&result.noRemoteStyles);
 testCheck('No renderer errors',!result.errors.length);
 const screenshot=path.join(__dirname,'..','preview-screenshot.png');
 try{
  const shot=await win.webContents.capturePage();
  fs.writeFileSync(screenshot,shot.toPNG());
 }catch(e){console.warn('Optional screenshot unavailable:',e.message);}
 const reportPath=path.join(__dirname,'..','test-results.json');
 fs.writeFileSync(reportPath,JSON.stringify({timestamp:new Date().toISOString(),...report,details:result},null,2));
 console.log('Lumina Pulse Design Preview test report:',JSON.stringify(report.checks));
 if(report.errors.length)throw Error('Smoke checks failed: '+report.errors.join(', '));
 console.log('SMOKE TEST SUCCESS');
 finished=true;win.close();app.quit();
}).catch(e=>{
 console.error('SMOKE TEST FAILED',e?.stack||e);
 process.exitCode=1;
 app.quit();
});
setTimeout(()=>{if(!finished){console.error('Electron smoke test timeout');process.exit(1);}},45000).unref();
