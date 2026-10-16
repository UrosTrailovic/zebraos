const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const helpers=source.slice(source.indexOf('function windowMaxWidth('),source.indexOf('function windowBox('));
function harness(capped=true,left=200){
 const events=new Map(),classes=new Set();
 const w={dataset:capped?{maxWidth:'960'}:{},style:{left:left+'px',top:'50px',width:'660px',height:'635px'},children:[],
 classList:{contains:x=>classes.has(x),add:x=>classes.add(x),remove:x=>classes.delete(x)},
 appendChild(x){this.children.push(x);},querySelector(){return null;},
 get offsetWidth(){return parseFloat(this.style.width);},get offsetHeight(){return parseFloat(this.style.height);}};
 const box={desktopWorkArea:()=>({width:1440,height:864}),window:{innerWidth:1440,
 addEventListener:(k,v)=>events.set(k,v),removeEventListener:k=>events.delete(k)},
 el:(tag,cls)=>({className:cls,setAttribute(){}}),opened:{amp:{w}},focus(){},Math,Number};
 vm.createContext(box);vm.runInContext(helpers,box);
 function drag(edge,dx){
  box.addResizeHandles(w);
  const handle=w.children.find(x=>x.className.split(' ').includes('resize-'+edge));
  handle.onpointerdown({button:0,clientX:0,clientY:0,stopPropagation(){},preventDefault(){}});
  events.get('pointermove')({clientX:dx,clientY:0});events.get('pointerup')();
 }
 return {w,box,drag};
}
test('AMP clamp stops at 960px and stays within smaller desktop work areas',()=>{
 const {w,box}=harness();w.style.width='1400px';box.clampWindow(w);assert.equal(w.style.width,'960px');
 assert.equal(box.windowMaxWidth(w,{width:800}),800);
});
test('right and left resize handles both respect the AMP cap and preserve their anchor',()=>{
 const right=harness();right.drag('e',3000);assert.equal(right.w.style.width,'960px');assert.equal(right.w.style.left,'200px');
 const left=harness(true,400);left.drag('w',-3000);assert.equal(left.w.style.width,'960px');
 assert.equal(parseFloat(left.w.style.left)+parseFloat(left.w.style.width),1060);
});
test('other applications retain the full available desktop width',()=>{
 const other=harness(false);other.drag('e',3000);assert.equal(other.w.style.width,'1240px');
 assert.equal(other.box.windowMaxWidth(other.w,{width:1440}),1440);
});
test('corner resizing obeys the same horizontal cap',()=>{
 for(const edge of ['ne','se']){const h=harness();h.drag(edge,3000);assert.equal(h.w.style.width,'960px');}
 for(const edge of ['nw','sw']){const h=harness(true,400);h.drag(edge,-3000);assert.equal(h.w.style.width,'960px');}
});
