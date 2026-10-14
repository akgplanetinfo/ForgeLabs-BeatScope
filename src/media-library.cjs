'use strict';
const path=require('node:path');
const fs=require('node:fs/promises');
const {randomUUID}=require('node:crypto');
const {pathToFileURL}=require('node:url');
const TYPES=Object.freeze({
 '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif',
 '.mp4':'video/mp4','.webm':'video/webm','.m4v':'video/mp4','.mov':'video/quicktime'
});
const ID=/^media-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|gif|mp4|webm|m4v|mov)$/;
const MAX_FILE_SIZE=2*1024*1024*1024; // 2 GiB, imported locally; no upload
const mediaDir=userData=>path.join(userData,'beatscope-media');
function validateId(id){return typeof id==='string'&&ID.test(id);}
function urlFor(id){if(!validateId(id))throw new Error('Érvénytelen médiaazonosító');return 'beatscope-media://local/'+id;}
function mimeFor(id){return TYPES[path.extname(id)]||null;}
function resolveURL(url,userData){
 const parsed=new URL(url);
 if(parsed.protocol!=='beatscope-media:'||parsed.hostname!=='local'||parsed.search||parsed.hash||parsed.username||parsed.password)return null;
 const id=parsed.pathname.slice(1);
 if(!validateId(id))return null;
 return path.join(mediaDir(userData),id);
}
async function importFile(filePath,userData){
 if(typeof filePath!=='string'||!filePath)throw new Error('Nincs kiválasztott fájl.');
 const ext=path.extname(filePath).toLowerCase();
 if(!TYPES[ext])throw new Error('Nem támogatott kép- vagy videóformátum.');
 const stats=await fs.stat(filePath);
 if(!stats.isFile()||stats.size<=0||stats.size>MAX_FILE_SIZE)throw new Error('A fájl üres vagy túl nagy (max. 2 GB).');
 await fs.mkdir(mediaDir(userData),{recursive:true});
 const id='media-'+randomUUID()+ext;
 const destination=path.join(mediaDir(userData),id);
 try{await fs.copyFile(filePath,destination);}catch(e){await fs.rm(destination,{force:true}).catch(()=>{});throw e;}
 const name=path.basename(filePath).replace(/[\x00-\x1f\x7f]/g,'').slice(0,90);
 return {id,name,type:TYPES[ext].startsWith('video/')?'video':'image',url:urlFor(id),bytes:stats.size};
}
async function importMany(paths,userData){
 if(!Array.isArray(paths)||paths.length>8)throw new Error('Legfeljebb nyolc médiafájl importálható egyszerre.');
 const result=[];
 for(const p of paths)result.push(await importFile(p,userData));
 return result;
}
module.exports={TYPES,MAX_FILE_SIZE,validateId,urlFor,mimeFor,resolveURL,mediaDir,importFile,importMany};