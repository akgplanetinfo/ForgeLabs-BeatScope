'use strict';
// Alpha 17 stage 5: searchable navigation, delegating exclusively to existing Pro VJ buttons.
(() => {
  const normalizeSearch = value => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('hu').trim();
  const matches = (entries, term) => {
    const query = normalizeSearch(term);
    return entries.filter(entry => normalizeSearch(entry.label).includes(query));
  };
  function attachVJCommandSearch(doc) {
    const overlay=doc?.getElementById?.('pro-command-overlay');
    const openButton=doc?.getElementById?.('pro-search-open');
    const closeButton=doc?.getElementById?.('pro-command-close');
    const input=doc?.getElementById?.('pro-command-input');
    const results=doc?.getElementById?.('pro-command-results');
    const nav=doc?.getElementById?.('pro-navigation');
    if (!overlay || !openButton || !closeButton || !input || !results || !nav) return null;
    const entries=[...nav.querySelectorAll('[data-vj-target], [data-vj-action]')]
      .map((button,index)=>({button,label:button.textContent.trim(),id:index}));
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
      if(!entry || !entries.includes(entry))return false;
      // This uses the existing Pro VJ navigation (history, FX library and section focus).
      close({restoreFocus:false});
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
      }
    },true);
    doc.getElementById('studio-simple')?.addEventListener('click',()=>close({restoreFocus:false}));
    return {open,close,isOpen:visible,execute,render,getMatches:()=>filtered.map(e=>e.label)};
  }
  if(typeof module!=='undefined'&&module.exports)
    module.exports={normalizeSearch,matches,attachVJCommandSearch};
  if(typeof document!=='undefined')attachVJCommandSearch(document);
})();
