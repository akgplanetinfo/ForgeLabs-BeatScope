'use strict';
const {app, BrowserWindow, ipcMain, dialog, session, nativeTheme, protocol, net, screen} = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const Composition=require('./composition.js');
const BeatClock=require('./beat-clock.js');
const AutoScenes=require('./auto-scenes.js');
const Output=require('./output-manager.cjs');
const Media=require('./media-library.cjs');
const {pathToFileURL}=require('node:url');
protocol.registerSchemesAsPrivileged([{scheme:'beatscope-media',privileges:{standard:true,secure:true,stream:true,supportFetchAPI:true,corsEnabled:true}}]);

const APP_TITLE = 'ForgeLabs BeatScope';
const DEFAULT_PREFS = Object.freeze({ mode:'bars', palette:'azure', intensity:1.15, smooth:0.75, barCount:56, showGrid:true, micDevice:'default', volume:0.85, aiEnabled:false, aiSpeed:'balanced', aiPalette:false, fxStack:[], fxBypass:false, fxAuto:false, fxFavorites:[], composition:Composition.createComposition(), bpm:120, quantize:'off',autoSceneMode:'sequential',autoSceneBars:4, ...Output.DEFAULT_CONFIG });
let window = null;
let previewWindow=null,outputWindow=null;
let selectedDisplayId=null,lastFrame=null,lastFrameSent=0;
const preferencesPath = () => path.join(app.getPath('userData'), 'beatscope-preferences.json');
function validatePrefs(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Érvénytelen beállítások');
  const out = {...DEFAULT_PREFS};
  if (Composition.SOURCES.includes(value.mode)) out.mode = value.mode;
  if (['azure','mint','violet','sunset','rainbow'].includes(value.palette)) out.palette = value.palette;
  for (const [key, min, max] of [['intensity',0.2,3],['smooth',0,0.94],['volume',0,1]]) {
    if (typeof value[key] === 'number' && Number.isFinite(value[key])) out[key] = Math.max(min, Math.min(max, value[key]));
  }
  if (Number.isInteger(value.barCount)) out.barCount = Math.max(16, Math.min(128, value.barCount));
  if (typeof value.showGrid === 'boolean') out.showGrid = value.showGrid;
  if (typeof value.fxBypass === 'boolean') out.fxBypass = value.fxBypass;
  if (typeof value.fxAuto === 'boolean') out.fxAuto = value.fxAuto;
  if (Array.isArray(value.fxFavorites)) out.fxFavorites = [...new Set(value.fxFavorites.filter(id=>/^fx-\d{3}$/.test(id)&&+id.slice(3)>=1&&+id.slice(3)<=120))].slice(0,120);
  if (Array.isArray(value.fxStack)) out.fxStack = value.fxStack.filter(v=>v&&typeof v==='object'&&/^fx-\d{3}$/.test(v.id)&&+v.id.slice(3)>=1&&+v.id.slice(3)<=120).slice(0,3).map(v=>({id:v.id,strength:Number.isFinite(v.strength)?Math.max(0,Math.min(2,v.strength)):1,wet:Number.isFinite(v.wet)?Math.max(0,Math.min(1,v.wet)):1,disabled:v.disabled===true}));
  if (value.composition !== undefined) out.composition=Composition.normalize(value.composition);
  if (typeof value.bpm==='number'&&Number.isFinite(value.bpm))out.bpm=BeatClock.normalizeBpm(value.bpm);
  if (BeatClock.QUANTIZATIONS.includes(value.quantize))out.quantize=value.quantize;
  if (AutoScenes.MODES.includes(value.autoSceneMode))out.autoSceneMode=value.autoSceneMode;
  if (AutoScenes.BAR_COUNTS.includes(value.autoSceneBars))out.autoSceneBars=value.autoSceneBars;
  Object.assign(out,Output.normalizeConfig(value));
  if (typeof value.aiEnabled === 'boolean') out.aiEnabled = value.aiEnabled;
  if (typeof value.aiPalette === 'boolean') out.aiPalette = value.aiPalette;
  if (['calm','balanced','party'].includes(value.aiSpeed)) out.aiSpeed = value.aiSpeed;
  if (typeof value.micDevice === 'string' && value.micDevice.length <= 256) out.micDevice = value.micDevice;
  return out;
}
async function readPrefs() {
  try { return validatePrefs(JSON.parse(await fs.readFile(preferencesPath(),'utf8'))); }
  catch { return {...DEFAULT_PREFS}; }
}
let pendingPrefs=Promise.resolve();
let prefsWriteNumber=0;
function writePrefs(input) {
  const valid=validatePrefs(input);
  const write=async()=>{
    const target=preferencesPath();
    const temp=target+'.'+process.pid+'.'+(++prefsWriteNumber)+'.tmp';
    await fs.mkdir(path.dirname(target),{recursive:true});
    try{
      await fs.writeFile(temp,JSON.stringify(valid,null,2),'utf8');
      await fs.rename(temp,target);
    }finally{
      await fs.rm(temp,{force:true}).catch(()=>{});
    }
    return valid;
  };
  // Electron can have multiple windows simultaneously writing preferences.
  pendingPrefs=pendingPrefs.catch(()=>{}).then(write);
  return pendingPrefs;
}

