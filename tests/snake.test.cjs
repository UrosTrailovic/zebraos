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
 const wall=createGame();wall.toggle();for(let i=0;i<30;i++)wall.tick();assert.equal(wall.state,'over');
 const body=createGame();body.snake=[{x:3,y:3},{x:4,y:3},{x:4,y:4},{x:3,y:4},{x:2,y:4}];body.toggle();body.tick();assert.equal(body.state,'over');
 const tail=createGame();tail.snake=[{x:3,y:3},{x:3,y:4},{x:4,y:4},{x:4,y:3}];tail.toggle();tail.tick();assert.equal(tail.state,'running');
});
test('filling the board wins without looping for food',()=>{
 const g=createGame();g.snake=[{x:0,y:0}];for(let y=0;y<20;y++)for(let x=0;x<24;x++)if((x!==0||y!==0)&&(x!==1||y!==0))g.snake.push({x,y});
 g.food={x:1,y:0};g.toggle();g.tick();assert.equal(g.state,'won');assert.equal(g.snake.length,480);assert.equal(g.food,null);
});
test('all four painted grounds leave the same classic game and traversable scenery',()=>{
 const {draw,themes}=context.window.ZebraSnake;
 const signatures=new Set();
 for(const theme of themes){
  const g=createGame(()=>0);g.snake=[{x:0,y:1}];g.direction='right';g.food={x:20,y:19};g.toggle();
  const before=JSON.stringify(g),ops=[];
  const ctx={fillStyle:'',strokeStyle:'',fillRect(...args){ops.push([this.fillStyle,...args]);},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
  draw(ctx,g,theme.id);assert.equal(JSON.stringify(g),before,'painting must not alter the run');signatures.add(JSON.stringify(ops));
  // The tree at (21,22) covers this cell in Bosquet; it must remain playable.
  g.tick();assert.equal(g.snake[0].x,1);assert.equal(g.state,'running');
 }
 assert.equal(themes.length,4);assert.equal(signatures.size,4);
});
