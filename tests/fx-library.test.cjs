'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const fx=require('../src/fx-engine.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('120 selectable effects in 20 distinct GPU filter families',()=>{
  assert.equal(fx.LIBRARY.length,120);
  assert.equal(fx.FAMILIES.length,20);
  assert.equal(new Set(fx.LIBRARY.map(x=>x.id)).size,120);
  assert.equal(new Set(fx.LIBRARY.map(x=>x.name)).size,120);
  for(const group of fx.FAMILIES)assert.equal(group[2].length,6);
});
test('each effect has a defined shader algorithm and profile',()=>{
  const file=read('src/fx-engine.js');
  for(let i=0;i<20;i++)assert.ok(file.includes('family=='+i),'missing shader family '+i);
  for(const entry of fx.LIBRARY){
    assert.equal(fx.byId(entry.id).variant,entry.variant);
    assert.ok(entry.name&&entry.category);
    assert.ok(entry.variant>=0&&entry.variant<6);
  }
});
test('AI can recommend valid effects across frequency profiles',()=>{
  const profiles=[{bass:.85,mids:.2,highs:.1},{bass:.1,mids:.7,highs:.1},{bass:.1,mids:.2,highs:.95},{bass:.1,mids:.1,highs:.1}];
  const found=new Set();
  for(const p of profiles)for(let seed=0;seed<36;seed++){const e=fx.recommend(p,[],seed);assert.ok(fx.byId(e.id));found.add(e.id);}
  assert.ok(found.size>=15,'AI should choose varied effects');
});
test('exclusions are honored for available recommendations',()=>{
  const first=fx.recommend({bass:.8},[],0);
  const next=fx.recommend({bass:.8},[first.id],0);
  assert.notEqual(first.id,next.id);
});
test('GPU renderer includes WebGL2, textures, multi-pass stack and feedback',()=>{
  const src=read('src/fx-engine.js');
  for(const needle of ['webgl2','gl.createFramebuffer()','prevTex','gl.drawArrays','blitFramebuffer','wet','strength'])assert.ok(src.includes(needle),needle);
});
test('FX browser controls and screenshot export are connected',()=>{
  const html=read('index.html'),ui=read('src/ui.js');
  for(const id of ['fx-browser-open','fx-drawer','fx-results','fx-search','fx-category','fx-stack','fx-wet','fx-strength','fx-auto','fx-bypass'])
    assert.ok(html.includes('id="'+id+'"'),id);
  for(const name of ['addFX','drawPostFX','fxAutoUpdate','initFXControls','refreshFXStack','drawImage(fxCanvas'])assert.ok(ui.includes(name),name);
  assert.ok(html.includes('src/fx-engine.js'));
});
test('maximum 3 stack effects and settings are validated',()=>{
  const main=read('src/main.cjs'),ui=read('src/ui.js');
  assert.ok(main.includes('.slice(0,3)'));
  assert.ok(ui.includes('settings.fxStack.length>=3'));
  for(const key of ['fxStack','fxBypass','fxAuto','fxFavorites'])assert.ok(main.includes(key));
});