const INDEX_URL=()=>require('node:url').pathToFileURL(path.join(__dirname,'../index.html')).toString();
function trustedController(event){
 const url=event?.sender?.getURL?.();
 return url===INDEX_URL();
}
function listDisplays(){
 const displays=screen.getAllDisplays();
 return Output.displayOptions(displays,screen.getPrimaryDisplay().id);
}
function status(){
 return {preview:!!previewWindow&&!previewWindow.isDestroyed(),
         output:!!outputWindow&&!outputWindow.isDestroyed(),
         displayId:selectedDisplayId,
         displays:listDisplays()};
}
function announceOutputStatus(){
 for(const wc of BrowserWindow.getAllWindows()){
   if(wc.isDestroyed())continue;
   if(wc.webContents.getURL()===INDEX_URL()&&!wc.webContents.isDestroyed())
     wc.webContents.send('beatscope:output-status',status());
 }
}
function createView(kind,displayId){
 const existing=kind==='preview'?previewWindow:outputWindow;
 if(existing&&!existing.isDestroyed()){existing.focus();return existing;}
 const displays=screen.getAllDisplays();
 const primary=screen.getPrimaryDisplay();
 const chosen=kind==='preview'?primary:Output.chooseDisplay(displays,primary.id,displayId);
 if(!chosen)throw new Error('Nem érhető el kijelző.');
 const external=kind==='output'&&chosen.id!==primary.id;
 const bounds=chosen.workArea||chosen.bounds;
 const width=external?chosen.bounds.width:Math.min(960,Math.max(480,bounds.width-100));
 const height=external?chosen.bounds.height:Math.min(540,Math.max(300,bounds.height-100));
 const view=new BrowserWindow({
   title:kind==='preview'?'BeatScope – Előnézet':'BeatScope – VJ Output',
   width:kind==='preview'?Math.min(820,width):width,
   height:kind==='preview'?Math.min(500,height):height,
   x:external?chosen.bounds.x:undefined,y:external?chosen.bounds.y:undefined,
   backgroundColor:'#000000',frame:!external,autoHideMenuBar:true,show:false,
   minWidth:320,minHeight:220,
   webPreferences:{preload:path.join(__dirname,'output-preload.cjs'),
     contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:false}
 });
 if(kind==='preview')previewWindow=view;else{outputWindow=view;selectedDisplayId=chosen.id;}
 view.webContents.on('page-title-updated',event=>event.preventDefault());
 view.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 view.webContents.on('will-navigate',e=>e.preventDefault());
 view.webContents.on('before-input-event',(event,input)=>{
   if(input.type==='keyDown'&&input.key==='Escape'){event.preventDefault();view.close();}
 });
 view.on('closed',()=>{
   if(kind==='preview')previewWindow=null;
   else{outputWindow=null;selectedDisplayId=null;}
   announceOutputStatus();
 });
 view.webContents.on('did-finish-load',()=>{
   if(lastFrame&& !view.webContents.isDestroyed())
     view.webContents.send('beatscope:output-frame',lastFrame);
 });
 view.once('ready-to-show',()=>{
   view.show();
   if(external){view.setBounds(chosen.bounds);view.setFullScreen(true);}
 });
 view.loadFile(path.join(__dirname,'../output.html'),{query:{kind}});
 announceOutputStatus();
 return view;
}
function closeView(kind){
 const target=kind==='preview'?previewWindow:outputWindow;
 if(target&&!target.isDestroyed()){target.close();return true;}
 return false;
}
function createWindow() {
  window = new BrowserWindow({
    title: APP_TITLE, width:1470, height:890, minWidth:890, minHeight:590,
    backgroundColor:'#080f1b', frame:false, show:false, autoHideMenuBar:true,
    icon:path.join(__dirname,'../assets/beatscope.png'),
    webPreferences:{ preload:path.join(__dirname,'preload.cjs'), contextIsolation:true, nodeIntegration:false, sandbox:true, webSecurity:true }
  });
  window.once('ready-to-show',()=>window.show());
  window.on('maximize',()=>window?.webContents.send('window-state',{maximized:true,fullscreen:window.isFullScreen()}));
  window.on('unmaximize',()=>window?.webContents.send('window-state',{maximized:false,fullscreen:window.isFullScreen()}));
  window.on('enter-full-screen',()=>window?.webContents.send('window-state',{maximized:window.isMaximized(),fullscreen:true}));
  window.on('leave-full-screen',()=>window?.webContents.send('window-state',{maximized:window.isMaximized(),fullscreen:false}));
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(e)=>e.preventDefault());
  window.loadFile(path.join(__dirname,'../index.html'));
}
app.setAppUserModelId('team.forgelabs.beatscope');
app.whenReady().then(()=>{
  // A separate, local-only protocol maps opaque clip IDs to files copied to the user's media library.
  protocol.handle('beatscope-media',async request=>{
    const target=Media.resolveURL(request.url,app.getPath('userData'));
    if(!target)return new Response('Media not found',{status:404});
    try{
      const info=await fs.stat(target);
      if(!info.isFile())return new Response('Media not found',{status:404});
      const fileResponse=await net.fetch(pathToFileURL(target).toString());
      const headers=new Headers(fileResponse.headers);
      headers.set('Access-Control-Allow-Origin','*');
      headers.set('Content-Type',Media.mimeFor(path.basename(target))||'application/octet-stream');
      return new Response(fileResponse.body,{status:fileResponse.status,headers});
    }catch{return new Response('Media not found',{status:404});}
  });
  // Kamera, GPS, képernyőmegosztás stb. soha nem kap automatikus engedélyt.
  // A mikrofon-hozzáférés csak a felhasználó aktív gombnyomására kérhető.
  session.defaultSession.setPermissionRequestHandler((_webContents,permission,callback,details)=>{
    const audioOnly = permission === 'media' && Array.isArray(details?.mediaTypes) && details.mediaTypes.length === 1 && details.mediaTypes[0] === 'audio';
    callback(audioOnly);
  });
  session.defaultSession.setPermissionCheckHandler((_wc,permission,_origin,details)=>{
    return permission === 'media' && details?.mediaType === 'audio';
  });

  ipcMain.handle('beatscope:displays',event=>{
    if(!trustedController(event))throw new Error('Nem engedélyezett ablak.');
    return listDisplays();
  });
  ipcMain.handle('beatscope:output-state',event=>{
    if(!trustedController(event))throw new Error('Nem engedélyezett ablak.');
    return status();
  });
  ipcMain.handle('beatscope:open-view',(event,kind,displayId)=>{
    if(!trustedController(event)||!['preview','output'].includes(kind))
      throw new Error('Érvénytelen kimeneti művelet.');
    if(kind==='output'&&displayId!==undefined&&
       !screen.getAllDisplays().some(d=>d.id===displayId))
      throw new Error('A kiválasztott kijelző már nem elérhető.');
    createView(kind,displayId);
    return status();
  });
  ipcMain.handle('beatscope:close-view',(event,kind)=>{
    if(!trustedController(event)||!['preview','output'].includes(kind))
      throw new Error('Érvénytelen kimeneti művelet.');
    closeView(kind);return status();
  });
  ipcMain.on('beatscope:push-frame',(event,frame)=>{
    if(!trustedController(event)||!Output.validFrame(frame))return;
    const now=Date.now();
    if(now-lastFrameSent<30)return; // Hard 33 FPS ceiling even if renderer misbehaves.
    lastFrameSent=now;lastFrame=frame;
    for(const view of [previewWindow,outputWindow]){
      if(view&&!view.isDestroyed()&&!view.webContents.isDestroyed()&&!view.webContents.isLoading())
        view.webContents.send('beatscope:output-frame',frame);
    }
  });
  screen.on('display-removed',(_event,removed)=>{
    if(outputWindow&&!outputWindow.isDestroyed()&&selectedDisplayId===removed.id)closeView('output');
    announceOutputStatus();
  });
  screen.on('display-added',announceOutputStatus);
  ipcMain.handle('beatscope:window',(_e,action)=>{
    if (!window || !['minimize','toggle-maximize','close','toggle-fullscreen'].includes(action)) return false;
    if (action==='minimize') window.minimize();
    if (action==='toggle-maximize') window.isMaximized()?window.unmaximize():window.maximize();
    if (action==='close') window.close();
    if (action==='toggle-fullscreen') window.setFullScreen(!window.isFullScreen());
    return true;
  });
  ipcMain.handle('beatscope:window-state',()=>({maximized:!!window?.isMaximized(),fullscreen:!!window?.isFullScreen()}));
  ipcMain.handle('beatscope:import-media',async ()=>{
    const result=await dialog.showOpenDialog(window,{
      title:'Képek és videók importálása',
      properties:['openFile'],
      filters:[
        {name:'Képek és videók',extensions:['png','jpg','jpeg','webp','gif','mp4','webm','m4v','mov']},
        {name:'Képek',extensions:['png','jpg','jpeg','webp','gif']},
        {name:'Videók',extensions:['mp4','webm','m4v','mov']}
      ]
    });
    if(result.canceled||!result.filePaths.length)return [];
    return Media.importMany(result.filePaths.slice(0,1),app.getPath('userData'));
  });
  ipcMain.handle('beatscope:read-prefs',readPrefs);
  ipcMain.handle('beatscope:write-prefs',(_e,value)=>writePrefs(value));
  ipcMain.handle('beatscope:save-screenshot',async (_e,dataUrl)=>{
    if (typeof dataUrl !== 'string'||dataUrl.length>22_000_000||!/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(dataUrl)) throw new Error('Érvénytelen PNG adat');
    const result = await dialog.showSaveDialog(window,{title:'Kép mentése',defaultPath:'BeatScope-'+new Date().toISOString().slice(0,19).replace(/:/g,'-')+'.png',filters:[{name:'PNG kép',extensions:['png']}]});
    if (result.canceled||!result.filePath) return {saved:false};
    await fs.writeFile(result.filePath,Buffer.from(dataUrl.split(',')[1],'base64'));
    return {saved:true};
  });
  createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
module.exports = { validatePrefs, DEFAULT_PREFS };