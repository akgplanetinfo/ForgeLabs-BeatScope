'use strict';
// Portable BeatScope project archives. Pure Node module so the parser can be fuzzed/tested without Electron.
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const {promisify}=require('node:util');
const Media=require('./media-library.cjs');
const gzip=promisify(zlib.gzip),gunzip=promisify(zlib.gunzip);
const MAGIC=Buffer.from('BEATSCOPE-PROJECT-1\n','utf8');
const FORMAT='forgelabs.beatscope.project';
const VERSION=1;
const MAX_MEDIA_BYTES=128*1024*1024;
const MAX_ARCHIVE_BYTES=150*1024*1024;
const MAX_JSON_BYTES=180*1024*1024;
const MAX_MEDIA_FILES=64;
function referencedMedia(settings){
 const ids=new Set();
 for(const layer of settings?.composition?.layers||[])
  for(const clip of layer?.clips||[])
   if(clip?.source==='media'){
    if(!Media.validateId(clip.mediaId))throw new Error('Hibás médiaazonosító a projektben.');
    ids.add(clip.mediaId);
   }
 if(ids.size>MAX_MEDIA_FILES)throw new Error('Túl sok médiafájl a projektben (maximum 64).');
 return [...ids].sort();
}
function fileHash(buffer){return crypto.createHash('sha256').update(buffer).digest('hex');}
function verifyEntries(project){
 if(!project||typeof project!=='object'||Array.isArray(project)||project.format!==FORMAT||project.version!==VERSION)
  throw new Error('Ismeretlen vagy nem támogatott BeatScope-projektverzió.');
 if(!project.settings||typeof project.settings!=='object'||Array.isArray(project.settings)||
  !Array.isArray(project.media)||project.media.length>MAX_MEDIA_FILES)
  throw new Error('Hiányos projektadatok.');
 const referenced=referencedMedia(project.settings);
 if(referenced.length!==project.media.length)throw new Error('A projektből hiányzik egy médiafájl.');
 let total=0;
 const seen=new Set();
 const assets=[];
 for(const item of project.media){
  if(!item||typeof item!=='object'||!Media.validateId(item.id)||seen.has(item.id)||
   !Number.isSafeInteger(item.bytes)||item.bytes<1||
   typeof item.sha256!=='string'||!/^[0-9a-f]{64}$/.test(item.sha256)||
   typeof item.data!=='string'||item.data.length>Math.ceil(MAX_MEDIA_BYTES*4/3)+8)
   throw new Error('Hibás vagy ismétlődő médiaelem.');
  seen.add(item.id);
  total+=item.bytes;
  if(total>MAX_MEDIA_BYTES)throw new Error('A projektméret meghaladja a 128 MB-os beágyazási korlátot.');
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(item.data))throw new Error('Sérült médiaadat.');
  const bytes=Buffer.from(item.data,'base64');
  if(bytes.length!==item.bytes||bytes.toString('base64')!==item.data||fileHash(bytes)!==item.sha256)
   throw new Error('Médiaadat sérült: '+item.id);
  assets.push({id:item.id,bytes});
 }
 if(referenced.some(id=>!seen.has(id)))throw new Error('A projekt médiaképei vagy videói hiányoznak.');
 return assets;
}
async function create(settings,userData){
 const refs=referencedMedia(settings),assets=[];
 let total=0;
 for(const id of refs){
  const p=path.join(Media.mediaDir(userData),id),stat=await fs.stat(p).catch(()=>null);
  if(!stat?.isFile()||stat.size<1)throw new Error('Hiányzik a projekthez tartozó fájl: '+id);
  total+=stat.size;
  if(total>MAX_MEDIA_BYTES)throw new Error('A projekt médiái összesen meghaladják a 128 MB-ot. A nagyméretű videókhoz később külön csomagolás szükséges.');
  const bytes=await fs.readFile(p);
  if(bytes.length!==stat.size)throw new Error('Mentés közben megváltozott egy médiafájl.');
  assets.push({id,bytes:bytes.length,sha256:fileHash(bytes),data:bytes.toString('base64')});
 }
 const manifest={format:FORMAT,version:VERSION,savedAt:new Date().toISOString(),settings,media:assets};
 const json=Buffer.from(JSON.stringify(manifest),'utf8');
 if(json.length>MAX_JSON_BYTES)throw new Error('A projektfájl túl nagy.');
 const compressed=await gzip(json,{level:6});
 const archive=Buffer.concat([MAGIC,compressed]);
 if(archive.length>MAX_ARCHIVE_BYTES)throw new Error('A projektarchívum túl nagy.');
 return archive;
}
async function parse(archive){
 if(!Buffer.isBuffer(archive)||archive.length<=MAGIC.length||archive.length>MAX_ARCHIVE_BYTES||
    !archive.subarray(0,MAGIC.length).equals(MAGIC))
  throw new Error('Nem érvényes .beatscope projektfájl.');
 let raw;
 try{raw=await gunzip(archive.subarray(MAGIC.length),{maxOutputLength:MAX_JSON_BYTES});}
 catch{throw new Error('Sérült vagy túl nagy BeatScope projektarchívum.');}
 let project;
 try{project=JSON.parse(raw.toString('utf8'));}
 catch{throw new Error('A projekt JSON adatai sérültek.');}
 const assets=verifyEntries(project);
 return {settings:project.settings,assets,savedAt:project.savedAt||null};
}
async function restore(parsed,userData,validateSettings,commitSettings){
 if(!parsed||typeof validateSettings!=='function'||typeof commitSettings!=='function')
  throw new Error('Hiányzó visszaállítási adatok.');
 const mapping=new Map(),written=[];
 let settings=validateSettings(parsed.settings);
 // All referenced media must still exist after schema normalization.
 const original=referencedMedia(parsed.settings),normalized=referencedMedia(settings);
 if(original.length!==normalized.length||original.some((id,i)=>id!==normalized[i]))
  throw new Error('A projekt sérült médiainformációkat tartalmaz.');
 try{
  await fs.mkdir(Media.mediaDir(userData),{recursive:true});
  for(const asset of parsed.assets){
   const id='media-'+crypto.randomUUID()+path.extname(asset.id);
   const dst=path.join(Media.mediaDir(userData),id);
   await fs.writeFile(dst,asset.bytes,{flag:'wx'});
   written.push(dst);mapping.set(asset.id,id);
  }
  const draft=structuredClone(settings);
  for(const layer of draft.composition.layers)
   for(const clip of layer.clips)
    if(clip?.source==='media')clip.mediaId=mapping.get(clip.mediaId);
  settings=validateSettings(draft);
  await commitSettings(settings); // Committed only after every media copy succeeds.
  return {restored:true,mediaCount:written.length,savedAt:parsed.savedAt};
 }catch(error){
  await Promise.all(written.map(p=>fs.rm(p,{force:true}).catch(()=>{})));
  throw error;
 }
}
module.exports={MAGIC,FORMAT,VERSION,MAX_MEDIA_BYTES,MAX_ARCHIVE_BYTES,MAX_JSON_BYTES,referencedMedia,create,parse,restore,verifyEntries};
