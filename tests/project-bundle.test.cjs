'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const Project=require('../src/project-bundle.cjs');
const Media=require('../src/media-library.cjs');
const Composition=require('../src/composition.js');
const config=()=>({composition:Composition.createComposition(),bpm:127,fxStack:[{id:'fx-012',strength:.75,wet:1,disabled:false}]});
async function sandbox(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'beatscope-project-test-'));
 return {dir,cleanup:()=>fs.rm(dir,{recursive:true,force:true})};
}
function makeMediaClip(settings,id){
 const c=Composition.normalize(settings.composition);
 c.layers[0].clips[0]={
  source:'media',mediaId:id,mediaName:'Fixture media',params:Composition.sanitizeParams(null),
  fxStack:[{id:'fx-003',wet:1,strength:1,disabled:false}],fxBypass:false
 };
 c.layers[0].activeSlot=0;
 return {...settings,composition:c};
}
test('empty media project roundtrips and survives program preferences normalization',async()=>{
 const env=await sandbox();
 try{
  const prefs=config();
  const bytes=await Project.create(prefs,env.dir);
  assert.ok(bytes.subarray(0,Project.MAGIC.length).equals(Project.MAGIC));
  const decoded=await Project.parse(bytes);
  assert.equal(decoded.assets.length,0);
  assert.deepEqual(decoded.settings,prefs);
  let applied=null;
  const result=await Project.restore(decoded,env.dir,x=>x,async x=>{applied=x;});
  assert.equal(result.restored,true);
  assert.deepEqual(applied,prefs);
 }finally{await env.cleanup();}
});
test('a referenced image is bundled, integrity-checked and restored with an opaque fresh ID',async()=>{
 const env=await sandbox();
 try{
  await fs.mkdir(Media.mediaDir(env.dir),{recursive:true});
  const oldId='media-aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa.png';
  const payload=Buffer.from('image-mock-fixture\u0000\u0001\u0002');
  await fs.writeFile(path.join(Media.mediaDir(env.dir),oldId),payload);
  const prefs=makeMediaClip(config(),oldId);
  const packed=await Project.create(prefs,env.dir);
  const parsed=await Project.parse(packed);
  assert.equal(parsed.assets.length,1);
  assert.equal(parsed.assets[0].id,oldId);
  let restored=null;
  await Project.restore(parsed,env.dir,x=>Composition.normalize(x.composition)?x:x,async x=>{restored=x;});
  const freshId=restored.composition.layers[0].clips[0].mediaId;
  assert.notEqual(freshId,oldId);
  assert.equal(Media.validateId(freshId),true);
  assert.deepEqual(await fs.readFile(path.join(Media.mediaDir(env.dir),freshId)),payload);
  assert.deepEqual(await fs.readFile(path.join(Media.mediaDir(env.dir),oldId)),payload);
 }finally{await env.cleanup();}
});
test('tampered media is rejected even if a gzip archive itself remains decodable',async()=>{
 const env=await sandbox();
 try{
  const id='media-aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa.webm';
  await fs.mkdir(Media.mediaDir(env.dir),{recursive:true});
  await fs.writeFile(path.join(Media.mediaDir(env.dir),id),Buffer.from('WEBM'));
  const packed=await Project.create(makeMediaClip(config(),id),env.dir);
  const json=JSON.parse(zlib.gunzipSync(packed.subarray(Project.MAGIC.length)).toString());
  json.media[0].sha256='0'.repeat(64);
  const tampered=Buffer.concat([Project.MAGIC,zlib.gzipSync(Buffer.from(JSON.stringify(json)))]);
  await assert.rejects(Project.parse(tampered),/sérült/i);
  await assert.rejects(Project.parse(Buffer.from('Not a project')),/érvényes/i);
  json.media[0].id='../escape.webm';
  await assert.rejects(Project.parse(Buffer.concat([Project.MAGIC,zlib.gzipSync(Buffer.from(JSON.stringify(json)))])),/Hibás/i);
 }finally{await env.cleanup();}
});
test('rollback deletes new imported assets when committing preferences fails',async()=>{
 const env=await sandbox();
 try{
  const id='media-aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa.png';
  await fs.mkdir(Media.mediaDir(env.dir),{recursive:true});
  await fs.writeFile(path.join(Media.mediaDir(env.dir),id),Buffer.from('IMAGE'));
  const data=await Project.parse(await Project.create(makeMediaClip(config(),id),env.dir));
  await assert.rejects(Project.restore(data,env.dir,x=>x,async()=>{throw Error('Simulated disk failure');}),/disk failure/);
  assert.deepEqual(await fs.readdir(Media.mediaDir(env.dir)),[id]);
 }finally{await env.cleanup();}
});
test('rejects missing media and unsupported bundle schema',async()=>{
 const env=await sandbox();
 try{
  const missing='media-aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa.png';
  await assert.rejects(Project.create(makeMediaClip(config(),missing),env.dir),/Hiányzik/);
  const invalid={format:Project.FORMAT,version:2,settings:config(),media:[]};
  await assert.rejects(Project.parse(Buffer.concat([Project.MAGIC,zlib.gzipSync(Buffer.from(JSON.stringify(invalid)))])),/nem támogatott/);
  const duplicate={format:Project.FORMAT,version:1,settings:makeMediaClip(config(),missing),media:[]};
  await assert.rejects(Project.parse(Buffer.concat([Project.MAGIC,zlib.gzipSync(Buffer.from(JSON.stringify(duplicate)))])),/hiányzik/);
 }finally{await env.cleanup();}
});
