(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BeatGenerators=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const NAMES=Object.freeze({
    tunnel:'Neon Tunnel',plasma:'Plasma Flow',rings:'Pulse Rings',
    grid:'Perspective Grid',laser:'Laser Fan',starfield:'Warp Starfield'
  });
  const IDS=Object.freeze(Object.keys(NAMES));
  const TAU=Math.PI*2,clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  function draw(id,ctx,options={}){
    if(!NAMES[id]||!ctx)return false;
    const w=Math.max(1,options.width||ctx.canvas.width);
    const h=Math.max(1,options.height||ctx.canvas.height);
    const t=(Number.isFinite(options.time)?options.time:0)/1000;
    const intensity=clamp(Number(options.intensity)||1,0.2,3);
    const bass=clamp(Number(options.bass)||0,0,1),mids=clamp(Number(options.mids)||0,0,1),highs=clamp(Number(options.highs)||0,0,1);
    const color=typeof options.color==='function'?options.color:(i,n,a=1)=>'rgba(77,214,255,'+a+')';
    const cx=w*.5,cy=h*.5,size=Math.min(w,h);
    ctx.save();
    try{
      if(id==='tunnel'){
        const angular=t*.23+highs*.17;
        for(let j=17;j>=0;j--){
          const v=((j/18+t*(.13+bass*.07))%1);
          const radius=(.045+Math.pow(v,1.65)*.78)*size;
          const sides=6,rot=angular+j*.042;
          ctx.beginPath();
          for(let k=0;k<=sides;k++){
            const a=TAU*k/sides+rot,px=cx+Math.cos(a)*radius,py=cy+Math.sin(a)*radius*.72;
            k?ctx.lineTo(px,py):ctx.moveTo(px,py);
          }
          ctx.closePath();ctx.strokeStyle=color(j,18,.22+v*.65);
          ctx.lineWidth=1+v*2+bass*2;ctx.stroke();
        }
        for(let k=0;k<6;k++){
          ctx.beginPath();ctx.moveTo(cx,cy);
          const a=TAU*k/6+angular;
          ctx.lineTo(cx+Math.cos(a)*size*.75,cy+Math.sin(a)*size*.54);
          ctx.strokeStyle=color(k,6,.12+bass*.2);ctx.lineWidth=1.5;ctx.stroke();
        }
      }else if(id==='plasma'){
        // Six moving radial light fields; no copy/paste of the older four generators.
        for(let i=0;i<6;i++){
          const x=cx+Math.sin(t*(.24+i*.065)+i*2.13)*w*.31;
          const y=cy+Math.cos(t*(.2+i*.075)+i*1.57)*h*.31;
          const r=Math.max(30,size*(.22+.07*Math.sin(t*.47+i)))*(1+bass*.3);
          const halo=ctx.createRadialGradient(x,y,1,x,y,r);
          halo.addColorStop(0,color(i,6,.50+mids*.25));
          halo.addColorStop(.48,color(i+1,6,.18));
          halo.addColorStop(1,color(i+2,6,0));
          ctx.fillStyle=halo;ctx.fillRect(x-r,y-r,r*2,r*2);
        }
        for(let i=0;i<5;i++){
          ctx.beginPath();
          for(let k=0;k<=90;k++){
            const x=k/90*w,angle=k/90*TAU*(1.3+i*.23)+t*(.58+i*.05);
            const y=cy+Math.sin(angle)*h*(.07+i*.027)+Math.cos(angle*1.7+i)*h*.07;
            k?ctx.lineTo(x,y):ctx.moveTo(x,y);
          }
          ctx.strokeStyle=color(i,5,.15+highs*.2);ctx.lineWidth=2+i*.7;ctx.stroke();
        }
      }else if(id==='rings'){
        for(let i=0;i<18;i++){
          const phase=((i/18+t*(.09+bass*.08))%1);
          const r=7+Math.pow(phase,1.2)*size*.68;
          const beat=1+bass*.24;
          ctx.strokeStyle=color(i,18,.17+phase*.7);
          ctx.lineWidth=1.1+phase*3;ctx.beginPath();
          ctx.ellipse(cx,cy,r*beat,r*.73*beat,t*.055,0,TAU*(.70+Math.sin(t*.4+i)*.16));
          ctx.stroke();
          const a=t*.35+i*.83;
          ctx.fillStyle=color(i+1,18,.45+phase*.3);
          ctx.beginPath();ctx.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r*.73,1.2+highs*3,0,TAU);ctx.fill();
        }
        ctx.beginPath();ctx.arc(cx,cy,8+bass*32,0,TAU);
        ctx.fillStyle=color(2,5,.6);ctx.fill();
      }else if(id==='grid'){
        const horizon=h*.33+Math.sin(t*.22)*h*.018;
        for(let i=-12;i<=12;i++){
          const from=cx+i*size*.026,to=cx+i*w*.11;
          ctx.beginPath();ctx.moveTo(from,horizon);ctx.lineTo(to,h);
          ctx.strokeStyle=color((i+24)%12,12,.17+highs*.33);ctx.lineWidth=i%4===0?1.8:1;ctx.stroke();
        }
        const scroll=t*(.18+bass*.08);
        for(let i=0;i<18;i++){
          const pos=((i/18+scroll)%1);
          const y=horizon+(h-horizon)*pos*pos;
          ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);
          ctx.strokeStyle=color(i,18,.13+pos*.66);ctx.lineWidth=.6+pos*1.8;ctx.stroke();
        }
        // Backlit skyline to make this visually distinct even on silence.
        for(let i=0;i<26;i++){
          const x=i*w/26,height=(Math.sin(i*2.68)+1)*h*.035;
          ctx.fillStyle=color(i,26,.06+highs*.08);
          ctx.fillRect(x,horizon-height,w/37,height);
        }
        ctx.strokeStyle=color(0,5,.78);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,horizon);ctx.lineTo(w,horizon);ctx.stroke();
      }else if(id==='laser'){
        for(let i=0;i<22;i++){
          const originX=(i%3)*w*.37+w*.13,originY=h*.82+(i%4)*h*.026;
          const a=-Math.PI/2+Math.sin(t*(.4+i*.017)+i*1.43)*(.45+i*.025);
          const len=size*(.56+Math.sin(i*9.2)*.20)+w*.15;
          const ex=originX+Math.cos(a)*len,ey=originY+Math.sin(a)*len;
          ctx.beginPath();ctx.moveTo(originX,originY);ctx.lineTo(ex,ey);
          ctx.strokeStyle=color(i,22,.16+highs*.47);ctx.lineWidth=.8+(i%4)*.5;
          ctx.stroke();
          if(i%3===0){
            ctx.beginPath();ctx.arc(ex,ey,1.7+highs*3,0,TAU);
            ctx.fillStyle=color(i,22,.45);ctx.fill();
          }
        }
        for(let i=0;i<3;i++){
          const x=(i*.37+.13)*w;
          const glow=ctx.createRadialGradient(x,h*.85,0,x,h*.85,size*.08);
          glow.addColorStop(0,color(i,3,.64+bass*.17));
          glow.addColorStop(1,color(i,3,0));ctx.fillStyle=glow;
          ctx.fillRect(x-size*.08,h*.85-size*.08,size*.16,size*.16);
        }
      }else if(id==='starfield'){
        const speed=.18+bass*.22;
        for(let i=0;i<190;i++){
          const seedX=Math.sin(i*52.13)*43758.5453,seedY=Math.sin(i*91.67)*10333.31;
          const x=(seedX-Math.floor(seedX))*2-1,y=(seedY-Math.floor(seedY))*2-1;
          const z=((i/190+t*speed)%1),scale=Math.pow(z,2.4)*2;
          const px=cx+x*w*.58*scale,py=cy+y*h*.58*scale;
          const length=2+z*z*(13+highs*28);
          ctx.beginPath();ctx.moveTo(px,py);
          ctx.lineTo(px+x*length,py+y*length);
          ctx.strokeStyle=color(i,190,.16+z*.77);
          ctx.lineWidth=.55+z*2.4;ctx.stroke();
        }
        const centerGlow=ctx.createRadialGradient(cx,cy,0,cx,cy,size*.2);
        centerGlow.addColorStop(0,color(2,6,.15+bass*.22));
        centerGlow.addColorStop(1,color(0,6,0));
        ctx.fillStyle=centerGlow;ctx.fillRect(cx-size*.2,cy-size*.2,size*.4,size*.4);
      }
    }finally{ctx.restore();}
    return true;
  }
  return {IDS,NAMES,draw};
});