'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../src/composition.js');
test('8x8 clip grid and sixteen generator source types',()=>{
 const c=C.createComposition();
 assert.equal(c.layers.length,8);
 for(const l of c.layers)assert.equal(l.clips.length,8);
 assert.equal(C.ROWS*C.COLUMNS,64);
 assert.equal(C.activeLayers(c).length,1);
 assert.deepEqual(C.SOURCES,['bars','wave','orbit','particles','tunnel','plasma','rings','grid','laser','starfield','hexfield','digitalrain','ribbon','mandala','fireflies','electric']);
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

test('independent saved parameters per clip and clamp invalid values',()=>{
 let c=C.createComposition();
 c=C.putClip(c,0,6,'mandala');
 c=C.putClip(c,1,6,'electric');
 c=C.updateClipParams(c,0,6,{speed:2.75,scale:1.55,rotation:-70,audio:.25});
 c=C.updateClipParams(c,1,6,{speed:.4,scale:.8,rotation:135,audio:1.85});
 const n=C.normalize(JSON.parse(JSON.stringify(c)));
 assert.deepEqual(n.layers[0].clips[6].params,{speed:2.75,scale:1.55,rotation:-70,audio:.25});
 assert.deepEqual(n.layers[1].clips[6].params,{speed:.4,scale:.8,rotation:135,audio:1.85});
 c=C.updateClipParams(n,0,6,{speed:999,scale:-1,rotation:999,audio:NaN});
 assert.deepEqual(c.layers[0].clips[6].params,{speed:4,scale:.4,rotation:180,audio:.25});
 assert.equal(n.layers[0].clips[6].params.speed,2.75);
});
test('legacy clip schema without parameters migrates to defaults',()=>{
 const c=C.createComposition();
 c.layers[0].clips[0]={source:'bars'};
 const n=C.normalize(c);
 assert.deepEqual(n.layers[0].clips[0].params,C.DEFAULT_PARAMS);
 const a=C.activeLayers(n)[0];
 assert.deepEqual(a.params,C.DEFAULT_PARAMS);
 assert.equal(a.slot,0);
});

test('scene launch starts all populated clips in a column without stopping empty cells',()=>{
 let c=C.createComposition();
 c=C.launch(c,1,0);
 c=C.stop(c,2);
 c=C.putClip(c,0,6,'mandala');
 c=C.putClip(c,1,6,'electric');
 c=C.launchScene(c,6);
 assert.equal(c.layers[0].activeSlot,6);
 assert.equal(c.layers[1].activeSlot,6);
 assert.equal(c.layers[2].activeSlot,-1);
 assert.equal(c.selectedSlot,6);
 assert.equal(C.activeLayers(c).length,2);
});
test('copy paste and duplication keep independent clip parameters',()=>{
 let c=C.createComposition();
 c=C.putClip(c,0,4,'starfield');
 c=C.updateClipParams(c,0,4,{speed:2.4,scale:1.3,rotation:45,audio:.45});
 const original=C.getClip(c,0,4);
 c=C.pasteClip(c,1,7,original);
 assert.deepEqual(C.getClip(c,1,7),original);
 c=C.updateClipParams(c,1,7,{speed:.4});
 assert.equal(C.getClip(c,0,4).params.speed,2.4);
 assert.equal(C.getClip(c,1,7).params.speed,.4);
 c=C.duplicateClip(c,0,4);
 assert.equal(c.selectedSlot,5);
 assert.deepEqual(C.getClip(c,0,5),original);
});
test('delete active clip stops that layer but leaves others running',()=>{
 let c=C.launch(C.createComposition(),1,0);
 c=C.removeClip(c,0,0);
 assert.equal(c.layers[0].activeSlot,-1);
 assert.equal(c.layers[1].activeSlot,0);
 assert.equal(C.getClip(c,0,0),null);
 assert.equal(C.activeLayers(c).length,1);
});
test('drag move or swap relocates clips without losing settings and active playback',()=>{
 let c=C.createComposition();
 c=C.putClip(c,0,4,'tunnel');
 c=C.updateClipParams(c,0,4,{speed:2.7});
 c=C.launch(c,0,4);
 c=C.moveClip(c,0,4,1,7);
 assert.equal(C.getClip(c,1,7).source,'tunnel');
 assert.equal(C.getClip(c,1,7).params.speed,2.7);
 assert.equal(C.getClip(c,0,4),null);
 assert.equal(c.layers[0].activeSlot,-1);
 assert.equal(c.layers[1].activeSlot,7);
 c=C.moveClip(c,1,7,1,0);
 assert.equal(c.layers[1].activeSlot,0);
 assert.equal(C.getClip(c,1,0).source,'tunnel');
 assert.equal(C.getClip(c,1,7).source,'wave');
});
test('invalid clip location and unknown clipboard source cause no data damage',()=>{
 const c=C.createComposition();
 assert.deepEqual(C.pasteClip(c,0,4,{source:'evil'}),c);
 assert.deepEqual(C.removeClip(c,99,4),c);
 assert.deepEqual(C.moveClip(c,1,1,99,7),c);
 assert.deepEqual(C.launchScene(c,-1),c);
 assert.deepEqual(C.selectClip(c,-1,3),c);
});
test('selected clip slot persists after normalization and defaults safely',()=>{
 let c=C.selectClip(C.createComposition(),3,5);
 assert.equal(C.normalize(c).selectedSlot,5);
 assert.equal(C.normalize({selectedSlot:400,layers:c.layers}).selectedSlot,0);
});

test('clip FX chain holds independent effects and clamps invalid settings',()=>{
 let c=C.createComposition();
 c=C.setClipEffects(c,0,0,[{id:'fx-001',wet:.25,strength:1.7,disabled:false},{id:'fx-057',wet:8,strength:-2,disabled:true},{id:'fx-120',wet:.7,strength:1}],false);
 assert.deepEqual(c.layers[0].clips[0].fxStack.map(x=>x.id),['fx-001','fx-057','fx-120']);
 assert.equal(c.layers[0].clips[0].fxStack[1].wet,1);
 assert.equal(c.layers[0].clips[0].fxStack[1].strength,0);
 assert.equal(c.layers[0].clips[0].fxStack[1].disabled,true);
 assert.deepEqual(c.layers[0].clips[1].fxStack,[]);
 const entry=C.activeLayers(c)[0];
 assert.equal(entry.fxStack.length,3);
 assert.equal(entry.fxBypass,false);
 c=C.setClipEffects(c,0,0,undefined,true);
 assert.equal(c.layers[0].clips[0].fxBypass,true);
 assert.equal(c.layers[0].clips[0].fxStack.length,3);
});
test('clip effects are validated, unknown IDs removed, and stacks capped at 3',()=>{
 const list=[{id:'fx-000'},{id:'fx-121'},{id:'fake'},{id:'fx-010',wet:NaN,strength:Infinity},{id:'fx-099'},{id:'fx-001'},{id:'fx-120'}];
 const out=C.normalizeFxStack(list);
 assert.deepEqual(out.map(x=>x.id),['fx-010','fx-099','fx-001']);
 assert.deepEqual(out[0],{id:'fx-010',wet:1,strength:1,disabled:false});
 assert.deepEqual(C.normalizeFxStack(null),[]);
});
test('pasting, duplicating and moving preserve FX but do not alias stacks',()=>{
 let c=C.putClip(C.createComposition(),0,6,'laser');
 c=C.setClipEffects(c,0,6,[{id:'fx-020',wet:.45,strength:1.8}],true);
 c=C.pasteClip(c,2,4,C.getClip(c,0,6));
 assert.equal(C.getClip(c,2,4).fxStack[0].id,'fx-020');
 assert.equal(C.getClip(c,2,4).fxBypass,true);
 c=C.setClipEffects(c,2,4,[{id:'fx-064',wet:.8}],false);
 assert.equal(C.getClip(c,0,6).fxStack[0].id,'fx-020');
 c=C.duplicateClip(c,0,6);
 assert.equal(C.getClip(c,0,7).fxStack[0].wet,.45);
 c=C.moveClip(c,0,6,4,7);
 assert.equal(C.getClip(c,4,7).fxStack[0].id,'fx-020');
 assert.equal(C.getClip(c,4,7).fxBypass,true);
 assert.equal(C.getClip(c,0,6),null);
});
test('old clip data migrates without effects and does not destroy previous generator params',()=>{
 const c=C.createComposition();c.layers[0].clips[0]={source:'rings',params:{speed:2.3,scale:1.6,rotation:0,audio:.3}};
 const migrated=C.normalize(c);
 assert.deepEqual(migrated.layers[0].clips[0].fxStack,[]);
 assert.equal(migrated.layers[0].clips[0].fxBypass,false);
 assert.equal(migrated.layers[0].clips[0].params.speed,2.3);
});
