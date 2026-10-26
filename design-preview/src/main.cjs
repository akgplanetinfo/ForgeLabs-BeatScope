'use strict';
const {app,BrowserWindow,ipcMain,session}=require('electron');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
let windowRef=null;
function createWindow(){
 const win=new BrowserWindow({
  title:'Lumina Pulse 2.0 – Design Preview',
  width:1480,height:920,minWidth:800,minHeight:550,
  show:false,backgroundColor:'#030609',autoHideMenuBar:true,
  webPreferences:{
   preload:path.join(__dirname,'preload.cjs'),
   nodeIntegration:false,contextIsolation:true,
   sandbox:true,webSecurity:true,backgroundThrottling:false
  }
 });
 windowRef=win;
 win.once('ready-to-show',()=>win.show());
 win.loadFile(path.join(ROOT,'index.html'));
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',event=>event.preventDefault());
 win.webContents.on('will-attach-webview',event=>event.preventDefault());
 win.on('closed',()=>{windowRef=null;});
 return win;
}
app.whenReady().then(()=>{
 session.defaultSession.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
 session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
  const requestURL=details.url;
  if(/^(https?|wss?):/i.test(requestURL))return callback({cancel:true});
  callback({});
 });
 ipcMain.handle('lumina:fullscreen',(event)=>{
  if(!windowRef||event.sender!==windowRef.webContents)return false;
  windowRef.setFullScreen(!windowRef.isFullScreen());
  return windowRef.isFullScreen();
 });
 createWindow();
 app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
