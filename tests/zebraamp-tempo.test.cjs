const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../zebraamp.js'),'utf8');

function harness(){
 class FakeAudio{
  constructor(){this.paused=false;this.playbackRate=1;this.defaultPlaybackRate=1;this.volume=.7;}
 }
 const box={window:{},Audio:FakeAudio,Float32Array,Uint8Array,Math,Number,Map,URL,Promise,Date};
 vm.createContext(box);
 vm.runInContext(source.replace('window.ZebraAMP={',`window.ZebraAMP={
  tempoTest:function(data,now){reverb=65;audio.paused=false;trackTempo(data,now);return {bpm:tempo.bpm,confidence:tempo.confidence};},
  tempoReset:function(){resetTempo();},`),box);
 return box.window.ZebraAMP;
}

function frame(level){
 const data=new Uint8Array(512);data.fill(12,1,9);
 if(level)data.fill(235,1,9);
 return data;
}

function feed(amp,beatMs,durationMs=9000){
 let result;
 for(let now=50;now<=durationMs;now+=50){
  const phase=now%beatMs;
  result=amp.tempoTest(frame(phase<50||phase>beatMs-50),now);
 }
 return result;
}

test('lightweight beat tracker locks to a steady audible tempo',()=>{
 const result=feed(harness(),500);
 assert.ok(Math.abs(result.bpm-120)<=2,result);
 assert.ok(result.confidence>=.52,result);
});

test('tempo tracking follows slowed audible beat spacing',()=>{
 const result=feed(harness(),750,12000);
 assert.ok(Math.abs(result.bpm-80)<=2,result);
 assert.ok(result.confidence>=.52,result);
});

test('steady bass without attacks never invents a BPM',()=>{
 const amp=harness();let result;
 for(let now=50;now<9000;now+=50)result=amp.tempoTest(frame(false),now);
 assert.equal(result.bpm,0);assert.equal(result.confidence,0);
});
