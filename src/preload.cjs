'use strict';
const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('beatAPI', Object.freeze({
  windowAction: (action)=>ipcRenderer.invoke('beatscope:window',action),
  windowState: ()=>ipcRenderer.invoke('beatscope:window-state'),
  onWindowState: (callback)=>{
    const listener=(_event,state)=>callback(state);
    ipcRenderer.on('window-state',listener);
    return ()=>ipcRenderer.removeListener('window-state',listener);
  },
  loadPreferences: ()=>ipcRenderer.invoke('beatscope:read-prefs'),
  savePreferences: (prefs)=>ipcRenderer.invoke('beatscope:write-prefs',prefs),
  saveScreenshot: (data)=>ipcRenderer.invoke('beatscope:save-screenshot',data)
}));