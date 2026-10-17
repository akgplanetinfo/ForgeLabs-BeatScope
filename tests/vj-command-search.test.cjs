'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {COMMAND_ACTIONS,RECENT_KEY,RECENT_LIMIT,FAVORITE_KEY,FAVORITE_LIMIT,normalizeSearch,matches,prioritizeRecent,prioritizeFavorites,attachVJCommandSearch}=require('../src/vj-command-search.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

function makeElement(id='') {
  const handlers=new Map(), attributes=new Map();
  const node={
    id,dataset:{},textContent:'',value:'',hidden:false,disabled:false,
    children:[],isConnected:true,
    addEventListener(name,fn){handlers.set(name,fn);},
    fire(name,event={}){handlers.get(name)?.(event);},
    click(){node.clicks=(node.clicks||0)+1;node.fire('click',{target:node});},
    focus(){node.focusCount=(node.focusCount||0)+1;doc.activeElement=node;},
    setAttribute(name,value){attributes.set(name,String(value));},
    getAttribute(name){return attributes.get(name)??null;},
    removeAttribute(name){attributes.delete(name);},
    append(child){node.children.push(child);},
    replaceChildren(...children){node.children=[...children];},
    querySelectorAll(selector){
      if(selector==='[role="option"]')return node.children.filter(e=>e.getAttribute('role')==='option');
      return [];
    },
    querySelector(selector){
      if(selector==='[aria-selected="true"]')
        return node.children.find(e=>e.getAttribute('aria-selected')==='true')||null;
      return null;
    },
    scrollIntoView(){node.scrolled=true;}
  };
  return node;
}
let doc;
function fixture({withActions=false}={}) {
  const ids=['pro-command-overlay','pro-search-open','pro-command-close',
    'pro-command-input','pro-command-results','pro-command-favorite','pro-command-note',
    'pro-navigation','studio-simple',
    ...(withActions?COMMAND_ACTIONS.map(action=>action.id):[])];
  const els=Object.fromEntries(ids.map(id=>[id,makeElement(id)]));
  const navItems=['BPM','Layer Mixer','FX Library ↗','VJ Output','Kliprács'].map((label,i)=>{
    const b=makeElement('nav'+i);
    b.textContent=label;
    b.dataset=i===2?{vjAction:'fx-library'}:{vjTarget:'id-'+i};
    return b;
  });
  els['pro-navigation'].querySelectorAll=selector=>{
    assert.equal(selector,'[data-vj-target], [data-vj-action]');
    return navItems;
  };
  els['pro-command-overlay'].hidden=true;
  const docHandlers=new Map();
  doc={
    body:{dataset:{studioMode:'pro'}},activeElement:els['pro-search-open'],
    getElementById:id=>els[id]||null,
    createElement:tag=>{const e=makeElement();e.tag=tag;return e;},
    addEventListener(name,fn){docHandlers.set(name,fn);},
    fire(name,event){docHandlers.get(name)?.(event);}
  };
  function key(key,extras={}) {
    let prevented=false,stopped=false;
    const e={key,target:els['pro-command-input'],
      preventDefault(){prevented=true;},stopPropagation(){stopped=true;},
      ...extras};
    return {event:e,dispatch:()=>{els['pro-command-input'].fire('keydown',e);return{prevented,stopped};}};
  }
  return {els,navItems,key,
    docKey(key,extras={}){
      let prevented=false;
      doc.fire('keydown',{key,preventDefault(){prevented=true;},stopPropagation(){},...extras});
      return prevented;
    }};
}
test('Search is accent insensitive and accepts partial names',()=>{
  assert.equal(normalizeSearch('  KLIPRÁCS '),'klipracs');
});
test('Queries filter only known navigation entries',()=>{
  const entries=[{label:'Kliprács'},{label:'BPM'},{label:'Layer Mixer'}];
  assert.deepEqual(matches(entries,'klipracs').map(e=>e.label),['Kliprács']);
  assert.deepEqual(matches(entries,'layer').map(e=>e.label),['Layer Mixer']);
  assert.equal(matches(entries,'no-match').length,0);
});
test('Ctrl+K only opens in Pro; input filters and Enter activates original button',()=>{
  const f=fixture(), controller=attachVJCommandSearch(doc);
  assert.ok(controller);
  assert.equal(f.docKey('k',{ctrlKey:true}),true);
  assert.equal(controller.isOpen(),true);
  assert.equal(doc.activeElement,f.els['pro-command-input']);
  assert.equal(controller.getMatches().length,5);
  f.els['pro-command-input'].value='mix';
  f.els['pro-command-input'].fire('input');
  assert.deepEqual(controller.getMatches(),['Layer Mixer']);
  assert.equal(f.els['pro-command-input'].getAttribute('aria-activedescendant'),'pro-command-option-1');
  f.key('Enter').dispatch();
  assert.equal(f.navItems[1].clicks,1);
  assert.equal(controller.isOpen(),false);
  doc.body.dataset.studioMode='simple';
  assert.equal(f.docKey('k',{ctrlKey:true}),false);
  assert.equal(controller.isOpen(),false);
});
test('Arrow selection, unknown terms and Escape safely close palette',()=>{
  const f=fixture(), controller=attachVJCommandSearch(doc);
  controller.open();
  const input=f.els['pro-command-input'];
  assert.equal(input.getAttribute('aria-activedescendant'),'pro-command-option-0');
  f.key('ArrowDown').dispatch();
  assert.equal(input.getAttribute('aria-activedescendant'),'pro-command-option-1');
  f.key('ArrowUp').dispatch();
  assert.equal(input.getAttribute('aria-activedescendant'),'pro-command-option-0');
  input.value='nothing-here';
  input.fire('input');
  assert.equal(controller.getMatches().length,0);
  assert.equal(input.getAttribute('aria-activedescendant'),null);
  f.key('Enter').dispatch();
  assert.equal(f.navItems.reduce((n,x)=>n+(x.clicks||0),0),0);
  assert.equal(controller.isOpen(),true);
  f.key('Escape').dispatch();
  assert.equal(controller.isOpen(),false);
  assert.equal(doc.activeElement,f.els['pro-search-open']);
});
test('Explicit close button, outside click and switch to Simple close safely',()=>{
  const f=fixture(),controller=attachVJCommandSearch(doc);
  controller.open();
  f.els['pro-command-close'].click();
  assert.equal(controller.isOpen(),false);
  controller.open();
  f.els['pro-command-overlay'].fire('click',{target:f.els['pro-command-overlay']});
  assert.equal(controller.isOpen(),false);
  controller.open();
  f.els['studio-simple'].click();
  assert.equal(controller.isOpen(),false);
});
test('Tab and Shift+Tab keep focus within the open modal',()=>{
  const f=fixture(),controller=attachVJCommandSearch(doc);
  controller.open();
  const items=f.els['pro-command-results'].querySelectorAll('[role="option"]');
  items[items.length-1].focus();
  assert.equal(f.docKey('Tab'),true);
  assert.equal(doc.activeElement,f.els['pro-command-close']);
  assert.equal(f.docKey('Tab',{shiftKey:true}),true);
  assert.equal(doc.activeElement,items[items.length-1]);
  controller.close();
});

