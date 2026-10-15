'use strict';
/* Local Electron-window WebRTC video transport. No STUN/TURN server or remote network service. */
(()=>{
 function createController(api,getCanvas,onStateChange){
  const peers=new Map(),pending=new Set(),ready=new Set(),failed=new Set();
  let stream=null,track=null,source=null,enabled=false;
  const kinds=['preview','output'];
  function signal(kind,payload){if(kinds.includes(kind))api.sendStreamSignal(kind,payload);}
  function teardown(kind,notifyView=true){
   const pc=peers.get(kind);peers.delete(kind);pending.delete(kind);
   if(pc){pc.onicecandidate=null;pc.onconnectionstatechange=null;pc.close();}
   if(notifyView)signal(kind,{type:'reset'});
   onStateChange();
  }
  function disposeStream(){
   if(track)track.stop();track=null;stream=null;source=null;
  }
  async function begin(kind){
   if(!enabled||!ready.has(kind)||failed.has(kind)||peers.has(kind)||pending.has(kind))return;
   pending.add(kind);
   try{
    if(typeof RTCPeerConnection!=='function')throw new Error('WebRTC nem érhető el');
    const canvas=getCanvas();
    if(!canvas||typeof canvas.captureStream!=='function')throw new Error('Canvas stream nem érhető el');
    if(!stream||source!==canvas){
     disposeStream();stream=canvas.captureStream(0);
     track=stream.getVideoTracks()[0];source=canvas;
     if(!track||typeof track.requestFrame!=='function')throw new Error('Manuális képkocka-átvitel nem érhető el');
    }
    if(!enabled||!ready.has(kind)){pending.delete(kind);return;}
    const pc=new RTCPeerConnection({iceServers:[]});
    peers.set(kind,pc);
    pc.addTrack(track,stream);
    pc.onicecandidate=event=>{if(event.candidate)signal(kind,{type:'candidate',candidate:event.candidate.toJSON()});};
    pc.onconnectionstatechange=()=>{
     if(pc.connectionState==='connected'){failed.delete(kind);onStateChange();}
     if(['failed','closed','disconnected'].includes(pc.connectionState)&&peers.get(kind)===pc){
      failed.add(kind);teardown(kind);
     }
    };
    const offer=await pc.createOffer();
    if(peers.get(kind)!==pc)return;
    await pc.setLocalDescription(offer);
    if(peers.get(kind)===pc)signal(kind,{type:'offer',sdp:pc.localDescription.sdp});
   }catch(error){failed.add(kind);teardown(kind);onStateChange();}
   finally{pending.delete(kind);}
  }
  async function onSignal(message){
   if(!message||!kinds.includes(message.kind))return;
   const {kind}=message;
   if(message.type==='ready'){
    ready.add(kind);failed.delete(kind);
    if(peers.has(kind))teardown(kind,false);
    await begin(kind);return;
   }
   if(message.type==='failed'){failed.add(kind);teardown(kind);return;}
   const pc=peers.get(kind);
   if(!pc||!enabled)return;
   try{
    if(message.type==='answer'&&pc.signalingState==='have-local-offer'){
     await pc.setRemoteDescription({type:'answer',sdp:message.sdp});
    }else if(message.type==='candidate'&&message.candidate){
     if(pc.remoteDescription)await pc.addIceCandidate(message.candidate);
     else (pc.pendingIce??=[]).push(message.candidate);
    }
    if(pc.remoteDescription&&pc.pendingIce){
     for(const candidate of pc.pendingIce)await pc.addIceCandidate(candidate);
     pc.pendingIce=[];
    }
   }catch{failed.add(kind);teardown(kind);}
  }
  function sync(state,useWebRtc){
   enabled=Boolean(useWebRtc);
   for(const kind of kinds){
    if(!state[kind]){ready.delete(kind);failed.delete(kind);if(peers.has(kind))teardown(kind,false);continue;}
    if(!enabled){if(peers.has(kind))teardown(kind);failed.delete(kind);}
    else if(ready.has(kind))begin(kind);
   }
   if(!enabled||(!peers.size&&!pending.size))disposeStream();
  }
  function restart(state){
   for(const kind of kinds){if(peers.has(kind))teardown(kind);}
   disposeStream();failed.clear();sync(state,enabled);
  }
  function isReady(state){return kinds.every(kind=>!state[kind]||peers.get(kind)?.connectionState==='connected');}
  function frameReady(){if(track&&track.readyState==='live'){try{track.requestFrame();}catch{}}}
  function close(){enabled=false;for(const kind of kinds)teardown(kind,false);disposeStream();ready.clear();}
  return {sync,restart,onSignal,isReady,frameReady,close};
 }
 window.BeatLiveOutput=Object.freeze({createController});
})();