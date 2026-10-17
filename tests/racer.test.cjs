const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const context={window:{},Math};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../racer.js'),'utf8'),context);
const {createGame,curveAt,finish,maxSpeed}=context.window.ZebraRacer;
test('race starts cleanly and acceleration advances the car',()=>{
 const g=createGame(()=>.5);assert.equal(g.state,'title');g.start();g.controls.gas=true;
 for(let i=0;i<120;i++)g.tick(1/60);
 assert.equal(g.state,'running');assert.ok(g.speed>100);assert.ok(g.distance>20);
});
test('braking, steering and off-road drag stay bounded',()=>{
 const g=createGame(()=>.5);g.start();g.controls.gas=true;for(let i=0;i<240;i++)g.tick(1/60);
 g.controls.gas=false;g.controls.brake=true;const before=g.speed;for(let i=0;i<30;i++)g.tick(1/60);assert.ok(g.speed<before);
 g.controls.brake=false;g.controls.right=true;for(let i=0;i<180;i++)g.tick(1/60);assert.ok(g.x<=1.42&&g.x>1);assert.ok(g.speed<=maxSpeed);
});
test('nitro has a finite tank and raises the normal speed ceiling',()=>{
 const g=createGame(()=>.5);g.start();g.speed=maxSpeed;g.controls.gas=true;g.controls.nitro=true;for(let i=0;i<60;i++)g.tick(1/60);
 assert.ok(g.speed>maxSpeed);assert.ok(g.nitro<100);assert.ok(g.speed<=365);
});
test('traffic collision damages and slows the player immediately',()=>{
 const g=createGame(()=>.5);g.start();g.speed=240;g.x=0;g.traffic=[{distance:5,lane:0,speed:0,type:'police',hit:false,color:'#fff'}];g.tick(.016);
 assert.equal(g.integrity,76);assert.ok(g.speed<150);assert.ok(g.shake>0);assert.equal(g.traffic[0].hit,true);
});
test('finish and destroyed car reach terminal states',()=>{
 const win=createGame(()=>.5);win.start();win.speed=200;win.distance=finish-.2;win.tick(.05);assert.equal(win.state,'won');
 const lose=createGame(()=>.5);lose.start();lose.integrity=10;lose.speed=200;lose.traffic=[{distance:5,lane:0,speed:0,type:'police',hit:false,color:'#fff'}];lose.tick(.016);assert.equal(lose.state,'over');
});
test('track curves remain continuous enough for an arcade road',()=>{
 for(let d=0;d<10000;d+=20)assert.ok(Math.abs(curveAt(d+1)-curveAt(d))<.02);
});
