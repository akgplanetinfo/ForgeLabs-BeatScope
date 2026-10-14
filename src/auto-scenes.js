(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BeatAutoScenes=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const MODES=Object.freeze(['sequential','shuffle']);
 const BAR_COUNTS=Object.freeze([1,2,4,8]);
 function normalizeMode(mode){return MODES.includes(mode)?mode:'sequential';}
 function normalizeBars(bars){return BAR_COUNTS.includes(bars)?bars:4;}
 function sceneSlots(composition){
   if(!composition||!Array.isArray(composition.layers))return [];
   const slots=[];
   for(let col=0;col<8;col++){
     if(composition.layers.some(layer=>Array.isArray(layer?.clips)&&Boolean(layer.clips[col])))slots.push(col);
   }
   return slots;
 }
 function chooseSlot(available,current,mode='sequential',random=Math.random){
   const slots=[...new Set((Array.isArray(available)?available:[])
     .filter(x=>Number.isInteger(x)&&x>=0&&x<8))].sort((a,b)=>a-b);
   if(!slots.length)return null;
   if(normalizeMode(mode)==='sequential'){
     return slots.find(n=>n>current)??slots[0];
   }
   const other=slots.length>1?slots.filter(n=>n!==current):slots;
   const raw=typeof random==='function'?random():.5;
   const value=typeof raw==='number'&&Number.isFinite(raw)?Math.max(0,Math.min(.9999999,raw)):.5;
   return other[Math.floor(value*other.length)];
 }
 function previousSlot(available,current){
   const slots=[...new Set((Array.isArray(available)?available:[])
     .filter(n=>Number.isInteger(n)&&n>=0&&n<8))].sort((a,b)=>a-b);
   if(!slots.length)return null;
   return slots.filter(n=>n<current).at(-1)??slots.at(-1);
 }
 function intervalMs(bpm,bars){
   const tempo=typeof bpm==='number'&&Number.isFinite(bpm)?Math.min(240,Math.max(40,bpm)):120;
   return 60000/tempo*4*normalizeBars(bars);
 }
 function nextBoundary(now,origin,bpm,bars){
   const step=intervalMs(bpm,bars);
   const time=Number.isFinite(now)?now:0;
   const zero=Number.isFinite(origin)?origin:0;
   return zero+(Math.floor((time-zero)/step)+1)*step;
 }
 return {MODES,BAR_COUNTS,normalizeMode,normalizeBars,sceneSlots,chooseSlot,previousSlot,intervalMs,nextBoundary};
});