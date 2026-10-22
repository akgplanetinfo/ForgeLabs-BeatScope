'use strict';
(()=>{
 const params=new URLSearchParams(location.search);
 const kind=params.get('kind');
 const blackoutOverlay=document.getElementById('blackout-screen');
 let blackout=false;
 function applyBlackout(enabled){
  blackout=kind==='output'&&enabled===true;
  if(blackoutOverlay)blackoutOverlay.hidden=!blackout;
  document.body.classList.toggle('blackout',blackout);
 }
 // The prearmed state is applied before first output paint.
 applyBlackout(params.get('blackout')==='1');
 window.outputBridge?.onBlackout(enabled=>applyBlackout(enabled));
 const canvas=document.getElementById('screen'),ctx=canvas.getContext('2d',{alpha:false});
 const video=document.getElementById('live-video');
 const lossOverlay=document.getElementById('signal-loss-screen');
 const health=window.BeatOutputHealth.createMonitor(performance.now());
 let lastReportedHealth=null;
 function reportHealth(status){
  if(lossOverlay)lossOverlay.hidden=status!=='lost';
  if(lastReportedHealth===status)return;
  lastReportedHealth=status;
  window.outputBridge?.sendHealth(kind,status);
 }
 function frameReceived(transport){
  reportHealth(health.frame(performance.now(),transport).status);
 }
 let accepted=0,painted=0,busy=false,nextFrame=null,sourceWidth=0,sourceHeight=0,decodeMs=0,lastPaintedAt=0;
 let mode='jpeg',pc=null,pendingCandidates=[],frameWatch=0,videoTimeout=null,offers=0,answers=0,lastError='';
 const signal=payload=>window.outputBridge?.sendStreamSignal(kind,payload);
 function fit(){
  const w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 }
 function draw(image){
  sourceWidth=image.width;sourceHeight=image.height;fit();
  ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);
  const scale=Math.min(canvas.width/image.width,canvas.height/image.height);
  const w=image.width*scale,h=image.height*scale;
  ctx.drawImage(image,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
  painted++;lastPaintedAt=performance.now();
  frameReceived('jpeg');
  document.body.classList.add('streaming');
 }
 async function consume(){
  if(busy||!nextFrame)return;
  busy=true;
  while(nextFrame){
   const frame=nextFrame;nextFrame=null;
   try{
    const image=new Image();image.src=frame;const started=performance.now();
    await image.decode();decodeMs=performance.now()-started;
    if(mode!=='webrtc')draw(image);
   }catch{/* Drop a corrupt/stale JPEG, retaining the last good frame. */}
  }
  busy=false;
 }
 function stopLive(){
  mode='jpeg';frameWatch++;
  health.stopRtc();
  if(videoTimeout!==null){clearTimeout(videoTimeout);videoTimeout=null;}
  if(pc){pc.ontrack=null;pc.onicecandidate=null;pc.onconnectionstatechange=null;pc.close();pc=null;}
  video.pause();video.srcObject=null;video.hidden=true;canvas.hidden=false;
  pendingCandidates=[];
 }
 function watchVideo(){
  const token=++frameWatch;
  const next=(_now,metadata)=>{
   if(token!==frameWatch||mode!=='webrtc')return;
   accepted++;painted++;
   if(videoTimeout!==null){clearTimeout(videoTimeout);videoTimeout=null;}
   sourceWidth=metadata.width||video.videoWidth;sourceHeight=metadata.height||video.videoHeight;
   lastPaintedAt=performance.now();frameReceived('webrtc');
   document.body.classList.add('streaming');
   if(typeof video.requestVideoFrameCallback==='function')video.requestVideoFrameCallback(next);
  };
  if(typeof video.requestVideoFrameCallback==='function')video.requestVideoFrameCallback(next);
  else video.addEventListener('timeupdate',()=>{if(token===frameWatch&&mode==='webrtc'){accepted++;painted++;sourceWidth=video.videoWidth;sourceHeight=video.videoHeight;lastPaintedAt=performance.now();frameReceived('webrtc');}},{once:false});
 }
 async function acceptOffer(message){
  offers++;
  // ICE candidates can arrive before SDP offer because signaling travels asynchronously.
  const queuedCandidates=pendingCandidates;
  stopLive();pendingCandidates=queuedCandidates;
  if(typeof RTCPeerConnection!=='function')throw new Error('WebRTC nem érhető el');
  const peer=new RTCPeerConnection({iceServers:[]});pc=peer;
  peer.onicecandidate=event=>{
   if(event.candidate&&pc===peer)signal({type:'candidate',candidate:event.candidate.toJSON()});
  };
  peer.ontrack=event=>{
   if(pc!==peer)return;
   video.srcObject=event.streams[0]||new MediaStream([event.track]);
   video.hidden=false;canvas.hidden=true;mode='webrtc';decodeMs=0;
   const paintedBefore=painted;
   videoTimeout=setTimeout(()=>{
    if(pc===peer&&mode==='webrtc'&&painted===paintedBefore){stopLive();signal({type:'failed'});}
   },9000);
   video.play().then(watchVideo).catch(()=>{stopLive();signal({type:'failed'});});
  };
  peer.onconnectionstatechange=()=>{
   if(pc===peer&&['failed','disconnected','closed'].includes(peer.connectionState)){
    stopLive();signal({type:'failed'});
   }
  };
  await peer.setRemoteDescription({type:'offer',sdp:message.sdp});
  for(const candidate of pendingCandidates)await peer.addIceCandidate(candidate);
  pendingCandidates=[];
  const answer=await peer.createAnswer();
  await peer.setLocalDescription(answer);
  if(pc===peer){answers++;signal({type:'answer',sdp:peer.localDescription.sdp});}
 }
 window.outputBridge?.onStreamSignal(async message=>{
  if(!message||message.kind!==kind)return;
  try{
   if(message.type==='reset'){stopLive();return;}
   if(message.type==='offer'){await acceptOffer(message);return;}
   if(message.type==='candidate'&&message.candidate){
    if(pc?.remoteDescription)await pc.addIceCandidate(message.candidate);
    else pendingCandidates.push(message.candidate);
   }
  }catch(error){lastError=error?.message||String(error);stopLive();signal({type:'failed'});}
 });
 window.outputBridge?.onFrame(data=>{
  if(typeof data!=='string'||!data.startsWith('data:image/jpeg;base64,'))return;
  if(mode==='webrtc')return;
  accepted++;nextFrame=data;consume();
 });
 function checkSignal(){
  const result=health.poll(performance.now(),mode);
  reportHealth(result.status);
  // After live WebRTC stops producing decoded pictures, request the already
  // supported JPEG fallback, once per stall. Preserve the BLACKOUT overlay.
  if(result.fallback&&mode==='webrtc'){
   lastError='WebRTC jelkimaradás: JPEG tartalékra váltás';
   stopLive();signal({type:'failed'});
  }
 }
 const watchdog=setInterval(checkSignal,1000);
 window.addEventListener('resize',fit);
 window.addEventListener('beforeunload',()=>{clearInterval(watchdog);stopLive();});
 fit();
 reportHealth('waiting');
 window.__beatOutputStats=()=>({accepted,painted,width:canvas.width,height:canvas.height,sourceWidth,sourceHeight,decodeMs,lastPaintedAt,mode,blackout,signalHealth:health.snapshot(),offers,answers,lastError,rtcState:pc?.connectionState||null,iceState:pc?.iceConnectionState||null});
 // The controller must not send an offer before this isolated renderer is listening.
 if(['preview','output'].includes(kind))signal({type:'ready'});
})();