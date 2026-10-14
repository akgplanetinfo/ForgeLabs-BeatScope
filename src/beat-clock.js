(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BeatClock=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const MIN_BPM=40,MAX_BPM=240;
 const QUANTIZATIONS=Object.freeze(['off','quarter','beat','two','bar']);
 const STEPS=Object.freeze({off:0,quarter:.25,beat:1,two:2,bar:4});
 function normalizeBpm(value){
   return typeof value==='number'&&Number.isFinite(value)?
     Math.min(MAX_BPM,Math.max(MIN_BPM,Math.round(value))):120;
 }
 function normalizeQuantize(value){return QUANTIZATIONS.includes(value)?value:'off';}
 function beatDuration(bpm){return 60000/normalizeBpm(bpm);}
 function intervalMs(bpm,quantize){return beatDuration(bpm)*STEPS[normalizeQuantize(quantize)];}
 function nextBoundary(now,origin,bpm,quantize){
   const dur=intervalMs(bpm,quantize);
   if(!dur)return now;
   const t=Number.isFinite(now)?now:0,o=Number.isFinite(origin)?origin:0;
   // Strictly future even if the click happens on a boundary.
   const steps=Math.floor((t-o)/dur)+1;
   return o+steps*dur;
 }
 function phase(now,origin,bpm){
   const d=beatDuration(bpm),t=Number.isFinite(now)?now:0,o=Number.isFinite(origin)?origin:0;
   return ((t-o)%d+d)%d/d;
 }
 function createClock({bpm=120,quantize='off',origin=0}={}){
   let currentBpm=normalizeBpm(bpm),quant=normalizeQuantize(quantize);
   let epoch=Number.isFinite(origin)?origin:0;
   let taps=[];
   return {
     get bpm(){return currentBpm;},
     get quantize(){return quant;},
     get origin(){return epoch;},
     interval(){return intervalMs(currentBpm,quant);},
     next(now){return nextBoundary(now,epoch,currentBpm,quant);},
     phase(now){return phase(now,epoch,currentBpm);},
     setBpm(value,now){
       currentBpm=normalizeBpm(value);
       if(Number.isFinite(now))epoch=now;
       taps=[];
       return currentBpm;
     },
     setQuantize(value){quant=normalizeQuantize(value);return quant;},
     reset(now){if(Number.isFinite(now))epoch=now;taps=[];},
     tap(now){
       if(!Number.isFinite(now))return null;
       const prev=taps[taps.length-1];
       if(prev!==undefined&&(now-prev<250||now-prev>1500))taps=[];
       taps.push(now);
       if(taps.length>7)taps.shift();
       if(taps.length<3)return null;
       const intervals=[];
       for(let i=1;i<taps.length;i++)intervals.push(taps[i]-taps[i-1]);
       intervals.sort((a,b)=>a-b);
       const typical=intervals.length%2?intervals[Math.floor(intervals.length/2)]:
         (intervals[intervals.length/2-1]+intervals[intervals.length/2])/2;
       if(typical<=0)return null;
       currentBpm=normalizeBpm(60000/typical);
       epoch=now;
       return currentBpm;
     }
   };
 }
 return {MIN_BPM,MAX_BPM,QUANTIZATIONS,STEPS,normalizeBpm,normalizeQuantize,beatDuration,intervalMs,nextBoundary,phase,createClock};
});