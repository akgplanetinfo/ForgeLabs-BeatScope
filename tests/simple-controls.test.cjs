'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { VISUALS, ACTIONS, attachSimpleControls } = require('../src/simple-controls.js');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

function element(id, dataset = {}) {
  const handlers = {};
  const attrs = new Map();
  const classes = new Set();
  let clicks = 0;
  return {
    id, dataset, disabled: false, value: '', attrs, classes,
    classList: {
      contains: name => classes.has(name),
      toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }
    },
    addEventListener(name, callback) { handlers[name] = callback; },
    removeEventListener(name, callback) { if(handlers[name]===callback)delete handlers[name]; },
    dispatchEvent(event) { handlers[event.type]?.(event); return true; },
    emit(name) { handlers[name]?.({type:name}); },
    setAttribute(name, val) { attrs.set(name, String(val)); },
    getAttribute(name) { return attrs.get(name) ?? null; },
    click() { clicks += 1; handlers.click?.(); },
    change() { handlers.change?.(); },
    get clicks() { return clicks; }
  };
}
function fixture() {
  const ids = ['simple-control-bar', 'simple-visual', ...Object.keys(ACTIONS),
    ...Object.values(ACTIONS), 'title-status', 'track-name', 'mode-label',
    'simple-status-source', 'simple-status-track', 'simple-status-visual',
    'simple-play-pause','simple-stop','simple-seek','simple-current-time',
    'simple-duration','play-pause','stop','seek','current-time','duration','audio',
    'mute','volume','simple-mute','simple-volume','simple-volume-value'];
  const nodes = Object.fromEntries(ids.map(id => [id, element(id)]));
  nodes['title-status'].textContent = 'Élő mikrofon';
  nodes['track-name'].textContent = 'teszt-zene.wav';
  nodes['mode-label'].textContent = 'ORBIT / RADIAL SPECTRUM';
  nodes.seek.disabled=true;
  nodes.audio.paused=true;
  nodes.audio.ended=false;
  nodes.audio.duration=NaN;
  nodes.audio.currentTime=0;
  nodes.audio.volume=.85;
  nodes.audio.muted=false;
  nodes.volume.value='85';
  nodes['simple-volume'].value='85';
  nodes['current-time'].textContent='0:00';
  nodes.duration.textContent='0:00';
  const sources = VISUALS.map(value => element('source-' + value, { mode: value }));
  const body = element('body');
  const doc = {
    body,
    getElementById: id => nodes[id] ?? null,
    defaultView: { Event: class { constructor(type,opts){this.type=type;this.bubbles=opts?.bubbles;} } },
    querySelectorAll: selector => selector === '[data-mode]' ? sources : []
  };
  const observers = [];
  class Observer {
    constructor(callback) { this.callback = callback; this.observed = []; observers.push(this); }
    observe(node, opts) { this.observed.push([node, opts.attributeFilter?.[0] ?? 'text']); }
    disconnect() { this.disconnected = true; }
    notify() { this.callback(); }
  }
  return { nodes, sources, body, doc, Observer, observers };
}

test('Simple shortcuts forward real user clicks to working BeatScope handlers', () => {
  const f = fixture();
  attachSimpleControls(f.doc, f.Observer);
  for (const [buttonId, originalId] of Object.entries(ACTIONS)) {
    f.nodes[buttonId].click();
    assert.equal(f.nodes[originalId].clicks, 1, originalId);
  }
  f.nodes['microphone'].disabled = true;
  f.nodes['simple-microphone'].click();
  assert.equal(f.nodes['microphone'].clicks, 1, 'Disabled original action must not trigger');
});

test('Visual selection uses original generator buttons; invalid values are ignored', () => {
  const f = fixture();
  attachSimpleControls(f.doc, f.Observer);
  for (let i = 0; i < VISUALS.length; i++) {
    f.nodes['simple-visual'].value = VISUALS[i];
    f.nodes['simple-visual'].change();
    assert.equal(f.sources[i].clicks, 1);
  }
  f.nodes['simple-visual'].value = 'invalid-mode';
  f.nodes['simple-visual'].change();
  assert.deepEqual(f.sources.map(e => e.clicks), [1,1,1,1]);
});

