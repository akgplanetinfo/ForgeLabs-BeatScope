'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');

test('program BLACKOUT IPC is boolean-only, trusted-controller-only and session-only',()=>{
 const main=read('src/main.cjs');
 assert.ok(main.includes("ipcMain.handle('beatscope:set-output-blackout'"));
 assert.ok(main.includes("!trustedController(event)||typeof enabled!=='boolean'"));
 assert.ok(main.includes('let outputBlackout=false'));
 assert.ok(main.includes('blackout:outputBlackout'));
 assert.ok(main.includes("view.webContents.send('beatscope:output-blackout',outputBlackout)"));
 assert.ok(!main.includes('out.blackout = value.blackout'));
});
test('opaque overlay starts before frame and leaves preview untouched',()=>{
 const html=read('output.html'),js=read('src/output-view.js'),main=read('src/main.cjs');
 assert.ok(html.includes('id="blackout-screen"'));
 assert.ok(html.includes('background:#000;z-index:9999'));
 assert.ok(js.includes("blackout=kind==='output'&&enabled===true"));
 assert.ok(js.includes("applyBlackout(params.get('blackout')==='1')"));
 assert.ok(js.includes('onBlackout(enabled=>applyBlackout(enabled))'));
 assert.ok(js.includes('blackoutOverlay.hidden=!blackout'));
 assert.ok(main.includes("query:{kind,blackout:kind==='output'&&outputBlackout?'1':'0'}"));
});
test('both preload bridges and the UI use the same validated controller API',()=>{
 const controller=read('src/preload.cjs'),view=read('src/output-preload.cjs');
 const ui=read('src/ui.js'),html=read('index.html');
 assert.ok(controller.includes("setOutputBlackout: (enabled)=>ipcRenderer.invoke('beatscope:set-output-blackout',enabled)"));
 assert.ok(view.includes("ipcRenderer.on('beatscope:output-blackout',listener)"));
 assert.ok(html.includes('id="output-blackout"'));
 assert.ok(ui.includes('window.beatAPI.setOutputBlackout(outputState.blackout!==true)'));
 assert.ok(ui.includes("blackout.setAttribute('aria-pressed',String(armed))"));
});
