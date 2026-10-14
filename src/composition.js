(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BeatComposition=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const SOURCES=Object.freeze(['bars','wave','orbit','particles','tunnel','plasma','rings','grid','laser','starfield','hexfield','digitalrain','ribbon','mandala','fireflies','electric']);
 const ROWS=8,COLUMNS=8;
 const DEFAULT_PARAMS=Object.freeze({speed:1,scale:1,rotation:0,audio:1});
 const PARAM_LIMITS=Object.freeze({speed:[.1,4],scale:[.4,2],rotation:[-180,180],audio:[0,2]});
 function sanitizeParams(input){
   const out={...DEFAULT_PARAMS};
   if(input&&typeof input==='object'&&!Array.isArray(input)){
     for(const [key,range] of Object.entries(PARAM_LIMITS)){
       if(typeof input[key]==='number'&&Number.isFinite(input[key]))
         out[key]=Math.max(range[0],Math.min(range[1],input[key]));
     }
   }
   return out;
 }
 function createComposition(){
   return {selectedLayer:0,layers:Array.from({length:ROWS},(_,i)=>({
     name:'Layer '+(i+1),opacity:1,muted:false,solo:false,
     activeSlot:i===0?0:-1,
     clips:Array.from({length:COLUMNS},(_,j)=>j<4?{source:SOURCES[(j+i)%4],params:sanitizeParams(null)}:null)
   }))};
 }
 const validInt=(x,max)=>Number.isInteger(x)&&x>=0&&x<max;
 function normalize(input){
   const base=createComposition();
   if(!input||typeof input!=='object'||!Array.isArray(input.layers))return base;
   if(validInt(input.selectedLayer,ROWS))base.selectedLayer=input.selectedLayer;
   for(let i=0;i<ROWS;i++){
     const src=input.layers[i],dest=base.layers[i];
     if(!src||typeof src!=='object')continue;
     if(typeof src.name==='string'&&src.name.trim())dest.name=src.name.trim().slice(0,36);
     if(typeof src.opacity==='number'&&Number.isFinite(src.opacity))dest.opacity=Math.min(1,Math.max(0,src.opacity));
     if(typeof src.muted==='boolean')dest.muted=src.muted;
     if(typeof src.solo==='boolean')dest.solo=src.solo;
     if(Array.isArray(src.clips)){
       dest.clips=Array.from({length:COLUMNS},(_,j)=>{
         const clip=src.clips[j];
         return clip&&typeof clip==='object'&&SOURCES.includes(clip.source)?{source:clip.source,params:sanitizeParams(clip.params)}:null;
       });
     }
     if(validInt(src.activeSlot,COLUMNS)&&dest.clips[src.activeSlot])dest.activeSlot=src.activeSlot;
     else if(src.activeSlot===-1)dest.activeSlot=-1;
     else if(!dest.clips[dest.activeSlot])dest.activeSlot=-1;
   }
   return base;
 }
 function layerAction(input,index,patch){
   const composition=normalize(input);
   if(!validInt(index,ROWS))return composition;
   const layer=composition.layers[index];
   if(Object.prototype.hasOwnProperty.call(patch,'muted'))layer.muted=!!patch.muted;
   if(Object.prototype.hasOwnProperty.call(patch,'solo'))layer.solo=!!patch.solo;
   if(typeof patch.opacity==='number'&&Number.isFinite(patch.opacity))layer.opacity=Math.max(0,Math.min(1,patch.opacity));
   if(typeof patch.name==='string'&&patch.name.trim())layer.name=patch.name.trim().slice(0,36);
   return composition;
 }
 function selectLayer(input,index){
   const c=normalize(input);if(validInt(index,ROWS))c.selectedLayer=index;return c;
 }
 function putClip(input,index,slot,source){
   const c=normalize(input);
   if(validInt(index,ROWS)&&validInt(slot,COLUMNS)&&SOURCES.includes(source))c.layers[index].clips[slot]={source,params:sanitizeParams(null)};
   return c;
 }
 function updateClipParams(input,index,slot,patch){
   const c=normalize(input);
   if(!validInt(index,ROWS)||!validInt(slot,COLUMNS))return c;
   const clip=c.layers[index].clips[slot];
   if(!clip||!patch||typeof patch!=='object')return c;
   const current={...clip.params};
   for(const key of Object.keys(PARAM_LIMITS)){
     if(typeof patch[key]==='number'&&Number.isFinite(patch[key]))current[key]=patch[key];
   }
   clip.params=sanitizeParams(current);
   return c;
 }
 function launch(input,index,slot){
   const c=normalize(input);
   if(validInt(index,ROWS)&&validInt(slot,COLUMNS)&&c.layers[index].clips[slot]){
     c.layers[index].activeSlot=slot;c.selectedLayer=index;
   }
   return c;
 }
 function stop(input,index){
   const c=normalize(input);if(validInt(index,ROWS))c.layers[index].activeSlot=-1;return c;
 }
 function activeLayers(input){
   const c=normalize(input),hasSolo=c.layers.some(l=>l.solo);
   return c.layers.map((l,index)=>({index,...l})).filter(l=>l.activeSlot>=0&&!l.muted&&l.opacity>0&&(!hasSolo||l.solo)&&l.clips[l.activeSlot])
    .map(l=>({index:l.index,source:l.clips[l.activeSlot].source,opacity:l.opacity,slot:l.activeSlot,params:sanitizeParams(l.clips[l.activeSlot].params)}))
    .reverse(); // topmost layer = Layer 1, rendered last
 }
 return {ROWS,COLUMNS,SOURCES,DEFAULT_PARAMS,PARAM_LIMITS,sanitizeParams,createComposition,normalize,selectLayer,layerAction,putClip,updateClipParams,launch,stop,activeLayers};
});