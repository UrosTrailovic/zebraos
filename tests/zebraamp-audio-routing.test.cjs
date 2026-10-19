const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadAmp(ContextClass) {
  class FakeAudio {
    constructor() {
      this.volume = 1; this.muted = false; this.defaultMuted = false;
      this.paused = true; this.currentTime = 0; this.readyState = 4;
      this.playbackRate = 1; this.src = "blob:test"; this.listeners = {};
    }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    setAttribute() {}
    removeAttribute(name) { if (name === "src") this.src = ""; }
    pause() { this.paused = true; }
    load() {}
    play() { this.paused = false; return Promise.resolve(); }
    remove() {}
  }
  const window = { AudioContext: ContextClass };
  const env = {
    window, Audio: FakeAudio, console, Promise, Math, Date,
    localStorage: { getItem() { return null; }, setItem() {} },
    setTimeout, clearTimeout, URL: { revokeObjectURL() {} }
  };
  vm.runInNewContext(fs.readFileSync("zebraamp.js", "utf8"), env);
  return window.ZebraAMP;
}

function node() { return { connect() {}, disconnect() {} }; }
function runningNodes(context) {
  context.createMediaElementSource = function() {
    assert.equal(this.state, "running", "le média ne doit être détourné qu'après activation du contexte");
    this.mediaSourceCalls++;
    return node();
  };
  context.createBiquadFilter = () => ({ ...node(), frequency: { value: 0 }, gain: { value: 0 }, Q: { value: 0 } });
  context.createAnalyser = () => ({ ...node(), fftSize: 0, smoothingTimeConstant: 0, frequencyBinCount: 512 });
}

test("le son natif démarre avant que l'analyseur ne détourne le média", async () => {
  class Context {
    constructor() { this.state = "suspended"; this.destination = {}; this.mediaSourceCalls = 0; runningNodes(this); Context.last = this; }
    resume() { this.state = "running"; return Promise.resolve(); }
  }
  const amp = loadAmp(Context);
  amp.play();
  assert.equal(amp.media.paused, false, "Play doit lancer le média immédiatement");
  await Promise.resolve(); await Promise.resolve();
  assert.equal(Context.last.mediaSourceCalls, 1);
  assert.ok(amp.analyser(), "le spectre doit recevoir un analyseur réel");
  assert.equal(amp.media.muted, false);
  assert.ok(amp.media.volume > 0);
});

test("un contexte refusé ne coupe jamais la lecture native", async () => {
  class BlockedContext {
    constructor() { this.state = "suspended"; this.destination = {}; this.mediaSourceCalls = 0; runningNodes(this); BlockedContext.last = this; }
    resume() { return Promise.resolve(); }
  }
  const amp = loadAmp(BlockedContext);
  amp.play();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(amp.media.paused, false);
  assert.equal(BlockedContext.last.mediaSourceCalls, 0, "aucun MediaElementSource silencieux ne doit être créé");
  assert.equal(amp.analyser(), null);
  assert.equal(amp.debug().nativeFallback, false);
});