test('Visual and AI/microphone/fullscreen indicators reflect original engine state', () => {
  const f = fixture();
  f.sources[2].classList.toggle('active', true);
  f.nodes['ai-toggle'].setAttribute('aria-checked', 'true');
  f.nodes['microphone'].classList.toggle('active', true);
  f.body.classList.toggle('fullscreen', true);
  const controller = attachSimpleControls(f.doc, f.Observer);
  assert.equal(f.nodes['simple-visual'].value, 'orbit');
  assert.equal(f.nodes['simple-ai'].getAttribute('aria-pressed'), 'true');
  assert.equal(f.nodes['simple-microphone'].getAttribute('aria-pressed'), 'true');
  assert.equal(f.nodes['simple-fullscreen'].getAttribute('aria-pressed'), 'true');
  f.nodes['ai-toggle'].setAttribute('aria-checked', 'false');
  f.nodes['microphone'].classList.toggle('active', false);
  f.body.classList.toggle('fullscreen', false);
  f.sources[2].classList.toggle('active', false);
  f.sources[0].classList.toggle('active', true);
  f.observers[0].notify();
  assert.equal(f.nodes['simple-visual'].value, 'bars');
  for (const id of ['simple-ai', 'simple-microphone', 'simple-fullscreen'])
    assert.equal(f.nodes[id].getAttribute('aria-pressed'), 'false');
  assert.ok(f.observers[0].observed.length >= 7);
  controller.disconnect();
  assert.equal(f.observers[0].disconnected, true);
});

test('Simple quick controls are wired into real Electron HTML only, with no duplicate engine', () => {
  const html = read('index.html');
  const css = read('src/lumina-theme.css');
  const js = read('src/simple-controls.js');
  for (const id of ['simple-control-bar','simple-visual',...Object.keys(ACTIONS)])
    assert.ok(html.includes('id="' + id + '"'), 'Missing ' + id);
  assert.ok(html.indexOf('src/ui.js') < html.indexOf('src/simple-controls.js'),
    'Quick controls must load after original BeatScope handlers');
  assert.match(css, /data-studio-mode="simple"\] \.simple-control-bar/);
  assert.match(css, /\.simple-control-bar\{display:none\}/);
  assert.match(js, /target\.click\(\)/);
});

test('Simple HUD reads original audio/track/visual labels and observes changes', () => {
  const f = fixture();
  const controller = attachSimpleControls(f.doc, f.Observer);
  assert.equal(f.nodes['simple-status-source'].textContent, 'Élő mikrofon');
  assert.equal(f.nodes['simple-status-track'].textContent, 'teszt-zene.wav');
  assert.equal(f.nodes['simple-status-visual'].textContent, 'ORBIT / RADIAL SPECTRUM');
  f.nodes['title-status'].textContent = 'Nincs hangforrás';
  f.nodes['track-name'].textContent = 'Nincs kiválasztott zene';
  f.nodes['mode-label'].textContent = 'SPECTRUM / REAL TIME';
  f.observers[0].notify();
  assert.equal(f.nodes['simple-status-source'].textContent,'Nincs hangforrás');
  assert.equal(f.nodes['simple-status-track'].textContent,'Nincs kiválasztott zene');
  assert.equal(f.nodes['simple-status-visual'].textContent,'SPECTRUM / REAL TIME');
  assert.ok(f.observers[0].observed.filter(([_,kind])=>kind==='text').length>=3);
  controller.disconnect();
});

