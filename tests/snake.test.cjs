const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const context={window:{},Math};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../snake.js'),'utf8'),context);
const {createGame}=context.window.ZebraSnake;
test('classic start, pause, reset and constant one-cell movement',()=>{
 const g=createGame(()=>0);assert.equal(g.state,'ready');g.tick();assert.equal(g.snake[0].x,9);
 g.toggle();g.tick();assert.equal(g.snake[0].x,10);g.toggle();g.tick();assert.equal(g.snake[0].x,10);
 g.reset();assert.equal(g.score,0);assert.equal(g.snake.length,4);assert.equal(g.state,'ready');
});
test('two fast turns execute on separate ticks; reversals are rejected',()=>{
 const g=createGame();assert.equal(g.turn('left'),false);g.turn('up');g.turn('left');assert.equal(g.turn('down'),false);
 g.tick();assert.equal(g.snake[0].y,9);assert.equal(g.snake[0].x,9);g.tick();assert.equal(g.snake[0].x,8);
});
test('food grows the snake and respawns in a free cell',()=>{
 const g=createGame(()=>0);g.food={x:10,y:10};g.toggle();g.tick();assert.equal(g.score,10);assert.equal(g.snake.length,5);
 assert.ok(!g.snake.some(p=>p.x===g.food.x&&p.y===g.food.y));
});
test('walls and body end a run, but a vacating tail remains legal',()=>{
 const wall=createGame();wall.toggle();for(let i=0;i<30;i++)wall.tick();assert.equal(wall.state,'hurt');wall.finishCrash();assert.equal(wall.state,'over');
 const body=createGame();body.snake=[{x:3,y:3},{x:4,y:3},{x:4,y:4},{x:3,y:4},{x:2,y:4}];body.toggle();body.tick();assert.equal(body.state,'hurt');body.finishCrash();assert.equal(body.state,'over');
 const tail=createGame();tail.snake=[{x:3,y:3},{x:3,y:4},{x:4,y:4},{x:4,y:3}];tail.toggle();tail.tick();assert.equal(tail.state,'running');
});
test('filling the board wins without looping for food',()=>{
 const g=createGame();g.snake=[{x:0,y:0}];for(let y=0;y<24;y++)for(let x=0;x<24;x++)if((x!==0||y!==0)&&(x!==1||y!==0))g.snake.push({x,y});
 g.food={x:1,y:0};g.toggle();g.tick();assert.equal(g.state,'won');assert.equal(g.snake.length,576);assert.equal(g.food,null);
});
test('painted trees and bushes leave the classic game unchanged and remain traversable',()=>{
 const {draw}=context.window.ZebraSnake;
 const g=createGame(()=>0);g.snake=[{x:0,y:1}];g.direction='right';g.food={x:20,y:19};g.toggle();
 const before=JSON.stringify(g);
 const ctx={fillStyle:'',strokeStyle:'',fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
 draw(ctx,g);assert.equal(JSON.stringify(g),before,'painting must not alter the run');
 // The tree at (21,22) covers this cell; it must remain playable.
 g.tick();assert.equal(g.snake[0].x,1);assert.equal(g.state,'running');
});
function soundHarness(){
 const contexts=[],nodes=[],timers=new Set(),tracks=[];let muted=false;
 class Track{constructor(src){this.src=src;this.paused=false;tracks.push(this);}play(){return Promise.resolve();}pause(){this.paused=true;}removeAttribute(){}load(){}}
 const storage={getItem:()=>muted?'1':'0'};
 class Audio{
  constructor(){this.currentTime=10;this.state='suspended';this.destination={};this.closed=false;contexts.push(this);}
  resume(){this.state='running';return Promise.resolve();}
  close(){this.closed=true;return Promise.resolve();}
  createOscillator(){const n={stops:[],frequency:{setValueAtTime(v){n.frequencyValue=v;},exponentialRampToValueAtTime(){}},connect(){},disconnect(){n.disconnected=true;},start(t){n.startAt=t;},stop(t){n.stops.push(t);}};nodes.push(n);return n;}
  createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
 }
 const env={window:{AudioContext:Audio,Audio:Track},setInterval(fn){timers.add(fn);return fn;},clearInterval(fn){timers.delete(fn);},document:{hidden:false},localStorage:storage,Math};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../snake.js'),'utf8'),env);
 return {sounds:env.window.ZebraSnake.createSounds(),contexts,nodes,timers,tracks,document:env.document,mute:v=>{muted=v;}};
}
test('game-over sound is gesture-gated and plays two short notes then a longer third',()=>{
 const h=soundHarness();h.sounds.play('over');assert.equal(h.contexts.length,0);
 h.sounds.unlock();h.sounds.play('over');assert.equal(h.contexts.length,1);assert.equal(h.nodes.length,3);
 assert.deepEqual(h.nodes.map(n=>n.frequencyValue),[392,311,196]);assert.deepEqual(h.nodes.map(n=>n.startAt),[10,10.2,10.4]);
 const lengths=h.nodes.map(n=>n.stops[0]-n.startAt);assert.ok(lengths[2]>lengths[0]*3);h.sounds.dispose();
});
test('game sounds obey system mute and hidden tabs, and dispose releases audio',()=>{
 const h=soundHarness();h.mute(true);h.sounds.unlock();h.sounds.play('start');assert.equal(h.contexts.length,0);
 h.mute(false);h.sounds.unlock();h.sounds.play('eat');assert.equal(h.nodes.length,2);
 h.mute(true);h.sounds.play('turn');assert.equal(h.nodes.length,2);assert.ok(h.nodes.every(n=>n.stops.length===2));
 h.mute(false);h.document.hidden=true;h.sounds.play('start');assert.equal(h.nodes.length,2);
 h.sounds.dispose();assert.equal(h.contexts[0].closed,true);h.document.hidden=false;h.sounds.unlock();h.sounds.play('start');assert.equal(h.nodes.length,2);
});
test('restart cancels the unfinished game-over fanfare before new sounds',()=>{
 const h=soundHarness();h.sounds.unlock();h.sounds.play('over');h.sounds.stop();
 assert.ok(h.nodes.every(n=>n.stops.length===2&&n.disconnected));h.sounds.play('start');assert.equal(h.nodes.length,5);h.sounds.dispose();
});

test('impact freezes the run and ignores controls until the reveal',()=>{
 const g=createGame();g.snake=[{x:23,y:10},{x:22,y:10}];g.toggle();g.tick();
 assert.equal(g.state,'hurt');assert.deepEqual(JSON.parse(JSON.stringify(g.impact)),{x:23,y:10});
 const snapshot=JSON.stringify(g.snake);g.tick();g.toggle();assert.equal(g.turn('up'),false);
 assert.equal(g.state,'hurt');assert.equal(JSON.stringify(g.snake),snapshot);
 g.finishCrash();assert.equal(g.state,'over');g.toggle();assert.equal(g.state,'running');assert.equal(g.impact,null);
});
test('fallback lose cue lasts three seconds, ambience stops on impact and disposal',()=>{
 const h=soundHarness();h.sounds.unlock();h.sounds.setMode('running');assert.equal(h.timers.size,1);
 h.sounds.setMode('hurt');assert.equal(h.timers.size,0);
 const lose=h.nodes.slice(-3);assert.deepEqual(lose.map(n=>n.frequencyValue),[392,311,196]);
 assert.ok(Math.abs(lose[2].stops[0]-13)<.03);
 h.sounds.setMode('running');assert.equal(h.timers.size,1);h.sounds.dispose();assert.equal(h.timers.size,0);
});
test('custom music loops and custom lose starts at impact without a competing synth melody',()=>{
 const h=soundHarness();h.sounds.configure({music:'/music.ogg',lose:'/lose.ogg'});h.sounds.unlock();h.sounds.setMode('running');
 assert.equal(h.tracks[0].src,'/music.ogg');assert.equal(h.tracks[0].loop,true);assert.equal(h.timers.size,0);
 h.sounds.setMode('hurt');assert.equal(h.tracks[0].paused,true);assert.equal(h.tracks[1].src,'/lose.ogg');assert.equal(h.tracks[1].loop,false);
 assert.equal(h.nodes.length,3,'only impact oscillators accompany custom lose');h.sounds.stop();assert.equal(h.tracks[1].paused,true);
});

const {createDuel,LEVEL_MS}=context.window.ZebraSnake;
test('hitting a wall or the other serpent kills immediately without a stuck state',()=>{
 const wall=createDuel({players:2,level:2});wall.players[0].snake=[{x:23,y:5},{x:22,y:5}];wall.players[1].snake=[{x:10,y:15},{x:11,y:15}];wall.toggle();wall.tick();
 assert.equal(wall.state,'hurt');assert.equal(wall.winner,2);assert.equal(wall.players[0].lost,true);
 const enemy=createDuel({players:2,level:1});enemy.players[0].snake=[{x:10,y:10},{x:9,y:10}];enemy.players[1].snake=[{x:11,y:10},{x:12,y:10}];enemy.toggle();enemy.tick();
 assert.equal(enemy.state,'hurt');assert.equal(enemy.winner,0,'a face-to-face hit is an immediate draw');
});
test('turning into the opponent body is an immediate loss',()=>{
 const g=createDuel({players:2,level:1});g.players[0].snake=[{x:5,y:6},{x:4,y:6}];g.players[1].snake=[{x:6,y:5},{x:5,y:5},{x:5,y:4},{x:6,y:4}];g.players[1].direction='up';g.toggle();g.turn('up',0);g.tick();
 assert.equal(g.state,'hurt');assert.equal(g.winner,2);assert.equal(g.players[0].lost,true);assert.equal(g.players[0].snake[0].x,5);assert.equal(g.players[0].snake[0].y,6);
 g.finishCrash();assert.equal(g.state,'over');
});
test('simultaneous head-on collision is a draw and never overlaps heads',()=>{
 const g=createDuel({players:2,level:1});g.players[0].snake=[{x:10,y:10}];g.players[1].snake=[{x:12,y:10}];g.toggle();g.tick();
 assert.equal(g.winner,0);assert.equal(g.state,'hurt');assert.equal(g.players[0].snake[0].x,10);assert.equal(g.players[1].snake[0].x,12);
});
test('three levels, separate queues, safe food and AI movement',()=>{
 assert.deepEqual(Array.from(LEVEL_MS),[180,135,95]);
 for(let level=1;level<=3;level++){
  const g=createDuel({players:1,level},()=>.5);g.toggle();for(let i=0;i<100;i++){g.tick();if(g.state!=='running')break;}
  assert.ok(g.players.every(p=>p.snake.every(q=>q.x>=0&&q.x<24&&q.y>=0&&q.y<24)));
  if(g.food)assert.ok(!g.players.some(p=>p.snake.some(q=>q.x===g.food.x&&q.y===g.food.y)));
 }
 const g=createDuel({players:2});g.toggle();assert.equal(g.turn('up',0),true);assert.equal(g.turn('down',1),true);g.tick();
 assert.equal(g.players[0].snake[0].y,5);assert.equal(g.players[1].snake[0].y,14);
});
