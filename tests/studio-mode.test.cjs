'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { STORAGE_KEY, normalizeMode, createModeSwitcher } = require('../src/studio-mode.js');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function button(mode) {
  const attributes = {};
  const classes = new Set();
  const handlers = {};
  return {
    dataset: { studioModeTarget: mode },
    classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); } },
    setAttribute(name, value) { attributes[name] = value; },
    addEventListener(name, handler) { handlers[name] = handler; },
    click() { handlers.click(); },
    pressed() { return attributes['aria-pressed']; },
    active() { return classes.has('active'); }
  };
}
function fixture(saved = null, throws = false) {
  const simple = button('simple'), pro = button('pro');
  const hint = { textContent: '' }, menu = { hidden: false };
  const body = { dataset: {} };
  const values = new Map(saved ? [[STORAGE_KEY, saved]] : []);
  const storage = {
    getItem(k) { if (throws) throw new Error('Storage blocked'); return values.get(k); },
    setItem(k, v) { if (throws) throw new Error('Storage blocked'); values.set(k, v); }
  };
  const doc = {
    body,
    querySelectorAll() { return [simple, pro]; },
    getElementById(id) { return id === 'studio-mode-hint' ? hint : id === 'vj-clip-menu' ? menu : null; }
  };
  return { simple, pro, hint, menu, body, storage, values, doc };
}
test('Only Simple and Pro VJ are valid workspace modes; fallback is Pro for existing users', () => {
  assert.equal(normalizeMode('simple'), 'simple');
  for (const value of ['pro', '', 'advanced', null, undefined]) assert.equal(normalizeMode(value), 'pro');
});
test('Clicking mode buttons switches layout without removing the VJ engine and persists selection', () => {
  const f = fixture();
  const switcher = createModeSwitcher(f.doc, f.storage);
  assert.equal(switcher.getMode(), 'pro');
  assert.equal(f.pro.pressed(), 'true');
  f.simple.click();
  assert.equal(f.body.dataset.studioMode, 'simple');
  assert.equal(f.simple.pressed(), 'true');
  assert.equal(f.pro.pressed(), 'false');
  assert.equal(f.values.get(STORAGE_KEY), 'simple');
  assert.equal(f.menu.hidden, true);
  f.pro.click();
  assert.equal(switcher.getMode(), 'pro');
  assert.equal(f.simple.active(), false);
  assert.equal(f.pro.active(), true);
});
test('Previously chosen workspace mode is restored; blocked storage does not crash', () => {
  const persisted = fixture('simple');
  createModeSwitcher(persisted.doc, persisted.storage);
  assert.equal(persisted.body.dataset.studioMode, 'simple');
  const blocked = fixture(null, true);
  const switcher = createModeSwitcher(blocked.doc, blocked.storage);
  blocked.simple.click();
  assert.equal(switcher.getMode(), 'simple');
});
test('Real renderer contains working mode buttons and hides advanced VJ panels only in Simple', () => {
  const html = read('index.html'), css = read('src/lumina-theme.css');
  for (const id of ['studio-simple', 'studio-pro', 'studio-mode-hint', 'vj-deck', 'vj-tempo', 'vj-mix', 'visualizer']) {
    assert.ok(html.includes('id="' + id + '"'), 'Missing UI element: ' + id);
  }
  assert.match(html, /src\/studio-mode\.js/);
  assert.match(css, /data-studio-mode="simple"/);
  assert.match(css, /#vj-deck/);
  assert.match(css, /#vj-layer-effects/);
});
