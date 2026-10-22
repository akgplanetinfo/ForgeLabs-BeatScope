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
    const shortcutBar=doc?.getElementById?.('pro-favorites-bar');
    const shortcutActions=doc?.getElementById?.('pro-favorites-actions');
    const orderSelect=doc?.getElementById?.('pro-favorites-select');
    const moveLeft=doc?.getElementById?.('pro-favorites-left');
    const moveRight=doc?.getElementById?.('pro-favorites-right');
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
    function updateMoveControls(){
      if(!orderSelect)return;
      const index=favoriteKeys.indexOf(orderSelect.value);
      if(moveLeft)moveLeft.disabled=index<=0;
      if(moveRight)moveRight.disabled=index<0||index>=favoriteKeys.length-1;
    }
    function syncFavoriteShortcuts(){
      if(!shortcutBar||!shortcutActions)return;
      const previousSelection=orderSelect?.value;
      shortcutActions.replaceChildren();
      orderSelect?.replaceChildren();
      for(const [index,key] of favoriteKeys.entries()){
        const entry=entries.find(item=>item.key===key);
        if(!entry)continue;
        const quick=doc.createElement('button');
        quick.type='button';
        quick.className='pro-favorite-shortcut';
        quick.dataset.commandKind=entry.kind;
        quick.textContent='★ '+(entry.kind==='action'?
          entry.label.replace(/^Művelet · /,''):entry.label);
        quick.title=entry.label+' · Ctrl+Shift+'+(index+1);
        quick.dataset.hotkey='Ctrl+Shift+'+(index+1);
        quick.setAttribute('aria-keyshortcuts','Control+Shift+'+(index+1));
        quick.disabled=Boolean(entry.button.disabled);
        quick.addEventListener('click',()=>runCommand(entry));
        shortcutActions.append(quick);
        if(orderSelect){
          const option=doc.createElement('option');
          option.value=key;
          option.textContent=entry.label;
          orderSelect.append(option);
        }
      }
      if(orderSelect)orderSelect.value=favoriteKeys.includes(previousSelection)
        ?previousSelection:(favoriteKeys[0]||'');
      updateMoveControls();
      shortcutBar.hidden=shortcutActions.children.length===0;
    }
    function moveFavorite(step){
      if(!orderSelect||!Number.isInteger(step)||Math.abs(step)!==1)return false;
      const index=favoriteKeys.indexOf(orderSelect.value);
      const destination=index+step;
      if(index<0||destination<0||destination>=favoriteKeys.length)return false;
      [favoriteKeys[index],favoriteKeys[destination]]=
        [favoriteKeys[destination],favoriteKeys[index]];
      try{storage?.setItem(FAVORITE_KEY,JSON.stringify(favoriteKeys));}catch{/* optional */}
      syncFavoriteShortcuts();
      // sync retains the selected command; all Ctrl+Shift slots now match the new order.
      if(note)note.textContent='Kedvencek sorrendje frissítve.';
      return true;
    }
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
      syncFavoriteShortcuts();
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
    function runCommand(entry){
      if(!entry || !entries.includes(entry) || entry.button.disabled)return false;
      // Delegate directly to the existing BeatScope controls in the user's click.
      if(entry.kind==='action')entry.button.focus?.({preventScroll:true});
      entry.button.click();
      recentKeys=[entry.key,...recentKeys.filter(key=>key!==entry.key)].slice(0,RECENT_LIMIT);
      try{storage?.setItem(RECENT_KEY,JSON.stringify(recentKeys));}catch{/* optional */}
      return true;
    }
    function execute(entry){
      if(!visible() || !entry || !entries.includes(entry) || entry.button.disabled)return false;
      close({restoreFocus:false});
      return runCommand(entry);
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
    orderSelect?.addEventListener('change',updateMoveControls);
    moveLeft?.addEventListener('click',()=>moveFavorite(-1));
    moveRight?.addEventListener('click',()=>moveFavorite(1));
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
      // Ctrl+Shift+1–8 are Pro-only favorites, not new audio/rendering handlers.
      // Physical Digit codes also work on HU layouts where Shift changes key to '!'.
      const digit=/^Digit([1-8])$/.exec(event.code||'')?.[1]
        || (/^[1-8]$/.test(event.key)?event.key:null);
      if(digit && event.ctrlKey && event.shiftKey && !event.altKey
          && !event.metaKey && doc.body?.dataset.studioMode==='pro'){
        const tag=event.target?.tagName;
        const editing=event.target?.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(tag);
        if(editing || event.isComposing)return;
        event.preventDefault();
        event.stopPropagation();
        if(event.repeat || visible())return;
        const commandKey=favoriteKeys[Number(digit)-1];
        const command=entries.find(entry=>entry.key===commandKey);
        if(command)runCommand(command);
        return;
      }
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
    if(shortcutActions && typeof doc.defaultView?.MutationObserver==='function'){
      const observer=new doc.defaultView.MutationObserver(syncFavoriteShortcuts);
      for(const entry of entries)
        observer.observe(entry.button,{attributes:true,attributeFilter:['disabled']});
    }
    syncFavoriteShortcuts();
    return {open,close,isOpen:visible,execute,runCommand,render,toggleFavorite,
      moveFavorite,getMatches:()=>filtered.map(e=>e.label),getRecentKeys:()=>[...recentKeys],
      getFavoriteKeys:()=>[...favoriteKeys]};
  }
  if(typeof module!=='undefined'&&module.exports)
    module.exports={COMMAND_ACTIONS,RECENT_KEY,RECENT_LIMIT,FAVORITE_KEY,FAVORITE_LIMIT,
      normalizeSearch,matches,prioritizeRecent,prioritizeFavorites,attachVJCommandSearch};
  if(typeof document!=='undefined')attachVJCommandSearch(document);
})();