test('Stage 6 action registry uses existing BeatScope source IDs and searchable aliases',()=>{
  assert.equal(COMMAND_ACTIONS.length,7);
  const html=read('index.html');
  for(const action of COMMAND_ACTIONS)assert.ok(html.includes('id="'+action.id+'"'),action.id);
  const entries=COMMAND_ACTIONS.map(action=>({label:'Művelet · '+action.label,terms:action.terms}));
  assert.deepEqual(matches(entries,'screenshot').map(x=>x.label),['Művelet · Kép mentése PNG']);
  assert.deepEqual(matches(entries,'mikrofon').map(x=>x.label),['Művelet · Mikrofon kapcsolása']);
  assert.deepEqual(matches(entries,'projekt').map(x=>x.label),['Művelet · Projekt mentése']);
});

test('Stage 6 delegates each selected action once to its original BeatScope control',()=>{
  const f=fixture({withActions:true}),ctrl=attachVJCommandSearch(doc);
  for(const action of COMMAND_ACTIONS){
    assert.equal(ctrl.open(),true);
    f.els['pro-command-input'].value=action.label;
    f.els['pro-command-input'].fire('input');
    const names=ctrl.getMatches();
    assert.equal(names.length,1,action.label+': '+names.join(', '));
    f.key('Enter').dispatch();
    assert.equal(f.els[action.id].clicks,1,action.id);
    assert.equal(ctrl.isOpen(),false);
  }
});

