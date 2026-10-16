// Run: node --test tests/zebravis.test.cjs (no dependencies).
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../visualizer.js'),'utf8');
function harness(){
 const box={window:{matchMedia:false},Uint8Array,Float32Array,Math,Number};
 vm.createContext(box);
 vm.runInContext(source.replace('window.ZebraVisualizer={',`globalThis.vizTest={sampleBands,makeMotion,readMotion,drawSpectrum,drawScope,drawTunnel,drawKaleido,drawHyperdrive,makeStars,backdrop,
 setSamples:function(freq,time){spectrum=freq;wave=time;}};window.ZebraVisualizer={`),box);
 return box.vizTest;
}
const node=rate=>({context:{sampleRate:rate},minDecibels:-100,maxDecibels:-30});
function samples(rate,hz,byte=235){
 const a=new Uint8Array(512),bin=Math.round(hz/(rate/1024));
 for(let i=Math.max(1,bin-1);i<=Math.min(511,bin+1);i++)a[i]=byte;
 return a;
}
function waveform(amplitude=0){return Uint8Array.from({length:1024},(_,i)=>128+Math.round(amplitude*127*Math.sin(i*.19)));}
test('low, middle and high musical bands respond at 44.1/48/96 kHz',()=>{
 const v=harness();
 for(const rate of [44100,48000,96000])for(const hz of [60,250,1000,4000,12000]){
  const bars=v.sampleBands(samples(rate,hz),node(rate),48);
  assert.ok(Math.max(...bars)>.35,`${hz} Hz at ${rate}: dead spectrum`);
  if(hz===12000)assert.ok(Math.max(...bars.slice(40))>.35,'treble must light right side');
  assert.ok([...bars].every(x=>Number.isFinite(x)&&x>=0&&x<=1));
 }
});
test('digital silence stays dark, regardless of treble compensation',()=>{
 const v=harness();assert.ok([...v.sampleBands(new Uint8Array(512),node(48000),48)].every(x=>x===0));
 const m=v.makeMotion();v.setSamples(new Uint8Array(512),waveform());
 for(let i=0;i<120;i++)assert.equal(v.readMotion(m,node(48000),true,1/60),false);
 assert.equal(m.clock,0);assert.equal(m.hit,0);assert.equal(m.level,0);
});
test('kick attacks immediately, releases in silence, pause freezes motion',()=>{
 const v=harness(),m=v.makeMotion();v.setSamples(samples(48000,90),waveform(.6));
 assert.equal(v.readMotion(m,node(48000),true,1/60),true);
 assert.ok(m.bass>0&&m.hit>0&&m.level>0);
 const loud=m.level,lit=Math.max(...m.levels),clock=m.clock;
 v.setSamples(new Uint8Array(512),waveform());
 for(let i=0;i<120;i++)v.readMotion(m,node(48000),false,1/60);
 assert.ok(m.level<loud*.001);assert.ok(Math.max(...m.levels)<lit*.001);assert.ok(m.hit<.001);
 const frozen=m.clock;
 for(let i=0;i<120;i++)v.readMotion(m,node(48000),false,1/60);
 assert.ok(m.clock-frozen<.00001);assert.ok(m.clock>=clock);
});
test('integrated motion is consistent across frame rates',()=>{
 const v=harness();v.setSamples(samples(48000,400),waveform(.4));
 function run(fps){const m=v.makeMotion();for(let i=0;i<fps*3;i++)v.readMotion(m,node(48000),true,1/fps);return m;}
 const a=run(30),b=run(60);assert.ok(Math.abs(a.clock-b.clock)<.015);assert.ok(Math.abs(a.level-b.level)<.001);
});
function domHarness(){
 const callbacks=new Map();let sequence=0,now=1000;
 class Element{
  constructor(tag,cls=''){this.tagName=tag;this.className=cls;this.children=[];this.attrs={};this.style={};this.hidden=false;this.isConnected=true;this.classList={toggle(){},contains(){return false;}};}
  append(...items){this.children.push(...items);}
  appendChild(x){this.children.push(x);return x;}
  setAttribute(k,v){this.attrs[k]=String(v);}
  getAttribute(k){return this.attrs[k];}
  addEventListener(){} closest(){return null;}
  getContext(){return {};}
  getBoundingClientRect(){return {width:360,height:250};}
  requestFullscreen(){doc.fullscreenElement=this;return Promise.resolve();}
 }
 const storage=new Map(),doc={hidden:false,createElement:tag=>new Element(tag),fullscreenElement:null,exitFullscreen(){this.fullscreenElement=null;return Promise.resolve();}};
 const box={window:{matchMedia:false},document:doc,performance:{now:()=>now},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
  requestAnimationFrame:fn=>{callbacks.set(++sequence,fn);return sequence;},cancelAnimationFrame:id=>callbacks.delete(id),Uint8Array,Float32Array,Math,Number};
 vm.createContext(box);vm.runInContext(source,box);
 const host=new Element('div'),listeners=new Map();
 const media={paused:true,ended:false,
  addEventListener(e,fn){if(!listeners.has(e))listeners.set(e,new Set());listeners.get(e).add(fn);},
  removeEventListener(e,fn){listeners.get(e)?.delete(fn);},
  emit(e){for(const fn of listeners.get(e)||[])fn();}};
 let previous=0,next=0,toggle=0;
 const options={analyser:{frequencyBinCount:512,fftSize:1024},previous(){previous++;},next(){next++;},toggle(){toggle++;media.paused=!media.paused;media.emit(media.paused?'pause':'play');}};
 box.window.ZebraVisualizer.mount(host,media,options);
 function find(cls,root=host){if(root.className.split(' ').includes(cls))return root;for(const c of root.children){const found=find(cls,c);if(found)return found;}return null;}
 return {box,host,media,options,doc,find,listeners,counts:()=>({previous,next,toggle})};
}
test('transport buttons operate audio, not the effect selector; icon follows playback',()=>{
 const h=domHarness(),buttons=h.find('zviz-transport').children;
 buttons[0].onclick();buttons[1].onclick();buttons[2].onclick();
 assert.deepEqual(h.counts(),{previous:1,next:1,toggle:1});
 assert.equal(buttons[1].textContent,'Ⅱ');assert.equal(buttons[1].attrs['aria-label'],'Mettre en pause');
 h.media.paused=true;h.media.emit('pause');assert.equal(buttons[1].textContent,'▶');
});
test('scope zoom covers 0.5× to 8×, resets to original 1×, and hides for other effects',()=>{
 const h=domHarness(),zoom=h.find('zviz-zoom'),slider=h.find('zviz-zoom-range');
 assert.equal(zoom.hidden,true);
 h.find('zviz-controls').children[2].onclick();assert.equal(zoom.hidden,false);
 slider.value='100';slider.oninput();assert.equal(h.find('zviz-zoom-value').textContent,'8×');
 slider.value='0';slider.oninput();assert.equal(h.find('zviz-zoom-value').textContent,'0,5×');
 h.find('zviz-zoom-reset').onclick();assert.equal(slider.value,'25');assert.equal(h.find('zviz-zoom-value').textContent,'1×');
 h.find('zviz-controls').children[2].onclick();assert.equal(zoom.hidden,true);
});
test('fullscreen includes transport, and reopening does not leak playback listeners',async()=>{
 const h=domHarness();h.find('zviz-fullscreen').onclick();assert.equal(h.doc.fullscreenElement,h.find('zviz'));
 h.find('zviz-fullscreen').onclick();assert.equal(h.doc.fullscreenElement,null);
 h.box.window.ZebraVisualizer.mount(h.host,h.media,h.options);
 for(const event of ['play','pause','ended','emptied'])assert.equal(h.listeners.get(event).size,1);
});
