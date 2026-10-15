'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('outputBridge',Object.freeze({
 onFrame(callback){
   if(typeof callback!=='function')return ()=>{};
   const listener=(_event,image)=>callback(image);
   ipcRenderer.on('beatscope:output-frame',listener);
   return ()=>ipcRenderer.removeListener('beatscope:output-frame',listener);
 }
}));