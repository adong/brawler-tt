#!/usr/bin/env node
/* Double TTrouble: headless check. Loads the real engine (js/rules.js, js/stages.js, js/sim.js, js/brains.js) in a
   sandbox with no browser and lets a simple bot play every stage, in 1 and 2 players, easy and normal.

     node tools/check.js            every stage x 6 set-ups (1P Teddy/Tommy, 2P, with and without the companion)
     node tools/check.js --soak 20  plus 20 extra random seeds per stage
     node tools/check.js --prove    also proves the check can fail: an idle player must not clear a stage, and an
                                    enemy pushed off-screen must be caught

   Every step it checks: no NaN; nobody but a walking-in baddie is off-screen; nobody walks in for more than 6.5 s;
   everyone stays on the street; the screen never stays locked with nothing left to fight; the camera never stalls. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const soak = args.includes('--soak') ? parseInt(args[args.indexOf('--soak') + 1], 10) || 10 : 0;
const prove = args.includes('--prove');
const only = args.includes('--stage') ? parseInt(args[args.indexOf('--stage') + 1], 10) : null;
const verbose = args.includes('-v');

function load() {
  const sandbox = { console, Math, Set, Map, Object, Array, JSON, Infinity, NaN, isFinite };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of ['js/rules.js', 'js/stages.js', 'js/sim.js', 'js/brains.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
  }
  return sandbox;
}

const G = load();
const Sim = G.BrawlSim, Brains = G.BrawlBrains;
const LIMIT = 600; // seconds of game time per stage before we call it stuck

function run(cfg) {
  const W = Sim.create({ stage: cfg.stage, mode: cfg.mode, hero: cfg.hero, difficulty: cfg.diff, seed: cfg.seed, continues: Infinity });
  const mems = W.heroes.map(() => ({ opts: { call: cfg.call, callEvery: cfg.mode === '2p' ? 4 : 14, kid: cfg.kid } }));
  const problems = [];
  const fail = (msg) => { if (problems.length < 5) problems.push(`t=${W.t.toFixed(1)} ${msg}`); };
  let lockedEmpty = 0, travelT = 0, steps = 0, sabotaged = false, maxEnemies = 0, buddyVisits = 0, treats = 0;
  const seenBoss = { yes: false };
  while (W.t < LIMIT && W.phase !== 'done') {
    if (W.phase === 'continue') Sim.continueGame(W);
    const inputs = W.heroes.map((h, i) => (cfg.idle ? {} : Brains.bot(W, h, mems[i])));
    Sim.step(W, inputs);
    steps++;
    for (const e of W.events) {
      if (e.type === 'boss') seenBoss.yes = true;
      if (e.type === 'buddy') buddyVisits++;
      if (e.type === 'treat') treats++;
    }
    W.events.length = 0;
    if (cfg.sabotage && !sabotaged && W.t > 8 && W.enemies.length) {
      const e = W.enemies.find((o) => o.state !== 'enter');
      if (e) { sabotaged = true; e.state = 'idle'; e.x = W.cam.x + W.halfW + 5; e.ai.cool = 999; e.def = Object.assign({}, e.def, { speed: 0 }); e.vx = 0; }
    }
    // ---- invariants
    const L = Sim.viewL(W) - 0.02, R = Sim.viewR(W) + 0.02;
    maxEnemies = Math.max(maxEnemies, W.enemies.length);
    for (const e of W.enemies) {
      if (![e.x, e.y, e.z, e.hp].every(Number.isFinite)) fail(`NaN on ${e.type}`);
      if (e.state === 'enter') {
        if (W.t - e.born > 6.5) fail(`${e.type} still walking in after 6.5 s`);
      } else if (e.x < L || e.x > R) fail(`${e.type} off-screen at x=${e.x.toFixed(2)} (view ${L.toFixed(1)}..${R.toFixed(1)}) state=${e.state}`);
      if (e.z < W.zMin - 0.01 || e.z > W.zMax + 0.01) fail(`${e.type} off the street z=${e.z.toFixed(2)}`);
      if (e.y < -0.01 || e.y > 8) fail(`${e.type} y=${e.y.toFixed(2)}`);
    }
    for (const h of W.heroes) {
      if (![h.x, h.y, h.z, h.hp].every(Number.isFinite)) fail(`NaN on ${h.who}`);
      if (h.out || ['enter', 'celebrate', 'out'].includes(h.state)) continue;
      if (W.phase === 'play' && (h.x < L || h.x > R)) fail(`${h.who} off-screen x=${h.x.toFixed(2)} state=${h.state}`);
      if (h.z < W.zMin - 0.01 || h.z > W.zMax + 0.01) fail(`${h.who} off the street`);
    }
    for (const it of W.items) if (it.z < W.zMin - 0.01 || it.z > W.zMax + 0.01 || !Number.isFinite(it.x)) fail(`item ${it.kind} off the street`);
    if (W.phase === 'play' && W.secState === 'fight' && !W.enemies.length && !W.pending.length) lockedEmpty += Sim.DT; else lockedEmpty = 0;
    if (lockedEmpty > 5) { fail('screen locked with nothing to fight for 5 s'); lockedEmpty = -1e9; }
    if (W.phase === 'play' && W.secState === 'travel') travelT += Sim.DT; else travelT = 0;
    if (travelT > 40) { fail('camera stalled for 40 s on the way to the next stop'); travelT = -1e9; }
    if (problems.length >= 5) break;
  }
  return {
    cleared: W.phase === 'done', time: W.t, problems, stats: W.stats, boss: seenBoss.yes, maxEnemies, buddyVisits, treats,
    lives: W.heroes.map((h) => h.lives).join('/'),
  };
}

const SETUPS = [
  { name: '1P Teddy easy', mode: '1p', hero: 'teddy', diff: 'easy' },
  { name: '1P Tommy easy +buddy', mode: '1p', hero: 'tommy', diff: 'easy', call: true },
  { name: '1P Teddy normal', mode: '1p', hero: 'teddy', diff: 'normal' },
  { name: '1P Tommy normal +buddy', mode: '1p', hero: 'tommy', diff: 'normal', call: true },
  { name: '2P easy', mode: '2p', diff: 'easy' },
  { name: '2P normal +team-up', mode: '2p', diff: 'normal', call: true },
  { name: '1P Tommy easy, kid bot', mode: '1p', hero: 'tommy', diff: 'easy', kid: true },
  { name: '1P Teddy normal, kid bot', mode: '1p', hero: 'teddy', diff: 'normal', kid: true },
];

// ---------------------------------------------------------------- the moves, one at a time

function moveChecks() {
  const results = [];
  const ok = (name, cond, info = '') => results.push([name, !!cond, info]);
  const fresh = (o = {}) => {
    const W = Sim.create(Object.assign({ stage: 0, mode: '1p', hero: 'teddy', difficulty: 'normal', seed: 7 }, o));
    for (let i = 0; i < 90; i++) Sim.step(W, [{}]);
    W.pending = []; W.waveIdx = 99; W.secState = 'fight'; W.enemies = []; W.items = []; W.crates = [];
    const h = W.heroes[0];
    h.x = W.cam.x - 2; h.z = 0; h.state = 'idle'; h.face = 1;
    return W;
  };
  const foe = (W, type, dx, dz = 0) => {
    const e = Sim.spawnEnemy(W, type, 1);
    e.x = W.heroes[0].x + dx; e.z = W.heroes[0].z + dz; e.state = 'idle'; e.ai.cool = 999; e.face = -1;
    return e;
  };
  const run = (W, inp, n = 1) => { for (let i = 0; i < n; i++) Sim.step(W, W.heroes.map((_, k) => (typeof inp === 'function' ? inp(i, k) : k === 0 ? inp : {}))); };
  const count = (W, type) => W.events.filter((e) => e.type === type).length;

  // combo: jab, straight, hook; the third knocks down
  let W = fresh(), e = foe(W, 'zombie', 1.0);
  for (let k = 0; k < 3; k++) { run(W, { attack: true }); run(W, {}, 14); }
  run(W, {}, 30);
  ok('Teddy combo jab-straight-hook knocks down', ['down', 'lying', 'getup'].includes(e.state) && e.hp < e.maxHp, `state ${e.state}, hp ${e.hp}`);
  W = fresh({ hero: 'tommy' }); e = foe(W, 'zombie', 1.0);
  for (let k = 0; k < 3; k++) { run(W, { attack: true }); run(W, {}, 14); }
  run(W, {}, 30);
  const names = W.events.filter((x) => x.type === 'swing').map((x) => x.name);
  ok("Tommy's combo is poke, poke2, swing", names.join() === 'poke,poke2,swing', names.join());

  // walk into a baddie: grab; bop, bop, toss; the tossed one bowls over another
  W = fresh(); e = foe(W, 'zombie', 0.8); const other = foe(W, 'robot', 4.0);
  run(W, { mx: 1 }, 20);
  const grabbed = W.heroes[0].state === 'grab';
  for (let k = 0; k < 3; k++) { run(W, { attack: true }); run(W, {}, 16); }
  run(W, {}, 60);
  ok('walk in = grab, then bop bop toss', grabbed && W.events.some((x) => x.type === 'toss'), `grab ${grabbed}`);
  ok('a tossed baddie bowls over another (STRIKE!)', W.events.some((x) => x.type === 'hit' && x.word === 'STRIKE!') && other.hp < other.maxHp);

  // jump kick knocks down
  W = fresh(); e = foe(W, 'robot', 1.6);
  run(W, { jump: true, mx: 1 }); run(W, { mx: 1 }, 8); run(W, { attack: true, mx: 1 }); run(W, { mx: 1 }, 40);
  ok('jump kick knocks down', W.events.some((x) => x.type === 'knock' && x.kind === 'enemy'), `enemy ${e.state}`);

  // dash (double tap) + attack = running pillow tackle
  W = fresh(); e = foe(W, 'zombie', 3.0);
  run(W, { mx: 1, dash: 1 }); run(W, { mx: 1 }, 10); run(W, { mx: 1, attack: true }); run(W, { mx: 1 }, 30);
  ok('dash + attack = tackle', W.events.some((x) => x.type === 'swing' && x.name === 'dashHit') && e.hp < e.maxHp, `enemy ${e.state}`);

  // weapons: walk over to pick up, swing, and it goes POOF after its uses
  W = fresh(); Sim.spawnItem(W, 'bat', W.heroes[0].x + 0.5, 0, false);
  run(W, { mx: 1 }, 20);
  const got = W.heroes[0].weapon && W.heroes[0].weapon.kind;
  const uses = W.heroes[0].weapon ? W.heroes[0].weapon.uses : 0;
  let broke = false;
  for (let k = 0; k < uses + 2 && !broke; k++) {
    foe(W, 'zombie', 1.2).hp = 999;
    run(W, { attack: true }); run(W, {}, 40);
    W.enemies = [];
    broke = count(W, 'break') > 0;
  }
  ok('pick up a foam bat, it breaks after its uses', got === 'bat' && broke && !W.heroes[0].weapon, `got ${got}, uses ${uses}, broke ${broke}`);

  // food heals
  W = fresh(); W.heroes[0].hp = 30; Sim.spawnItem(W, 'melon', W.heroes[0].x + 0.4, 0, false);
  run(W, { mx: 1 }, 15);
  ok('watermelon heals', W.heroes[0].hp === 70, `hp ${W.heroes[0].hp}`);

  // special costs a little health, never the last point
  W = fresh(); W.heroes[0].hp = 3; foe(W, 'zombie', 1.5);
  run(W, { special: true }); run(W, {}, 70);
  ok('special costs health but never the last point', W.heroes[0].hp === 1 && W.events.some((x) => x.type === 'dunk'), `hp ${W.heroes[0].hp}`);
  W = fresh({ hero: 'tommy' }); const ring = [foe(W, 'zombie', 2.5), foe(W, 'gremlin', -2.5), foe(W, 'robot', 0.5, -1.4)];
  run(W, { special: true }); run(W, {}, 60);
  ok("Tommy's peace wave knocks down all around him", ring.every((x) => x.state !== 'idle' && x.hp < x.maxHp), ring.map((x) => x.state).join());

  // the companion: arrives, treat, blocks one hit, leaves after ~10 s
  W = fresh(); W.heroes[0].hp = 50;
  run(W, { call: true }); run(W, {}, 200);
  const healed = W.heroes[0].hp > 50, shield = W.heroes[0].shield;
  e = foe(W, 'robot', 1.0); e.state = 'windup'; e.st = 9; e.ai.cool = 0;
  const hp0 = W.heroes[0].hp;
  run(W, {}, 30);
  ok('companion: treat heals, one hit is blocked', healed && shield && W.heroes[0].hp === hp0 && count(W, 'saved') === 1, `healed ${healed}, shield ${shield}, hp ${hp0}->${W.heroes[0].hp}`);
  W.enemies = [];
  run(W, {}, 60 * 11);
  ok('companion leaves after his visit, shield goes with him', !W.buddy && !W.heroes[0].shield);
  run(W, { call: true }); run(W, {}, 2); run(W, { call: true }); run(W, {}, 300);
  ok('calling again gives another treat', W.stats.treats >= 3, `treats ${W.stats.treats}`);

  // team-up (2P): every regular baddie on screen is bonked
  W = fresh({ mode: '2p' });
  W.heroes[1].x = W.heroes[0].x; W.heroes[1].state = 'idle';
  const gang = [foe(W, 'zombie', 3), foe(W, 'robot', 5), foe(W, 'gremlin', -1)];
  run(W, (i, k) => (i === 0 && k === 1 ? { call: true } : {}), 1); run(W, {}, 200);
  ok('2P team-up bonks the whole screen, then cools down', gang.every((x) => x.ko || x.gone) && W.teamCd > 0, gang.map((x) => x.state).join());

  // lives, then CONTINUE?
  W = fresh();
  for (let k = 0; k < 3; k++) { W.heroes[0].inv = 0; W.heroes[0].state = 'idle'; Sim.hurtHero(W, W.heroes[0], 999, { dir: -1 }); run(W, {}, 200); }
  const cont = W.phase === 'continue';
  Sim.continueGame(W); run(W, {}, 120);
  ok('3 lives, then CONTINUE? brings you back', cont && W.phase === 'play' && W.heroes[0].lives === 3 && W.continues === 1, `phase ${W.phase}, continues ${W.continues}`);
  return results;
}

const stages = G.BRAWL_STAGES;
let bad = 0, total = 0;
console.log('Moves:');
for (const [name, pass, info] of moveChecks()) {
  total++;
  if (!pass) bad++;
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${name}${!pass && info ? '   (' + info + ')' : ''}`);
}
console.log('');
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('stage', 16) + pad('set-up', 26) + pad('result', 9) + pad('time', 8) + pad('KOs', 6) + pad('deaths', 8) + pad('cont', 6) + 'notes');
for (let si = 0; si < stages.length; si++) {
  if (only != null && si !== only) continue;
  for (const s of SETUPS) {
    const seeds = [1 + si * 101];
    for (let k = 0; k < soak; k++) seeds.push(1000 + si * 7919 + k * 31);
    for (const seed of seeds) {
      const r = run(Object.assign({ stage: si, seed }, s));
      total++;
      const ok = r.cleared && !r.problems.length && r.boss;
      if (!ok) bad++;
      const notes = [];
      if (s.call && s.mode === '1p') notes.push(`buddy x${r.buddyVisits}, treats ${r.treats}, saves ${r.stats.saves}`);
      if (s.call && s.mode === '2p') notes.push(`team-ups ${r.stats.teamups}`);
      notes.push(`specials ${r.stats.specials}, ouch ${Math.round(r.stats.ouch || 0)}`);
      if (seed === seeds[0] || !ok || verbose) {
        console.log(pad(stages[si].id + (seed !== seeds[0] ? ` #${seed}` : ''), 16) + pad(s.name, 26) + pad(ok ? 'CLEAR' : 'FAIL', 9) +
          pad(r.time.toFixed(0) + 's', 8) + pad(r.stats.kos, 6) + pad(r.stats.deaths, 8) + pad(r.stats.continues, 6) + notes.join(', '));
      }
      for (const p of r.problems) console.log('    ! ' + p);
      if (!r.cleared && !r.problems.length) console.log('    ! did not clear within ' + LIMIT + ' s');
    }
  }
}
console.log(`\n${total - bad}/${total} runs cleared with no problems.`);

if (prove) {
  console.log('\nProving the check can fail:');
  const idle = run({ stage: 0, mode: '1p', hero: 'teddy', diff: 'normal', seed: 5, idle: true });
  const idleOk = !idle.cleared;
  console.log(`  idle player on stage 1: ${idle.cleared ? 'CLEARED (bad: the check would pass anything)' : 'did not clear (good)'}, deaths ${idle.stats.deaths}`);
  const sab = run({ stage: 0, mode: '1p', hero: 'teddy', diff: 'easy', seed: 5, sabotage: true });
  const sabOk = sab.problems.some((p) => p.includes('off-screen'));
  console.log(`  enemy pushed off-screen: ${sabOk ? 'caught (good): ' + sab.problems[0] : 'NOT caught (bad)'}`);
  if (!idleOk || !sabOk) bad++;
}
process.exit(bad ? 1 : 0);
