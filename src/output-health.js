'use strict';
// Window-local picture-signal watchdog. No stored preferences or external services.
// The pure monitor is also exercised deterministically by Node unit tests.
(function attach(root){
  function createMonitor(startedAt=0,{lostAfterMs=6000,startupGraceMs=10000}={}){
    let lastFrameAt=null,lastRtcFrameAt=null,status='waiting';
    let losses=0,recoveries=0,fallbackIssued=false;
    function snapshot(){
      return {status,lastFrameAt,lastRtcFrameAt,losses,recoveries};
    }
    function frame(time,transport){
      if(!Number.isFinite(time))return snapshot();
      lastFrameAt=time;
      if(transport==='webrtc')lastRtcFrameAt=time;
      if(status==='lost')recoveries++;
      status='live';fallbackIssued=false;
      return snapshot();
    }
    function stopRtc(){lastRtcFrameAt=null;fallbackIssued=false;}
    function poll(time,transport){
      if(!Number.isFinite(time))return {...snapshot(),fallback:false};
      const last=lastFrameAt??startedAt;
      const threshold=lastFrameAt===null?startupGraceMs:lostAfterMs;
      if(time-last>=threshold&&status!=='lost'){status='lost';losses++;}
      const fallback=transport==='webrtc'&&lastRtcFrameAt!==null
        &&time-lastRtcFrameAt>=lostAfterMs&&!fallbackIssued;
      if(fallback)fallbackIssued=true;
      return {...snapshot(),fallback};
    }
    return Object.freeze({frame,poll,stopRtc,snapshot});
  }
  const api=Object.freeze({createMonitor});
  if(root)root.BeatOutputHealth=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='undefined'?null:window);
