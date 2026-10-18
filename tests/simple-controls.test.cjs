'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { VISUALS, PALETTES, ACTIONS, SIMPLE_SHORTCUTS, VISUAL_TUNING, attachSimpleControls } = require('../src/simple-controls.js');
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
  const ids = ['simple-control-bar', 'simple-visual', 'simple-palette', ...Object.keys(ACTIONS),
    ...Object.values(ACTIONS), 'title-status', 'track-name', 'mode-label',
    'simple-status-source', 'simple-status-track', 'simple-status-visual',
    'simple-play-pause','simple-stop','simple-seek','simple-current-time',
    'simple-duration','play-pause','stop','seek','current-time','duration','audio',
    'mute','volume','simple-mute','simple-volume','simple-volume-value',
    'previous','next','repeat','simple-previous','simple-next','simple-repeat',
    'intensity','smooth','intensity-val','smooth-val',
    'simple-intensity','simple-smooth','simple-intensity-value','simple-smooth-value'];
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
  nodes.audio.loop=false;
  nodes.volume.value='85';
  nodes.intensity.value='115';nodes.intensity.min='20';nodes.intensity.max='300';
  nodes.smooth.value='75';nodes.smooth.min='0';nodes.smooth.max='94';
  nodes['intensity-val'].textContent='115%';nodes['smooth-val'].textContent='75%';
  nodes['simple-volume'].value='85';
  nodes['current-time'].textContent='0:00';
  nodes.duration.textContent='0:00';
  const sources = VISUALS.map(value => element('source-' + value, { mode: value }));
  const swatches = PALETTES.map(value => element('swatch-' + value, { palette: value }));
  swatches[0].classList.toggle('selected',true);
  const body = element('body'),docHandlers=new Map();
  const doc = {
    body,
    activeElement:null,
    addEventListener:(name,callback)=>docHandlers.set(name,callback),
    removeEventListener:(name,callback)=>{
      if(docHandlers.get(name)===callback)docHandlers.delete(name);
    },
    getElementById: id => nodes[id] ?? null,
    defaultView: { Event: class { constructor(type,opts){this.type=type;this.bubbles=opts?.bubbles;} } },
    querySelectorAll: selector => selector === '[data-mode]' ? sources :
      selector === '[data-palette]' ? swatches : [],
    querySelector:()=>null
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
  return { nodes, sources, swatches, body, doc, Observer, observers, key, docHandlers };
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
  assert.deepEqual(VISUAL_TUNING.map(entry=>entry[1]),['intensity','smooth']);
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
