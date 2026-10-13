(function (root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BeatMath=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  function meanBand(bins,start,end){
    if(!bins||!bins.length)return 0;
    const lo=Math.min(bins.length,Math.max(0,Math.floor(start)));
    const hi=Math.min(bins.length,Math.max(lo+1,Math.ceil(end)));
    let sum=0;for(let i=lo;i<hi;i++)sum+=bins[i];
    return Math.max(0,Math.min(1,(sum/(hi-lo))/255));
  }
  function frequencyBands(bins,sampleRate=44100,fftSize=2048){
    const nyquist=sampleRate/2;
    const convert=(hz)=>Math.floor(hz/nyquist*bins.length);
    return {
      bass:meanBand(bins,convert(30),convert(220)),
      mids:meanBand(bins,convert(220),convert(2000)),
      highs:meanBand(bins,convert(2000),convert(10000)),
      total:meanBand(bins,0,bins.length),
      dominantHz:dominantFrequency(bins,sampleRate,fftSize)
    };
  }
  function dominantFrequency(bins,sampleRate=44100,fftSize=2048){
    if(!bins?.length)return 0;
    let best=0,peak=0;
    for(let i=2;i<bins.length;i++){if(bins[i]>peak){peak=bins[i];best=i;}}
    return peak>=12?Math.round(best*sampleRate/fftSize):0;
  }
  function rmsOfWave(wave){
    if(!wave?.length)return 0;
    let sum=0;for(const n of wave){const v=(n-128)/128;sum+=v*v;}
    return Math.min(1,Math.sqrt(sum/wave.length));
  }
  function audioBarLevel(bins,barIndex,barCount){
    if(!bins||!bins.length)return 0;
    const t=barIndex/Math.max(1,barCount);
    const first=Math.floor(Math.pow(t,1.7)*(bins.length-1));
    const t2=(barIndex+1)/Math.max(1,barCount);
    const last=Math.max(first+1,Math.ceil(Math.pow(t2,1.7)*(bins.length-1)));
    return meanBand(bins,first,last);
  }
  function formatTime(seconds){
    if(!Number.isFinite(seconds)||seconds<0) return '0:00';
    const s=Math.floor(seconds);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
  }
  return{meanBand,frequencyBands,dominantFrequency,rmsOfWave,audioBarLevel,formatTime};
});