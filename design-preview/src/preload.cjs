'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('luminaBridge',Object.freeze({
 toggleFullscreen:()=>ipcRenderer.invoke('lumina:fullscreen')
}));
