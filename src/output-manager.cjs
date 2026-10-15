'use strict';
const MAX_FRAME_LENGTH=6_500_000;
const FRAME_PATTERN=/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;
const RESOLUTIONS=Object.freeze([540,720,1080]);
const FPS_OPTIONS=Object.freeze([12,24,30]);
const QUALITY_OPTIONS=Object.freeze([65,80,90]);
const DEFAULT_CONFIG=Object.freeze({outputResolution:540,outputFps:12,outputQuality:80});
function normalizeConfig(input){
 const c=input&&typeof input==='object'?input:{};
 return {
  outputResolution:RESOLUTIONS.includes(c.outputResolution)?c.outputResolution:DEFAULT_CONFIG.outputResolution,
  outputFps:FPS_OPTIONS.includes(c.outputFps)?c.outputFps:DEFAULT_CONFIG.outputFps,
  outputQuality:QUALITY_OPTIONS.includes(c.outputQuality)?c.outputQuality:DEFAULT_CONFIG.outputQuality
 };
}
function dimensions(height){const h=RESOLUTIONS.includes(height)?height:540;return {width:Math.round(h*16/9),height:h};}
function interval(fps){return 1000/(FPS_OPTIONS.includes(fps)?fps:12);}
function validFrame(frame){return typeof frame==='string'&&frame.length<=MAX_FRAME_LENGTH&&frame.length>120&&FRAME_PATTERN.test(frame);}
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
module.exports={MAX_FRAME_LENGTH,RESOLUTIONS,FPS_OPTIONS,QUALITY_OPTIONS,DEFAULT_CONFIG,normalizeConfig,dimensions,interval,validFrame,displayOptions,chooseDisplay};