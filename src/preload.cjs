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
  saveProject: (settings)=>ipcRenderer.invoke('beatscope:project-save',settings),
  openProject: ()=>ipcRenderer.invoke('beatscope:project-open'),
  newProject: ()=>ipcRenderer.invoke('beatscope:project-new'),
  displays: ()=>ipcRenderer.invoke('beatscope:displays'),
  outputState: ()=>ipcRenderer.invoke('beatscope:output-state'),
  setOutputBlackout: (enabled)=>ipcRenderer.invoke('beatscope:set-output-blackout',enabled),
  openView: (kind,displayId)=>ipcRenderer.invoke('beatscope:open-view',kind,displayId),
  closeView: (kind)=>ipcRenderer.invoke('beatscope:close-view',kind),
  pushOutputFrame: (frame)=>ipcRenderer.send('beatscope:push-frame',frame),
  sendStreamSignal: (kind,payload)=>ipcRenderer.send('beatscope:stream-signal',kind,payload),
  onStreamSignal: (callback)=>{
    const listener=(_event,message)=>callback(message);
    ipcRenderer.on('beatscope:stream-signal',listener);
    return ()=>ipcRenderer.removeListener('beatscope:stream-signal',listener);
  },
  onOutputStatus: (callback)=>{
    const listener=(_event,status)=>callback(status);
    ipcRenderer.on('beatscope:output-status',listener);
    return ()=>ipcRenderer.removeListener('beatscope:output-status',listener);
  }
}));