'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createMonitor}=require('../src/output-health.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('watchdog waits for initial frame, then marks missing picture and recovers',()=>{
 const m=createMonitor(100,{lostAfterMs:6000,startupGraceMs:10000});
 assert.equal(m.poll(100,'jpeg').status,'waiting');
 assert.equal(m.poll(10099,'jpeg').status,'waiting');
 assert.deepEqual(m.poll(10100,'jpeg').status,'lost');
 assert.equal(m.poll(10101,'jpeg').losses,1,'only one loss per stall');
 assert.equal(m.frame(10200,'jpeg').status,'live');
 assert.equal(m.snapshot().recoveries,1);
 assert.equal(m.poll(16199,'jpeg').status,'live');
 assert.equal(m.poll(16200,'jpeg').status,'lost');
 assert.equal(m.frame(16250,'jpeg').status,'live');
 assert.equal(m.snapshot().losses,2);
 assert.equal(m.snapshot().recoveries,2);
});
test('healthy frames prevent false loss and an invalid timestamp cannot arm fallback',()=>{
 const m=createMonitor(0);
 m.frame(100,'jpeg');
 m.frame(5900,'jpeg');
 assert.equal(m.poll(10000,'jpeg').status,'live');
 assert.equal(m.poll(NaN,'webrtc').fallback,false);
 assert.equal(m.frame(Infinity,'webrtc').status,'live');
});
test('stalled live WebRTC triggers JPEG fallback once; reset prevents repeat',()=>{
 const m=createMonitor(0,{lostAfterMs:6000,startupGraceMs:10000});
 m.frame(100,'jpeg');
 m.frame(200,'webrtc');
 assert.equal(m.poll(6199,'webrtc').fallback,false);
 const timedOut=m.poll(6200,'webrtc');
 assert.equal(timedOut.status,'lost');
 assert.equal(timedOut.fallback,true);
 assert.equal(m.poll(8500,'webrtc').fallback,false,'fallback is issued exactly once');
 m.stopRtc();
 assert.equal(m.poll(8700,'jpeg').fallback,false);
 m.frame(8800,'jpeg');
 assert.equal(m.snapshot().status,'live');
 assert.equal(m.snapshot().recoveries,1);
});
test('no WebRTC fallback before its first decoded video frame',()=>{
 const m=createMonitor(0);
 m.frame(200,'jpeg');
 assert.equal(m.poll(7000,'webrtc').fallback,false);
 m.frame(8000,'webrtc');
 assert.equal(m.poll(8500,'webrtc').fallback,false);
});
test('receiver uses fullscreen black signal-loss overlay beneath operator BLACKOUT',()=>{
 const h=read('output.html'),receiver=read('src/output-view.js');
 assert.ok(h.includes('id="signal-loss-screen"'));
 assert.ok(h.includes('background:#000;z-index:9000'));
 assert.ok(h.includes('background:#000;z-index:9999'));
 assert.ok(h.indexOf('src/output-health.js')<h.indexOf('src/output-view.js'));
 assert.ok(receiver.includes("lossOverlay.hidden=status!=='lost'"));
 assert.ok(receiver.includes("if(result.fallback&&mode==='webrtc')"));
 assert.ok(receiver.includes("stopLive();signal({type:'failed'})"));
 assert.ok(receiver.includes("reportHealth(health.frame(performance.now(),transport).status)"));
});
test('controller receives health from only the correct sandboxed view',()=>{
 const main=read('src/main.cjs'),bridge=read('src/output-preload.cjs'),ui=read('src/ui.js');
 assert.ok(main.includes("ipcMain.on('beatscope:output-health'"));
 assert.ok(main.includes("event.sender!==view.webContents"));
 assert.ok(main.includes("!['waiting','live','lost'].includes(health)"));
 assert.ok(main.includes("health:{...outputHealth}"));
 assert.ok(bridge.includes("ipcRenderer.send('beatscope:output-health',kind,status)"));
 assert.ok(ui.includes("outputState.health?.output==='lost'"));
 assert.ok(ui.includes("VJ JEL MEGSZAKADT"));
 assert.ok(main.includes('outputHealth[kind]=\'off\''));
});
