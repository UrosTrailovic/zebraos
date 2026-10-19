const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const game=fs.readFileSync(path.join(root,"tetris.js"),"utf8");
const artwork=fs.readFileSync(path.join(root,"tetris-artwork.js"),"utf8");
const css=fs.readFileSync(path.join(root,"style.css"),"utf8");

test("Tetris opens on a dedicated title screen instead of PAUSE",()=>{
  assert.match(game,/started=false/);
  assert.match(game,/showTitleScreen\(\);/);
  assert.match(game,/overlay\.dataset\.state=over\?"gameover":titleScreen\?"intro"/);
  assert.match(game,/titleScreen\?"PRÊT"/);
  assert.doesNotMatch(game,/reset\(\);paused=true;updateStatus\(\);render\(\);/);
});

test("the title screen starts from click or any mapped game key",()=>{
  assert.match(game,/stage\.addEventListener\("click",playFromTitle\)/);
  assert.match(game,/pressed==="enter"\|\|action\[pressed\]/);
  assert.match(game,/"PRESS BUTTON TO PLAY"/);
  assert.match(game,/requestAnimationFrame\(animateTitleScreen\)/);
  assert.match(game,/drawIntroGame/);
});

test("MENU returns to the title and game controls can start again",()=>{
  assert.match(game,/if\(started\|\|over\)showTitleScreen\(\)/);
  assert.match(game,/if\(!started&&!over\)playFromTitle\(\);else action\(\)/);
  assert.match(game,/pressed==="enter"\|\|action\[pressed\]/);
});

test("the supplied game song starts with gameplay, loops and stops at the title",()=>{
  assert.match(game,/new Audio\("assets\/games\/TETRISv1song\.mp3\?v=1"\)/);
  assert.match(game,/gameMusic\.loop=true/);
  assert.match(game,/gameMusic\.volume=\.42/);
  assert.match(game,/if\(!started\|\|paused\|\|over\|\|musicMuted\(\)\)/);
  assert.match(game,/function showTitleScreen\(\)\{\n  stopGameMusic\(true\)/);
});

test("the music toggle persists its state and controls playback",()=>{
  assert.match(game,/zebra\.tetris\.music/);
  assert.match(game,/MUSIC ON/);
  assert.match(game,/MUSIC OFF/);
  assert.match(game,/musicEnabled=!musicEnabled/);
  assert.match(game,/updateMusicButton\(\);syncGameMusic\(\)/);
  assert.match(game,/aria-pressed/);
});

test("the authentic Zebra Tetris logo is reused inside the intro",()=>{
  assert.match(artwork,/state==="intro"\?"logo":"paused"/);
  assert.match(css,/\.zg-overlay\[data-state="intro"\]/);
  assert.match(css,/@keyframes zt-press-blink/);
});
