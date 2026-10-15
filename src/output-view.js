'use strict';
(()=>{
 const canvas=document.getElementById('screen'),ctx=canvas.getContext('2d',{alpha:false});
 let accepted=0,painted=0,busy=false,nextFrame=null,sourceWidth=0,sourceHeight=0,decodeMs=0,lastPaintedAt=0;
 function fit(){
   const w=Math.max(1,window.innerWidth),h=Math.max(1,window.innerHeight);
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 }
 function draw(image){
   fit();
   ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);
   const scale=Math.min(canvas.width/image.width,canvas.height/image.height);
   const w=image.width*scale,h=image.height*scale;
   ctx.drawImage(image,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
   painted++;sourceWidth=image.width;sourceHeight=image.height;lastPaintedAt=performance.now();
   document.body.classList.add('streaming');
 }
 async function consume(){
   if(busy||!nextFrame)return;
   busy=true;
   while(nextFrame){
     const source=nextFrame;nextFrame=null;
     try{
       const image=new Image();
       image.src=source;
       const started=performance.now();
       await image.decode();
       decodeMs=performance.now()-started;
       draw(image);
     }catch{/* Ignore corrupt/obsolete frames; keep most recent good frame. */}
   }
   busy=false;
 }
 window.outputBridge?.onFrame(data=>{
   if(typeof data!=='string'||!data.startsWith('data:image/jpeg;base64,'))return;
   accepted++;
   nextFrame=data;
   consume();
 });
 window.addEventListener('resize',()=>{fit();});
 fit();
 window.__beatOutputStats=()=>({accepted,painted,width:canvas.width,height:canvas.height,sourceWidth,sourceHeight,decodeMs,lastPaintedAt});
})();