'use strict';
// Alpha 17 step 2. Delegate to the original BeatScope controls, never fork the audio/VJ engine.
(() => {
  const VISUALS = Object.freeze(['bars', 'wave', 'orbit', 'particles']);
  const ACTIONS = Object.freeze({
    'simple-open-file': 'open-file',
    'simple-microphone': 'microphone',
    'simple-ai': 'ai-toggle',
    'simple-fullscreen': 'fullscreen'
  });

  function attachSimpleControls(doc, ObserverClass = doc?.defaultView?.MutationObserver) {
    const root = doc?.getElementById?.('simple-control-bar');
    if (!root) return null;
    const get = id => doc.getElementById(id);
    const visual = get('simple-visual');
    if (!visual) return null;

    for (const [quickId, sourceId] of Object.entries(ACTIONS)) {
      const quick = get(quickId);
      if (!quick) continue;
      quick.addEventListener('click', () => {
        // Running only inside an actual click preserves browser user activation
        // for the native file picker and the microphone permission prompt.
        const target = get(sourceId);
        if (target && !target.disabled) target.click();
      });
    }
    visual.addEventListener('change', () => {
      const value = visual.value;
      if (!VISUALS.includes(value)) return;
      const source = [...doc.querySelectorAll('[data-mode]')]
        .find(element => element.dataset.mode === value);
      if (source && !source.disabled) source.click();
    });

    function sync() {
      const selected = [...doc.querySelectorAll('[data-mode]')]
        .find(element => element.classList.contains('active') && VISUALS.includes(element.dataset.mode));
      if (selected) visual.value = selected.dataset.mode;

      const ai = get('ai-toggle')?.getAttribute('aria-checked') === 'true';
      const microphone = Boolean(get('microphone')?.classList.contains('active'));
      const fullscreen = Boolean(doc.body?.classList.contains('fullscreen'));
      for (const [id, pressed] of [
        ['simple-ai', ai], ['simple-microphone', microphone],
        ['simple-fullscreen', fullscreen]
      ]) {
        get(id)?.setAttribute('aria-pressed', String(pressed));
      }
    }

    let observer = null;
    if (typeof ObserverClass === 'function') {
      observer = new ObserverClass(sync);
      const observe = (element, attr) => {
        if (element) observer.observe(element, { attributes: true, attributeFilter: [attr] });
      };
      observe(get('ai-toggle'), 'aria-checked');
      observe(get('microphone'), 'class');
      observe(doc.body, 'class');
      for (const element of doc.querySelectorAll('[data-mode]')) observe(element, 'class');
    }
    sync();
    return { sync, disconnect: () => observer?.disconnect() };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VISUALS, ACTIONS, attachSimpleControls };
  }
  if (typeof document !== 'undefined') attachSimpleControls(document);
})();
