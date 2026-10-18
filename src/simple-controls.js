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

    // Stage 12: transport is a thin adapter to BeatScope's existing player/seek.
    const audio = get('audio');
    const nativeSeek = get('seek');
    const play = get('simple-play-pause');
    const stop = get('simple-stop');
    const seek = get('simple-seek');
    const current = get('simple-current-time');
    const duration = get('simple-duration');
    const nativeVolume = get('volume');
    const nativeMute = get('mute');
    const simpleVolume = get('simple-volume');
    const simpleMute = get('simple-mute');
    const volumeLabel = get('simple-volume-value');
    function syncVolume() {
      if (!audio || !nativeVolume || !simpleVolume || !simpleMute) return;
      // The native BeatScope player owns the persisted volume setting.
      const volume = Number.isFinite(audio.volume) ? audio.volume : Number(nativeVolume.value)/100;
      const percent = Math.max(0,Math.min(100,Math.round(volume*100)));
      simpleVolume.value = String(percent);
      simpleVolume.disabled = Boolean(nativeVolume.disabled);
      simpleVolume.setAttribute('aria-valuetext',percent+'%');
      if (volumeLabel) volumeLabel.textContent = percent+'%';
      const muted = Boolean(audio.muted);
      simpleMute.setAttribute('aria-pressed',String(muted));
      simpleMute.setAttribute('aria-label',muted?'Némítás feloldása':'Némítás');
      simpleMute.textContent = muted?'◖× Némítva':'◖)) Hang';
      simpleMute.disabled = Boolean(nativeMute?.disabled);
    }
    simpleMute?.addEventListener('click',() => {
      if (nativeMute && !nativeMute.disabled) nativeMute.click();
    });
    simpleVolume?.addEventListener('input',() => {
      if (!nativeVolume || nativeVolume.disabled) return;
      const raw = Number(simpleVolume.value);
      if (!Number.isFinite(raw)) return;
      const percent = Math.max(0,Math.min(100,Math.round(raw)));
      nativeVolume.value=String(percent);
      // The original UI input handler persists and applies volume.
      const NativeEvent=doc.defaultView?.Event;
      if (NativeEvent) nativeVolume.dispatchEvent(new NativeEvent('input',{bubbles:true}));
      syncVolume();
    });
    audio?.addEventListener('volumechange',syncVolume);
    function isMicActive() {
      return Boolean(get('microphone')?.classList.contains('active'));
    }
    function canSeek() {
      return Boolean(nativeSeek && !nativeSeek.disabled && audio &&
        Number.isFinite(audio.duration) && audio.duration > 0 && !isMicActive());
    }
    function syncTransport() {
      if (!audio || !nativeSeek || !play || !stop || !seek) return;
      const microphone = isMicActive();
      const hasFile = !nativeSeek.disabled;
      const isPlaying = hasFile && !audio.paused && !audio.ended && !microphone;
      const label = microphone ? 'Mikrofon leállítása'
        : !hasFile ? 'Zene megnyitása' : isPlaying ? 'Szünet' : 'Lejátszás';
      play.textContent = (microphone ? '■ ' : !hasFile ? '♫ ' : isPlaying ? '❚❚ ' : '▶ ') + label;
      play.setAttribute('aria-label',label);
      play.setAttribute('aria-pressed',String(isPlaying));
      play.disabled = Boolean(get('play-pause')?.disabled);
      stop.disabled = Boolean(get('stop')?.disabled) || (!hasFile && !microphone);
      seek.disabled = !canSeek();
      seek.value = canSeek() ? String(Math.max(0,Math.min(1000,
        Math.round(audio.currentTime / audio.duration * 1000)))) : '0';
      if (current) current.textContent = get('current-time')?.textContent || '0:00';
      if (duration) duration.textContent = get('duration')?.textContent || '0:00';
      seek.setAttribute('aria-valuetext',
        (current?.textContent || '0:00') + ' / ' + (duration?.textContent || '0:00'));
      syncVolume();
    }
    play?.addEventListener('click',() => {
      const original=get('play-pause');
      if (original && !original.disabled) original.click();
    });
    stop?.addEventListener('click',() => {
      const original=get('stop');
      if (original && !original.disabled) original.click();
    });
    seek?.addEventListener('input',() => {
      if (!canSeek()) return;
      nativeSeek.value=seek.value;
      // Trigger the original renderer's input handler; do not reimplement time changes.
      const NativeEvent=doc.defaultView?.Event;
      if (NativeEvent) nativeSeek.dispatchEvent(new NativeEvent('input',{bubbles:true}));
    });
    const AUDIO_EVENTS=['loadedmetadata','durationchange','timeupdate','seeked',
      'play','pause','ended','emptied','error'];
    for (const name of AUDIO_EVENTS) audio?.addEventListener(name,syncTransport);

    const STATUS_FIELDS = [
      ['simple-status-source', 'title-status'],
      ['simple-status-track', 'track-name'],
      ['simple-status-visual', 'mode-label']
    ];
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
      // Read existing renderer labels; never guess whether the input is live.
      for (const [displayId, originalId] of STATUS_FIELDS) {
        const display = get(displayId), original = get(originalId);
        if (display && original) display.textContent = original.textContent;
      }
      syncTransport();
    }

    let observer = null;
    if (typeof ObserverClass === 'function') {
      observer = new ObserverClass(sync);
      const observe = (element, attr) => {
        if (element) observer.observe(element, { attributes: true, attributeFilter: [attr] });
      };
      observe(get('ai-toggle'), 'aria-checked');
      observe(get('microphone'), 'class');
      observe(get('seek'), 'disabled');
      observe(get('play-pause'), 'disabled');
      observe(get('stop'), 'disabled');
      observe(nativeVolume, 'disabled');
      observe(nativeMute, 'disabled');
      observe(doc.body, 'class');
      for (const element of doc.querySelectorAll('[data-mode]')) observe(element, 'class');
      // textContent replacement fires childList mutations on the original BeatScope labels.
      for (const [, originalId] of STATUS_FIELDS) {
        const element = get(originalId);
        if (element) observer.observe(element, { childList: true, subtree: true, characterData: true });
      }
      for (const id of ['current-time','duration']) {
        const element=get(id);
        if(element)observer.observe(element,{childList:true,subtree:true,characterData:true});
      }
    }
    sync();
    return { sync, syncTransport, disconnect: () => {
      observer?.disconnect();
      for (const name of AUDIO_EVENTS) audio?.removeEventListener?.(name,syncTransport);
      audio?.removeEventListener?.('volumechange',syncVolume);
    } };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VISUALS, ACTIONS, attachSimpleControls };
  }
  if (typeof document !== 'undefined') attachSimpleControls(document);
})();
