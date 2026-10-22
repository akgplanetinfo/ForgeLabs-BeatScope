'use strict';
// Alpha 17: user-facing workspace mode; all audio and VJ engines remain mounted.
(() => {
  const STORAGE_KEY = 'lumina-pulse.studio-mode.v1';
  function normalizeMode(value) {
    return value === 'simple' ? 'simple' : 'pro';
  }
  function createModeSwitcher(doc, storage) {
    if (!doc?.body) return null;
    const buttons = [...doc.querySelectorAll('[data-studio-mode-target]')];
    if (buttons.length !== 2) return null;
    const hint = doc.getElementById('studio-mode-hint');
    const clipMenu = doc.getElementById('vj-clip-menu');
    function setMode(value, { persist = true } = {}) {
      const mode = normalizeMode(value);
      doc.body.dataset.studioMode = mode;
      for (const button of buttons) {
        const active = button.dataset.studioModeTarget === mode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      }
      if (hint) hint.textContent = mode === 'simple'
        ? 'Alap vezérlés · a Pro VJ eszközei továbbra is elérhetők.'
        : 'Teljes VJ munkatér · rétegek, BPM, effektek és kimenetek.';
      if (mode === 'simple' && clipMenu) clipMenu.hidden = true;
      if (persist) {
        try { storage?.setItem(STORAGE_KEY, mode); } catch { /* storage may be restricted */ }
      }
      return mode;
    }
    let initial = 'pro';
    try { initial = storage?.getItem(STORAGE_KEY) || 'pro'; } catch { /* storage may be restricted */ }
    setMode(initial, { persist: false });
    for (const button of buttons) {
      button.addEventListener('click', () => setMode(button.dataset.studioModeTarget));
    }
    return { setMode, getMode: () => doc.body.dataset.studioMode };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { STORAGE_KEY, normalizeMode, createModeSwitcher };
  }
  if (typeof document !== 'undefined') {
    let storage = null;
    try { storage = window.localStorage; } catch { /* storage may be restricted */ }
    createModeSwitcher(document, storage);
  }
})();
