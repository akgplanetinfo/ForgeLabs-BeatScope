'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createDirector,estimateBpm,SPEEDS}=require('../src/ai-director.js');
const sound={bass:.53,mids:.34,highs:.17,total:.19,rms:.26};
test('AI Visual Director exists and has independent speed settings',()=>{
  assert.deepEqual(Object.keys(SPEEDS),['calm','balanced','party']);
  assert.ok(SPEEDS.calm>SPEEDS.balanced&&SPEEDS.balanced>SPEEDS.party);
});
test('AI never switches on silence',()=>{
  const ai=createDirector();
  for(let t=0;t<=40000;t+=250){
    const result=ai.update({bass:0,mids:0,highs:0,total:0,rms:0},t,'bars','party');
    assert.equal(result.change,false);
  }
});
test('AI changes mode when music is active and respects cooldown',()=>{
  const ai=createDirector();
  assert.equal(ai.update(sound,0,'bars','party').change,false);
  assert.equal(ai.update(sound,2500,'bars','party').change,false);
  const decision=ai.update(sound,4000,'bars','party');
  assert.equal(decision.change,true);
  assert.notEqual(decision.mode,'bars');
  assert.ok(decision.reason);
  assert.equal(ai.update(sound,4200,decision.mode,'party').change,false);
});
test('AI remains varied when audio stays steady',()=>{
  const ai=createDirector();
  let mode='bars', visited=new Set([mode]);
  for(let t=0;t<48000;t+=4000){
    const result=ai.update(sound,t,mode,'party');
    if(result.change){mode=result.mode;visited.add(mode);}
  }
  assert.ok(visited.size>=3,'Expected a changing selection of visualizations');
});
test('AI BPM estimate is based on measured transients, not a random number',()=>{
  const hits=[0,500,1000,1500,2000,2500,3000];
  assert.equal(estimateBpm(hits),120);
  assert.equal(estimateBpm([]),null);
});
test('AI reset forgets old scene cooldown and beat history',()=>{
  const ai=createDirector();
  ai.update(sound,0,'bars','party');
  assert.equal(ai.update(sound,5000,'bars','party').change,true);
  ai.reset();
  assert.equal(ai.update(sound,5100,'wave','party').change,false);
});
test('AI settings and UI are connected to persistent preferences',()=>{
  const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
  const main=read('src/main.cjs'),html=read('index.html'),ui=read('src/ui.js');
  for(const field of ['aiEnabled','aiSpeed','aiPalette']){
    assert.ok(main.includes(field),field+' prefs missing');
    assert.ok(ui.includes(field),field+' ui missing');
  }
  for(const el of ['ai-toggle','ai-speed','ai-palette','ai-status','ai-bpm'])
    assert.ok(html.includes('id="'+el+'"'),el);
  assert.ok(html.includes('src/ai-director.js'));
  assert.ok(ui.includes('aiDirector.update('));
  assert.ok(ui.includes('modeTransition'));
});
