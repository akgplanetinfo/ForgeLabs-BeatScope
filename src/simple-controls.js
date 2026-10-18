'use strict';
// Alpha 17 step 2. Delegate to the original BeatScope controls, never fork the audio/VJ engine.
(() => {
  const VISUALS = Object.freeze(['bars', 'wave', 'orbit', 'particles']);
  const PALETTES = Object.freeze(['azure','mint','violet','sunset','rainbow']);
  const AI_SPEEDS = Object.freeze(['calm','balanced','party']);
  const ACTIONS = Object.freeze({
    'simple-open-file': 'open-file',
    'simple-microphone': 'microphone',
    'simple-ai': 'ai-toggle',
    'simple-fx-bypass': 'fx-bypass',
    'simple-fullscreen': 'fullscreen'
  });
  // Space already belongs to the native BeatScope keyboard listener.
  // Only add previously unused, Simple-only letter shortcuts.
  const SIMPLE_SHORTCUTS = Object.freeze({
    m:'simple-mute',r:'simple-repeat',s:'simple-stop'
  });
  const VISUAL_TUNING = Object.freeze([
    ['simple-intensity','intensity','simple-intensity-value','intensity-val'],
    ['simple-smooth','smooth','simple-smooth-value','smooth-val'],
    ['simple-bars-count','bars-count','simple-bars-value','bars-val']
  ]);

  function attachSimpleControls(doc, ObserverClass = doc?.defaultView?.MutationObserver) {
    const root = doc?.getElementById?.('simple-control-bar');
    if (!root) return null;
    const get = id => doc.getElementById(id);
    const visual = get('simple-visual');
    const palette = get('simple-palette');
    const autoPalette = get('simple-ai-palette');
    const nativeAutoPalette = get('ai-palette');
    const simpleAISpeed = get('simple-ai-speed');
    const nativeAISpeed = get('ai-speed');
    const simpleGrid = get('simple-show-grid');
    const nativeGrid = get('show-grid');
    const simpleFXBypass = get('simple-fx-bypass');
    const nativeFXBypass = get('fx-bypass');
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
    palette?.addEventListener('change', () => {
      if (!PALETTES.includes(palette.value)) return;
      // Use the existing palette button and its persistence/AI handling.
      const source = [...doc.querySelectorAll('[data-palette]')]
        .find(element => element.dataset.palette === palette.value);
      if (source && !source.disabled) source.click();
    });

    // Stage 18: AI-driven palette changes use the native BeatScope preference.
    // Native "change" owns persistence; never store a separate Simple preference.
    function syncAutoPalette() {
      if (!autoPalette) return;
      autoPalette.disabled = !nativeAutoPalette || Boolean(nativeAutoPalette.disabled);
      if (nativeAutoPalette) autoPalette.checked = Boolean(nativeAutoPalette.checked);
    }
    autoPalette?.addEventListener('change', () => {
      if (!nativeAutoPalette || nativeAutoPalette.disabled) {
        syncAutoPalette();return;
      }
      const selected=Boolean(autoPalette.checked);
      if (nativeAutoPalette.checked !== selected) {
        nativeAutoPalette.checked=selected;
        const NativeEvent=doc.defaultView?.Event;
        if (NativeEvent) nativeAutoPalette.dispatchEvent(
          new NativeEvent('change',{bubbles:true}));
      }
      syncAutoPalette();
    });
    nativeAutoPalette?.addEventListener('change',syncAutoPalette);

    // Stage 19: reuse the native AI director's timing, reset and persistence.
    function syncAISpeed(){
      if(!simpleAISpeed)return;
      simpleAISpeed.disabled=!nativeAISpeed||Boolean(nativeAISpeed.disabled);
      if(nativeAISpeed&&AI_SPEEDS.includes(nativeAISpeed.value))
        simpleAISpeed.value=nativeAISpeed.value;
    }
    simpleAISpeed?.addEventListener('change',()=>{
      const selected=simpleAISpeed.value;
      if(!nativeAISpeed||nativeAISpeed.disabled||!AI_SPEEDS.includes(selected)){
        syncAISpeed();return;
      }
      if(nativeAISpeed.value!==selected){
        nativeAISpeed.value=selected;
        const NativeEvent=doc.defaultView?.Event;
        if(NativeEvent)nativeAISpeed.dispatchEvent(new NativeEvent('change',{bubbles:true}));
      }
      syncAISpeed();
    });
    nativeAISpeed?.addEventListener('change',syncAISpeed);

    // Stage 20: use the renderer's original showGrid change handler and
    // settings persistence, without a duplicate renderer or stored preference.
    function syncGrid(){
      if(!simpleGrid)return;
      simpleGrid.disabled=!nativeGrid||Boolean(nativeGrid.disabled);
      if(nativeGrid)simpleGrid.checked=Boolean(nativeGrid.checked);
    }
    simpleGrid?.addEventListener('change',()=>{
      if(!nativeGrid||nativeGrid.disabled){syncGrid();return;}
      const wanted=Boolean(simpleGrid.checked);
      if(nativeGrid.checked!==wanted){
        nativeGrid.checked=wanted;
        const NativeEvent=doc.defaultView?.Event;
        if(NativeEvent)nativeGrid.dispatchEvent(new NativeEvent('change',{bubbles:true}));
      }
      syncGrid();
    });
    nativeGrid?.addEventListener('change',syncGrid);

    // Stage 22: the native FX-bypass action only bypasses rendering;
    // the entire Pro FX stack and its settings remain untouched.
    function syncFXBypass(){
      if(!simpleFXBypass)return;
      const bypassed=nativeFXBypass?.getAttribute('aria-pressed')==='true';
      simpleFXBypass.disabled=!nativeFXBypass||Boolean(nativeFXBypass.disabled);
      simpleFXBypass.setAttribute('aria-pressed',String(bypassed));
      simpleFXBypass.setAttribute('aria-label',bypassed
        ?'Effektek visszakapcsolása':'Effektek kikapcsolása');
      simpleFXBypass.textContent=bypassed?'◌ FX kikapcsolva':'◉ FX aktív';
    }

    // Stage 12: transport is a thin adapter to BeatScope's existing player/seek.
    const audio = get('audio');
    const nativeSeek = get('seek');
    const play = get('simple-play-pause');
    const stop = get('simple-stop');
    const previous = get('simple-previous');
    const next = get('simple-next');
    const repeatButton = get('simple-repeat');
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
      const fileSeekable=canSeek();
      seek.disabled = !fileSeekable;
      for (const [quick,nativeId] of [[previous,'previous'],[next,'next'],[repeatButton,'repeat']]) {
        if(quick)quick.disabled=!fileSeekable || Boolean(get(nativeId)?.disabled);
      }
      if(repeatButton){
        const looping=Boolean(audio.loop);
        repeatButton.setAttribute('aria-pressed',String(looping));
        repeatButton.setAttribute('aria-label',looping?'Ismétlés kikapcsolása':'Ismétlés bekapcsolása');
        repeatButton.textContent=looping?'↻ Ismétlés: be':'↻ Ismétlés';
      }
      seek.value = fileSeekable ? String(Math.max(0,Math.min(1000,
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
    for (const [quick,nativeId] of [[previous,'previous'],[next,'next'],[repeatButton,'repeat']]) {
      quick?.addEventListener('click',()=>{
        const original=get(nativeId);
        if(canSeek() && original && !original.disabled)original.click();
      });
    }
    seek?.addEventListener('input',() => {
      if (!canSeek()) return;
      nativeSeek.value=seek.value;
      // Trigger the original renderer's input handler; do not reimplement time changes.
      const NativeEvent=doc.defaultView?.Event;
      if (NativeEvent) nativeSeek.dispatchEvent(new NativeEvent('input',{bubbles:true}));
    });
    function onSimpleKeydown(event) {
      if (doc.body?.dataset?.studioMode!=='simple' || event.defaultPrevented ||
          event.repeat || event.isComposing || event.ctrlKey || event.altKey ||
          event.metaKey || event.shiftKey) return;
      const key=String(event.key||'').toLowerCase();
      const controlId=SIMPLE_SHORTCUTS[key];
      if(!controlId)return;
      const target=event.target||doc.activeElement;
      const tag=target?.tagName?.toUpperCase();
      if(target?.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(tag) ||
         target?.closest?.('[contenteditable="true"]'))return;
      // Other active dialogs should retain their own keyboard interaction.
      if(doc.querySelector?.('[role="dialog"]:not([hidden])'))return;
      const quick=get(controlId);
      if(!quick || quick.disabled)return;
      event.preventDefault();
      event.stopPropagation?.();
      quick.click(); // Existing Simple handlers delegate to the original player.
    }
    doc.addEventListener?.('keydown',onSimpleKeydown,true);
    const AUDIO_EVENTS=['loadedmetadata','durationchange','timeupdate','seeked',
      'play','pause','ended','emptied','error'];
    for (const name of AUDIO_EVENTS) audio?.addEventListener(name,syncTransport);

    // Stage 16: both sliders forward input into the existing renderer, which
    // persists intensity and updates the live Web Audio smoothing analyser.
    function syncVisualTuning(){
      for(const [quickId,nativeId,outputId,nativeOutputId] of VISUAL_TUNING){
        const quick=get(quickId),native=get(nativeId);
        if(!quick)continue;
        if(!native){quick.disabled=true;continue;}
        quick.disabled=Boolean(native.disabled);
        const raw=Number(native.value);
        const low=Number(native.min),high=Number(native.max);
        const value=Number.isFinite(raw)?Math.max(low,Math.min(high,raw)):low;
        quick.value=String(value);
        const label=get(nativeOutputId)?.textContent||value+'%';
        if(get(outputId))get(outputId).textContent=label;
        quick.setAttribute('aria-valuetext',label);
      }
    }
    for(const [quickId,nativeId] of VISUAL_TUNING){
      const quick=get(quickId),native=get(nativeId);
      quick?.addEventListener('input',()=>{
        if(!native||native.disabled||quick.disabled)return;
        const n=Number(quick.value);
        if(!Number.isFinite(n))return;
        const min=Number(native.min),max=Number(native.max);
        const clamped=Math.max(min,Math.min(max,n));
        // Spectrum density is quantized to the native 8-bar steps.
        const step=Number(native.step);
        native.value=String(Number.isFinite(step)&&step>0
          ?Math.max(min,Math.min(max,min+Math.round((clamped-min)/step)*step))
          :clamped);
        const NativeEvent=doc.defaultView?.Event;
        if(NativeEvent)native.dispatchEvent(new NativeEvent('input',{bubbles:true}));
        syncVisualTuning();
      });
      native?.addEventListener('input',syncVisualTuning);
    }

    const STATUS_FIELDS = [
      ['simple-status-source', 'title-status'],
      ['simple-status-track', 'track-name'],
      ['simple-status-visual', 'mode-label']
    ];
    function sync() {
      const selected = [...doc.querySelectorAll('[data-mode]')]
        .find(element => element.classList.contains('active') && VISUALS.includes(element.dataset.mode));
      if (selected) visual.value = selected.dataset.mode;
      const selectedPalette = [...doc.querySelectorAll('[data-palette]')]
        .find(element => element.classList.contains('selected') &&
          PALETTES.includes(element.dataset.palette));
      if (palette && selectedPalette) palette.value = selectedPalette.dataset.palette;
      syncAutoPalette();
      syncAISpeed();
      syncGrid();
      syncFXBypass();

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
      syncVisualTuning();
    }

    let observer = null;
    if (typeof ObserverClass === 'function') {
      observer = new ObserverClass(sync);
      const observe = (element, attr) => {
        if (element) observer.observe(element, { attributes: true, attributeFilter: [attr] });
      };
      observe(get('ai-toggle'), 'aria-checked');
      observe(nativeAutoPalette, 'disabled');
      observe(nativeAISpeed, 'disabled');
      observe(nativeGrid, 'disabled');
      observe(nativeFXBypass, 'aria-pressed');
      observe(nativeFXBypass, 'disabled');
      observe(get('microphone'), 'class');
      observe(get('seek'), 'disabled');
      observe(get('play-pause'), 'disabled');
      observe(get('stop'), 'disabled');
      for(const id of ['previous','next','repeat'])observe(get(id),'disabled');
      observe(get('repeat'),'class');
      observe(nativeVolume, 'disabled');
      observe(nativeMute, 'disabled');
      for(const [,nativeId] of VISUAL_TUNING){
        observe(get(nativeId),'disabled');
      }
      observe(doc.body, 'class');
      for (const element of doc.querySelectorAll('[data-mode]')) observe(element, 'class');
      for (const element of doc.querySelectorAll('[data-palette]')) observe(element, 'class');
      // textContent replacement fires childList mutations on the original BeatScope labels.
      for (const [, originalId] of STATUS_FIELDS) {
        const element = get(originalId);
        if (element) observer.observe(element, { childList: true, subtree: true, characterData: true });
      }
      for (const id of ['current-time','duration',...VISUAL_TUNING.map(item=>item[3])]) {
        const element=get(id);
        if(element)observer.observe(element,{childList:true,subtree:true,characterData:true});
      }
    }
    sync();
    return { sync, syncTransport, disconnect: () => {
      observer?.disconnect();
      for (const name of AUDIO_EVENTS) audio?.removeEventListener?.(name,syncTransport);
      audio?.removeEventListener?.('volumechange',syncVolume);
      doc.removeEventListener?.('keydown',onSimpleKeydown,true);
      nativeAutoPalette?.removeEventListener?.('change',syncAutoPalette);
      nativeAISpeed?.removeEventListener?.('change',syncAISpeed);
      nativeGrid?.removeEventListener?.('change',syncGrid);
      for(const [,nativeId] of VISUAL_TUNING)get(nativeId)?.removeEventListener?.('input',syncVisualTuning);
    } };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VISUALS, PALETTES, AI_SPEEDS, ACTIONS, SIMPLE_SHORTCUTS, VISUAL_TUNING, attachSimpleControls };
  }
  if (typeof document !== 'undefined') attachSimpleControls(document);
})();
