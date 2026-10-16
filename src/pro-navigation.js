'use strict';
// Alpha 17 stage 4: in-page navigation only. Audio, clips, presets and renderer are untouched.
(() => {
  const TARGET_IDS = Object.freeze([
    'visual-shell', 'project-toolbar', 'vj-tempo', 'vj-auto', 'vj-deck',
    'vj-controls', 'vj-mix', 'vj-layer-effects', 'vj-clip-effects', 'output-router'
  ]);
  const NAV_KEYS = Object.freeze(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

  function attachProNavigation(doc) {
    const root = doc?.getElementById?.('pro-navigation');
    if (!root) return null;
    const status = doc.getElementById('pro-navigation-status');
    const back = doc.getElementById('pro-nav-back');
    const buttons = [...root.querySelectorAll('[data-vj-target], [data-vj-action]')];
    const history = [];
    let current = 'visual-shell';

    function markCurrent() {
      for (const button of buttons) {
        if (!button.dataset.vjTarget) continue;
        button.setAttribute('aria-current',
          button.dataset.vjTarget === current ? 'location' : 'false');
      }
      if (back) back.disabled = history.length === 0;
    }

    function activate(button, { remember = true } = {}) {
      if (!button || !buttons.includes(button)) return false;
      const id = button.dataset.vjTarget;
      if (id && TARGET_IDS.includes(id)) {
        const target = doc.getElementById(id);
        if (!target) return false;
        if (remember && id !== current) {
          history.push(current);
          if (history.length > 20) history.shift();
        }
        current = id;
        markCurrent();
        if (target.getAttribute('tabindex') === null) target.setAttribute('tabindex', '-1');
        target.scrollIntoView({ behavior: 'auto', block: 'start', inline: 'nearest' });
        target.focus({ preventScroll: true });
        if (status) status.textContent = button.textContent.trim() + ' megnyitva';
        return true;
      }
      if (button.dataset.vjAction === 'fx-library') {
        const fxButton = doc.getElementById('fx-browser-open');
        if (!fxButton || fxButton.disabled) return false;
        fxButton.click();
        if (status) status.textContent = 'FX Library megnyitva';
        return true;
      }
      return false;
    }

    function goBack() {
      while (history.length) {
        const previous = history.pop();
        const button = buttons.find(entry => entry.dataset.vjTarget === previous);
        if (button && activate(button, { remember: false })) {
          markCurrent();
          return true;
        }
      }
      markCurrent();
      return false;
    }

    for (const button of buttons) button.addEventListener('click', () => activate(button));
    back?.addEventListener('click', goBack);
    root.addEventListener('keydown', event => {
      if (!NAV_KEYS.includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
      // Arrow/Home/End changes focus within the navigation bar; Enter/Space
      // still uses the native button click and only then scrolls the workspace.
      const focusable = [back, ...buttons].filter(button => button && !button.disabled);
      const selected = focusable.indexOf(event.target);
      if (selected < 0) return;
      event.preventDefault();
      const index = event.key === 'Home' ? 0
        : event.key === 'End' ? focusable.length - 1
        : (selected + (event.key === 'ArrowRight' ? 1 : -1) + focusable.length) % focusable.length;
      focusable[index].focus({ preventScroll: true });
      focusable[index].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    markCurrent();
    return { activate, goBack, getCurrent: () => current, targets: TARGET_IDS };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TARGET_IDS, NAV_KEYS, attachProNavigation };
  }
  if (typeof document !== 'undefined') attachProNavigation(document);
})();
