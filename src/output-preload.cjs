'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('outputBridge',Object.freeze({
 sendStreamSignal(kind,payload){ipcRenderer.send('beatscope:stream-signal',kind,payload);},
 sendHealth(kind,status){ipcRenderer.send('beatscope:output-health',kind,status);},
 onStreamSignal(callback){
   if(typeof callback!=='function')return ()=>{};
   const listener=(_event,message)=>callback(message);
   ipcRenderer.on('beatscope:stream-signal',listener);
   return ()=>ipcRenderer.removeListener('beatscope:stream-signal',listener);
 },
 onBlackout(callback){
   if(typeof callback!=='function')return ()=>{};
   const listener=(_event,enabled)=>callback(enabled);
   ipcRenderer.on('beatscope:output-blackout',listener);
   return ()=>ipcRenderer.removeListener('beatscope:output-blackout',listener);
 },
 onFrame(callback){
   if(typeof callback!=='function')return ()=>{};
   const listener=(_event,image)=>callback(image);
   ipcRenderer.on('beatscope:output-frame',listener);
   return ()=>ipcRenderer.removeListener('beatscope:output-frame',listener);
 }
}));