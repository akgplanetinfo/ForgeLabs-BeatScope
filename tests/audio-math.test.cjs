'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const m=require('../src/audio-math.js');
test('üres spektrum csendet ad',()=>{assert.equal(m.meanBand(new Uint8Array(0),0,4),0);assert.equal(m.dominantFrequency(new Uint8Array(0)),0);});
test('átlagolt energia helyes',()=>{assert.equal(m.meanBand(Uint8Array.from([0,255,255,0]),1,3),1);});
test('alacsony energiát 0..1 közé skálázza',()=>{assert.ok(m.meanBand(Uint8Array.from([127,127,127,127]),0,4)>.49);});
test('frekvencia-sávokat külön méri',()=>{
 const b=new Uint8Array(1024);b[4]=255;b[12]=255;b[80]=255;b[400]=255;
 const r=m.frequencyBands(b,48000,2048);
 assert.ok(r.bass>0&&r.mids>0&&r.highs>0);
});
test('domináns frekvencia spektrumbin szerint számol',()=>{const b=new Uint8Array(1024);b[100]=255;assert.equal(m.dominantFrequency(b,48000,2048),2344);});
test('zajszint alatt nincs domináns frekvencia',()=>{const b=new Uint8Array(1024);b[43]=10;assert.equal(m.dominantFrequency(b),0);});
test('RMS 128-szintű jel esetén nulla',()=>{assert.equal(m.rmsOfWave(Uint8Array.from([128,128,128,128])),0);});
test('RMS nem nulla, ha hullámforma változik',()=>{const rms=m.rmsOfWave(Uint8Array.from([0,255,0,255]));assert.ok(rms>.9&&rms<=1);});
test('oszlopok hangenergiával arányosak',()=>{const b=new Uint8Array(1024).fill(255);assert.equal(m.audioBarLevel(b,0,64),1);});
test('idők kijelzése',()=>{assert.equal(m.formatTime(0),'0:00');assert.equal(m.formatTime(125.9),'2:05');assert.equal(m.formatTime(NaN),'0:00');});