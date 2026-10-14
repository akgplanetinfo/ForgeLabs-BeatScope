(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BeatComposition=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const SOURCES=Object.freeze(['bars','wave','orbit','particles','tunnel','plasma','rings','grid','laser','starfield','hexfield','digitalrain','ribbon','mandala','fireflies','electric']);
 const ROWS=8,COLUMNS=8,MAX_CLIP_FX=3,MAX_LAYER_FX=3;
 const BLEND_MODES=Object.freeze(['screen','normal','add','multiply','overlay','difference','lighten','darken']);
 const blendMode=m=>BLEND_MODES.includes(m)?m:'screen';
 const canvasBlendMode=m=>m==='add'?'lighter':m==='normal'?'source-over':blendMode(m);
 function normalizeFxStack(stack){
   if(!Array.isArray(stack))return [];
   return stack.filter(entry=>entry&&typeof entry==='object'&&/^fx-\d{3}$/.test(entry.id)&&Number(entry.id.slice(3))>=1&&Number(entry.id.slice(3))<=120).slice(0,MAX_CLIP_FX).map(entry=>({
     id:entry.id,wet:Number.isFinite(entry.wet)?Math.max(0,Math.min(1,entry.wet)):1,
     strength:Number.isFinite(entry.strength)?Math.max(0,Math.min(2,entry.strength)):1,
     disabled:entry.disabled===true
   }));
 }
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
   return {selectedLayer:0,selectedSlot:0,layers:Array.from({length:ROWS},(_,i)=>({
     name:'Layer '+(i+1),opacity:1,blendMode:'screen',muted:false,solo:false,fxStack:[],fxBypass:false,
     activeSlot:i===0?0:-1,
     clips:Array.from({length:COLUMNS},(_,j)=>j<4?{source:SOURCES[(j+i)%4],params:sanitizeParams(null),fxStack:[],fxBypass:false}:null)
   }))};
 }
 const validInt=(x,max)=>Number.isInteger(x)&&x>=0&&x<max;
 function normalize(input){
   const base=createComposition();
   if(!input||typeof input!=='object'||!Array.isArray(input.layers))return base;
   if(validInt(input.selectedLayer,ROWS))base.selectedLayer=input.selectedLayer;
   if(validInt(input.selectedSlot,COLUMNS))base.selectedSlot=input.selectedSlot;
   for(let i=0;i<ROWS;i++){
     const src=input.layers[i],dest=base.layers[i];
     if(!src||typeof src!=='object')continue;
     if(typeof src.name==='string'&&src.name.trim())dest.name=src.name.trim().slice(0,36);
     if(typeof src.opacity==='number'&&Number.isFinite(src.opacity))dest.opacity=Math.min(1,Math.max(0,src.opacity));
     dest.blendMode=blendMode(src.blendMode);
     if(typeof src.muted==='boolean')dest.muted=src.muted;
     if(typeof src.solo==='boolean')dest.solo=src.solo;
     dest.fxStack=normalizeFxStack(src.fxStack);
     dest.fxBypass=src.fxBypass===true;
     if(Array.isArray(src.clips)){
       dest.clips=Array.from({length:COLUMNS},(_,j)=>{
         const clip=src.clips[j];
         return clip&&typeof clip==='object'&&SOURCES.includes(clip.source)?{source:clip.source,params:sanitizeParams(clip.params),fxStack:normalizeFxStack(clip.fxStack),fxBypass:clip.fxBypass===true}:null;
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
   if(typeof patch.blendMode==='string'&&BLEND_MODES.includes(patch.blendMode))layer.blendMode=patch.blendMode;
   if(typeof patch.name==='string'&&patch.name.trim())layer.name=patch.name.trim().slice(0,36);
   return composition;
 }
 function moveLayer(input,index,offset){
   const c=normalize(input);
   const to=index+offset;
   if(!validInt(index,ROWS)||!validInt(to,ROWS)||Math.abs(offset)!==1)return c;
   [c.layers[index],c.layers[to]]=[c.layers[to],c.layers[index]];
   if(c.selectedLayer===index)c.selectedLayer=to;
   else if(c.selectedLayer===to)c.selectedLayer=index;
   return c;
 }
 function setLayerEffects(input,index,stack,bypass){
   const c=normalize(input);
   if(!validInt(index,ROWS))return c;
   const layer=c.layers[index];
   if(stack!==undefined)layer.fxStack=normalizeFxStack(stack);
   if(typeof bypass==='boolean')layer.fxBypass=bypass;
   return c;
 }
 function selectLayer(input,index){
   const c=normalize(input);if(validInt(index,ROWS))c.selectedLayer=index;return c;
 }

 function selectClip(input,index,slot){
   const c=normalize(input);
   if(validInt(index,ROWS)&&validInt(slot,COLUMNS)){
     c.selectedLayer=index;c.selectedSlot=slot;
   }
   return c;
 }
 function getClip(input,index,slot){
   const c=normalize(input);
   if(!validInt(index,ROWS)||!validInt(slot,COLUMNS))return null;
   const clip=c.layers[index].clips[slot];
   return clip?{source:clip.source,params:sanitizeParams(clip.params),fxStack:normalizeFxStack(clip.fxStack),fxBypass:clip.fxBypass===true}:null;
 }
 function pasteClip(input,index,slot,clip){
   const c=normalize(input);
   if(!validInt(index,ROWS)||!validInt(slot,COLUMNS)||!clip||!SOURCES.includes(clip.source))return c;
   c.layers[index].clips[slot]={source:clip.source,params:sanitizeParams(clip.params),fxStack:normalizeFxStack(clip.fxStack),fxBypass:clip.fxBypass===true};
   c.selectedLayer=index;c.selectedSlot=slot;
   return c;
 }
 function removeClip(input,index,slot){
   const c=normalize(input);
   if(!validInt(index,ROWS)||!validInt(slot,COLUMNS))return c;
   const layer=c.layers[index];
   layer.clips[slot]=null;
   if(layer.activeSlot===slot)layer.activeSlot=-1;
   c.selectedLayer=index;c.selectedSlot=slot;
   return c;
 }
 function duplicateClip(input,index,slot){
   const c=normalize(input);
   if(!validInt(index,ROWS)||!validInt(slot,COLUMNS)||!c.layers[index].clips[slot])return c;
   const layer=c.layers[index];
   for(let step=1;step<COLUMNS;step++){
     const to=(slot+step)%COLUMNS;
     if(!layer.clips[to]){
       layer.clips[to]=getClip(c,index,slot);
       c.selectedLayer=index;c.selectedSlot=to;
       return c;
     }
   }
   return c;
 }
 function moveClip(input,fromLayer,fromSlot,toLayer,toSlot){
   const c=normalize(input);
   if(!validInt(fromLayer,ROWS)||!validInt(toLayer,ROWS)||!validInt(fromSlot,COLUMNS)||!validInt(toSlot,COLUMNS))return c;
   if(fromLayer===toLayer&&fromSlot===toSlot)return c;
   const a=c.layers[fromLayer],b=c.layers[toLayer],moving=a.clips[fromSlot];
   if(!moving)return c;
   const replaced=b.clips[toSlot];
   const sourceWasPlaying=a.activeSlot===fromSlot;
   const targetWasPlaying=b.activeSlot===toSlot;
   a.clips[fromSlot]=replaced;b.clips[toSlot]=moving;
   if(fromLayer===toLayer){
     if(sourceWasPlaying)a.activeSlot=toSlot;
     else if(targetWasPlaying)a.activeSlot=fromSlot;
   }else{
     if(sourceWasPlaying)a.activeSlot=-1;
     if(targetWasPlaying)b.activeSlot=-1;
     if(sourceWasPlaying)b.activeSlot=toSlot;
     if(targetWasPlaying&&replaced)a.activeSlot=fromSlot;
   }
   c.selectedLayer=toLayer;c.selectedSlot=toSlot;
   return c;
 }
 function launchScene(input,slot){
   const c=normalize(input);
   if(!validInt(slot,COLUMNS))return c;
   for(const layer of c.layers)if(layer.clips[slot])layer.activeSlot=slot;
   c.selectedSlot=slot;
   return c;
 }
 function putClip(input,index,slot,source){
   const c=normalize(input);
   if(validInt(index,ROWS)&&validInt(slot,COLUMNS)&&SOURCES.includes(source)){
     c.layers[index].clips[slot]={source,params:sanitizeParams(null),fxStack:[],fxBypass:false};
     c.selectedLayer=index;c.selectedSlot=slot;
   }
   return c;
 }
 function setClipEffects(input,index,slot,stack,bypass){
   const c=normalize(input);
   if(!validInt(index,ROWS)||!validInt(slot,COLUMNS)||!c.layers[index].clips[slot])return c;
   const clip=c.layers[index].clips[slot];
   if(stack!==undefined)clip.fxStack=normalizeFxStack(stack);
   if(typeof bypass==='boolean')clip.fxBypass=bypass;
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
     c.layers[index].activeSlot=slot;c.selectedLayer=index;c.selectedSlot=slot;
   }
   return c;
 }
 function stop(input,index){
   const c=normalize(input);if(validInt(index,ROWS))c.layers[index].activeSlot=-1;return c;
 }
 function activeLayers(input){
   const c=normalize(input),hasSolo=c.layers.some(l=>l.solo);
   return c.layers.map((l,index)=>({index,...l})).filter(l=>l.activeSlot>=0&&!l.muted&&l.opacity>0&&(!hasSolo||l.solo)&&l.clips[l.activeSlot])
    .map(l=>({index:l.index,source:l.clips[l.activeSlot].source,opacity:l.opacity,blendMode:blendMode(l.blendMode),layerFxStack:normalizeFxStack(l.fxStack),layerFxBypass:l.fxBypass===true,slot:l.activeSlot,params:sanitizeParams(l.clips[l.activeSlot].params),fxStack:normalizeFxStack(l.clips[l.activeSlot].fxStack),fxBypass:l.clips[l.activeSlot].fxBypass===true}))
    .reverse(); // topmost layer = Layer 1, rendered last
 }
 return {ROWS,COLUMNS,MAX_CLIP_FX,MAX_LAYER_FX,BLEND_MODES,blendMode,canvasBlendMode,SOURCES,DEFAULT_PARAMS,PARAM_LIMITS,sanitizeParams,normalizeFxStack,createComposition,normalize,selectLayer,selectClip,getClip,pasteClip,removeClip,duplicateClip,moveClip,launchScene,layerAction,putClip,updateClipParams,setClipEffects,setLayerEffects,moveLayer,launch,stop,activeLayers};
});