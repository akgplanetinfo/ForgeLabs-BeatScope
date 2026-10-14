'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path'),os=require('node:os'),fs=require('node:fs/promises');
const Media=require('../src/media-library.cjs');
const C=require('../src/composition.js');
const VALID='media-11111111-2222-4333-8444-555555555555.png';
test('safe media IDs map only to local imported media library',()=>{
 assert.equal(Media.validateId(VALID),true);
 assert.equal(Media.validateId('../secret.png'),false);
 assert.equal(Media.validateId('media-notvalid.mp4'),false);
 assert.equal(Media.validateId('media-11111111-2222-4333-8444-555555555555.exe'),false);
 const root=path.join(os.tmpdir(),'beatscope-validation');
 assert.equal(Media.resolveURL('beatscope-media://local/'+VALID,root),path.join(root,'beatscope-media',VALID));
 for(const uri of ['https://example.com/'+VALID,'beatscope-media://remote/'+VALID,'beatscope-media://local/../../secret.png','beatscope-media://local/'+VALID+'?x=y','beatscope-media://local/%2e%2e%2fsecret.png'])
   assert.equal(Media.resolveURL(uri,root),null,uri);
 assert.equal(Media.mimeFor(VALID),'image/png');
 assert.equal(Media.mimeFor(VALID.replace('.png','.webm')),'video/webm');
});
test('real image file imports locally, keeps source untouched, and returns safe URI',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'beatscope-import-test-'));
 try{
   const file=path.join(root,'fixture.png');
   const data=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/4sYAAAAASUVORK5CYII=','base64');
   await fs.writeFile(file,data);
   const item=await Media.importFile(file,root);
   assert.equal(item.type,'image');assert.equal(item.name,'fixture.png');
   assert.ok(Media.validateId(item.id));assert.match(item.url,/^beatscope-media:\/\/local\/media-/);
   assert.deepEqual(await fs.readFile(Media.resolveURL(item.url,root)),data);
   assert.deepEqual(await fs.readFile(file),data);
   const cl=C.putMediaClip(C.createComposition(),2,5,item);
   assert.equal(cl.layers[2].clips[5].source,'media');
   assert.equal(cl.layers[2].clips[5].mediaId,item.id);
   assert.equal(cl.layers[2].clips[5].mediaName,item.name);
   const moved=C.pasteClip(cl,3,4,C.getClip(cl,2,5));
   assert.equal(moved.layers[3].clips[4].mediaId,item.id);
   const saved=C.normalize(JSON.parse(JSON.stringify(moved)));
   assert.equal(saved.layers[3].clips[4].mediaName,'fixture.png');
   const launched=C.launch(saved,3,4);
   assert.equal(C.activeLayers(launched).find(l=>l.index===3).mediaId,item.id);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('reject unsupported extensions, traversal, and malicious media clip IDs',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'beatscope-block-'));
 try{
   const executable=path.join(root,'malware.exe');
   await fs.writeFile(executable,'not media');
   await assert.rejects(Media.importFile(executable,root),/Nem támogatott/);
   const invalid=C.putMediaClip(C.createComposition(),0,7,{id:'../../secret.webm',name:'bad'});
   assert.equal(invalid.layers[0].clips[7],null);
   const clip=C.normalizeClip({source:'media',mediaId:'https://example.com/x',mediaName:'external'});
   assert.equal(clip,null);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('video extensions and mime types are supported without guessing codecs',()=>{
 assert.equal(Media.mimeFor('a.mp4'),'video/mp4');
 assert.equal(Media.mimeFor('a.webm'),'video/webm');
 assert.equal(Media.mimeFor('a.mov'),'video/quicktime');
 assert.equal(Media.mimeFor('a.m4v'),'video/mp4');
 assert.equal(Media.validateId(VALID.replace('.png','.mp4')),true);
 assert.equal(Media.validateId(VALID.replace('.png','.mov')),true);
});
