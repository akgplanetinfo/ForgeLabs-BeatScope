(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BeatDirector=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const MODES=Object.freeze(['bars','wave','orbit','particles']);
  const SPEEDS=Object.freeze({calm:12500,balanced:7100,party:3900});
  const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
  const labels=Object.freeze({
    bars:'Spektrum hangsúlyos',
    wave:'Lágyabb, hullámformás szakasz',
    orbit:'Erőteljes basszus és ritmus',
    particles:'Magas frekvenciák és változások'
  });
  function createDirector(){
    let lastSwitch=null,previousEnergy=0,energyAverage=0,beatAverage=0;
    let lastBeat=-Infinity,beatTimes=[],visits=[],sceneCounter=0;
    function reset(){
      lastSwitch=null;previousEnergy=0;energyAverage=0;beatAverage=0;
      lastBeat=-Infinity;beatTimes=[];visits=[];sceneCounter=0;
    }
    function update(features,now,currentMode,speed='balanced'){
      if(!Number.isFinite(now))return null;
      const bass=clamp(features?.bass),mids=clamp(features?.mids),highs=clamp(features?.highs);
      const total=clamp(features?.total),rms=clamp(features?.rms);
      const energy=clamp(bass*.50+mids*.24+highs*.14+rms*.12);
      energyAverage=energyAverage*.965+energy*.035;
      const onset=Math.max(0,energy-previousEnergy);
      previousEnergy=energy;
      beatAverage=beatAverage*.92+onset*.08;
      const beat=onset>Math.max(.045,beatAverage*2.6)&&energy>.09&&now-lastBeat>=260;
      if(beat){
        lastBeat=now;beatTimes.push(now);beatTimes=beatTimes.filter(t=>now-t<12000).slice(-16);
      }
      const bpm=estimateBpm(beatTimes);
      const active=total>.014||rms>.012||energy>.03;
      if(!active){lastSwitch=now;return {change:false,bpm,beat,active:false};}
      if(lastSwitch===null){lastSwitch=now;return {change:false,bpm,beat,active:true};}
      const interval=SPEEDS[speed]||SPEEDS.balanced;
      if(now-lastSwitch<interval)return {change:false,bpm,beat,active:true};
      const scores={
        bars:.25+mids*.85+highs*.45,
        wave:.2+(1-clamp(energy*2.2))*.65+mids*.16,
        orbit:.16+bass*1.6+(beat?.45:0),
        particles:.15+highs*1.1+Math.abs(energy-energyAverage)*2
      };
      const recent=visits.slice(-2);
      for(const mode of MODES){
        if(mode===currentMode)scores[mode]-=10;
        if(recent.includes(mode))scores[mode]-=.9;
      }
      const rotation=MODES[(sceneCounter+1)%MODES.length];
      scores[rotation]+=.09;
      const next=MODES.reduce((a,b)=>scores[b]>scores[a]?b:a);
      lastSwitch=now;visits.push(currentMode);visits=visits.slice(-4);sceneCounter++;
      return {change:true,mode:next,bpm,beat,active:true,reason:labels[next]};
    }
    return {update,reset};
  }
  function estimateBpm(times){
    if(!Array.isArray(times)||times.length<4)return null;
    const intervals=[];
    for(let i=1;i<times.length;i++){
      const diff=times[i]-times[i-1];
      if(diff>=270&&diff<=1400)intervals.push(diff);
    }
    if(intervals.length<3)return null;
    intervals.sort((a,b)=>a-b);
    const median=intervals[Math.floor(intervals.length/2)];
    let bpm=60000/median;
    while(bpm<70)bpm*=2;
    while(bpm>180)bpm/=2;
    return Math.round(bpm);
  }
  return {createDirector,estimateBpm,SPEEDS,MODES};
});