test('Stage 6 does not run a disabled action; re-enabled original actions become available',()=>{
  const f=fixture({withActions:true}),ctrl=attachVJCommandSearch(doc);
  f.els['open-preview'].disabled=true;
  ctrl.open();
  f.els['pro-command-input'].value='Előnézeti ablak megnyitása';
  f.els['pro-command-input'].fire('input');
  const row=f.els['pro-command-results'].querySelectorAll('[role="option"]')[0];
  assert.equal(row.disabled,true);
  f.key('Enter').dispatch();
  assert.equal(ctrl.isOpen(),true);
  assert.equal(f.els['open-preview'].clicks||0,0);
  f.els['open-preview'].disabled=false;
  f.els['pro-command-input'].fire('input');
  assert.equal(f.els['pro-command-results'].querySelectorAll('[role="option"]')[0].disabled,false);
  f.key('Enter').dispatch();
  assert.equal(ctrl.isOpen(),false);
  assert.equal(f.els['open-preview'].clicks,1);
});

test('Stage 7 recent commands appear first on an empty query and persist only stable IDs',()=>{
  const values=new Map();
  const storage={getItem:key=>values.get(key)||null,setItem:(key,val)=>values.set(key,val)};
  const f=fixture({withActions:true}),ctrl=attachVJCommandSearch(doc,storage);
  ctrl.open();
  assert.equal(ctrl.getRecentKeys().length,0);
  f.els['pro-command-input'].value='Layer Mixer';
  f.els['pro-command-input'].fire('input');
  f.key('Enter').dispatch();
  assert.deepEqual(ctrl.getRecentKeys(),['target:id-1']);
  assert.deepEqual(JSON.parse(values.get(RECENT_KEY)),['target:id-1']);
  ctrl.open();
  assert.equal(ctrl.getMatches()[0],'Layer Mixer');
  const option=f.els['pro-command-results'].querySelectorAll('[role="option"]')[0];
  assert.equal(option.dataset.recent,'true');
  assert.equal(option.dataset.commandKind,'navigation');
  f.els['pro-command-input'].value='play pause';
  f.els['pro-command-input'].fire('input');
  f.key('Enter').dispatch();
  assert.deepEqual(ctrl.getRecentKeys(),['action:play-pause','target:id-1']);
  ctrl.open();
  assert.equal(ctrl.getMatches()[0],'Művelet · Lejátszás / szünet');
  assert.equal(f.els['pro-command-results'].querySelectorAll('[role="option"]')[0].dataset.commandKind,'action');
  assert.equal(f.els['pro-command-results'].querySelectorAll('[role="option"]')[0].dataset.recent,'true');
  assert.equal(values.get(RECENT_KEY).includes('play pause'),false);
});

test('Stage 7 recents are bounded and do not keep duplicates',()=>{
  const storage={value:'',getItem(){return this.value;},setItem(_key,val){this.value=val;}};
  const f=fixture({withActions:true}),ctrl=attachVJCommandSearch(doc,storage);
  for(const query of ['Layer Mixer','BPM','Kliprács','screenshot','Mikrofon kapcsolása','Projekt mentése']){
    ctrl.open();
    f.els['pro-command-input'].value=query;
    f.els['pro-command-input'].fire('input');
    assert.equal(ctrl.getMatches().length,1,query);
    f.key('Enter').dispatch();
  }
  assert.equal(ctrl.getRecentKeys().length,RECENT_LIMIT);
  assert.equal(ctrl.getRecentKeys()[0],'action:project-save');
  assert.equal(ctrl.getRecentKeys().includes('target:id-1'),false);
  ctrl.open();
  f.els['pro-command-input'].value='Projekt mentése';
  f.els['pro-command-input'].fire('input');
  f.key('Enter').dispatch();
  assert.equal(new Set(ctrl.getRecentKeys()).size,RECENT_LIMIT);
});

