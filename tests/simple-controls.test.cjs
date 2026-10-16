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
    setAttribute(name, val) { attrs.set(name, String(val)); },
    getAttribute(name) { return attrs.get(name) ?? null; },
    click() { clicks += 1; handlers.click?.(); },
    change() { handlers.change?.(); },
    get clicks() { return clicks; }
  };
}
function fixture() {
  const ids = ['simple-control-bar', 'simple-visual', ...Object.keys(ACTIONS),
    ...Object.values(ACTIONS)];
  const nodes = Object.fromEntries(ids.map(id => [id, element(id)]));
  const sources = VISUALS.map(value => element('source-' + value, { mode: value }));
  const body = element('body');
  const doc = {
    body,
    getElementById: id => nodes[id] ?? null,
    querySelectorAll: selector => selector === '[data-mode]' ? sources : []
  };
  const observers = [];
  class Observer {
    constructor(callback) { this.callback = callback; this.observed = []; observers.push(this); }
    observe(node, opts) { this.observed.push([node, opts.attributeFilter[0]]); }
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