test('Stage 12 Simple transport forwards clicks to original play/stop and obeys no-file state', () => {
  const f=fixture();
  const controller=attachSimpleControls(f.doc,f.Observer);
  assert.equal(f.nodes['simple-play-pause'].textContent,'♫ Zene megnyitása');
  assert.equal(f.nodes['simple-stop'].disabled,true);
  assert.equal(f.nodes['simple-seek'].disabled,true);
  f.nodes['simple-play-pause'].click();
  assert.equal(f.nodes['play-pause'].clicks,1,'Delegates native opener/play behavior');
  f.nodes['simple-stop'].click();
  assert.equal(f.nodes.stop.clicks,1,'Direct invocation must still forward only to native control');
  f.nodes.seek.disabled=false;
  f.nodes.audio.duration=120;
  f.nodes.audio.currentTime=15;
  f.nodes['current-time'].textContent='0:15';
  f.nodes.duration.textContent='2:00';
  f.nodes.audio.emit('loadedmetadata');
  assert.equal(f.nodes['simple-play-pause'].textContent,'▶ Lejátszás');
  assert.equal(f.nodes['simple-stop'].disabled,false);
  assert.equal(f.nodes['simple-seek'].disabled,false);
  assert.equal(f.nodes['simple-seek'].value,'125');
  f.nodes.audio.paused=false;
  f.nodes.audio.emit('play');
  assert.equal(f.nodes['simple-play-pause'].textContent,'❚❚ Szünet');
  assert.equal(f.nodes['simple-play-pause'].getAttribute('aria-pressed'),'true');
  f.nodes['simple-play-pause'].click();
  assert.equal(f.nodes['play-pause'].clicks,2);
  f.nodes.audio.paused=true;
  f.nodes.audio.emit('pause');
  assert.equal(f.nodes['simple-play-pause'].getAttribute('aria-pressed'),'false');
  assert.equal(f.nodes['simple-play-pause'].textContent,'▶ Lejátszás');
  controller.disconnect();
});

test('Stage 12 seeking delegates original BeatScope seek input and updates accessibility', () => {
  const f=fixture();
  let nativeInputs=0;
  f.nodes.seek.addEventListener('input',()=>{nativeInputs++;});
  const controller=attachSimpleControls(f.doc,f.Observer);
  f.nodes['simple-seek'].value='900';
  f.nodes['simple-seek'].emit('input');
  assert.equal(nativeInputs,0,'No seek while no file is loaded');
  f.nodes.seek.disabled=false;
  f.nodes.audio.duration=100;
  f.nodes.audio.currentTime=25;
  f.nodes['current-time'].textContent='0:25';
  f.nodes.duration.textContent='1:40';
  f.nodes.audio.emit('loadedmetadata');
  assert.equal(f.nodes['simple-seek'].value,'250');
  f.nodes['simple-seek'].value='600';
  f.nodes['simple-seek'].emit('input');
  assert.equal(nativeInputs,1);
  assert.equal(f.nodes.seek.value,'600');
  f.nodes.audio.currentTime=60;
  f.nodes['current-time'].textContent='1:00';
  f.nodes.audio.emit('timeupdate');
  assert.equal(f.nodes['simple-seek'].value,'600');
  assert.equal(f.nodes['simple-current-time'].textContent,'1:00');
  assert.equal(f.nodes['simple-duration'].textContent,'1:40');
  assert.equal(f.nodes['simple-seek'].getAttribute('aria-valuetext'),'1:00 / 1:40');
  controller.disconnect();
});

test('Stage 12 microphone and invalid metadata cannot seek a file timeline', () => {
  const f=fixture();
  f.nodes.seek.disabled=false;
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  assert.equal(f.nodes['simple-seek'].disabled,true,'Metadata missing');
  f.nodes.audio.duration=Infinity;
  f.nodes.audio.emit('durationchange');
  assert.equal(f.nodes['simple-seek'].disabled,true,'Invalid duration');
  f.nodes.audio.duration=90;
  f.nodes.microphone.classList.toggle('active',true);
  f.observers[0].notify();
  assert.equal(f.nodes['simple-seek'].disabled,true,'Live microphone has no file seek');
  assert.equal(f.nodes['simple-play-pause'].textContent,'■ Mikrofon leállítása');
  f.nodes['simple-play-pause'].click();
  assert.equal(f.nodes['play-pause'].clicks,1,'Native Mic stop action');
  f.nodes.microphone.classList.toggle('active',false);
  f.nodes.audio.paused=false;
  f.nodes.audio.ended=true;
  f.nodes.audio.emit('ended');
  assert.equal(f.nodes['simple-play-pause'].textContent,'▶ Lejátszás');
  f.nodes['play-pause'].disabled=true;
  f.nodes.stop.disabled=true;
  f.observers[0].notify();
  assert.equal(f.nodes['simple-play-pause'].disabled,true);
  assert.equal(f.nodes['simple-stop'].disabled,true);
  ctrl.disconnect();
});