test('Stage 7 validates stored recents, supports blocked storage and restores next session',()=>{
  const values=new Map([[RECENT_KEY,JSON.stringify(['not-a-command','action:microphone','action:microphone','target:id-4'])]]);
  const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  const f=fixture({withActions:true}),ctrl=attachVJCommandSearch(doc,storage);
  assert.deepEqual(ctrl.getRecentKeys(),['action:microphone','target:id-4']);
  ctrl.open();
  assert.equal(ctrl.getMatches()[0],'Művelet · Mikrofon kapcsolása');
  ctrl.close();
  const reread=attachVJCommandSearch(doc,storage);
  assert.deepEqual(reread.getRecentKeys(),['action:microphone','target:id-4']);
  const blocked={getItem(){throw Error('access denied');},setItem(){throw Error('access denied');}};
  const f2=fixture({withActions:true}),offline=attachVJCommandSearch(doc,blocked);
  assert.equal(offline.open(),true);
  f2.els['pro-command-input'].value='BPM';
  f2.els['pro-command-input'].fire('input');
  f2.key('Enter').dispatch();
  assert.deepEqual(offline.getRecentKeys(),['target:id-0']);
  assert.equal(offline.isOpen(),false);
});

test('Stage 7 sorting is stable and never mutates original search results',()=>{
  const items=[{key:'a'},{key:'b'},{key:'c'},{key:'d'}];
  const sorted=prioritizeRecent(items,['d','b']);
  assert.deepEqual(sorted.map(x=>x.key),['d','b','a','c']);
  assert.deepEqual(items.map(x=>x.key),['a','b','c','d']);
});

test('Stage 8 pinned favorite outranks recent and persists without search text',()=>{
  const values=new Map();
  const storage={getItem:key=>values.get(key)||null,setItem:(key,v)=>values.set(key,v)};
  const f=fixture({withActions:true}),ctrl=attachVJCommandSearch(doc,storage);
  ctrl.open();
  const input=f.els['pro-command-input'],pin=f.els['pro-command-favorite'];
  assert.equal(pin.disabled,false);
  assert.equal(pin.getAttribute('aria-pressed'),'false');
  input.value='Layer Mixer';input.fire('input');
  assert.equal(pin.getAttribute('aria-pressed'),'false');
  pin.click();
  assert.deepEqual(ctrl.getFavoriteKeys(),['target:id-1']);
  assert.equal(pin.getAttribute('aria-pressed'),'true');
  assert.deepEqual(JSON.parse(values.get(FAVORITE_KEY)),['target:id-1']);
  assert.equal(values.get(FAVORITE_KEY).includes('Layer Mixer'),false);
  input.value='BPM';input.fire('input');
  f.key('Enter').dispatch();
  assert.deepEqual(ctrl.getRecentKeys(),['target:id-0']);
  ctrl.open();
  assert.equal(ctrl.getMatches()[0],'Layer Mixer','Pinned wins over more recent BPM');
  const first=f.els['pro-command-results'].querySelectorAll('[role="option"]')[0];
  assert.equal(first.dataset.favorite,'true');
  assert.equal(first.dataset.commandKind,'navigation');
  assert.equal(first.dataset.recent,undefined);
  ctrl.close();
  const revived=fixture({withActions:true}),afterRestart=attachVJCommandSearch(doc,storage);
  assert.deepEqual(afterRestart.getFavoriteKeys(),['target:id-1']);
  afterRestart.open();
  assert.equal(afterRestart.getMatches()[0],'Layer Mixer');
  revived.els['pro-command-favorite'].click();
  assert.deepEqual(afterRestart.getFavoriteKeys(),[]);
  assert.equal(afterRestart.getMatches()[0],'BPM');
});

