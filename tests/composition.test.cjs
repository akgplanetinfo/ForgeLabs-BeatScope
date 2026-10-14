'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/composition.js');
test('8x8 clip grid and ten working generator source types',()=>{
 const c=C.createComposition();
 assert.equal(c.layers.length,8);
 for(const l of c.layers)assert.equal(l.clips.length,8);
 assert.equal(C.ROWS*C.COLUMNS,64);
 assert.equal(C.activeLayers(c).length,1);
 assert.deepEqual(C.SOURCES,['bars','wave','orbit','particles','tunnel','plasma','rings','grid','laser','starfield']);
});
test('launch multiple layers, preserve other layers while switching clips',()=>{
 let c=C.createComposition();
 c=C.launch(c,1,1);
 assert.deepEqual(C.activeLayers(c).map(x=>x.index),[1,0]);
 assert.equal(c.layers[0].activeSlot,0);
 c=C.launch(c,0,2);
 assert.equal(c.layers[0].activeSlot,2);
 assert.equal(c.layers[1].activeSlot,1);
 assert.equal(C.activeLayers(c)[1].source,'orbit');
});
test('mute solo opacity and stop change actual active layers',()=>{
 let c=C.launch(C.createComposition(),1,2);
 c=C.layerAction(c,1,{muted:true});
 assert.deepEqual(C.activeLayers(c).map(x=>x.index),[0]);
 c=C.layerAction(c,1,{muted:false,solo:true});
 assert.deepEqual(C.activeLayers(c).map(x=>x.index),[1]);
 c=C.layerAction(c,1,{opacity:0});
 assert.equal(C.activeLayers(c).length,0);
 c=C.layerAction(c,1,{opacity:.55,solo:false});
 assert.deepEqual(C.activeLayers(c).map(x=>x.index),[1,0]);
 c=C.stop(c,1);
 assert.deepEqual(C.activeLayers(c).map(x=>x.index),[0]);
});
test('empty clip can be filled and launched without touching other clips',()=>{
 let c=C.createComposition();
 assert.equal(c.layers[2].clips[5],null);
 c=C.putClip(c,2,5,'particles');
 c=C.launch(c,2,5);
 assert.equal(c.layers[2].activeSlot,5);
 assert.equal(c.layers[2].clips[5].source,'particles');
 assert.equal(c.layers[2].clips[2].source,'bars');
});
test('clip data is normalized, unknown sources sanitized and opacity clamped',()=>{
 const c=C.createComposition();
 c.layers[0].opacity=4;
 c.layers[0].clips[0]={source:'javascript:evil'};
 c.layers[1].clips[0]={source:'wave'};
 c.selectedLayer=999;
 const n=C.normalize(c);
 assert.equal(n.layers[0].opacity,1);
 assert.equal(n.layers[0].clips[0],null);
 assert.equal(n.layers[0].activeSlot,-1);
 assert.equal(n.selectedLayer,0);
 assert.equal(n.layers[1].clips[0].source,'wave');
});
test('clip actions are immutable and invalid coordinates are ignored',()=>{
 const c=C.createComposition();
 const next=C.putClip(c,0,4,'orbit');
 assert.equal(c.layers[0].clips[4],null);
 assert.equal(next.layers[0].clips[4].source,'orbit');
 const n=C.launch(next,32,10);
 assert.equal(n.layers[0].activeSlot,0);
});
test('legacy preferences recover a valid composition',()=>{
 const n=C.normalize(null);
 assert.equal(n.layers.length,8);
 assert.equal(n.layers[0].activeSlot,0);
});

test('new generators can be saved, relaunched and survive normalized project preferences',()=>{
  let c=C.createComposition();
  for(let i=0;i<6;i++){
    const src=C.SOURCES[i+4];
    c=C.putClip(c,i,6,src);
    c=C.launch(c,i,6);
    const saved=JSON.parse(JSON.stringify(c));
    c=C.normalize(saved);
    assert.equal(c.layers[i].clips[6].source,src);
    assert.equal(c.layers[i].activeSlot,6);
  }
  assert.equal(C.activeLayers(c).length,6);
});
