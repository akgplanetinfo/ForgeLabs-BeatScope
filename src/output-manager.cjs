'use strict';
const MAX_FRAME_LENGTH=6_500_000;
const FRAME_PATTERN=/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;
const RESOLUTIONS=Object.freeze([540,720,1080]);
const FPS_OPTIONS=Object.freeze([12,24,30,60]);
const TRANSPORTS=Object.freeze(['jpeg','webrtc']);
const QUALITY_OPTIONS=Object.freeze([65,80,90]);
const DEFAULT_CONFIG=Object.freeze({outputResolution:540,outputFps:12,outputQuality:80,outputTransport:'jpeg'});
function normalizeConfig(input){
 const c=input&&typeof input==='object'?input:{};
 return {
  outputResolution:RESOLUTIONS.includes(c.outputResolution)?c.outputResolution:DEFAULT_CONFIG.outputResolution,
  outputFps:FPS_OPTIONS.includes(c.outputFps)?c.outputFps:DEFAULT_CONFIG.outputFps,
  outputQuality:QUALITY_OPTIONS.includes(c.outputQuality)?c.outputQuality:DEFAULT_CONFIG.outputQuality,
  outputTransport:TRANSPORTS.includes(c.outputTransport)?c.outputTransport:DEFAULT_CONFIG.outputTransport
 };
}
function dimensions(height){const h=RESOLUTIONS.includes(height)?height:540;return {width:Math.round(h*16/9),height:h};}
function interval(fps){return 1000/(FPS_OPTIONS.includes(fps)?fps:12);}
function validFrame(frame){return typeof frame==='string'&&frame.length<=MAX_FRAME_LENGTH&&frame.length>120&&FRAME_PATTERN.test(frame);}
function validSignal(data){
 if(!data||typeof data!=='object'||Array.isArray(data))return false;
 if(data.type==='ready'||data.type==='reset'||data.type==='failed')return true;
 if(['offer','answer'].includes(data.type))return typeof data.sdp==='string'&&data.sdp.length>30&&data.sdp.length<100000&&/^v=0\r?\n/.test(data.sdp);
 if(data.type==='candidate'){
  const c=data.candidate;
  return !!c&&typeof c==='object'&&!Array.isArray(c)&&
    typeof c.candidate==='string'&&c.candidate.length<=4096&&
    (c.sdpMid==null||typeof c.sdpMid==='string'&&c.sdpMid.length<=64)&&
    (c.sdpMLineIndex==null||Number.isInteger(c.sdpMLineIndex)&&c.sdpMLineIndex>=0&&c.sdpMLineIndex<64);
 }
 return false;
}
function displayOptions(displays,primaryId){
 return (Array.isArray(displays)?displays:[]).map((display,index)=>({
   id:display.id,
   name:'Kijelző '+(index+1)+(display.id===primaryId?' (elsődleges)':' (külső)'),
   width:Math.max(1,Math.trunc(display.bounds?.width||display.size?.width||1)),
   height:Math.max(1,Math.trunc(display.bounds?.height||display.size?.height||1)),
   primary:display.id===primaryId
 }));
}
function chooseDisplay(displays,primaryId,requested){
 const all=Array.isArray(displays)?displays:[];
 const selected=all.find(x=>x.id===requested);
 return selected||all.find(x=>x.id===primaryId)||all[0]||null;
}
module.exports={MAX_FRAME_LENGTH,RESOLUTIONS,FPS_OPTIONS,QUALITY_OPTIONS,TRANSPORTS,DEFAULT_CONFIG,normalizeConfig,dimensions,interval,validFrame,validSignal,displayOptions,chooseDisplay};