test('Stage 8 favorites are bounded, unique and permit clean unpinning',()=>{
  const values=new Map();
  const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  const f=fixture({withActions:true}),ctrl=attachVJCommandSearch(doc,storage);
  const pin=f.els['pro-command-favorite'];
  const queries=['BPM','Layer Mixer','FX Library','VJ Output','Kliprács',
    'Zene betöltése','Lejátszás / szünet','Mikrofon kapcsolása'];
  for(const query of queries){
    ctrl.open();
    f.els['pro-command-input'].value=query;
    f.els['pro-command-input'].fire('input');
    assert.equal(ctrl.getMatches().length,1,query);
    pin.click();
    ctrl.close();
  }
  assert.equal(ctrl.getFavoriteKeys().length,FAVORITE_LIMIT);
  ctrl.open();
  f.els['pro-command-input'].value='Automatikus FX';
  f.els['pro-command-input'].fire('input');
  assert.equal(ctrl.toggleFavorite(),false);
  assert.equal(f.els['pro-command-note'].textContent,'Legfeljebb 8 kedvenc rögzíthető.');
  assert.equal(ctrl.getFavoriteKeys().length,8);
  f.els['pro-command-input'].value='BPM';f.els['pro-command-input'].fire('input');
  pin.click();
  assert.equal(ctrl.getFavoriteKeys().length,7);
  f.els['pro-command-input'].value='Automatikus FX';f.els['pro-command-input'].fire('input');
  assert.equal(ctrl.toggleFavorite(),true);
  assert.equal(ctrl.getFavoriteKeys().length,8);
  assert.equal(new Set(ctrl.getFavoriteKeys()).size,8);
});

test('Stage 8 invalid favorites and blocked localStorage do not break command execution',()=>{
  const bad=new Map([[FAVORITE_KEY,JSON.stringify(['bogus','target:id-4','target:id-4','action:ai-toggle',123])]]);
  const storage={getItem:k=>bad.get(k),setItem:(k,v)=>bad.set(k,v)};
  const f=fixture({withActions:true}),ctrl=attachVJCommandSearch(doc,storage);
  assert.deepEqual(ctrl.getFavoriteKeys(),['target:id-4','action:ai-toggle']);
  ctrl.open();
  assert.deepEqual(ctrl.getMatches().slice(0,2),['Kliprács','Művelet · Automatikus FX kapcsolása']);
  const blocked={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
  const g=fixture({withActions:true}),offline=attachVJCommandSearch(doc,blocked);
  offline.open();
  assert.equal(offline.toggleFavorite(),true);
  assert.equal(offline.getFavoriteKeys().length,1);
  g.els['pro-command-input'].value='BPM';g.els['pro-command-input'].fire('input');
  g.key('Enter').dispatch();
  assert.equal(g.navItems[0].clicks,1);
});

test('Stage 8 ranking is stable with favorite, recent and ordinary commands',()=>{
  const items=['a','b','c','d','e'].map(key=>({key}));
  assert.deepEqual(prioritizeFavorites(items,['d','b'],['e','a']).map(x=>x.key),
    ['d','b','e','a','c']);
  assert.deepEqual(items.map(x=>x.key),['a','b','c','d','e']);
});

test('Search dialog is in the Electron renderer with original navigation unchanged',()=>{
  const html=read('index.html'),css=read('src/lumina-theme.css'),js=read('src/vj-command-search.js');
  for(const id of ['pro-search-open','pro-command-overlay','pro-command-input',
    'pro-command-close','pro-command-results','pro-command-favorite','pro-navigation'])
    assert.ok(html.includes('id="'+id+'"'),'Missing '+id);
  assert.match(html,/src\/vj-command-search\.js/);
  assert.ok(html.indexOf('src/pro-navigation.js')<html.indexOf('src/vj-command-search.js'));
  assert.match(css,/\.pro-command-overlay\[hidden\]\{display:none!important\}/);
  assert.match(js,/entry\.button\.click\(\)/);
});