test('Stage 12 real HTML includes Simple playback and timeline controls, original player retained',()=>{
  const html=read('index.html'),css=read('src/lumina-theme.css'),js=read('src/simple-controls.js');
  for(const id of ['simple-transport','simple-play-pause','simple-stop',
    'simple-seek','simple-current-time','simple-duration',
    'play-pause','stop','seek','audio'])
    assert.ok(html.includes('id="'+id+'"'),'Missing '+id);
  assert.match(css,/data-studio-mode="simple"\] \.simple-control-bar/);
  assert.match(css,/\.simple-transport/);
  assert.match(js,/nativeSeek\.dispatchEvent/);
});

test('Stage 13 Simple volume sends input to existing BeatScope handler and syncs status',()=>{
  const f=fixture();
  let nativeInputCount=0;
  f.nodes.volume.addEventListener('input',()=>{
    nativeInputCount++;
    f.nodes.audio.volume=Number(f.nodes.volume.value)/100;
    f.nodes.audio.emit('volumechange');
  });
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  assert.equal(f.nodes['simple-volume'].value,'85');
  assert.equal(f.nodes['simple-volume-value'].textContent,'85%');
  assert.equal(f.nodes['simple-volume'].getAttribute('aria-valuetext'),'85%');
  f.nodes['simple-volume'].value='32';
  f.nodes['simple-volume'].emit('input');
  assert.equal(nativeInputCount,1,'Must call native input handler exactly once');
  assert.equal(f.nodes.volume.value,'32');
  assert.equal(f.nodes.audio.volume,.32);
  assert.equal(f.nodes['simple-volume-value'].textContent,'32%');
  f.nodes.audio.volume=.67;
  f.nodes.audio.emit('volumechange');
  assert.equal(f.nodes['simple-volume'].value,'67');
  assert.equal(f.nodes['simple-volume-value'].textContent,'67%');
  f.nodes.audio.volume=1;
  f.nodes.audio.emit('volumechange');
  assert.equal(f.nodes['simple-volume'].value,'100');
  f.nodes.audio.volume=0;
  f.nodes.audio.emit('volumechange');
  assert.equal(f.nodes['simple-volume'].value,'0');
  ctrl.disconnect();
});

test('Stage 13 mute button delegates to original BeatScope mute and follows Pro state',()=>{
  const f=fixture();
  f.nodes.mute.addEventListener('click',()=>{
    f.nodes.audio.muted=!f.nodes.audio.muted;
    f.nodes.audio.emit('volumechange');
  });
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  const quick=f.nodes['simple-mute'];
  assert.equal(quick.getAttribute('aria-pressed'),'false');
  assert.equal(quick.getAttribute('aria-label'),'Némítás');
  quick.click();
  assert.equal(f.nodes.mute.clicks,1);
  assert.equal(f.nodes.audio.muted,true);
  assert.equal(quick.getAttribute('aria-pressed'),'true');
  assert.equal(quick.getAttribute('aria-label'),'Némítás feloldása');
  assert.equal(quick.textContent,'◖× Némítva');
  f.nodes.mute.click();
  assert.equal(quick.getAttribute('aria-pressed'),'false');
  assert.equal(quick.textContent,'◖)) Hang');
  f.nodes.mute.disabled=true;
  f.nodes.volume.disabled=true;
  f.observers[0].notify();
  assert.equal(quick.disabled,true);
  assert.equal(f.nodes['simple-volume'].disabled,true);
  quick.click();
  f.nodes['simple-volume'].value='12';
  f.nodes['simple-volume'].emit('input');
  assert.equal(f.nodes.mute.clicks,2,'Disabled native mute stays untouched');
  assert.equal(f.nodes.volume.value,'85','Disabled native volume stays untouched');
  ctrl.disconnect();
});

test('Stage 13 real Electron HTML has file-volume and mute controls',()=>{
  const html=read('index.html'),css=read('src/lumina-theme.css');
  for(const id of ['simple-volume','simple-mute','simple-volume-value','volume','mute'])
    assert.ok(html.includes('id="'+id+'"'),'Missing '+id);
  assert.match(css,/\.simple-volume/);
  assert.match(css,/#simple-mute\[aria-pressed="true"\]/);
});
