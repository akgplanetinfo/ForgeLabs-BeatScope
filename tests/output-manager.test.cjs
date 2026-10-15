'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Router=require('../src/output-manager.cjs');
test('only bounded actual JPEG frames are relayed across windows',()=>{
 const ok='data:image/jpeg;base64,'+'A'.repeat(384);
 assert.equal(Router.validFrame(ok),true);
 assert.equal(Router.validFrame('data:image/png;base64,'+'A'.repeat(384)),false);
 assert.equal(Router.validFrame('javascript:'+'A'.repeat(500)),false);
 assert.equal(Router.validFrame('data:image/jpeg;base64,../secret'),false);
 assert.equal(Router.validFrame('data:image/jpeg;base64,'+'A'.repeat(2_200_000)),false);
 assert.equal(Router.validFrame({image:ok}),false);
});
test('display discovery annotates primary and external without exposing physical identifiers',()=>{
 const fake=[
  {id:100,bounds:{x:0,y:0,width:1920,height:1080}},
  {id:200,bounds:{x:1920,y:0,width:2560,height:1440}}
 ];
 const output=Router.displayOptions(fake,100);
 assert.deepEqual(output.map(d=>d.primary),[true,false]);
 assert.equal(output[0].name,'Kijelző 1 (elsődleges)');
 assert.equal(output[1].name,'Kijelző 2 (külső)');
 assert.equal(output[1].width,2560);
 assert.equal(Router.chooseDisplay(fake,100,200).id,200);
 assert.equal(Router.chooseDisplay(fake,100,999).id,100);
 assert.equal(Router.chooseDisplay([],100,999),null);
});


test('selectable HD and Full HD output profiles are validated',()=>{
 assert.deepEqual(Router.RESOLUTIONS,[540,720,1080]);
 assert.deepEqual(Router.FPS_OPTIONS,[12,24,30]);
 assert.deepEqual(Router.QUALITY_OPTIONS,[65,80,90]);
 assert.deepEqual(Router.normalizeConfig({}),Router.DEFAULT_CONFIG);
 assert.deepEqual(Router.normalizeConfig({outputResolution:720,outputFps:24,outputQuality:90}),
   {outputResolution:720,outputFps:24,outputQuality:90});
 assert.deepEqual(Router.normalizeConfig({outputResolution:4096,outputFps:300,outputQuality:'65'}),Router.DEFAULT_CONFIG);
 assert.deepEqual(Router.dimensions(540),{width:960,height:540});
 assert.deepEqual(Router.dimensions(720),{width:1280,height:720});
 assert.deepEqual(Router.dimensions(1080),{width:1920,height:1080});
 assert.equal(Router.interval(12),1000/12);
 assert.equal(Router.interval(24),1000/24);
 assert.equal(Router.interval(30),1000/30);
});
test('large but bounded HD JPEG frames are accepted, excessive IPC input is rejected',()=>{
 const png='data:image/png;base64,'+'A'.repeat(450);
 assert.equal(Router.validFrame(png),false);
 const valid='data:image/jpeg;base64,'+'A'.repeat(3_200_000);
 assert.equal(Router.validFrame(valid),true);
 assert.equal(Router.validFrame('data:image/jpeg;base64,'+'A'.repeat(Router.MAX_FRAME_LENGTH)),false);
});
