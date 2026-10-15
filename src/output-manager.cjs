'use strict';
const MAX_FRAME_LENGTH=2_100_000;
const FRAME_PATTERN=/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;
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
module.exports={MAX_FRAME_LENGTH,validFrame,displayOptions,chooseDisplay};