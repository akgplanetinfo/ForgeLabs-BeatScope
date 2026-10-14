(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BeatVideoTiming=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const MAX_SECONDS=86400;
  const DEFAULT_PLAYBACK=Object.freeze({loop:true,inPoint:0,outPoint:null});
  const finite=(v)=>typeof v==='number'&&Number.isFinite(v);
  const limit=(v,min,max)=>Math.min(max,Math.max(min,v));
  function normalizePlayback(input){
    const raw=input&&typeof input==='object'?input:{};
    const inPoint=finite(raw.inPoint)?limit(raw.inPoint,0,MAX_SECONDS):0;
    const outPoint=finite(raw.outPoint)&&raw.outPoint>inPoint+.049?
      limit(raw.outPoint,inPoint+.05,MAX_SECONDS):null;
    return {loop:raw.loop!==false,inPoint,outPoint};
  }
  function bounds(playback,duration){
    const p=normalizePlayback(playback);
    const d=finite(duration)&&duration>0?duration:0;
    if(!d)return {start:p.inPoint,end:p.outPoint,known:false};
    const start=limit(p.inPoint,0,Math.max(0,d-.05));
    const end=p.outPoint!==null?limit(p.outPoint,start+.05,d):d;
    return {start,end,known:true};
  }
  function seekTime(value,playback,duration){
    const b=bounds(playback,duration);
    const target=finite(value)?value:b.start;
    return limit(target,b.start,b.end);
  }
  function atOut(current,playback,duration){
    const b=bounds(playback,duration);
    return b.known&&finite(current)&&current>=b.end-.035;
  }
  function formatTime(seconds){
    if(!finite(seconds)||seconds<0)return '00:00.0';
    const rounded=Math.floor(seconds*10+0.00001);
    const minutes=Math.floor(rounded/600),sec=Math.floor((rounded%600)/10),tenths=rounded%10;
    return String(minutes).padStart(2,'0')+':'+String(sec).padStart(2,'0')+'.'+tenths;
  }
  return {MAX_SECONDS,DEFAULT_PLAYBACK,normalizePlayback,bounds,seekTime,atOut,formatTime};
});