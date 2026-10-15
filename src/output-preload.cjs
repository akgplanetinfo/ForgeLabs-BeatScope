'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('outputBridge',Object.freeze({
 sendStreamSignal(kind,payload){ipcRenderer.send('beatscope:stream-signal',kind,payload);},
 onStreamSignal(callback){
   if(typeof callback!=='function')return ()=>{};
   const listener=(_event,message)=>callback(message);
   ipcRenderer.on('beatscope:stream-signal',listener);
   return ()=>ipcRenderer.removeListener('beatscope:stream-signal',listener);
 },
 onFrame(callback){
   if(typeof callback!=='function')return ()=>{};
   const listener=(_event,image)=>callback(image);
   ipcRenderer.on('beatscope:output-frame',listener);
   return ()=>ipcRenderer.removeListener('beatscope:output-frame',listener);
 }
}));