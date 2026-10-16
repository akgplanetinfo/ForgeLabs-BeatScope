'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { TARGET_IDS, attachProNavigation } = require('../src/pro-navigation.js');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function mockButton(id, action = false) {
  const listeners = new Map();
  return {
    dataset: action ? { vjAction: id } : { vjTarget: id },
    textContent: id,
    addEventListener(name, fn) { listeners.set(name, fn); },
    click() { listeners.get('click')?.(); }
  };
}
function fixture(missing = null) {
  const targets = new Map(TARGET_IDS.filter(id => id !== missing).map(id => {
    let focused = 0, scrolled = 0, tabindex = null;
    return [id, {
      getAttribute: name => name === 'tabindex' ? tabindex : null,
      setAttribute(name, value) { if (name === 'tabindex') tabindex = value; },
      scrollIntoView(opts) { scrolled++; this.lastScroll = opts; },
      focus(opts) { focused++; this.lastFocus = opts; },
      get focused() { return focused; },
      get scrolled() { return scrolled; }
    }];
  }));
  const buttons = TARGET_IDS.map(id => mockButton(id));
  const fx = mockButton('fx-library', true); buttons.push(fx);
  const status = { textContent: '' };
  let fxClick = 0;
  const originalFX = { disabled: false, click() { fxClick++; } };
  const root = { querySelectorAll(selector) {
    assert.equal(selector, '[data-vj-target], [data-vj-action]');
    return buttons;
  }};
  const doc = { getElementById(id) {
    return id === 'pro-navigation' ? root :
      id === 'pro-navigation-status' ? status :
      id === 'fx-browser-open' ? originalFX : targets.get(id) ?? null;
  }};
  return { targets, buttons, fx, status, originalFX, doc, get fxClicks() { return fxClick; } };
}
test('Every Pro VJ quick navigation target exists and is reachable', () => {
  const f = fixture();
  const nav = attachProNavigation(f.doc);
  assert.equal(nav.targets.length, 10);
  for (let i=0;i<TARGET_IDS.length;i++){
    f.buttons[i].click();
    const target = f.targets.get(TARGET_IDS[i]);
    assert.equal(target.scrolled,1,TARGET_IDS[i]);
    assert.equal(target.focused,1,TARGET_IDS[i]);
    assert.equal(target.getAttribute('tabindex'),'-1');
    assert.equal(target.lastScroll.block,'start');
  }
  assert.match(f.status.textContent,/megnyitva/);
});
test('FX library action delegates existing BeatScope UI and rejects invalid targets', () => {
  const f = fixture('vj-mix');
  const nav = attachProNavigation(f.doc);
  assert.equal(nav.activate(f.buttons[TARGET_IDS.indexOf('vj-mix')]),false);
  assert.equal(nav.activate({dataset:{vjTarget:'private-file'}}),false);
  f.fx.click();
  assert.equal(f.fxClicks,1);
  f.originalFX.disabled=true;
  f.fx.click();
  assert.equal(f.fxClicks,1);
});
test('Navigation is scoped to Pro workspace and does not remove audio/VJ elements', () => {
  const html=read('index.html'), theme=read('src/lumina-theme.css'), source=read('src/pro-navigation.js');
  assert.match(html,/id="pro-navigation"/);
  assert.match(html,/src\/pro-navigation\.js/);
  assert.match(theme,/data-studio-mode="simple"\] \.pro-navigation\{display:none\}/);
  for(const id of TARGET_IDS) assert.ok(html.includes('id="'+id+'"'),'Missing target: '+id);
  assert.ok(html.includes('id="visualizer"'));
  assert.ok(source.includes("fxButton.click()"));
});
