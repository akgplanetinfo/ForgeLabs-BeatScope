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
  const matches = (entries, term) => {
    const query = normalizeSearch(term);
    return entries.filter(entry => normalizeSearch(entry.label+' '+(entry.terms||'')).includes(query));
  };
  function attachVJCommandSearch(doc) {
    const overlay=doc?.getElementById?.('pro-command-overlay');
    const openButton=doc?.getElementById?.('pro-search-open');
    const closeButton=doc?.getElementById?.('pro-command-close');
    const input=doc?.getElementById?.('pro-command-input');
    const results=doc?.getElementById?.('pro-command-results');
    const nav=doc?.getElementById?.('pro-navigation');
    if (!overlay || !openButton || !closeButton || !input || !results || !nav) return null;
    const navigation=[...nav.querySelectorAll('[data-vj-target], [data-vj-action]')]
      .map((button,index)=>({button,label:button.textContent.trim(),id:index,kind:'navigation'}));
    const actions=COMMAND_ACTIONS.flatMap(action=>{
      const button=doc.getElementById(action.id);
      return button?[{button,label:'Művelet · '+action.label,id:navigation.length+COMMAND_ACTIONS.indexOf(action),
        kind:'action',terms:action.terms}]:[];
    });
    const entries=[...navigation,...actions];
    let filtered=[],selected=0,previousFocus=null;
    const visible=()=>!overlay.hidden;
    function render() {
      filtered=matches(entries,input.value);
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
        if(entry.kind==='action')item.dataset.commandKind='action';
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
    }
    function open(){
      if(doc.body?.dataset.studioMode!=='pro')return false;
      if(visible()){input.focus();return true;}
      previousFocus=doc.activeElement;
      overlay.hidden=false;
      input.value='';
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
      return true;
    }
    openButton.addEventListener('click',open);
    closeButton.addEventListener('click',()=>close());
    overlay.addEventListener('click',event=>{
      if(event.target===overlay)close();
    });
    input.addEventListener('input',render);
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
        const focusable=[closeButton,input,...results.querySelectorAll('[role="option"]')];
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
    return {open,close,isOpen:visible,execute,render,getMatches:()=>filtered.map(e=>e.label)};
  }
  if(typeof module!=='undefined'&&module.exports)
    module.exports={COMMAND_ACTIONS,normalizeSearch,matches,attachVJCommandSearch};
  if(typeof document!=='undefined')attachVJCommandSearch(document);
})();
