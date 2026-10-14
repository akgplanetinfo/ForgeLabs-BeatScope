(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.BeatExtraGenerators=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const NAMES=Object.freeze({
  hexfield:'Hex Matrix',digitalrain:'Digital Rain',ribbon:'Ribbon Flow',
  mandala:'Mandala Bloom',fireflies:'Firefly Cloud',electric:'Electric Arcs'
 });
 const IDS=Object.freeze(Object.keys(NAMES));
 const TAU=Math.PI*2;
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 const fract=x=>x-Math.floor(x);
 const hash=n=>fract(Math.sin(n*127.1+78.233)*43758.5453);
 function draw(id,ctx,o={}){
  if(!NAMES[id]||!ctx)return false;
  const w=Math.max(1,o.width||ctx.canvas.width),h=Math.max(1,o.height||ctx.canvas.height);
  const time=Number.isFinite(o.time)?o.time/1000:0;
  const scale=Math.min(w,h);
  const bass=clamp(Number(o.bass)||0,0,1),mids=clamp(Number(o.mids)||0,0,1),highs=clamp(Number(o.highs)||0,0,1);
  const intensity=clamp(Number(o.intensity)||1,.2,3);
  const color=typeof o.color==='function'?o.color:(i,n,a=1)=>'rgba(78,219,245,'+a+')';
  const cx=w*.5,cy=h*.5;
  ctx.save();
  try{
   if(id==='hexfield'){
    const r=clamp(scale/22,10,24),stepX=1.5*r,stepY=Math.sqrt(3)*r;
    for(let col=-1;col<=Math.ceil(w/stepX)+1;col++){
     for(let row=-1;row<=Math.ceil(h/stepY)+1;row++){
      const x=col*stepX,y=(row+(col%2)*.5)*stepY;
      const v=Math.sin(col*.75+row*.85+time*(.75+bass))*.5+.5;
      const k=.58+v*.4+highs*.18;
      ctx.strokeStyle=color(Math.abs(col+row)%19,19,.09+v*.48);
      ctx.lineWidth=.65+v*1.4;
      ctx.beginPath();
      for(let q=0;q<6;q++){
       const a=q*TAU/6+Math.PI/6;
       const px=x+Math.cos(a)*r*k,py=y+Math.sin(a)*r*k;
       q?ctx.lineTo(px,py):ctx.moveTo(px,py);
      }
      ctx.closePath();ctx.stroke();
      if(v>.93){ctx.fillStyle=color(col+row,14,.22+mids*.3);ctx.fill();}
     }
    }
   }else if(id==='digitalrain'){
    const cell=clamp(w/50,10,20),columns=Math.ceil(w/cell)+1;
    ctx.font='bold '+Math.floor(cell*.9)+'px monospace';
    ctx.textBaseline='top';
    for(let i=0;i<columns;i++){
     const velocity=.65+hash(i+4)*1.55+highs*.65;
     const yy=(time*cell*velocity*4+hash(i*17)*h*2)%(h+cell*22);
     for(let j=0;j<15;j++){
      const y=yy-j*cell,x=i*cell;
      if(y<0||y>=h)continue;
      const chr=String.fromCharCode(0x30A0+Math.floor(hash(i*31+j*13+Math.floor(time*6))*90));
      ctx.fillStyle=color(i+j,19,j===0?.95:(1-j/16)*(.16+.45*bass));
      ctx.fillText(chr,x,y);
     }
    }
   }else if(id==='ribbon'){
    for(let band=0;band<8;band++){
     const waver=.05+band*.014,phase=band*.82+time*(.45+highs*.6);
     ctx.beginPath();
     for(let k=0;k<=150;k++){
      const x=w*k/150;
      const y=cy+Math.sin(x/w*TAU*(1.2+band*.17)+phase)*h*waver
       +Math.cos(x/w*TAU*2.8-phase*.7)*h*.085+(band-3.5)*h*.044;
      k?ctx.lineTo(x,y):ctx.moveTo(x,y);
     }
     ctx.lineWidth=2.1+band*.7+bass*2;
     ctx.strokeStyle=color(band,8,.30+highs*.3);
     ctx.stroke();
    }
   }else if(id==='mandala'){
    const petals=12,sections=7;
    for(let layer=1;layer<=sections;layer++){
     const rad=layer*scale*.048+6+bass*layer*2,rot=time*.09*(layer%2?1:-1);
     for(let k=0;k<petals;k++){
      const a=k*TAU/petals+rot;
      const centerX=cx+Math.cos(a)*rad,centerY=cy+Math.sin(a)*rad;
      ctx.beginPath();
      ctx.ellipse(centerX,centerY,Math.max(3,rad*.3),Math.max(2,rad*.12),
        a,0,TAU);
      ctx.lineWidth=1+(layer%3)*.5;
      ctx.strokeStyle=color(layer+k,sections*petals,.2+layer*.07+highs*.13);
      ctx.stroke();
     }
    }
    ctx.fillStyle=color(2,8,.56+mids*.2);
    ctx.beginPath();ctx.arc(cx,cy,5+bass*12,0,TAU);ctx.fill();
   }else if(id==='fireflies'){
    for(let i=0;i<210;i++){
     const seed=hash(i*5+11),a=hash(i*7+19)*TAU+time*(.02+hash(i*13)*.10);
     const x=cx+Math.cos(a)*w*seed*.56+Math.sin(time*.37+i)*w*.038;
     const y=cy+Math.sin(a*1.3)*h*hash(i*17)*.54+Math.cos(time*.2+i*2)*h*.034;
     const brightness=.5+.5*Math.sin(time*(.7+hash(i*19)*2.2)+i);
     const radius=.65+brightness*3.4*(1+mids*.52)*intensity;
     ctx.fillStyle=color(i,210,.17+brightness*.75);
     ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fill();
     if(i%7===0){
      ctx.strokeStyle=color(i,210,.07+brightness*.18);
      ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,radius*4,0,TAU);ctx.stroke();
     }
    }
   }else if(id==='electric'){
    for(let i=0;i<17;i++){
     const startX=w*(.07+hash(i*11)*.86),startY=h*(.15+hash(i*13)*.7);
     const endX=cx+Math.cos(time*.12+i*2)*w*.33,endY=cy+Math.sin(time*.18+i*1.7)*h*.37;
     const steps=19;
     ctx.beginPath();
     for(let k=0;k<=steps;k++){
      const f=k/steps,jitter=Math.sin(time*(3+i*.07)+i*23+k*73)*scale*.022*(1+highs);
      const x=startX*(1-f)+endX*f+Math.sin(i+k)*jitter;
      const y=startY*(1-f)+endY*f+Math.cos(i+k*1.7)*jitter;
      k?ctx.lineTo(x,y):ctx.moveTo(x,y);
     }
     ctx.strokeStyle=color(i,17,.15+bass*.36+((i%3)*.08));
     ctx.lineWidth=(i%4===0?2.6:1.15)*(1+highs*.45);
     ctx.stroke();
    }
   }
  }finally{ctx.restore();}
  return true;
 }
 return {NAMES,IDS,draw};
});