'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Generators=require('../src/generators.js');
const Composition=require('../src/composition.js');
test('six distinct generators exposed with stable IDs and labels',()=>{
  assert.deepEqual(Generators.IDS,['tunnel','plasma','rings','grid','laser','starfield']);
  assert.equal(new Set(Object.values(Generators.NAMES)).size,6);
  assert.equal(Composition.SOURCES.length,10);
  for(const id of Generators.IDS)assert.ok(Composition.SOURCES.includes(id));
});
test('unknown source does not render',()=>{
  assert.equal(Generators.draw('not-a-generator',{}),false);
  assert.equal(Generators.draw('tunnel',null),false);
});
test('existing project migration keeps legacy clip slots while new sources are accepted',()=>{
  const old=Composition.createComposition();
  assert.equal(old.layers[0].clips[0].source,'bars');
  let c=Composition.putClip(old,3,7,'starfield');
  c=Composition.launch(c,3,7);
  const restored=Composition.normalize(JSON.parse(JSON.stringify(c)));
  assert.equal(restored.layers[3].activeSlot,7);
  assert.equal(restored.layers[3].clips[7].source,'starfield');
  assert.equal(restored.layers[0].clips[0].source,'bars');
});
