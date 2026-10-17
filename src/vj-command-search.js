'use strict';
// Alpha 17 stage 5: searchable navigation, delegating exclusively to existing Pro VJ buttons.
(() => {
  const normalizeSearch = value => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('hu').trim();
  // Actions are strictly delegated to existing controls; no duplicate playback/audio state.
  const COMMAND_ACTIONS = Object.freeze([
    {id:'open-file',label:'Zene betöltése',terms:'hangfájl fájl mp3 audio megnyitás'},
    {id:'play-pause',label:'Lejátszás / szünet',terms:'play pause zene indítás megállítás'},
    {id:'microphone',label:'Mikrofon kapcsolása',terms:'mikrofon mic élő bemenet'},
    {id:'ai-toggle',label:'Automatikus FX kapcsolása',terms:'ai visual director effektek automata'},
    {id:'save-image',label:'Kép mentése PNG',terms:'screenshot kép export pillanatkép'},
    {id:'open-preview',label:'Előnézeti ablak megnyitása',terms:'preview ablak megjelenítés'},
    {id:'project-save',label:'Projekt mentése',terms:'projekt biztonsági mentés save'}
  ]);
  const RECENT_KEY = 'lumina-pulse.recent-commands.v1';
  const RECENT_LIMIT = 5;
  const FAVORITE_KEY = 'lumina-pulse.favorite-commands.v1';
  const FAVORITE_LIMIT = 8;
  const matches = (entries, term) => {
    const query = normalizeSearch(term);
    return entries.filter(entry => normalizeSearch(entry.label+' '+(entry.terms||'')).includes(query));
  };
  function prioritizeRecent(entries, recentKeys) {
    const position = new Map(recentKeys.map((key,index)=>[key,index]));
    return [...entries].sort((a,b)=>
      (position.get(a.key) ?? Number.MAX_SAFE_INTEGER) -
      (position.get(b.key) ?? Number.MAX_SAFE_INTEGER));
  }
  function prioritizeFavorites(entries, favoriteKeys, recentKeys) {
    const fav = new Map(favoriteKeys.map((key,index)=>[key,index]));
    const rec = new Map(recentKeys.map((key,index)=>[key,index]));
    return [...entries].sort((a,b)=>{
      const af=fav.get(a.key),bf=fav.get(b.key);
      if(af!==undefined || bf!==undefined)
        return (af??Number.MAX_SAFE_INTEGER)-(bf??Number.MAX_SAFE_INTEGER);
      return (rec.get(a.key)??Number.MAX_SAFE_INTEGER)-
        (rec.get(b.key)??Number.MAX_SAFE_INTEGER);
    });
  }
  function attachVJCommandSearch(doc, providedStorage) {
    const overlay=doc?.getElementById?.('pro-command-overlay');
    const openButton=doc?.getElementById?.('pro-search-open');
    const closeButton=doc?.getElementById?.('pro-command-close');
    const input=doc?.getElementById?.('pro-command-input');
    const results=doc?.getElementById?.('pro-command-results');
    const favoriteButton=doc?.getElementById?.('pro-command-favorite');
    const note=doc?.getElementById?.('pro-command-note');
    const nav=doc?.getElementById?.('pro-navigation');
    if (!overlay || !openButton || !closeButton || !input || !results || !nav || !favoriteButton) return null;
    const navigation=[...nav.querySelectorAll('[data-vj-target], [data-vj-action]')]
      .map((button,index)=>({button,label:button.textContent.trim(),id:index,kind:'navigation',
        key:button.dataset.vjTarget?'target:'+button.dataset.vjTarget:'nav:'+button.dataset.vjAction}));
    const actions=COMMAND_ACTIONS.flatMap(action=>{
      const button=doc.getElementById(action.id);
      return button?[{button,label:'Művelet · '+action.label,id:navigation.length+COMMAND_ACTIONS.indexOf(action),
        kind:'action',terms:action.terms,key:'action:'+action.id}]:[];
    });
    const entries=[...navigation,...actions];
    let storage=providedStorage;
    if(storage===undefined){try{storage=doc.defaultView?.localStorage;}catch{storage=null;}}
    let recentKeys=[];
    try{
      const parsed=JSON.parse(storage?.getItem(RECENT_KEY)||'[]');
      if(Array.isArray(parsed))recentKeys=[...new Set(parsed)]
        .filter(key=>typeof key==='string'&&entries.some(entry=>entry.key===key)).slice(0,RECENT_LIMIT);
    }catch{ /* local storage may be denied or contain damaged data */ }
    let favoriteKeys=[];
    try{
      const parsed=JSON.parse(storage?.getItem(FAVORITE_KEY)||'[]');
      if(Array.isArray(parsed))favoriteKeys=[...new Set(parsed)]
        .filter(key=>typeof key==='string'&&entries.some(entry=>entry.key===key))
        .slice(0,FAVORITE_LIMIT);
    }catch{ /* optional local storage may be restricted */ }
    let filtered=[],selected=0,previousFocus=null;
    const visible=()=>!overlay.hidden;
    function render() {
      const found=matches(entries,input.value);
      filtered=normalizeSearch(input.value)?found:
        prioritizeFavorites(found,favoriteKeys,recentKeys);
      selected=0;
      results.replaceChildren();
      for(const entry of filtered){
        const item=doc.createElement('button');
        item.type='button';
        item.className='pro-command-result';
        item.setAttribute('role','option');
        item.id='pro-command-option-'+entry.id;
        item.textContent=entry.label;
        item.disabled=Boolean(entry.button.disabled);
        item.dataset.commandKind=entry.kind;
        if(!normalizeSearch(input.value)&&recentKeys.includes(entry.key))
          item.dataset.recent='true';
        if(favoriteKeys.includes(entry.key))item.dataset.favorite='true';
        item.addEventListener('click',()=>execute(entry));
        results.append(item);
      }
      if(!filtered.length){
        const empty=doc.createElement('p');
        empty.className='pro-command-empty';
        empty.textContent='Nincs találat. Próbálj másik keresést.';
        results.append(empty);
      }
      highlight();
    }
    function highlight(){
      const options=[...results.querySelectorAll('[role="option"]')];
      options.forEach((option,index)=>{
        option.setAttribute('aria-selected',String(index===selected));
      });
      if(filtered[selected]) input.setAttribute('aria-activedescendant','pro-command-option-'+filtered[selected].id);
      else input.removeAttribute('aria-activedescendant');
      const active=filtered[selected];
      const pinned=Boolean(active && favoriteKeys.includes(active.key));
      favoriteButton.disabled=!active;
      favoriteButton.setAttribute('aria-pressed',String(pinned));
      favoriteButton.textContent=pinned?'★ Kedvenc eltávolítása':'☆ Kedvencekhez';
    }
    function toggleFavorite(){
      if(!visible() || !filtered[selected])return false;
      const key=filtered[selected].key;
      const pinned=favoriteKeys.includes(key);
      if(!pinned && favoriteKeys.length>=FAVORITE_LIMIT) {
        if(note)note.textContent='Legfeljebb '+FAVORITE_LIMIT+' kedvenc rögzíthető.';
        return false;
      }
      favoriteKeys=pinned?favoriteKeys.filter(value=>value!==key):[...favoriteKeys,key];
      try{storage?.setItem(FAVORITE_KEY,JSON.stringify(favoriteKeys));}catch{/* optional */}
      if(note)note.textContent=pinned?'Eltávolítva a kedvencek közül.':'Kedvencek közé mentve.';
      const selectedKey=key;
      render();
      const index=filtered.findIndex(entry=>entry.key===selectedKey);
      if(index>=0){selected=index;highlight();}
      return true;
    }
    function open(){
      if(doc.body?.dataset.studioMode!=='pro')return false;
      if(visible()){input.focus();return true;}
      previousFocus=doc.activeElement;
      overlay.hidden=false;
      input.value='';
      if(note)note.textContent='';
      render();
      input.focus();
      return true;
    }
    function close({ restoreFocus=true }={}){
      if(!visible())return false;
      overlay.hidden=true;
      input.removeAttribute('aria-activedescendant');
      if(restoreFocus) {
        const target=previousFocus?.isConnected ? previousFocus : openButton;
        target.focus();
      }
      return true;
    }
    function execute(entry){
      if(!visible() || !entry || !entries.includes(entry) || entry.button.disabled)return false;
      // Existing real UI handlers own confirmation, file dialogs, playback and permissions.
      // Keep this inside the user's click or Enter event to preserve user activation.
      close({restoreFocus:false});
      if(entry.kind==='action')entry.button.focus?.({preventScroll:true});
      entry.button.click();
      // Persist only stable command identifiers, never searches or filenames.
      recentKeys=[entry.key,...recentKeys.filter(key=>key!==entry.key)].slice(0,RECENT_LIMIT);
      try{storage?.setItem(RECENT_KEY,JSON.stringify(recentKeys));}catch{/* optional */}
      return true;
    }
    openButton.addEventListener('click',open);
    closeButton.addEventListener('click',()=>close());
    overlay.addEventListener('click',event=>{
      if(event.target===overlay)close();
    });
    input.addEventListener('input',()=>{
      if(note)note.textContent='';
      render();
    });
    favoriteButton.addEventListener('click',toggleFavorite);
    input.addEventListener('keydown',event=>{
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){
        event.preventDefault();
        if(!filtered.length)return;
        selected=(selected+(event.key==='ArrowDown'?1:-1)+filtered.length)%filtered.length;
        highlight();
        results.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'});
      } else if(event.key==='Enter'){
        event.preventDefault();event.stopPropagation();
        execute(filtered[selected]);
      } else if(event.key==='Escape'){
        event.preventDefault();event.stopPropagation();
        close();
      }
    });
    doc.addEventListener('keydown',event=>{
      if((event.ctrlKey||event.metaKey)&&!event.shiftKey&&!event.altKey&&
        event.key.toLowerCase()==='k'&&doc.body?.dataset.studioMode==='pro'){
        event.preventDefault();
        open();
      } else if(event.key==='Escape'&&visible()){
        event.preventDefault();event.stopPropagation();
        close();
      } else if(event.key==='Tab'&&visible()){
        // Keep keyboard focus inside the modal while it is visible.
        const focusable=[closeButton,input,favoriteButton,...results.querySelectorAll('[role="option"]')]
          .filter(element=>!element.disabled);
        const index=focusable.indexOf(doc.activeElement);
        if(index<0){
          event.preventDefault();input.focus();
        } else if(event.shiftKey&&index===0){
          event.preventDefault();focusable[focusable.length-1].focus();
        } else if(!event.shiftKey&&index===focusable.length-1){
          event.preventDefault();focusable[0].focus();
        }
      }
    },true);
    doc.getElementById('studio-simple')?.addEventListener('click',()=>close({restoreFocus:false}));
    return {open,close,isOpen:visible,execute,render,toggleFavorite,
      getMatches:()=>filtered.map(e=>e.label),getRecentKeys:()=>[...recentKeys],
      getFavoriteKeys:()=>[...favoriteKeys]};
  }
  if(typeof module!=='undefined'&&module.exports)
    module.exports={COMMAND_ACTIONS,RECENT_KEY,RECENT_LIMIT,FAVORITE_KEY,FAVORITE_LIMIT,
      normalizeSearch,matches,prioritizeRecent,prioritizeFavorites,attachVJCommandSearch};
  if(typeof document!=='undefined')attachVJCommandSearch(document);
})();
