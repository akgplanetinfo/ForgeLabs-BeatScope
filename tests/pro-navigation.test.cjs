'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { TARGET_IDS, NAV_KEYS, attachProNavigation } = require('../src/pro-navigation.js');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

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
  let focus = null;
  function mockButton(id, action = false) {
    const listeners = new Map(), attrs = new Map();
    return {
      dataset: action ? { vjAction: id } : { vjTarget: id },
      textContent: id, disabled: false,
      addEventListener(name, fn) { listeners.set(name, fn); },
      click() { listeners.get('click')?.(); },
      focus() { focus = this; },
      scrollIntoView(opts) { this.lastScroll = opts; },
      setAttribute(name, value) { attrs.set(name, value); },
      getAttribute(name) { return attrs.get(name) ?? null; }
    };
  }
  const buttons = TARGET_IDS.map(id => mockButton(id));
  const fx = mockButton('fx-library', true); buttons.push(fx);
  const back = mockButton('back'); back.disabled = true;
  const status = { textContent: '' };
  let fxClick = 0;
  const originalFX = { disabled: false, click() { fxClick++; } };
  const listeners = new Map();
  const root = {
    querySelectorAll(selector) {
      assert.equal(selector, '[data-vj-target], [data-vj-action]');
      return buttons;
    },
    addEventListener(name, fn) { listeners.set(name, fn); },
    keydown(key, target, extras={}) {
      let prevented=false;
      listeners.get('keydown')?.({
        key, target, ...extras,
        preventDefault() { prevented=true; }
      });
      return prevented;
    }
  };
  const doc = { getElementById(id) {
    return id === 'pro-navigation' ? root :
      id === 'pro-nav-back' ? back :
      id === 'pro-navigation-status' ? status :
      id === 'fx-browser-open' ? originalFX : targets.get(id) ?? null;
  }};
  return { targets, buttons, back, fx, status, root, originalFX, doc,
    get focusedButton() { return focus; },
    get fxClicks() { return fxClick; }
  };
}

test('Every Pro VJ target remains reachable; active section is marked', () => {
  const f = fixture();
  const nav = attachProNavigation(f.doc);
  assert.equal(nav.targets.length, 10);
  assert.equal(nav.getCurrent(), 'visual-shell');
  assert.equal(f.buttons[0].getAttribute('aria-current'), 'location');
  assert.equal(f.back.disabled, true);
  for(let i=0;i<TARGET_IDS.length;i++) {
    f.buttons[i].click();
    const target=f.targets.get(TARGET_IDS[i]);
    assert.equal(target.scrolled, 1, TARGET_IDS[i]);
    assert.equal(target.focused, 1, TARGET_IDS[i]);
    assert.equal(target.getAttribute('tabindex'), '-1');
    assert.equal(target.lastScroll.block, 'start');
    assert.equal(f.buttons[i].getAttribute('aria-current'), 'location');
  }
  assert.equal(nav.getCurrent(), 'output-router');
  assert.equal(f.buttons[0].getAttribute('aria-current'), 'false');
  assert.equal(f.back.disabled, false);
  assert.match(f.status.textContent, /megnyitva/);
});

test('Back restores last visited section, never modifies engine and handles empty history', () => {
  const f=fixture(), nav=attachProNavigation(f.doc);
  assert.equal(nav.goBack(),false);
  f.buttons[6].click(); // layer mixer
  f.buttons[2].click(); // BPM
  assert.equal(nav.getCurrent(),'vj-tempo');
  assert.equal(nav.goBack(),true);
  assert.equal(nav.getCurrent(),'vj-mix');
  assert.equal(nav.goBack(),true);
  assert.equal(nav.getCurrent(),'visual-shell');
  assert.equal(f.back.disabled,true);
  assert.equal(nav.goBack(),false);
  assert.equal(f.targets.get('visual-shell').focused,1);
  f.buttons[6].click();
  f.buttons[6].click();
  assert.equal(nav.goBack(),true,'Clicking same destination must not add duplicate history entries');
  assert.equal(nav.getCurrent(),'visual-shell');
});

test('Arrow, Home and End move only navigation focus; no automatic engine action', () => {
  const f=fixture();
  attachProNavigation(f.doc);
  assert.deepEqual(NAV_KEYS,['ArrowLeft','ArrowRight','Home','End']);
  assert.equal(f.root.keydown('ArrowRight',f.buttons[0]),true);
  assert.equal(f.focusedButton,f.buttons[1]);
  assert.equal(f.buttons[1].lastScroll.block,'nearest');
  assert.equal(f.root.keydown('End',f.buttons[1]),true);
  assert.equal(f.focusedButton,f.fx);
  assert.equal(f.root.keydown('Home',f.fx),true);
  assert.equal(f.focusedButton,f.buttons[0]); // Back disabled
  assert.equal(f.root.keydown('ArrowLeft',f.buttons[0]),true);
  assert.equal(f.focusedButton,f.fx);
  assert.equal(f.root.keydown('ArrowRight',f.fx,{ctrlKey:true}),false);
  assert.equal(f.root.keydown('ArrowRight',{}),false);
  assert.equal(f.fxClicks,0);
  assert.equal(f.targets.get('project-toolbar').focused,0);
});

test('FX shortcut delegates native action; missing and invalid targets are rejected', () => {
  const f=fixture('vj-mix');
  const nav=attachProNavigation(f.doc);
  assert.equal(nav.activate(f.buttons[6]),false);
  assert.equal(nav.activate({dataset:{vjTarget:'unknown'}}),false);
  f.fx.click();
  assert.equal(f.fxClicks,1);
  f.originalFX.disabled=true;
  f.fx.click();
  assert.equal(f.fxClicks,1);
});

test('Renderer provides back button, all VJ targets and Simple Mode isolation', () => {
  const html=read('index.html'), theme=read('src/lumina-theme.css'), source=read('src/pro-navigation.js');
  assert.match(html,/id="pro-navigation"/);
  assert.match(html,/id="pro-nav-back"/);
  assert.match(html,/src\/pro-navigation\.js/);
  assert.match(theme,/data-studio-mode="simple"\] \.pro-navigation\{display:none\}/);
  for(const id of TARGET_IDS) assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(html,/id="visualizer"/);
  assert.ok(source.includes('fxButton.click()'));
});
