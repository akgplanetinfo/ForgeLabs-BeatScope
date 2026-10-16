'use strict';
// Alpha 17 stage 3: navigation only. Never duplicates or changes the original VJ state.
(() => {
  const TARGET_IDS = Object.freeze([
    'visual-shell', 'project-toolbar', 'vj-tempo', 'vj-auto', 'vj-deck',
    'vj-controls', 'vj-mix', 'vj-layer-effects', 'vj-clip-effects', 'output-router'
  ]);
  function attachProNavigation(doc) {
    const root = doc?.getElementById?.('pro-navigation');
    if (!root) return null;
    const status = doc.getElementById('pro-navigation-status');
    const buttons = [...root.querySelectorAll('[data-vj-target], [data-vj-action]')];
    function activate(button) {
      if (!button || !buttons.includes(button)) return false;
      const id = button.dataset.vjTarget;
      if (id && TARGET_IDS.includes(id)) {
        const target = doc.getElementById(id);
        if (!target) return false;
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
    for (const button of buttons) button.addEventListener('click', () => activate(button));
    return { activate, targets: TARGET_IDS };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TARGET_IDS, attachProNavigation };
  }
  if (typeof document !== 'undefined') attachProNavigation(document);
})();
