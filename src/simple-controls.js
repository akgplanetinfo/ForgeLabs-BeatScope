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
    'simple-fx-auto': 'fx-auto',
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
    const simpleFXAuto = get('simple-fx-auto');
    const nativeFXAuto = get('fx-auto');
    if (!visual) return null;

    for (const [quickId, sourceId] of Object.entries(ACTIONS)) {
      const quick = get(quickId);
      if (!quick) continue;
      quick.addEventListener('click', () => {
        // Running only inside an actual click preserves browser user activation
        // for the native file picker and the microphone permission prompt.
        const target = get(sourceId);
        if (target && !target.disabled) target.click();
        // Immediately reflect the bypass result in Simple; the observer handles
        // later changes initiated by Pro or by the original renderer.
        if (quickId === 'simple-fx-bypass') syncFXBypass();
        if (quickId === 'simple-fx-auto') syncFXAutopilot();
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
    // Listen to the native Pro button as well as observing its attributes.
    // The original renderer binds first, so this sees its final new state.
    nativeFXBypass?.addEventListener('click',syncFXBypass);

    // Stage 23: this is the dedicated FX Autopilot (120 FX), separate from
    // the AI Visual Director switch. Both states are native and persisted by UI.
    function syncFXAutopilot(){
      if(!simpleFXAuto)return;
      const active=nativeFXAuto?.getAttribute('aria-checked')==='true';
      simpleFXAuto.disabled=!nativeFXAuto||Boolean(nativeFXAuto.disabled);
      simpleFXAuto.setAttribute('aria-checked',String(active));
      simpleFXAuto.setAttribute('aria-label',active
        ?'120 FX Autopilot kikapcsolása':'120 FX Autopilot bekapcsolása');
      simpleFXAuto.textContent=active?'✦ 120 FX Autopilot: BE':'✦ 120 FX Autopilot: KI';
    }
    nativeFXAuto?.addEventListener('click',syncFXAutopilot);

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

    // Stage 25: select an effect already in the native Pro FX chain.
    // The native name button updates fxSelected and refreshes the real FX panel.
    const simpleFXPicker=get('simple-fx-picker');
    const simpleFXAdd=get('simple-fx-add');
    const simpleFXAddStatus=get('simple-fx-add-status');
    const nativeFXBrowser=get('fx-browser-open');
    let pendingSimpleFXAdd=null;
    let fxPickerSignature=null;
    function fxRows(){
      return [...(doc.querySelectorAll?.('#fx-stack .fx-stack-entry')||[])];
    }
    // Stage 29: open the existing 120-FX drawer in Simple Mode, never
    // duplicate addFX(), settings.fxStack, or its persistence/render pipeline.
    function syncFXAdd(){
      if(!simpleFXAdd)return;
      const full=fxRows().length>=3;
      simpleFXAdd.disabled=!nativeFXBrowser||Boolean(nativeFXBrowser.disabled)||full;
      simpleFXAdd.textContent=full?'✓ Effektlánc tele (3/3)':'＋ Effekt hozzáadása';
      simpleFXAdd.setAttribute('aria-label',full
        ?'Az effektlánc megtelt, legfeljebb három effekt használható'
        :'Effekt hozzáadása a BeatScope FX-könyvtárból');
    }
    // Stage 30: a Simple-initiated catalog session closes only after an
    // observable, native Pro FX addition. No new FX data or duplicate save path.
    function finishSimpleFXAdd(){
      if(!pendingSimpleFXAdd)return;
      const drawer=get('fx-drawer'),rows=fxRows();
      if(doc.body?.dataset?.studioMode!=='simple'||!drawer||drawer.hidden
        ||rows.length<pendingSimpleFXAdd.count){
        pendingSimpleFXAdd=null;return;
      }
      if(rows.length<=pendingSimpleFXAdd.count)return;
      // The native renderer already selected and persisted the added FX.
      const chosen=rows.find(row=>row.classList?.contains('selected'))||rows[rows.length-1];
      const name=chosen?.querySelector?.('.fx-stack-name')?.textContent?.trim()||'Effekt';
      pendingSimpleFXAdd=null; // clear first: hidden mutation cannot re-enter
      drawer.hidden=true;
      if(simpleFXAddStatus)
        simpleFXAddStatus.textContent='✓ '+name+' hozzáadva ('+rows.length+'/3)';
      simpleFXPicker?.focus?.(); // FX picker already refreshed by syncFXParams
    }
    simpleFXAdd?.addEventListener('click',()=>{
      if(simpleFXAdd.disabled||doc.body?.dataset?.studioMode!=='simple'
        ||!nativeFXBrowser||nativeFXBrowser.disabled||fxRows().length>=3)return;
      // Record session before opening; an already-open catalog is not toggled shut.
      pendingSimpleFXAdd={count:fxRows().length};
      if(simpleFXAddStatus)
        simpleFXAddStatus.textContent='Válassz effektet a könyvtárból…';
      if(get('fx-drawer')?.hidden===false){
        get('fx-search')?.focus?.();return;
      }
      nativeFXBrowser.click(); // use the original 120 FX catalog and add handler
    });
    function syncFXPicker(){
      if(!simpleFXPicker)return;
      const rows=fxRows();
      const labels=rows.map(row=>row.querySelector?.('.fx-stack-name')?.textContent?.trim()||'Effekt');
      const signature=JSON.stringify(labels);
      if(fxPickerSignature!==signature){
        fxPickerSignature=signature;
        const options=rows.length?labels.map((name,i)=>{
          const opt=doc.createElement('option');
          opt.value=String(i);opt.textContent=(i+1)+'. '+name;
          return opt;
        }):(()=>{
          const opt=doc.createElement('option');
          opt.value='';opt.textContent='Nincs hozzáadott effekt – adj hozzá Pro módban';
          return [opt];
        })();
        simpleFXPicker.replaceChildren(...options);
      }
      simpleFXPicker.disabled=!rows.length;
      const chosen=rows.findIndex(row=>row.classList?.contains('selected'));
      simpleFXPicker.value=chosen>=0?String(chosen):'';
    }
    simpleFXPicker?.addEventListener('change',()=>{
      const selected=String(simpleFXPicker.value);
      const rows=fxRows();
      const index=/^(0|[1-9][0-9]*)$/.test(selected)?Number(selected):-1;
      const original=index>=0&&index<rows.length
        ?rows[index].querySelector?.('.fx-stack-name'):null;
      if(original&&!original.disabled)original.click();
      syncFXParams();
    });

    // Stage 26: the second button of a native Pro FX row enables/disables
    // just that effect. Never edit fxStack, its parameters or a parallel state.
    const simpleFXEnabled=get('simple-fx-enabled');
    function selectedFXControls(){
      const row=fxRows().find(item=>item.classList?.contains('selected'));
      const name=row?.querySelector?.('.fx-stack-name');
      const nativeToggle=row?.querySelectorAll?.('button')?.[1];
      return {row,name,nativeToggle};
    }
    function syncFXEnabled(){
      if(!simpleFXEnabled)return;
      const {name,nativeToggle}=selectedFXControls();
      const available=Boolean(name&&nativeToggle&&!nativeToggle.disabled);
      const enabled=available&&!name.classList?.contains('inactive');
      simpleFXEnabled.disabled=!available;
      simpleFXEnabled.setAttribute('aria-checked',String(enabled));
      simpleFXEnabled.setAttribute('aria-label',enabled
        ?'Kijelölt effekt kikapcsolása':'Kijelölt effekt bekapcsolása');
      simpleFXEnabled.textContent=enabled?'● Kijelölt FX: BE':'○ Kijelölt FX: KI';
    }
    simpleFXEnabled?.addEventListener('click',()=>{
      const {name,nativeToggle}=selectedFXControls();
      if(simpleFXEnabled.disabled||!name||!nativeToggle||nativeToggle.disabled)return;
      nativeToggle.click(); // existing Pro handler persists the unchanged FX stack
      syncFXParams();
    });

    // Stage 27: use the native up/down buttons on the selected Pro FX row.
    // Pro refreshFXStack() owns reordering, selection, persistence and rendering.
    const fxOrderUp=get('simple-fx-up'),fxOrderDown=get('simple-fx-down');
    const fxOrderPosition=get('simple-fx-position');
    function syncFXOrder(){
      const rows=fxRows();
      const selected=rows.findIndex(row=>row.classList?.contains('selected'));
      if(fxOrderPosition)fxOrderPosition.textContent=selected>=0
        ?(selected+1)+' / '+rows.length:'Nincs effekt';
      for(const [control,step,buttonIndex] of [[fxOrderUp,-1,2],[fxOrderDown,1,3]]){
        if(!control)continue;
        const native=selected>=0?rows[selected]?.querySelectorAll?.('button')?.[buttonIndex]:null;
        control.disabled=selected<0||selected+step<0||selected+step>=rows.length
          ||!native||Boolean(native.disabled);
      }
    }
    for(const [control,step,buttonIndex] of [[fxOrderUp,-1,2],[fxOrderDown,1,3]]){
      control?.addEventListener('click',()=>{
        const rows=fxRows(),selected=rows.findIndex(row=>row.classList?.contains('selected'));
        if(control.disabled||selected<0||selected+step<0||selected+step>=rows.length)return;
        const native=rows[selected]?.querySelectorAll?.('button')?.[buttonIndex];
        if(!native||native.disabled)return;
        native.click(); // native Pro handler persists order and retains FX parameters
        syncFXParams();
      });
    }

    // Stage 28: removal requires two clicks on the SAME selected native FX.
    // Native Pro delete owns persistence and updates fxSelected. Confirmation is
    // cancelled if the Pro stack is recreated or a different FX is selected.
    const fxRemove=get('simple-fx-remove'),fxRemoveCancel=get('simple-fx-remove-cancel');
    const fxRemoveNote=get('simple-fx-remove-note');
    let pendingFXRemoval=null;
    function currentFXRemoval(){
      const rows=fxRows(),index=rows.findIndex(row=>row.classList?.contains('selected'));
      const row=index>=0?rows[index]:null;
      const native=row?.querySelectorAll?.('button')?.[4];
      const name=row?.querySelector?.('.fx-stack-name')?.textContent?.trim()||'Effekt';
      return {row,native,index,name};
    }
    function clearFXRemoval(){
      pendingFXRemoval=null;
      if(fxRemoveCancel)fxRemoveCancel.hidden=true;
      if(fxRemoveNote)fxRemoveNote.textContent='Az eltávolításhoz megerősítés kell.';
    }
    function syncFXRemoval(){
      const current=currentFXRemoval();
      const available=Boolean(current.row&&current.native&&!current.native.disabled);
      if(pendingFXRemoval&&(
        !available||current.row!==pendingFXRemoval.row
        ||current.native!==pendingFXRemoval.native
        ||current.index!==pendingFXRemoval.index
        ||doc.body?.dataset?.studioMode!=='simple'
      ))clearFXRemoval();
      if(!fxRemove)return;
      fxRemove.disabled=!available;
      if(pendingFXRemoval){
        fxRemove.textContent='✕ Biztosan törlöd: '+pendingFXRemoval.name+'?';
        fxRemove.setAttribute('aria-label','Megerősítés: '+pendingFXRemoval.name+' eltávolítása');
      }else{
        fxRemove.textContent='✕ Effekt eltávolítása';
        fxRemove.setAttribute('aria-label','Kijelölt effekt eltávolítása, megerősítés szükséges');
      }
    }
    fxRemove?.addEventListener('click',()=>{
      const current=currentFXRemoval();
      if(fxRemove.disabled||!current.native||current.native.disabled)return;
      if(!pendingFXRemoval){
        pendingFXRemoval=current;
        if(fxRemoveCancel)fxRemoveCancel.hidden=false;
        if(fxRemoveNote)fxRemoveNote.textContent='Kattints ismét a törléshez, vagy válaszd a Mégse gombot.';
        syncFXRemoval();
        return;
      }
      if(pendingFXRemoval.row!==current.row
        ||pendingFXRemoval.native!==current.native
        ||pendingFXRemoval.index!==current.index){
        clearFXRemoval();syncFXRemoval();return;
      }
      clearFXRemoval();
      current.native.click(); // original Pro deletion, no duplicate FX state
      syncFXParams();
    });
    fxRemoveCancel?.addEventListener('click',()=>{
      clearFXRemoval();syncFXRemoval();
    });

    // Stage 24: controls operate only on the FX currently selected in Pro.
    // Native sliders, persist() and the GPU FX chain are the single source of truth.
    const FX_PARAMS = Object.freeze([
      ['simple-fx-wet','fx-wet','simple-fx-wet-value','fx-wet-value'],
      ['simple-fx-strength','fx-strength','simple-fx-strength-value','fx-strength-value']
    ]);
    function syncFXParams(){
      syncFXAdd();
      syncFXPicker();
      finishSimpleFXAdd();
      syncFXEnabled();
      syncFXOrder();
      syncFXRemoval();
      const chosen=get('simple-fx-selection');
      const available=FX_PARAMS.every(([,id])=>Boolean(get(id)&&!get(id).disabled));
      const selectedName=doc.querySelector?.('#fx-stack .fx-stack-entry.selected .fx-stack-name')
        ?.textContent?.trim();
      if(chosen)chosen.textContent=available
        ?(selectedName||'Kiválasztott Pro effekt')
        :'Válassz egy effektet Pro módban';
      for(const [quickId,nativeId,outputId,nativeOutputId] of FX_PARAMS){
        const quick=get(quickId),native=get(nativeId),output=get(outputId);
        if(!quick)continue;
        quick.disabled=!available||!native||Boolean(native.disabled);
        if(!available||!native){
          if(output)output.textContent='—';
          quick.setAttribute('aria-valuetext','Nincs kijelölt effekt');
          continue;
        }
        const value=Number(native.value);
        if(Number.isFinite(value))quick.value=String(value);
        const label=get(nativeOutputId)?.textContent||quick.value+'%';
        if(output)output.textContent=label;
        quick.setAttribute('aria-valuetext',label);
      }
    }
    for(const [quickId,nativeId] of FX_PARAMS){
      const quick=get(quickId),native=get(nativeId);
      quick?.addEventListener('input',()=>{
        if(!quick||!native||quick.disabled||native.disabled){syncFXParams();return;}
        const raw=Number(quick.value);
        if(!Number.isFinite(raw)){syncFXParams();return;}
        const low=Number(native.min),high=Number(native.max);
        if(!Number.isFinite(low)||!Number.isFinite(high)||high<low)return;
        const value=Math.max(low,Math.min(high,Math.round(raw)));
        native.value=String(value);
        const NativeEvent=doc.defaultView?.Event;
        if(NativeEvent)native.dispatchEvent(new NativeEvent('input',{bubbles:true}));
        syncFXParams();
      });
      native?.addEventListener('input',syncFXParams);
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
      syncFXAutopilot();

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
      syncFXParams();
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
      observe(nativeFXAuto, 'aria-checked');
      observe(nativeFXAuto, 'disabled');
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
      for(const [,nativeId] of FX_PARAMS)observe(get(nativeId),'disabled');
      const fxStack=get('fx-stack');
      if(fxStack)observer.observe(fxStack,{childList:true,subtree:true});
      observe(get('fx-drawer'),'hidden');
      observe(doc.body, 'data-studio-mode');
      observe(doc.body, 'class');
      for (const element of doc.querySelectorAll('[data-mode]')) observe(element, 'class');
      for (const element of doc.querySelectorAll('[data-palette]')) observe(element, 'class');
      // textContent replacement fires childList mutations on the original BeatScope labels.
      for (const [, originalId] of STATUS_FIELDS) {
        const element = get(originalId);
        if (element) observer.observe(element, { childList: true, subtree: true, characterData: true });
      }
      for (const id of ['current-time','duration',...VISUAL_TUNING.map(item=>item[3]),...FX_PARAMS.map(item=>item[3])]) {
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
      nativeFXBypass?.removeEventListener?.('click',syncFXBypass);
      nativeFXAuto?.removeEventListener?.('click',syncFXAutopilot);
      for(const [,nativeId] of VISUAL_TUNING)get(nativeId)?.removeEventListener?.('input',syncVisualTuning);
      for(const [,nativeId] of FX_PARAMS)get(nativeId)?.removeEventListener?.('input',syncFXParams);
    } };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VISUALS, PALETTES, AI_SPEEDS, ACTIONS, SIMPLE_SHORTCUTS, VISUAL_TUNING, attachSimpleControls };
  }
  if (typeof document !== 'undefined') attachSimpleControls(document);
})();
