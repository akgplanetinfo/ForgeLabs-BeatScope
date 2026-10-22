'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { VISUALS, PALETTES, AI_SPEEDS, ACTIONS, SIMPLE_SHORTCUTS, VISUAL_TUNING, attachSimpleControls } = require('../src/simple-controls.js');
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
    replaceChildren(...items) { this.children=items; },
    click() { clicks += 1; handlers.click?.(); },
    change() { handlers.change?.(); },
    get clicks() { return clicks; }
  };
}
function fixture() {
  const ids = ['simple-control-bar', 'simple-visual', 'simple-palette',
    'simple-ai-palette','ai-palette','simple-ai-speed','ai-speed',
    'simple-show-grid','show-grid', ...Object.keys(ACTIONS),
    ...Object.values(ACTIONS), 'title-status', 'track-name', 'mode-label',
    'simple-status-source', 'simple-status-track', 'simple-status-visual',
    'simple-play-pause','simple-stop','simple-seek','simple-current-time',
    'simple-duration','play-pause','stop','seek','current-time','duration','audio',
    'mute','volume','simple-mute','simple-volume','simple-volume-value',
    'previous','next','repeat','simple-previous','simple-next','simple-repeat',
    'intensity','smooth','intensity-val','smooth-val',
    'simple-intensity','simple-smooth','simple-intensity-value','simple-smooth-value',
    'bars-count','bars-val','simple-bars-count','simple-bars-value',
    'simple-fx-wet','fx-wet','simple-fx-wet-value','fx-wet-value',
    'simple-fx-strength','fx-strength','simple-fx-strength-value','fx-strength-value',
    'simple-fx-selection','fx-stack','simple-fx-picker','simple-fx-enabled',
    'simple-fx-up','simple-fx-down','simple-fx-position',
    'simple-fx-remove','simple-fx-remove-cancel','simple-fx-remove-note',
    'simple-fx-add','fx-browser-open','fx-drawer','fx-search'];
  const nodes = Object.fromEntries(ids.map(id => [id, element(id)]));
  nodes['simple-fx-remove-cancel'].hidden=true;
  nodes['fx-drawer'].hidden=true;
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
  nodes.audio.loop=false;
  nodes['simple-ai-palette'].checked=false;
  nodes['ai-palette'].checked=false;
  nodes['ai-speed'].value='balanced';
  nodes['simple-ai-speed'].value='balanced';
  nodes['show-grid'].checked=true;
  nodes['simple-show-grid'].checked=true;
  nodes.volume.value='85';
  nodes.intensity.value='115';nodes.intensity.min='20';nodes.intensity.max='300';
  nodes.smooth.value='75';nodes.smooth.min='0';nodes.smooth.max='94';
  nodes['bars-count'].value='56';nodes['bars-count'].min='16';
  nodes['bars-count'].max='128';nodes['bars-count'].step='8';
  nodes['intensity-val'].textContent='115%';nodes['smooth-val'].textContent='75%';
  nodes['bars-val'].textContent='56';
  nodes['fx-wet'].value='100';nodes['fx-wet'].min='0';nodes['fx-wet'].max='100';
  nodes['fx-strength'].value='100';nodes['fx-strength'].min='0';nodes['fx-strength'].max='200';
  nodes['fx-wet'].disabled=true;nodes['fx-strength'].disabled=true;
  nodes['fx-wet-value'].textContent='100%';nodes['fx-strength-value'].textContent='100%';
  nodes['simple-volume'].value='85';
  nodes['current-time'].textContent='0:00';
  nodes.duration.textContent='0:00';
  const sources = VISUALS.map(value => element('source-' + value, { mode: value }));
  const swatches = PALETTES.map(value => element('swatch-' + value, { palette: value }));
  swatches[0].classList.toggle('selected',true);
  const fxRows=[];
  const body = element('body'),docHandlers=new Map();
  const doc = {
    body,
    activeElement:null,
    addEventListener:(name,callback)=>docHandlers.set(name,callback),
    removeEventListener:(name,callback)=>{
      if(docHandlers.get(name)===callback)docHandlers.delete(name);
    },
    getElementById: id => nodes[id] ?? null,
    createElement: tag => element(tag),
    defaultView: { Event: class { constructor(type,opts){this.type=type;this.bubbles=opts?.bubbles;} } },
    querySelectorAll: selector => selector === '[data-mode]' ? sources :
      selector === '[data-palette]' ? swatches :
      selector === '#fx-stack .fx-stack-entry' ? fxRows : [],
    querySelector:selector => selector === '#fx-stack .fx-stack-entry.selected .fx-stack-name'
      ?fxRows.find(row=>row.classList.contains('selected'))?.querySelector('.fx-stack-name')??null
      :null
  };
  function key(char,extras={}) {
    let prevented=false,stopped=false;
    const event={key:char,target:{tagName:'DIV'},preventDefault(){prevented=true;},
      stopPropagation(){stopped=true;},...extras};
    docHandlers.get('keydown')?.(event);
    return {prevented,stopped};
  }
  const observers = [];
  class Observer {
    constructor(callback) { this.callback = callback; this.observed = []; observers.push(this); }
    observe(node, opts) { this.observed.push([node, opts.attributeFilter?.[0] ?? 'text']); }
    disconnect() { this.disconnected = true; }
    notify() { this.callback(); }
  }
  return { nodes, sources, swatches, fxRows, body, doc, Observer, observers, key, docHandlers };
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

test('Stage 14 native start/end buttons and repeat preserve original BeatScope behavior',()=>{
  const f=fixture();
  f.nodes.previous.addEventListener('click',()=>{f.nodes.audio.currentTime=0;});
  f.nodes.next.addEventListener('click',()=>{f.nodes.audio.currentTime=f.nodes.audio.duration-.1;});
  f.nodes.repeat.addEventListener('click',()=>{
    f.nodes.audio.loop=!f.nodes.audio.loop;
    f.nodes.repeat.classList.toggle('toggled',f.nodes.audio.loop);
  });
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  const start=f.nodes['simple-previous'],end=f.nodes['simple-next'],loop=f.nodes['simple-repeat'];
  assert.equal(start.disabled,true);
  assert.equal(end.disabled,true);
  assert.equal(loop.disabled,true);
  assert.equal(loop.getAttribute('aria-pressed'),'false');
  start.click();end.click();loop.click();
  assert.deepEqual([f.nodes.previous.clicks,f.nodes.next.clicks,f.nodes.repeat.clicks],[0,0,0],
    'No file should not invoke native handlers even if click dispatched programmatically');
  f.nodes.seek.disabled=false;
  f.nodes.audio.duration=120;
  f.nodes.audio.currentTime=55;
  f.nodes.audio.emit('loadedmetadata');
  assert.equal(start.disabled,false);
  assert.equal(end.disabled,false);
  assert.equal(loop.disabled,false);
  start.click();
  assert.equal(f.nodes.previous.clicks,1);
  assert.equal(f.nodes.audio.currentTime,0);
  end.click();
  assert.equal(f.nodes.next.clicks,1);
  assert.ok(Math.abs(f.nodes.audio.currentTime-119.9)<.001);
  loop.click();f.observers[0].notify();
  assert.equal(f.nodes.repeat.clicks,1);
  assert.equal(f.nodes.audio.loop,true);
  assert.equal(loop.getAttribute('aria-pressed'),'true');
  assert.equal(loop.getAttribute('aria-label'),'Ismétlés kikapcsolása');
  assert.equal(loop.textContent,'↻ Ismétlés: be');
  loop.click();f.observers[0].notify();
  assert.equal(f.nodes.audio.loop,false);
  assert.equal(loop.getAttribute('aria-pressed'),'false');
  ctrl.disconnect();
});

test('Stage 14 mirrored repeat state responds to Pro changes and disabled native actions',()=>{
  const f=fixture(),ctrl=attachSimpleControls(f.doc,f.Observer);
  f.nodes.seek.disabled=false;
  f.nodes.audio.duration=45;
  f.nodes.audio.loop=true;
  f.nodes.repeat.classList.toggle('toggled',true);
  f.observers[0].notify();
  assert.equal(f.nodes['simple-repeat'].getAttribute('aria-pressed'),'true');
  assert.equal(f.nodes['simple-repeat'].disabled,false);
  f.nodes.repeat.disabled=true;
  f.nodes.previous.disabled=true;
  f.nodes.next.disabled=true;
  f.observers[0].notify();
  for(const id of ['simple-repeat','simple-previous','simple-next'])
    assert.equal(f.nodes[id].disabled,true,id);
  f.nodes['simple-repeat'].click();
  f.nodes['simple-previous'].click();
  f.nodes['simple-next'].click();
  assert.equal(f.nodes.repeat.clicks,0);
  assert.equal(f.nodes.previous.clicks,0);
  assert.equal(f.nodes.next.clicks,0);
  ctrl.disconnect();
});

test('Stage 14 microphone and missing/invalid duration disable start/end/repeat',()=>{
  const f=fixture(),ctrl=attachSimpleControls(f.doc,f.Observer);
  f.nodes.seek.disabled=false;
  for(const invalid of [NaN,0,Infinity,-20]){
    f.nodes.audio.duration=invalid;
    f.nodes.audio.emit('durationchange');
    for(const id of ['simple-repeat','simple-previous','simple-next'])
      assert.equal(f.nodes[id].disabled,true,'invalid duration: '+invalid);
  }
  f.nodes.audio.duration=80;
  f.nodes.microphone.classList.toggle('active',true);
  f.observers[0].notify();
  for(const id of ['simple-repeat','simple-previous','simple-next'])
    assert.equal(f.nodes[id].disabled,true,'microphone should disable '+id);
  f.nodes.microphone.classList.toggle('active',false);
  f.observers[0].notify();
  assert.equal(f.nodes['simple-repeat'].disabled,false);
  ctrl.disconnect();
});

test('Stage 14 HTML retains separate native source controls and visible Simple labels',()=>{
  const html=read('index.html'),css=read('src/lumina-theme.css'),js=read('src/simple-controls.js');
  for(const id of ['simple-repeat','simple-previous','simple-next','repeat','previous','next'])
    assert.ok(html.includes('id="'+id+'"'),'Missing '+id);
  assert.match(html,/Ugrás a zene végére/);
  assert.match(css,/\.simple-transport-extra/);
  assert.match(js,/get\('repeat'\)/);
});

test('Stage 15 Simple M, R, S shortcuts delegate exactly once to the native player',()=>{
  const f=fixture();
  f.body.dataset.studioMode='simple';
  f.nodes.seek.disabled=false;f.nodes.audio.duration=80;
  f.nodes.mute.addEventListener('click',()=>{
    f.nodes.audio.muted=!f.nodes.audio.muted;f.nodes.audio.emit('volumechange');
  });
  f.nodes.repeat.addEventListener('click',()=>{
    f.nodes.audio.loop=!f.nodes.audio.loop;
    f.nodes.repeat.classList.toggle('toggled',f.nodes.audio.loop);
  });
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  assert.deepEqual(SIMPLE_SHORTCUTS,{m:'simple-mute',r:'simple-repeat',s:'simple-stop'});
  const mute=f.key('m');
  assert.equal(mute.prevented,true);
  assert.equal(mute.stopped,true);
  assert.equal(f.nodes.mute.clicks,1);
  assert.equal(f.nodes.audio.muted,true);
  assert.equal(f.nodes['simple-mute'].getAttribute('aria-pressed'),'true');
  const repeat=f.key('R');
  assert.equal(repeat.prevented,true);
  assert.equal(f.nodes.repeat.clicks,1);
  assert.equal(f.nodes.audio.loop,true);
  f.observers[0].notify();
  assert.equal(f.nodes['simple-repeat'].getAttribute('aria-pressed'),'true');
  const stop=f.key('s');
  assert.equal(stop.prevented,true);
  assert.equal(f.nodes.stop.clicks,1);
  assert.equal(f.key(' ').prevented,false,'Native BeatScope owns Space; no duplicate');
  assert.equal(f.key('a').prevented,false,'Native BeatScope owns A key');
  ctrl.disconnect();
  assert.equal(f.docHandlers.has('keydown'),false,'Disconnect removes document listener');
});

test('Stage 15 shortcuts never hijack typing, modifiers, repeat or dialog controls',()=>{
  const f=fixture();
  f.body.dataset.studioMode='simple';
  f.nodes.seek.disabled=false;f.nodes.audio.duration=90;
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  const denied=[
    ['m',{target:{tagName:'INPUT'}}],
    ['m',{target:{tagName:'TEXTAREA'}}],
    ['m',{target:{tagName:'SELECT'}}],
    ['m',{target:{tagName:'DIV',isContentEditable:true}}],
    ['m',{target:{tagName:'DIV',closest:()=>({})}}],
    ['m',{ctrlKey:true}],['m',{altKey:true}],['m',{metaKey:true}],
    ['m',{shiftKey:true}],['m',{repeat:true}],['m',{isComposing:true}],
    ['m',{defaultPrevented:true}]
  ];
  for(const [key,event] of denied)
    assert.equal(f.key(key,event).prevented,false,'Must ignore '+JSON.stringify(event));
  assert.equal(f.nodes.mute.clicks||0,0);
  f.doc.querySelector=()=>({id:'open-dialog'});
  assert.equal(f.key('m').prevented,false,'Modal should keep its keys');
  f.doc.querySelector=()=>null;
  f.body.dataset.studioMode='pro';
  assert.equal(f.key('m').prevented,false);
  f.body.dataset.studioMode='simple';
  assert.equal(f.key('s').prevented,true);
  assert.equal(f.nodes.stop.clicks,1);
  f.nodes.stop.disabled=true;f.observers[0].notify();
  assert.equal(f.key('s').prevented,false);
  assert.equal(f.nodes.stop.clicks,1);
  f.nodes.seek.disabled=true;f.observers[0].notify();
  assert.equal(f.key('r').prevented,false);
  assert.equal(f.nodes.repeat.clicks||0,0);
  ctrl.disconnect();
});

test('Stage 15 Simple keyboard hint documents only shortcuts actually available',()=>{
  const html=read('index.html'),css=read('src/lumina-theme.css'),js=read('src/simple-controls.js');
  assert.match(html,/id="simple-keyboard-hint"/);
  for(const letter of ['Space','M','R','S'])assert.ok(html.includes('<kbd>'+letter+'</kbd>'),letter);
  assert.match(css,/\.simple-keyboard-hint/);
  assert.match(js,/SIMPLE_SHORTCUTS/);
});

test('Stage 16 Simple visual intensity and smoothing use native BeatScope input exactly once',()=>{
  const f=fixture();
  const events={intensity:0,smooth:0};
  for(const id of ['intensity','smooth']){
    const node=f.nodes[id],dispatch=node.dispatchEvent.bind(node);
    node.dispatchEvent=event=>{
      events[id]++;
      f.nodes[id+'-val'].textContent=node.value+'%';
      return dispatch(event);
    };
  }
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  assert.deepEqual(VISUAL_TUNING.slice(0,2).map(entry=>entry[1]),['intensity','smooth']);
  assert.equal(f.nodes['simple-intensity'].value,'115');
  assert.equal(f.nodes['simple-smooth'].value,'75');
  f.nodes['simple-intensity'].value='185';
  f.nodes['simple-intensity'].emit('input');
  assert.equal(events.intensity,1);
  assert.equal(f.nodes.intensity.value,'185');
  assert.equal(f.nodes['simple-intensity-value'].textContent,'185%');
  assert.equal(f.nodes['simple-intensity'].getAttribute('aria-valuetext'),'185%');
  f.nodes['simple-smooth'].value='32';
  f.nodes['simple-smooth'].emit('input');
  assert.equal(events.smooth,1);
  assert.equal(f.nodes.smooth.value,'32');
  assert.equal(f.nodes['simple-smooth-value'].textContent,'32%');
  ctrl.disconnect();
});

test('Stage 16 Pro changes restore exact slider values and reject disabled/invalid input',()=>{
  const f=fixture(),ctrl=attachSimpleControls(f.doc,f.Observer);
  f.nodes.intensity.value='230';
  f.nodes['intensity-val'].textContent='230%';
  f.nodes.intensity.emit('input');
  assert.equal(f.nodes['simple-intensity'].value,'230');
  assert.equal(f.nodes['simple-intensity-value'].textContent,'230%');
  f.nodes.smooth.value='12';
  f.nodes['smooth-val'].textContent='12%';
  f.nodes.smooth.emit('input');
  assert.equal(f.nodes['simple-smooth'].value,'12');
  assert.equal(f.nodes['simple-smooth-value'].textContent,'12%');
  f.nodes.intensity.disabled=true;
  f.nodes.smooth.disabled=true;
  f.observers[0].notify();
  assert.equal(f.nodes['simple-intensity'].disabled,true);
  assert.equal(f.nodes['simple-smooth'].disabled,true);
  f.nodes['simple-intensity'].value='80';
  f.nodes['simple-intensity'].emit('input');
  assert.equal(f.nodes.intensity.value,'230');
  f.nodes.intensity.disabled=false;
  f.observers[0].notify();
  f.nodes['simple-intensity'].value='not a number';
  f.nodes['simple-intensity'].emit('input');
  assert.equal(f.nodes.intensity.value,'230');
  f.nodes['simple-intensity'].value='999';
  f.nodes['simple-intensity'].emit('input');
  assert.equal(f.nodes.intensity.value,'300','Hard clamp to native max');
  ctrl.disconnect();
});

test('Stage 16 two-way visual settings are present in real renderer without new generator',()=>{
  const html=read('index.html'),css=read('src/lumina-theme.css'),js=read('src/simple-controls.js');
  for(const id of ['intensity','smooth','simple-intensity','simple-smooth',
    'simple-intensity-value','simple-smooth-value'])
    assert.ok(html.includes('id="'+id+'"'),'Missing '+id);
  assert.match(css,/\.simple-visual-tuning/);
  assert.match(js,/native\.dispatchEvent\(new NativeEvent\('input'/);
  assert.match(js,/syncVisualTuning/);
});

test('Stage 17 Simple palette follows the native BeatScope swatches and delegates exactly once',()=>{
  const f=fixture(),ctrl=attachSimpleControls(f.doc,f.Observer);
  const simple=f.nodes['simple-palette'];
  assert.deepEqual(PALETTES,['azure','mint','violet','sunset','rainbow']);
  assert.equal(simple.value,'azure','Initial selection follows native current palette');
  // Simulate native renderer setPalette() when the real swatch receives a click.
  for(const swatch of f.swatches){
    swatch.addEventListener('click',()=>{
      for(const item of f.swatches)
        item.classList.toggle('selected',item===swatch);
      f.observers[0].notify();
    });
  }
  for(const name of ['mint','violet','sunset','rainbow','azure']){
    simple.value=name;
    simple.change();
    const source=f.swatches.find(node=>node.dataset.palette===name);
    assert.equal(source.clicks,1,'Native swatch clicked once for '+name);
    assert.equal(source.classList.contains('selected'),true);
    assert.equal(simple.value,name);
  }
  simple.value='not-supported';
  simple.change();
  assert.equal(f.swatches.reduce((count,node)=>count+node.clicks,0),5,
    'Unknown palette must never click a native swatch');
  f.swatches[1].disabled=true;
  simple.value='mint';
  simple.change();
  assert.equal(f.swatches[1].clicks,1,'Disabled native swatch must be respected');
  ctrl.disconnect();
});

test('Stage 17 Simple selector mirrors palette changes made in Pro or by AI',()=>{
  const f=fixture(),ctrl=attachSimpleControls(f.doc,f.Observer);
  const simple=f.nodes['simple-palette'];
  for(const palette of ['violet','rainbow','sunset']){
    for(const swatch of f.swatches)
      swatch.classList.toggle('selected',swatch.dataset.palette===palette);
    f.observers[0].notify();
    assert.equal(simple.value,palette,'Mirrors selected native palette '+palette);
  }
  assert.ok(f.observers[0].observed.length>=PALETTES.length+7);
  // No chosen palette is a temporary state; do not replace it arbitrarily.
  for(const swatch of f.swatches)swatch.classList.toggle('selected',false);
  f.observers[0].notify();
  assert.equal(simple.value,'sunset');
  ctrl.disconnect();
  assert.equal(f.observers[0].disconnected,true);
});

test('Stage 17 palette exists in actual renderer, with original palette retained',()=>{
  const html=read('index.html'),css=read('src/lumina-theme.css'),js=read('src/simple-controls.js');
  assert.match(html,/id="simple-palette"/);
  for(const value of PALETTES){
    assert.ok(html.includes('data-palette="'+value+'"'),'Native swatch '+value);
    assert.ok(html.includes('<option value="'+value+'">'),'Simple option '+value);
  }
  assert.match(css,/#simple-palette:focus-visible/);
  assert.match(js,/source\.click\(\)/);
});

test('Stage 18 Simple auto palette delegates a single native change and syncs both modes',()=>{
  const f=fixture();
  let nativeChanges=0;
  const native=f.nodes['ai-palette'];
  const originalDispatch=native.dispatchEvent.bind(native);
  // Count DOM dispatches without overriding the fixture's single listener slot.
  native.dispatchEvent=event=>{
    if(event.type==='change')nativeChanges++;
    return originalDispatch(event);
  };
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  const simple=f.nodes['simple-ai-palette'];
  assert.equal(simple.checked,false);
  assert.equal(simple.disabled,false);
  simple.checked=true;simple.change();
  assert.equal(native.checked,true);
  assert.equal(nativeChanges,1);
  assert.equal(simple.checked,true);
  assert.equal(simple.disabled,false);
  simple.change();
  assert.equal(nativeChanges,1,'Unchanged value never dispatches duplicate change');
  native.checked=false;native.dispatchEvent(new f.doc.defaultView.Event('change',{bubbles:true}));
  assert.equal(nativeChanges,2);
  assert.equal(simple.checked,false,'Pro mode change must sync the Simple control');
  native.checked=true;native.dispatchEvent(new f.doc.defaultView.Event('change',{bubbles:true}));
  assert.equal(nativeChanges,3);
  assert.equal(simple.checked,true);
  ctrl.disconnect();
  native.checked=false;native.change();
  assert.equal(simple.checked,true,'Disconnect must remove native listener');
});

test('Stage 18 native disabled state is respected and restores Simple value',()=>{
  const f=fixture(),native=f.nodes['ai-palette'],simple=f.nodes['simple-ai-palette'];
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  native.disabled=true;
  f.observers[0].notify();
  assert.equal(simple.disabled,true);
  simple.checked=true;simple.change();
  assert.equal(native.checked,false,'Disabled native checkbox stays unchanged');
  assert.equal(simple.checked,false,'Invalid Simple update is rolled back');
  native.disabled=false;
  f.observers[0].notify();
  assert.equal(simple.disabled,false);
  simple.checked=true;simple.change();
  assert.equal(native.checked,true);
  ctrl.disconnect();
});

test('Stage 18 Simple AI palette uses real native preference and documents AI dependence',()=>{
  const html=read('index.html'),js=read('src/simple-controls.js'),css=read('src/lumina-theme.css');
  assert.match(html,/id="simple-ai-palette" type="checkbox"/);
  assert.match(html,/id="ai-palette" type="checkbox"/);
  assert.match(html,/Automata FX közben váltja a palettát/);
  assert.match(js,/nativeAutoPalette\.dispatchEvent/);
  assert.match(js,/nativeAutoPalette\?\.addEventListener\('change',syncAutoPalette\)/);
  assert.match(css,/\.simple-auto-palette/);
});

test('Stage 19 Simple AI speed delegates exactly one change to native BeatScope director',()=>{
  const f=fixture(),native=f.nodes['ai-speed'],simple=f.nodes['simple-ai-speed'];
  let nativeChanges=0;
  const originalDispatch=native.dispatchEvent.bind(native);
  native.dispatchEvent=event=>{
    if(event.type==='change')nativeChanges++;
    return originalDispatch(event);
  };
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  assert.deepEqual(AI_SPEEDS,['calm','balanced','party']);
  assert.equal(simple.value,'balanced');
  assert.equal(simple.disabled,false);
  for(const [speed,count] of [['calm',1],['party',2],['balanced',3]]){
    simple.value=speed;simple.change();
    assert.equal(native.value,speed,'Native renderer speed '+speed);
    assert.equal(nativeChanges,count,'Exactly one native change per real change');
    assert.equal(simple.value,speed);
  }
  simple.change();
  assert.equal(nativeChanges,3,'Duplicate selected value does not redispatch');
  ctrl.disconnect();
});

test('Stage 19 Pro AI speed changes propagate back to Simple without a second timer',()=>{
  const f=fixture(),native=f.nodes['ai-speed'],simple=f.nodes['simple-ai-speed'];
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  for(const speed of ['party','calm','balanced']){
    native.value=speed;
    native.dispatchEvent(new f.doc.defaultView.Event('change',{bubbles:true}));
    assert.equal(simple.value,speed);
  }
  ctrl.disconnect();
  native.value='party';native.change();
  assert.equal(simple.value,'balanced','Listener is removed on disconnect');
});

test('Stage 19 unsupported or disabled AI speed never changes native preference',()=>{
  const f=fixture(),native=f.nodes['ai-speed'],simple=f.nodes['simple-ai-speed'];
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  native.disabled=true;f.observers[0].notify();
  assert.equal(simple.disabled,true);
  simple.value='party';simple.change();
  assert.equal(native.value,'balanced');
  assert.equal(simple.value,'balanced','Rejected change rolls back to real native value');
  native.disabled=false;f.observers[0].notify();
  assert.equal(simple.disabled,false);
  simple.value='invalid';simple.change();
  assert.equal(native.value,'balanced');
  assert.equal(simple.value,'balanced');
  simple.value='party';simple.change();
  assert.equal(native.value,'party');
  ctrl.disconnect();
});

test('Stage 19 AI speed exposes the same native options with no new AI algorithm',()=>{
  const html=read('index.html'),css=read('src/lumina-theme.css'),js=read('src/simple-controls.js');
  assert.match(html,/id="simple-ai-speed"/);
  assert.match(html,/id="ai-speed"/);
  for(const value of AI_SPEEDS){
    assert.equal((html.match(new RegExp('<option value="'+value+'"','g'))||[]).length,2,
      'Simple and Pro speed '+value);
  }
  assert.match(css,/#simple-ai-speed:focus-visible/);
  assert.match(js,/nativeAISpeed\.dispatchEvent/);
  assert.match(js,/nativeAISpeed\?\.addEventListener\('change',syncAISpeed\)/);
});

test('Stage 20 Simple background grid invokes original renderer exactly once per change',()=>{
  const f=fixture(),native=f.nodes['show-grid'],quick=f.nodes['simple-show-grid'];
  let calls=0;
  const dispatch=native.dispatchEvent.bind(native);
  native.dispatchEvent=event=>{
    if(event.type==='change')calls++;
    return dispatch(event);
  };
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  assert.equal(native.checked,true);
  assert.equal(quick.checked,true);
  quick.checked=false;quick.change();
  assert.equal(native.checked,false);
  assert.equal(calls,1,'Native change event fired once for turning grid off');
  quick.change();
  assert.equal(calls,1,'Duplicate off state must not fire another event');
  quick.checked=true;quick.change();
  assert.equal(native.checked,true);
  assert.equal(calls,2);
  ctrl.disconnect();
});

test('Stage 20 Pro grid updates sync to Simple, including persisted original state',()=>{
  const f=fixture(),native=f.nodes['show-grid'],quick=f.nodes['simple-show-grid'];
  native.checked=false;
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  assert.equal(quick.checked,false,'Restores original checkbox state on startup');
  native.checked=true;native.dispatchEvent(new f.doc.defaultView.Event('change',{bubbles:true}));
  assert.equal(quick.checked,true);
  native.checked=false;native.dispatchEvent(new f.doc.defaultView.Event('change',{bubbles:true}));
  assert.equal(quick.checked,false);
  ctrl.disconnect();
  native.checked=true;native.change();
  assert.equal(quick.checked,false,'Disconnect removes synchronization listener');
});

test('Stage 20 disabled original grid cannot be modified by Simple Mode',()=>{
  const f=fixture(),native=f.nodes['show-grid'],quick=f.nodes['simple-show-grid'];
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  native.disabled=true;f.observers[0].notify();
  assert.equal(quick.disabled,true);
  quick.checked=false;quick.change();
  assert.equal(native.checked,true,'Disabled original grid setting remains checked');
  assert.equal(quick.checked,true,'Rejected Simple change is rolled back');
  native.disabled=false;f.observers[0].notify();
  assert.equal(quick.disabled,false);
  quick.checked=false;quick.change();
  assert.equal(native.checked,false);
  ctrl.disconnect();
});

test('Stage 20 background grid is in the original Electron renderer without a new preference',()=>{
  const html=read('index.html'),js=read('src/simple-controls.js'),css=read('src/lumina-theme.css');
  assert.match(html,/id="simple-show-grid" type="checkbox"/);
  assert.match(html,/id="show-grid" type="checkbox"/);
  assert.match(html,/Finom háttérrács/);
  assert.match(js,/nativeGrid\.dispatchEvent/);
  assert.match(js,/nativeGrid\?\.addEventListener\('change',syncGrid\)/);
  assert.match(css,/\.simple-grid-toggle/);
});

test('Stage 21 Simple Spectrum Bars count delegates to native visual engine exactly once',()=>{
  const f=fixture(),native=f.nodes['bars-count'],quick=f.nodes['simple-bars-count'];
  let nativeInputs=0;
  const originalDispatch=native.dispatchEvent.bind(native);
  native.dispatchEvent=event=>{
    if(event.type==='input'){
      nativeInputs++;
      f.nodes['bars-val'].textContent=native.value;
    }
    return originalDispatch(event);
  };
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  assert.ok(VISUAL_TUNING.some(([quickId,nativeId])=>
    quickId==='simple-bars-count'&&nativeId==='bars-count'));
  assert.equal(quick.value,'56');
  assert.equal(f.nodes['simple-bars-value'].textContent,'56');
  quick.value='80';quick.emit('input');
  assert.equal(nativeInputs,1,'Exactly one native change');
  assert.equal(native.value,'80');
  assert.equal(quick.getAttribute('aria-valuetext'),'80');
  assert.equal(f.nodes['simple-bars-value'].textContent,'80');
  ctrl.disconnect();
});

test('Stage 21 bars density preserves original steps and safely clamps bad values',()=>{
  const f=fixture(),native=f.nodes['bars-count'],quick=f.nodes['simple-bars-count'];
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  quick.value='83';quick.emit('input');
  assert.equal(native.value,'80','Step 8 rounds to the nearest native permitted value');
  quick.value='999';quick.emit('input');
  assert.equal(native.value,'128');
  quick.value='-50';quick.emit('input');
  assert.equal(native.value,'16');
  quick.value='not-a-number';quick.emit('input');
  assert.equal(native.value,'16','Invalid input cannot change engine settings');
  native.disabled=true;f.observers[0].notify();
  assert.equal(quick.disabled,true);
  quick.value='96';quick.emit('input');
  assert.equal(native.value,'16','Disabled original control cannot be overridden');
  ctrl.disconnect();
});

test('Stage 21 Pro bar count input updates the Simple slider, even after reload',()=>{
  const f=fixture(),native=f.nodes['bars-count'],quick=f.nodes['simple-bars-count'];
  native.value='96';f.nodes['bars-val'].textContent='96';
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  assert.equal(quick.value,'96','Native stored value restored by original renderer');
  assert.equal(f.nodes['simple-bars-value'].textContent,'96');
  native.value='120';f.nodes['bars-val'].textContent='120';
  native.dispatchEvent(new f.doc.defaultView.Event('input',{bubbles:true}));
  assert.equal(quick.value,'120');
  assert.equal(f.nodes['simple-bars-value'].textContent,'120');
  ctrl.disconnect();
  native.value='64';native.emit('input');
  assert.equal(quick.value,'120','Unsubscribes on disconnect');
});

test('Stage 21 bars control is part of original renderer and keeps original spectrum parameters',()=>{
  const html=read('index.html'),css=read('src/lumina-theme.css');
  for(const id of ['simple-bars-count','simple-bars-value','bars-count','bars-val'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(html,/id="simple-bars-count" min="16" max="128" value="56" step="8"/);
  assert.match(html,/csak Bars módban/);
  assert.match(css,/\.simple-bars-tuning/);
});

test('Stage 22 Simple FX bypass delegates once and mirrors the original BeatScope state',()=>{
  const f=fixture(),native=f.nodes['fx-bypass'],quick=f.nodes['simple-fx-bypass'];
  let fxItems=['glow','blur'],nativeClicks=0;
  native.setAttribute('aria-pressed','false');
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  native.addEventListener('click',()=>{
    nativeClicks++;
    const next=native.getAttribute('aria-pressed')!=='true';
    native.setAttribute('aria-pressed',String(next));
    // Native bypass must not remove or reorder FX in the original Pro chain.
  });
  assert.equal(quick.disabled,false);
  assert.equal(quick.getAttribute('aria-pressed'),'false');
  assert.equal(quick.textContent,'◉ FX aktív');
  quick.click();f.observers[0].notify();
  assert.equal(nativeClicks,1);
  assert.equal(native.getAttribute('aria-pressed'),'true');
  assert.equal(quick.getAttribute('aria-pressed'),'true');
  assert.equal(quick.getAttribute('aria-label'),'Effektek visszakapcsolása');
  assert.equal(quick.textContent,'◌ FX kikapcsolva');
  assert.deepEqual(fxItems,['glow','blur'],'Bypass never removes effects');
  quick.click();f.observers[0].notify();
  assert.equal(nativeClicks,2);
  assert.equal(native.getAttribute('aria-pressed'),'false');
  assert.equal(quick.getAttribute('aria-pressed'),'false');
  assert.equal(quick.getAttribute('aria-label'),'Effektek kikapcsolása');
  ctrl.disconnect();
});

test('Stage 22 Pro native FX bypass changes are visible in Simple including startup state',()=>{
  const f=fixture(),native=f.nodes['fx-bypass'],quick=f.nodes['simple-fx-bypass'];
  native.setAttribute('aria-pressed','true');
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  assert.equal(quick.getAttribute('aria-pressed'),'true');
  native.setAttribute('aria-pressed','false');f.observers[0].notify();
  assert.equal(quick.getAttribute('aria-pressed'),'false');
  native.setAttribute('aria-pressed','true');f.observers[0].notify();
  assert.equal(quick.getAttribute('aria-pressed'),'true');
  assert.ok(f.observers[0].observed.some(([node,attribute])=>
    node===native&&attribute==='aria-pressed'),
    'Native FX bypass is observed');
  ctrl.disconnect();
});

test('Stage 22 cannot bypass disabled or missing native FX control',()=>{
  const f=fixture(),native=f.nodes['fx-bypass'],quick=f.nodes['simple-fx-bypass'];
  native.setAttribute('aria-pressed','false');
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  native.disabled=true;f.observers[0].notify();
  assert.equal(quick.disabled,true);
  quick.click();
  assert.equal(native.clicks||0,0,'Disabled native FX button is never invoked');
  native.disabled=false;f.observers[0].notify();
  assert.equal(quick.disabled,false);
  quick.click();
  assert.equal(native.clicks,1);
  ctrl.disconnect();
  const g=fixture(),originalGet=g.doc.getElementById;
  g.doc.getElementById=id=>id==='fx-bypass'?null:originalGet(id);
  const missing=attachSimpleControls(g.doc,g.Observer);
  assert.equal(g.nodes['simple-fx-bypass'].disabled,true);
  g.nodes['simple-fx-bypass'].click();
  missing.disconnect();
});

test('Stage 22 Simple FX quick action remains connected to original Pro FX stack',()=>{
  const html=read('index.html'),js=read('src/simple-controls.js'),
    css=read('src/lumina-theme.css');
  assert.match(html,/id="simple-fx-bypass"/);
  assert.match(html,/id="fx-bypass"/);
  assert.match(html,/FX-ek ideiglenes ki- és bekapcsolása/);
  assert.equal(ACTIONS['simple-fx-bypass'],'fx-bypass');
  assert.match(js,/syncFXBypass/);
  assert.match(css,/#simple-fx-bypass\[aria-pressed="true"\]/);
});

test('Stage 23 Simple FX Autopilot invokes the real 120-FX switch, not AI Visual Director',()=>{
  const f=fixture(),native=f.nodes['fx-auto'],quick=f.nodes['simple-fx-auto'];
  const director=f.nodes['ai-toggle'];
  native.setAttribute('aria-checked','false');
  director.setAttribute('aria-checked','false');
  let nativeClicks=0;
  const originalClick=native.click.bind(native);
  native.click=()=>{
    nativeClicks++;
    const active=native.getAttribute('aria-checked')!=='true';
    native.setAttribute('aria-checked',String(active));
    originalClick();
  };
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  assert.equal(ACTIONS['simple-fx-auto'],'fx-auto');
  assert.equal(quick.disabled,false);
  assert.equal(quick.getAttribute('aria-checked'),'false');
  assert.equal(quick.textContent,'✦ 120 FX Autopilot: KI');
  quick.click();f.observers[0].notify();
  assert.equal(nativeClicks,1);
  assert.equal(native.getAttribute('aria-checked'),'true');
  assert.equal(quick.getAttribute('aria-checked'),'true');
  assert.equal(quick.getAttribute('aria-label'),'120 FX Autopilot kikapcsolása');
  assert.equal(quick.textContent,'✦ 120 FX Autopilot: BE');
  assert.equal(director.getAttribute('aria-checked'),'false','Different AI director must be unaffected');
  quick.click();f.observers[0].notify();
  assert.equal(nativeClicks,2);
  assert.equal(native.getAttribute('aria-checked'),'false');
  assert.equal(quick.getAttribute('aria-checked'),'false');
  ctrl.disconnect();
});

test('Stage 23 native Pro FX Autopilot changes sync to Simple and preserve earlier FX bypass',()=>{
  const f=fixture(),native=f.nodes['fx-auto'],quick=f.nodes['simple-fx-auto'];
  native.setAttribute('aria-checked','true');
  f.nodes['fx-bypass'].setAttribute('aria-pressed','false');
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  assert.equal(quick.getAttribute('aria-checked'),'true');
  assert.equal(quick.textContent,'✦ 120 FX Autopilot: BE');
  native.setAttribute('aria-checked','false');f.observers[0].notify();
  assert.equal(quick.getAttribute('aria-checked'),'false');
  native.setAttribute('aria-checked','true');f.observers[0].notify();
  assert.equal(quick.getAttribute('aria-checked'),'true');
  assert.equal(f.nodes['simple-fx-bypass'].getAttribute('aria-pressed'),'false',
    'FX Autopilot is not the FX bypass switch');
  assert.ok(f.observers[0].observed.some(([node,attribute])=>
    node===native&&attribute==='aria-checked'));
  ctrl.disconnect();
});

test('Stage 23 disabled or missing FX Autopilot switch never launches native action',()=>{
  const f=fixture(),native=f.nodes['fx-auto'],quick=f.nodes['simple-fx-auto'];
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  native.disabled=true;f.observers[0].notify();
  assert.equal(quick.disabled,true);
  quick.click();
  assert.equal(native.clicks,0);
  native.disabled=false;f.observers[0].notify();
  assert.equal(quick.disabled,false);
  quick.click();
  assert.equal(native.clicks,1);
  ctrl.disconnect();
  const g=fixture(),orig=g.doc.getElementById;
  g.doc.getElementById=id=>id==='fx-auto'?null:orig(id);
  const missing=attachSimpleControls(g.doc,g.Observer);
  assert.equal(g.nodes['simple-fx-auto'].disabled,true);
  g.nodes['simple-fx-auto'].click();
  missing.disconnect();
});

test('Stage 23 dedicated FX Autopilot is distinct from AI Visual Director in renderer',()=>{
  const html=read('index.html'),js=read('src/simple-controls.js'),
    css=read('src/lumina-theme.css');
  for(const id of ['simple-fx-auto','fx-auto','simple-ai','ai-toggle','simple-fx-bypass'])
    assert.ok(html.includes('id="'+id+'"'),'Missing '+id);
  assert.match(html,/id="simple-fx-auto" role="switch" aria-checked="false"/);
  assert.match(html,/120 FX Autopilot/);
  assert.match(js,/nativeFXAuto\?\.addEventListener\('click',syncFXAutopilot\)/);
  assert.match(css,/#simple-fx-auto\[aria-checked="true"\]/);
});

test('Stage 24 Simple FX parameters are unavailable until Pro selects an effect',()=>{
  const f=fixture();
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  for(const id of ['simple-fx-wet','simple-fx-strength'])
    assert.equal(f.nodes[id].disabled,true,id);
  assert.equal(f.nodes['simple-fx-wet-value'].textContent,'—');
  assert.equal(f.nodes['simple-fx-strength-value'].textContent,'—');
  assert.equal(f.nodes['simple-fx-selection'].textContent,'Válassz egy effektet Pro módban');
  f.nodes['simple-fx-wet'].value='24';f.nodes['simple-fx-wet'].emit('input');
  assert.equal(f.nodes['fx-wet'].value,'100','Disabled FX cannot be edited');
  ctrl.disconnect();
});

test('Stage 24 Simple Wet/Dry and strength forward native inputs to the selected FX',()=>{
  const f=fixture();
  f.nodes['fx-wet'].disabled=false;
  f.nodes['fx-strength'].disabled=false;
  const nativeInputs={wet:0,strength:0};
  for(const [id,name] of [['fx-wet','wet'],['fx-strength','strength']]){
    const control=f.nodes[id],original=control.dispatchEvent.bind(control);
    control.dispatchEvent=ev=>{
      if(ev.type==='input'){
        nativeInputs[name]++;
        f.nodes[id+'-value'].textContent=control.value+'%';
      }
      return original(ev);
    };
  }
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  assert.equal(f.nodes['simple-fx-wet'].disabled,false);
  assert.equal(f.nodes['simple-fx-strength'].disabled,false);
  assert.equal(f.nodes['simple-fx-selection'].textContent,'Kiválasztott Pro effekt');
  f.nodes['simple-fx-wet'].value='38';f.nodes['simple-fx-wet'].emit('input');
  assert.equal(f.nodes['fx-wet'].value,'38');
  assert.equal(nativeInputs.wet,1,'One event to native Wet/Dry');
  assert.equal(f.nodes['simple-fx-wet-value'].textContent,'38%');
  assert.equal(f.nodes['simple-fx-wet'].getAttribute('aria-valuetext'),'38%');
  f.nodes['simple-fx-strength'].value='145';f.nodes['simple-fx-strength'].emit('input');
  assert.equal(f.nodes['fx-strength'].value,'145');
  assert.equal(nativeInputs.strength,1,'One event to native Strength');
  assert.equal(f.nodes['simple-fx-strength-value'].textContent,'145%');
  ctrl.disconnect();
});

test('Stage 24 native Pro FX parameter changes and selection refresh synchronize Simple',()=>{
  const f=fixture();
  const wet=f.nodes['fx-wet'],strength=f.nodes['fx-strength'];
  wet.disabled=false;strength.disabled=false;
  wet.value='32';strength.value='175';
  f.nodes['fx-wet-value'].textContent='32%';
  f.nodes['fx-strength-value'].textContent='175%';
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  assert.equal(f.nodes['simple-fx-wet'].value,'32');
  assert.equal(f.nodes['simple-fx-strength'].value,'175');
  wet.value='81';f.nodes['fx-wet-value'].textContent='81%';
  wet.dispatchEvent(new f.doc.defaultView.Event('input',{bubbles:true}));
  assert.equal(f.nodes['simple-fx-wet'].value,'81');
  f.nodes['fx-wet-value'].textContent='81%';
  strength.value='115';f.nodes['fx-strength-value'].textContent='115%';
  strength.dispatchEvent(new f.doc.defaultView.Event('input',{bubbles:true}));
  assert.equal(f.nodes['simple-fx-strength'].value,'115');
  assert.ok(f.observers[0].observed.some(([node])=>node===f.nodes['fx-stack']),
    'FX selection stack must be observed');
  strength.disabled=true;f.observers[0].notify();
  assert.equal(f.nodes['simple-fx-wet'].disabled,true,'No complete FX selection');
  assert.equal(f.nodes['simple-fx-strength'].disabled,true);
  assert.equal(f.nodes['simple-fx-selection'].textContent,'Válassz egy effektet Pro módban');
  ctrl.disconnect();
});

test('Stage 24 invalid/clamped FX values and native disabled state cannot corrupt settings',()=>{
  const f=fixture(),wet=f.nodes['fx-wet'],strength=f.nodes['fx-strength'];
  wet.disabled=false;strength.disabled=false;
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  f.nodes['simple-fx-strength'].value='999';f.nodes['simple-fx-strength'].emit('input');
  assert.equal(strength.value,'200');
  f.nodes['simple-fx-wet'].value='-20';f.nodes['simple-fx-wet'].emit('input');
  assert.equal(wet.value,'0');
  f.nodes['simple-fx-wet'].value='invalid';f.nodes['simple-fx-wet'].emit('input');
  assert.equal(wet.value,'0');
  wet.disabled=true;f.observers[0].notify();
  f.nodes['simple-fx-strength'].value='130';f.nodes['simple-fx-strength'].emit('input');
  assert.equal(strength.value,'200','No selected FX should be editable');
  ctrl.disconnect();
});

test('Stage 24 Simple FX parameter panel reuses native Pro effects and keeps it separate from visuals',()=>{
  const html=read('index.html'),js=read('src/simple-controls.js'),css=read('src/lumina-theme.css');
  for(const id of ['simple-fx-wet','simple-fx-strength','simple-fx-selection','fx-wet','fx-strength'])
    assert.ok(html.includes('id="'+id+'"'),'Missing '+id);
  assert.match(html,/Válassz egy effektet Pro módban/);
  assert.match(js,/native\.dispatchEvent\(new NativeEvent\('input'/);
  assert.match(js,/function syncFXParams\(\)/);
  assert.match(css,/\.simple-fx-parameters/);
});

function addFXRow(f,name,wet,strength,selected=false){
  const row=element('fx-row'),button=element('fx-name');
  const toggle=element('fx-toggle'),up=element('fx-up'),down=element('fx-down'),
    remove=element('fx-remove');
  button.textContent=name;
  row.classList.toggle('selected',selected);
  row.querySelector=selector=>selector==='.fx-stack-name'?button:null;
  row.querySelectorAll=selector=>selector==='button'?[button,toggle,up,down,remove]:[];
  row.nativeNameButton=button;
  row.nativeToggle=toggle;
  row.nativeUp=up;
  row.nativeDown=down;
  row.nativeRemove=remove;
  row.fxSettings={wet,strength};
  remove.addEventListener('click',()=>{
    const index=f.fxRows.indexOf(row);
    if(index<0)return;
    f.fxRows.splice(index,1);
    const next=f.fxRows[Math.min(index,f.fxRows.length-1)];
    if(next)next.nativeNameButton.click();
    else{
      f.nodes['fx-wet'].disabled=true;
      f.nodes['fx-strength'].disabled=true;
    }
    f.observers[0]?.notify();
  });
  for(const [control,step] of [[up,-1],[down,1]]){
    control.addEventListener('click',()=>{
      const index=f.fxRows.indexOf(row),target=index+step;
      if(index<0||target<0||target>=f.fxRows.length)return;
      [f.fxRows[index],f.fxRows[target]]=[f.fxRows[target],f.fxRows[index]];
      f.observers[0]?.notify();
    });
  }
  toggle.textContent='●';
  toggle.addEventListener('click',()=>{
    const next=!button.classList.contains('inactive');
    button.classList.toggle('inactive',next);
    toggle.textContent=next?'○':'●';
    f.observers[0]?.notify();
  });
  button.addEventListener('click',()=>{
    for(const item of f.fxRows)item.classList.toggle('selected',item===row);
    f.nodes['fx-wet'].disabled=false;
    f.nodes['fx-strength'].disabled=false;
    f.nodes['fx-wet'].value=String(wet);
    f.nodes['fx-strength'].value=String(strength);
    f.nodes['fx-wet-value'].textContent=wet+'%';
    f.nodes['fx-strength-value'].textContent=strength+'%';
  });
  f.fxRows.push(row);
  return row;
}

test('Stage 25 Empty native FX stack shows disabled Simple chooser without fabricated effects',()=>{
  const f=fixture(),ctrl=attachSimpleControls(f.doc,f.Observer);
  const picker=f.nodes['simple-fx-picker'];
  assert.equal(picker.disabled,true);
  assert.equal(picker.value,'');
  assert.equal(picker.children.length,1);
  assert.match(picker.children[0].textContent,/Nincs hozzáadott effekt/);
  assert.equal(f.nodes['simple-fx-wet'].disabled,true);
  ctrl.disconnect();
});

test('Stage 25 Simple chooser selects real Pro FX and switches parameter context',()=>{
  const f=fixture();
  const first=addFXRow(f,'Hue Rotate',25,120,true);
  const second=addFXRow(f,'Glow',75,160);
  const third=addFXRow(f,'Blur',40,90);
  first.nativeNameButton.click();
  const ctrl=attachSimpleControls(f.doc,f.Observer),picker=f.nodes['simple-fx-picker'];
  assert.equal(picker.disabled,false);
  assert.deepEqual(picker.children.map(item=>item.value),['0','1','2']);
  assert.deepEqual(picker.children.map(item=>item.textContent),
    ['1. Hue Rotate','2. Glow','3. Blur']);
  assert.equal(picker.value,'0');
  picker.value='1';picker.change();
  assert.equal(second.nativeNameButton.clicks,1,'Calls original Pro selection button');
  assert.equal(picker.value,'1');
  assert.equal(f.nodes['simple-fx-selection'].textContent,'Glow');
  assert.equal(f.nodes['simple-fx-wet'].value,'75');
  assert.equal(f.nodes['simple-fx-strength'].value,'160');
  picker.value='2';picker.change();
  assert.equal(third.nativeNameButton.clicks,1);
  assert.equal(f.nodes['simple-fx-selection'].textContent,'Blur');
  assert.equal(f.nodes['simple-fx-strength'].value,'90');
  ctrl.disconnect();
});

test('Stage 25 Pro selection, rename, reorder and remove refresh Simple chooser',()=>{
  const f=fixture();
  const hue=addFXRow(f,'Hue Rotate',40,100,true);
  const glow=addFXRow(f,'Glow',66,120);
  hue.nativeNameButton.click();
  const ctrl=attachSimpleControls(f.doc,f.Observer),picker=f.nodes['simple-fx-picker'];
  glow.nativeNameButton.click();f.observers[0].notify();
  assert.equal(picker.value,'1');
  assert.equal(f.nodes['simple-fx-selection'].textContent,'Glow');
  glow.nativeNameButton.textContent='Glow - edited';
  f.fxRows.reverse();f.observers[0].notify();
  assert.equal(picker.value,'0','Selected row follows native reorder');
  assert.equal(picker.children[0].textContent,'1. Glow - edited');
  f.fxRows.splice(0,1);hue.nativeNameButton.click();f.observers[0].notify();
  assert.deepEqual(picker.children.map(x=>x.textContent),['1. Hue Rotate']);
  assert.equal(picker.value,'0');
  f.fxRows.splice(0,1);
  f.nodes['fx-wet'].disabled=true;f.nodes['fx-strength'].disabled=true;
  f.observers[0].notify();
  assert.equal(picker.disabled,true);
  assert.equal(picker.children.length,1);
  assert.equal(picker.value,'');
  ctrl.disconnect();
});

test('Stage 25 invalid, stale or disabled FX options cannot invoke another effect',()=>{
  const f=fixture();
  const first=addFXRow(f,'Glow',30,50,true);
  const second=addFXRow(f,'Echo',60,90);
  first.nativeNameButton.click();
  const ctrl=attachSimpleControls(f.doc,f.Observer),picker=f.nodes['simple-fx-picker'];
  for(const invalid of ['-1','123','1evil','unknown','']){
    picker.value=invalid;picker.change();
    assert.equal(second.nativeNameButton.clicks,0,'Reject '+invalid);
    assert.equal(picker.value,'0','Restore native selected FX');
  }
  second.nativeNameButton.disabled=true;
  picker.value='1';picker.change();
  assert.equal(second.nativeNameButton.clicks,0);
  assert.equal(picker.value,'0');
  ctrl.disconnect();
});

test('Stage 25 FX picker reuses the actual Pro effect name buttons and observes native stack',()=>{
  const html=read('index.html'),js=read('src/simple-controls.js'),css=read('src/lumina-theme.css');
  assert.match(html,/id="simple-fx-picker"/);
  assert.match(html,/Nincs hozzáadott effekt/);
  assert.match(js,/\.querySelector\?\.\('\.fx-stack-name'\)/);
  assert.match(js,/original\.click\(\)/);
  assert.match(css,/#simple-fx-picker:focus-visible/);
});

test('Stage 26 no selected FX means Simple individual effect toggle is safely disabled',()=>{
  const f=fixture(),ctrl=attachSimpleControls(f.doc,f.Observer);
  const quick=f.nodes['simple-fx-enabled'];
  assert.equal(quick.disabled,true);
  assert.equal(quick.getAttribute('aria-checked'),'false');
  assert.equal(quick.getAttribute('aria-label'),'Kijelölt effekt bekapcsolása');
  quick.click();
  assert.equal(f.fxRows.length,0);
  ctrl.disconnect();
});

test('Stage 26 toggle delegates to the native Pro row and retains FX parameters and order',()=>{
  const f=fixture();
  const glow=addFXRow(f,'Glow',25,130,true);
  const blur=addFXRow(f,'Blur',65,80);
  glow.nativeNameButton.click();
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  const quick=f.nodes['simple-fx-enabled'];
  assert.equal(quick.disabled,false);
  assert.equal(quick.getAttribute('aria-checked'),'true');
  assert.equal(quick.textContent,'● Kijelölt FX: BE');
  quick.click();
  assert.equal(glow.nativeToggle.clicks,1,'Only the native FX toggle was clicked');
  assert.equal(blur.nativeToggle.clicks,0);
  assert.equal(glow.nativeNameButton.classList.contains('inactive'),true);
  assert.equal(quick.getAttribute('aria-checked'),'false');
  assert.equal(quick.getAttribute('aria-label'),'Kijelölt effekt bekapcsolása');
  assert.equal(quick.textContent,'○ Kijelölt FX: KI');
  assert.deepEqual(f.fxRows,[glow,blur],'No FX removal, duplication or reordering');
  assert.deepEqual(glow.fxSettings,{wet:25,strength:130});
  assert.equal(f.nodes['simple-fx-wet'].value,'25');
  assert.equal(f.nodes['simple-fx-strength'].value,'130');
  quick.click();
  assert.equal(glow.nativeToggle.clicks,2);
  assert.equal(glow.nativeNameButton.classList.contains('inactive'),false);
  assert.equal(quick.getAttribute('aria-checked'),'true');
  assert.equal(quick.getAttribute('aria-label'),'Kijelölt effekt kikapcsolása');
  ctrl.disconnect();
});

test('Stage 26 Pro enable and selected effect change synchronize the Simple switch',()=>{
  const f=fixture();
  const glow=addFXRow(f,'Glow',60,90,true);
  const blur=addFXRow(f,'Blur',40,100);
  glow.nativeNameButton.click();
  const ctrl=attachSimpleControls(f.doc,f.Observer),quick=f.nodes['simple-fx-enabled'];
  glow.nativeToggle.click();
  assert.equal(quick.getAttribute('aria-checked'),'false','Pro disabled FX mirrored');
  f.nodes['simple-fx-picker'].value='1';f.nodes['simple-fx-picker'].change();
  assert.equal(blur.nativeNameButton.clicks,1);
  assert.equal(quick.getAttribute('aria-checked'),'true','New selected FX enabled');
  blur.nativeToggle.click();
  assert.equal(quick.getAttribute('aria-checked'),'false');
  glow.nativeNameButton.click();f.observers[0].notify();
  assert.equal(quick.getAttribute('aria-checked'),'false');
  glow.nativeToggle.click();
  assert.equal(quick.getAttribute('aria-checked'),'true');
  ctrl.disconnect();
});

test('Stage 26 deleted or unavailable Pro toggle cannot affect a different FX',()=>{
  const f=fixture();
  const glow=addFXRow(f,'Glow',30,70,true);
  const blur=addFXRow(f,'Blur',45,160);
  glow.nativeNameButton.click();
  const ctrl=attachSimpleControls(f.doc,f.Observer),quick=f.nodes['simple-fx-enabled'];
  glow.nativeToggle.disabled=true;
  f.observers[0].notify();
  assert.equal(quick.disabled,true);
  quick.click();
  assert.equal(glow.nativeToggle.clicks,0);
  assert.equal(blur.nativeToggle.clicks,0);
  glow.nativeToggle.disabled=false;
  f.fxRows.splice(0,1);
  blur.nativeNameButton.click();f.observers[0].notify();
  assert.equal(quick.disabled,false);
  assert.equal(quick.getAttribute('aria-checked'),'true');
  quick.click();
  assert.equal(glow.nativeToggle.clicks,0);
  assert.equal(blur.nativeToggle.clicks,1,'Only the current, existing Pro FX changes');
  f.fxRows.splice(0,1);
  f.observers[0].notify();
  assert.equal(quick.disabled,true);
  ctrl.disconnect();
});

test('Stage 26 selected-effect switch uses native Pro row control with accessible status',()=>{
  const html=read('index.html'),js=read('src/simple-controls.js'),
    css=read('src/lumina-theme.css');
  assert.match(html,/id="simple-fx-enabled"/);
  assert.match(html,/role="switch" aria-checked="false"/);
  assert.match(js,/row\?\.querySelectorAll\?\.\('button'\)\?\.\[1\]/);
  assert.match(js,/nativeToggle\.click\(\)/);
  assert.match(css,/#simple-fx-enabled\[aria-checked="true"\]/);
});

test('Stage 27 empty FX chain disables reorder without mutating anything',()=>{
  const f=fixture(),ctrl=attachSimpleControls(f.doc,f.Observer);
  assert.equal(f.nodes['simple-fx-position'].textContent,'Nincs effekt');
  assert.equal(f.nodes['simple-fx-up'].disabled,true);
  assert.equal(f.nodes['simple-fx-down'].disabled,true);
  f.nodes['simple-fx-up'].click();f.nodes['simple-fx-down'].click();
  assert.equal(f.fxRows.length,0);
  ctrl.disconnect();
});

test('Stage 27 move selected native FX down and back up with preserved parameters',()=>{
  const f=fixture();
  const glow=addFXRow(f,'Glow',25,130,true);
  const blur=addFXRow(f,'Blur',70,90);
  const hue=addFXRow(f,'Hue Rotate',40,115);
  glow.nativeNameButton.click();
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  const up=f.nodes['simple-fx-up'],down=f.nodes['simple-fx-down'];
  const position=f.nodes['simple-fx-position'];
  assert.equal(position.textContent,'1 / 3');
  assert.equal(up.disabled,true);
  assert.equal(down.disabled,false);
  up.click();
  assert.equal(glow.nativeUp.clicks,0,'Top boundary never delegates');
  down.click();
  assert.equal(glow.nativeDown.clicks,1,'One native Pro down click');
  assert.deepEqual(f.fxRows,[blur,glow,hue]);
  assert.equal(position.textContent,'2 / 3');
  assert.equal(f.nodes['simple-fx-picker'].value,'1');
  assert.equal(f.nodes['simple-fx-selection'].textContent,'Glow');
  assert.equal(f.nodes['simple-fx-wet'].value,'25');
  assert.equal(f.nodes['simple-fx-strength'].value,'130');
  assert.deepEqual(glow.fxSettings,{wet:25,strength:130});
  assert.equal(up.disabled,false);
  up.click();
  assert.equal(glow.nativeUp.clicks,1,'One native Pro up click');
  assert.deepEqual(f.fxRows,[glow,blur,hue]);
  assert.equal(position.textContent,'1 / 3');
  assert.equal(up.disabled,true);
  assert.equal(down.disabled,false);
  ctrl.disconnect();
});

test('Stage 27 bottom boundary and native disabled state prevent illegal FX moves',()=>{
  const f=fixture();
  const glow=addFXRow(f,'Glow',25,130,true);
  const blur=addFXRow(f,'Blur',70,90);
  blur.nativeNameButton.click();
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  assert.equal(f.nodes['simple-fx-position'].textContent,'2 / 2');
  assert.equal(f.nodes['simple-fx-down'].disabled,true);
  f.nodes['simple-fx-down'].click();
  assert.equal(blur.nativeDown.clicks,0);
  blur.nativeUp.disabled=true;
  f.observers[0].notify();
  assert.equal(f.nodes['simple-fx-up'].disabled,true);
  f.nodes['simple-fx-up'].click();
  assert.equal(blur.nativeUp.clicks,0);
  blur.nativeUp.disabled=false;
  f.observers[0].notify();
  assert.equal(f.nodes['simple-fx-up'].disabled,false);
  f.nodes['simple-fx-up'].click();
  assert.deepEqual(f.fxRows,[blur,glow]);
  assert.equal(f.nodes['simple-fx-up'].disabled,true);
  assert.equal(f.nodes['simple-fx-position'].textContent,'1 / 2');
  ctrl.disconnect();
});

test('Stage 27 Pro reorder, selection and removal update the Simple FX position',()=>{
  const f=fixture();
  const glow=addFXRow(f,'Glow',30,70,true);
  const blur=addFXRow(f,'Blur',45,160);
  const hue=addFXRow(f,'Hue',20,120);
  glow.nativeNameButton.click();
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  hue.nativeNameButton.click();
  f.observers[0].notify();
  assert.equal(f.nodes['simple-fx-position'].textContent,'3 / 3');
  assert.equal(f.nodes['simple-fx-down'].disabled,true);
  hue.nativeUp.click();
  assert.deepEqual(f.fxRows,[glow,hue,blur]);
  assert.equal(f.nodes['simple-fx-position'].textContent,'2 / 3');
  assert.equal(f.nodes['simple-fx-picker'].value,'1');
  f.fxRows.splice(1,1);
  glow.nativeNameButton.click();f.observers[0].notify();
  assert.equal(f.nodes['simple-fx-position'].textContent,'1 / 2');
  f.fxRows.splice(0,2);f.observers[0].notify();
  assert.equal(f.nodes['simple-fx-position'].textContent,'Nincs effekt');
  assert.equal(f.nodes['simple-fx-up'].disabled,true);
  assert.equal(f.nodes['simple-fx-down'].disabled,true);
  ctrl.disconnect();
});

test('Stage 27 Simple reordering delegates to original Pro FX buttons',()=>{
  const html=read('index.html'),css=read('src/lumina-theme.css'),js=read('src/simple-controls.js');
  for(const id of ['simple-fx-up','simple-fx-down','simple-fx-position'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(html,/Kijelölt effekt sorrendjének módosítása/);
  assert.match(js,/function syncFXOrder\(\)/);
  assert.match(js,/native\.click\(\)/);
  assert.match(css,/\.simple-fx-order/);
});

test('Stage 28 empty or disabled native Pro FX cannot be deleted in Simple',()=>{
  const f=fixture();f.body.dataset.studioMode='simple';
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  const remove=f.nodes['simple-fx-remove'];
  assert.equal(remove.disabled,true);
  assert.equal(f.nodes['simple-fx-remove-cancel'].hidden,true);
  remove.click();
  assert.equal(f.fxRows.length,0);
  ctrl.disconnect();
  const g=fixture();g.body.dataset.studioMode='simple';
  const fx=addFXRow(g,'Glow',35,115,true);fx.nativeNameButton.click();
  fx.nativeRemove.disabled=true;
  const c=attachSimpleControls(g.doc,g.Observer);
  assert.equal(g.nodes['simple-fx-remove'].disabled,true);
  g.nodes['simple-fx-remove'].click();g.nodes['simple-fx-remove'].click();
  assert.equal(fx.nativeRemove.clicks,0);
  assert.equal(g.fxRows.length,1);
  c.disconnect();
});

test('Stage 28 first click arms, second click removes only the selected native Pro FX',()=>{
  const f=fixture();f.body.dataset.studioMode='simple';
  const glow=addFXRow(f,'Glow',35,115,true),blur=addFXRow(f,'Blur',80,90);
  glow.nativeNameButton.click();
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  const remove=f.nodes['simple-fx-remove'],cancel=f.nodes['simple-fx-remove-cancel'];
  assert.equal(remove.disabled,false);
  remove.click();
  assert.deepEqual(f.fxRows,[glow,blur],'First click must not delete');
  assert.equal(glow.nativeRemove.clicks,0);
  assert.equal(cancel.hidden,false);
  assert.match(remove.textContent,/Biztosan törlöd: Glow/);
  assert.match(f.nodes['simple-fx-remove-note'].textContent,/Kattints ismét/);
  remove.click();
  assert.equal(glow.nativeRemove.clicks,1,'Exactly one native delete');
  assert.equal(blur.nativeRemove.clicks,0);
  assert.deepEqual(f.fxRows,[blur]);
  assert.equal(cancel.hidden,true);
  assert.equal(f.nodes['simple-fx-picker'].value,'0');
  assert.equal(f.nodes['simple-fx-selection'].textContent,'Blur');
  assert.equal(f.nodes['simple-fx-wet'].value,'80');
  assert.equal(f.nodes['simple-fx-strength'].value,'90');
  assert.equal(remove.disabled,false);
  assert.equal(remove.textContent,'✕ Effekt eltávolítása');
  ctrl.disconnect();
});

test('Stage 28 Mégse cancels pending deletion without removing any FX',()=>{
  const f=fixture();f.body.dataset.studioMode='simple';
  const fx=addFXRow(f,'Blur',40,120,true);fx.nativeNameButton.click();
  const ctrl=attachSimpleControls(f.doc,f.Observer);
  f.nodes['simple-fx-remove'].click();
  assert.equal(f.nodes['simple-fx-remove-cancel'].hidden,false);
  f.nodes['simple-fx-remove-cancel'].click();
  assert.equal(f.nodes['simple-fx-remove-cancel'].hidden,true);
  assert.equal(f.nodes['simple-fx-remove'].textContent,'✕ Effekt eltávolítása');
  assert.equal(fx.nativeRemove.clicks,0);
  assert.deepEqual(f.fxRows,[fx]);
  f.nodes['simple-fx-remove'].click();
  assert.equal(fx.nativeRemove.clicks,0,'After cancelling requires two clicks again');
  ctrl.disconnect();
});

test('Stage 28 changing selected FX or Pro mode invalidates stale confirmation',()=>{
  const f=fixture();f.body.dataset.studioMode='simple';
  const glow=addFXRow(f,'Glow',20,100,true),blur=addFXRow(f,'Blur',60,140);
  glow.nativeNameButton.click();
  const ctrl=attachSimpleControls(f.doc,f.Observer),remove=f.nodes['simple-fx-remove'];
  remove.click();
  blur.nativeNameButton.click();f.observers[0].notify();
  assert.equal(remove.textContent,'✕ Effekt eltávolítása');
  assert.equal(f.nodes['simple-fx-remove-cancel'].hidden,true);
  remove.click();
  assert.equal(glow.nativeRemove.clicks,0);
  assert.equal(blur.nativeRemove.clicks,0,'First click on newly selected FX arms only');
  f.body.dataset.studioMode='pro';f.observers[0].notify();
  assert.equal(remove.textContent,'✕ Effekt eltávolítása');
  f.body.dataset.studioMode='simple';f.observers[0].notify();
  remove.click();
  assert.equal(blur.nativeRemove.clicks,0,'Returning from Pro requires new confirmation');
  ctrl.disconnect();
});

test('Stage 28 reordering or removing the FX in Pro invalidates pending deletion',()=>{
  const f=fixture();f.body.dataset.studioMode='simple';
  const glow=addFXRow(f,'Glow',20,100,true),blur=addFXRow(f,'Blur',60,140);
  glow.nativeNameButton.click();
  const ctrl=attachSimpleControls(f.doc,f.Observer),remove=f.nodes['simple-fx-remove'];
  remove.click();
  glow.nativeDown.click();
  assert.deepEqual(f.fxRows,[blur,glow]);
  assert.equal(remove.textContent,'✕ Effekt eltávolítása','Reorder resets confirmation');
  remove.click();
  assert.equal(glow.nativeRemove.clicks,0,'Reordered FX is not deleted without new confirm');
  f.fxRows.splice(1,1);blur.nativeNameButton.click();f.observers[0].notify();
  assert.equal(remove.textContent,'✕ Effekt eltávolítása');
  remove.click();
  assert.equal(blur.nativeRemove.clicks,0,'Different FX only arms');
  ctrl.disconnect();
});

test('Stage 28 confirmation UI delegates only to Pro native fifth delete button',()=>{
  const html=read('index.html'),js=read('src/simple-controls.js'),
    css=read('src/lumina-theme.css');
  for(const id of ['simple-fx-remove','simple-fx-remove-cancel','simple-fx-remove-note'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(html,/megerősítés szükséges/);
  assert.match(js,/row\?\.querySelectorAll\?\.\('button'\)\?\.\[4\]/);
  assert.match(js,/current\.native\.click\(\)/);
  assert.match(css,/#simple-fx-remove\[aria-label\^="Megerősítés"\]/);
});


test('Stage 29 Simple opens the native 120-FX browser without changing effects',()=>{
  const f=fixture();f.body.dataset.studioMode='simple';
  let focused=0;
  f.nodes['fx-search'].focus=()=>{focused++;};
  f.nodes['fx-browser-open'].addEventListener('click',()=>{
    f.nodes['fx-drawer'].hidden=!f.nodes['fx-drawer'].hidden;
  });
  const ctrl=attachSimpleControls(f.doc,f.Observer),add=f.nodes['simple-fx-add'];
  assert.equal(add.disabled,false);
  assert.equal(f.nodes['fx-drawer'].hidden,true);
  add.click();
  assert.equal(f.nodes['fx-browser-open'].clicks,1,'The original native library opens');
  assert.equal(f.nodes['fx-drawer'].hidden,false);
  assert.equal(f.fxRows.length,0,'Opening the FX library does not add an effect');
  add.click();
  assert.equal(f.nodes['fx-browser-open'].clicks,1,'An open drawer must not be closed');
  assert.equal(focused,1,'Reopen action focuses the original search');
  assert.equal(f.nodes['fx-drawer'].hidden,false);
  ctrl.disconnect();
});

test('Stage 29 FX capacity, Pro mode and native disabled state are respected',()=>{
  const f=fixture();f.body.dataset.studioMode='simple';
  f.nodes['fx-browser-open'].addEventListener('click',()=>{
    f.nodes['fx-drawer'].hidden=!f.nodes['fx-drawer'].hidden;
  });
  const a=addFXRow(f,'Glow',35,100,true);
  addFXRow(f,'Blur',75,110);addFXRow(f,'Edge',25,150);
  a.nativeNameButton.click();
  const ctrl=attachSimpleControls(f.doc,f.Observer),add=f.nodes['simple-fx-add'];
  assert.equal(add.disabled,true);
  assert.match(add.textContent,/3\/3/);
  add.click();
  assert.equal(f.nodes['fx-browser-open'].clicks,0,'Full chain cannot open for adding');
  f.fxRows[2].nativeRemove.click();
  f.observers[0].notify();
  assert.equal(add.disabled,false,'Space becoming available re-enables add');
  f.body.dataset.studioMode='pro';f.observers[0].notify();
  add.click();
  assert.equal(f.nodes['fx-browser-open'].clicks,0,'Pro mode must not delegate Simple action');
  f.body.dataset.studioMode='simple';f.observers[0].notify();
  f.nodes['fx-browser-open'].disabled=true;f.observers[0].notify();
  assert.equal(add.disabled,true,'Native disabled action must stay disabled');
  add.click();
  assert.equal(f.nodes['fx-browser-open'].clicks,0);
  f.nodes['fx-browser-open'].disabled=false;f.observers[0].notify();
  add.click();
  assert.equal(f.nodes['fx-browser-open'].clicks,1,'Native library opens once when available');
  ctrl.disconnect();
});

test('Stage 29 Simple FX add UI is wired to native library, not a second FX engine',()=>{
  const html=read('index.html'),js=read('src/simple-controls.js');
  assert.match(html,/id="simple-fx-add"/);
  assert.match(html,/120 effektusos könyvtár/);
  assert.match(js,/nativeFXBrowser\.click\(\)/);
  assert.match(js,/fxRows\(\)\.length>=3/);
});
