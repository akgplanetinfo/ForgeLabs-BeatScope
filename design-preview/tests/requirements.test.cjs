'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const data=require('../src/modules.js');
const REQUIRED=['dashboard','simple','studio','library','designer','ai','audio','mixer','output','presets','core','settings','beatscope','stats'];
test('SRS: all 14 mandatory sections are present and navigable',()=>{
 assert.deepEqual(data.modules.map(x=>x.id),REQUIRED);
 assert.equal(new Set(data.modules.map(x=>x.id)).size,14);
 for(const mod of data.modules){
  assert.ok(mod.name&&mod.icon&&mod.tag&&mod.description,mod.id);
  assert.ok(mod.features.length>=5,mod.id);
  assert.ok(mod.features.every(f=>typeof f==='string'&&f.trim()),mod.id);
 }
});
test('SRS: Visual Library contains at least 30 distinct planned cards',()=>{
 assert.ok(data.visuals.length>=30);
 assert.equal(new Set(data.visuals.map(x=>x.id)).size,data.visuals.length);
 assert.ok(data.visuals.every(x=>x.planned===true&&x.category&&x.name));
});
test('SRS: all three AI workflows, actions, and fields are defined',()=>{
 assert.deepEqual(data.aiWorkflows.map(w=>w.name),['Text to Visual','Image to Visual','AI Remix']);
 assert.ok(data.aiWorkflows.every(w=>w.fields.length>=3&&w.actions.length>=4));
 assert.ok(data.aiWorkflows[1].fields.some(f=>f.includes('PNG')));
 assert.ok(data.aiWorkflows[2].actions.includes('Verziók kezelése'));
});
test('Unimplemented actions show the exact required Hungarian development notice',()=>{
 assert.equal(data.PLACEHOLDER,'Ez a funkció még nem működik – fejlesztés alatt.');
});
test('BeatScope reference and ForgeLabs Core keep dedicated non-functional panels',()=>{
 const beat=data.modules.find(x=>x.id==='beatscope');
 assert.ok(beat.features.includes('Kompatibilis presetek'));
 const core=data.modules.find(x=>x.id==='core');
 assert.ok(core.features.includes('Biztonsági beállítások'));
});
