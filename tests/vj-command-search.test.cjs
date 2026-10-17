'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {normalizeSearch,matches,attachVJCommandSearch}=require('../src/vj-command-search.js');
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
function fixture() {
  const ids=['pro-command-overlay','pro-search-open','pro-command-close',
    'pro-command-input','pro-command-results','pro-navigation','studio-simple'];
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

test('Search dialog is in the Electron renderer with original navigation unchanged',()=>{
  const html=read('index.html'),css=read('src/lumina-theme.css'),js=read('src/vj-command-search.js');
  for(const id of ['pro-search-open','pro-command-overlay','pro-command-input',
    'pro-command-close','pro-command-results','pro-navigation'])
    assert.ok(html.includes('id="'+id+'"'),'Missing '+id);
  assert.match(html,/src\/vj-command-search\.js/);
  assert.ok(html.indexOf('src/pro-navigation.js')<html.indexOf('src/vj-command-search.js'));
  assert.match(css,/\.pro-command-overlay\[hidden\]\{display:none!important\}/);
  assert.match(js,/entry\.button\.click\(\)/);
});
