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
  saveScreenshot: (data)=>ipcRenderer.invoke('beatscope:save-screenshot',data),
  importMedia: ()=>ipcRenderer.invoke('beatscope:import-media'),
  displays: ()=>ipcRenderer.invoke('beatscope:displays'),
  outputState: ()=>ipcRenderer.invoke('beatscope:output-state'),
  openView: (kind,displayId)=>ipcRenderer.invoke('beatscope:open-view',kind,displayId),
  closeView: (kind)=>ipcRenderer.invoke('beatscope:close-view',kind),
  pushOutputFrame: (frame)=>ipcRenderer.send('beatscope:push-frame',frame),
  onOutputStatus: (callback)=>{
    const listener=(_event,status)=>callback(status);
    ipcRenderer.on('beatscope:output-status',listener);
    return ()=>ipcRenderer.removeListener('beatscope:output-status',listener);
  }
}));