/* Double TTrouble: the engine. Plain state, stepped at a fixed 60 steps a second, with no Three.js and no DOM, so
   the same code runs the browser game and the headless check (node tools/check.js).
   The renderer (js/game.js) only reads this state and the `events` list it fills.

   Everyone on the street is a "fighter": the brothers (kind 'hero'), the companion (kind 'buddy') and the gang
   (kind 'enemy'). Each one is a little state machine (idle, walk, run, attack, jump, grab, held, hurt, down,
   lying, getup, dizzy, flag...). The enemies' and the companion's brains are in js/brains.js. */
(function () {
  'use strict';

  const DT = 1 / 60;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const ev = (W, type, o) => W.events.push(Object.assign({ type, t: W.t }, o));
  const brains = () => window.BrawlBrains;

  // ---------------------------------------------------------------- the world

  // opts: stage (0-5), mode ('1p' | '2p' | 'demo'), hero ('teddy' | 'tommy', 1 player), difficulty ('easy' |
  // 'normal'), seed, halfW (half the visible width), lives / continues (overrides, for tests).
  function create(opts = {}) {
    const R = window.BRAWL_RULES;
    const stages = window.BRAWL_STAGES;
    const si = clamp(opts.stage | 0, 0, stages.length - 1);
    const S = stages[si];
    const diff = Object.assign({}, R.DIFF[opts.difficulty] || R.DIFF.normal);
    if (opts.lives) diff.lives = opts.lives;
    const halfW = opts.halfW || R.WORLD.VIEW_HALF;
    const W = {
      R, S, si, diff, difficulty: R.DIFF[opts.difficulty] ? opts.difficulty : 'normal', mode: opts.mode || '1p',
      t: 0, halfW, zMin: S.zMin != null ? S.zMin : R.WORLD.Z_MIN, zMax: S.zMax != null ? S.zMax : R.WORLD.Z_MAX,
      rand: mulberry32(opts.seed != null ? opts.seed : (Math.random() * 1e9) | 0),
      heroes: [], enemies: [], items: [], shots: [], crates: [], events: [],
      cam: { x: halfW }, lockX: halfW, sec: 0, secState: 'travel', go: false, goFrom: 0,
      waveQ: [], waveIdx: 0, waveT: 0, pending: [],
      phase: 'intro', phaseT: 0, boss: null, bossDown: false,
      buddy: null, buddyT: 0, treatN: 0, teamCd: 0,
      continues: opts.continues != null ? opts.continues : diff.continues,
      nextId: 1,
      stats: { kos: 0, hits: 0, specials: 0, treats: 0, saves: 0, deaths: 0, continues: 0, teamups: 0, calls: 0, time: 0 },
    };
    const who = W.mode === '2p' || W.mode === 'demo' ? ['teddy', 'tommy'] : [opts.hero === 'tommy' ? 'tommy' : 'teddy'];
    who.forEach((w, i) => W.heroes.push(makeHero(W, w, i)));
    // items and crates are placed now, so you can see them as you walk up
    S.sections.forEach((sec) => {
      const cx = secX(W, sec);
      (sec.items || []).forEach((it) => spawnItem(W, it.kind, cx + it.x, it.z != null ? it.z : 0, false));
      (sec.crates || []).forEach((c) => W.crates.push({ id: W.nextId++, x: cx + c.x, z: clamp(c.z != null ? c.z : -2.2, W.zMin, W.zMax), drop: c.drop || 'cookie', look: c.look || null }));
    });
    return W;
  }

  function makeHero(W, who, slot) {
    return {
      id: W.nextId++, kind: 'hero', who, slot, def: W.R.HEROES[who],
      x: W.cam.x - W.halfW - 0.8 - slot * 1.1, y: 0, z: W.mode === '1p' ? -0.4 : slot ? 0.3 : -1.1,
      vx: 0, vy: 0, vz: 0, face: 1, r: 0.4, scale: 1,
      hp: W.diff.heroHp, maxHp: W.diff.heroHp, lives: W.diff.lives, score: 0,
      state: 'enter', st: 0, move: null, combo: 0, comboT: 9, queued: false,
      weapon: null, grab: null, bops: 0, bopT: -1, contact: 0,
      inv: 0, freeze: 0, flash: 0, shield: false, out: false, ko: false, stun: 0,
    };
  }

  // Where a section stops the screen (the middle of the screen, in metres along the street).
  function secX(W, sec) {
    const lo = W.halfW, hi = W.S.length - W.halfW;
    if (sec.at === 'start') return lo;
    if (sec.at === 'end') return hi;
    return clamp(sec.at, lo, hi);
  }

  const viewL = (W) => W.cam.x - W.halfW + W.R.WORLD.EDGE;
  const viewR = (W) => W.cam.x + W.halfW - W.R.WORLD.EDGE;
  const activeHero = (h) => !h.out && h.state !== 'out';
  const standing = (h) => activeHero(h) && !h.ko && !['down', 'lying', 'dizzy', 'drop', 'enter'].includes(h.state);

  // ---------------------------------------------------------------- the main step

  // inputs: one per hero: { mx, mz (-1..1), attack, jump, special, call (presses this step), dash (±1 on a double tap) }
  function step(W, inputs = []) {
    W.t += DT;
    W.phaseT += DT;
    if (W.phase === 'play' || W.phase === 'team') W.stats.time += DT;
    W.teamCd = Math.max(0, W.teamCd - DT);
    const noInput = {};

    if (W.phase === 'intro' && W.phaseT > 1.3) setPhase(W, 'play');
    if (W.phase === 'team') return stepTeam(W, inputs);

    // calling the brother (1P) or the team-up (2P)
    for (let i = 0; i < W.heroes.length; i++) if (inputs[i] && inputs[i].call) callBrother(W, i);

    W.heroes.forEach((h, i) => updateHero(W, h, W.phase === 'play' ? inputs[i] || noInput : noInput));
    if (W.buddy) updateBuddy(W, W.buddy);
    if (W.phase === 'play' || W.phase === 'clear') {
      brains().tokens(W);
      for (const e of W.enemies) updateEnemy(W, e);
      separate(W);
      W.enemies = W.enemies.filter((e) => !e.gone);
      updateShots(W);
    }
    updateItems(W);
    if (W.phase === 'play') {
      updateSections(W);
      updateCam(W);
    }
    if (W.phase === 'clear') stepClear(W);
    if (W.phase === 'celebrate') stepCelebrate(W);
    if (W.events.length > 400) W.events.splice(0, W.events.length - 400);
  }

  function setPhase(W, p) {
    W.phase = p;
    W.phaseT = 0;
    ev(W, 'phase', { phase: p });
  }

  // ---------------------------------------------------------------- sections, waves, camera

  function updateSections(W) {
    const sec = W.S.sections[W.sec];
    if (!sec) return;
    if (W.secState === 'travel') {
      W.lockX = secX(W, sec);
      if (W.cam.x >= W.lockX - 0.02) {
        W.cam.x = W.lockX;
        W.secState = 'fight';
        W.go = false;
        W.waveIdx = 0;
        W.waveT = 99;
        W.pending = [];
        ev(W, 'section', { n: W.sec, boss: !!sec.boss });
      }
      return;
    }
    if (W.secState !== 'fight') return;
    const waves = sec.waves || [];
    const alive = W.enemies.filter((e) => !e.ko).length + W.pending.length;
    W.waveT += DT;
    const wave = waves[W.waveIdx];
    if (wave) {
      const first = W.waveIdx === 0;
      const when = wave.when != null ? wave.when : 1;
      const delay = wave.delay != null ? wave.delay : first ? 0.3 : 1.0;
      if (alive <= (first ? 99 : when) && W.waveT >= delay) {
        queueWave(W, wave);
        W.waveIdx++;
        W.waveT = 0;
      }
    }
    // pending enemies walk in as soon as there's room
    const max = W.diff.maxActive + (sec.boss ? 1 : 0);
    while (W.pending.length && W.enemies.filter((e) => !e.ko).length < max) {
      const p = W.pending.shift();
      spawnEnemy(W, p.type, p.side);
    }
    if (W.waveIdx >= waves.length && !W.pending.length && !W.enemies.length) {
      if (sec.boss) {
        if (W.phase === 'play') stageClear(W);
      } else {
        W.sec++;
        W.secState = 'travel';
        W.go = true;
        W.goFrom = W.cam.x;
        ev(W, 'go');
      }
    }
  }

  function queueWave(W, wave) {
    let list = (wave.enemies || []).slice();
    // easy mode leaves a few of the gang at home (never a boss)
    if (W.diff.keep < 1) {
      const keep = Math.max(1, Math.ceil(list.length * W.diff.keep));
      for (let i = list.length - 1; i >= 0 && list.length > keep; i--) if (!W.R.BOSSES[list[i]]) list.splice(i, 1);
    }
    const from = wave.from || 'right';
    list.forEach((type, i) => {
      const side = from === 'left' ? -1 : from === 'both' ? (i % 2 ? -1 : 1) : 1;
      W.pending.push({ type, side });
    });
  }

  function updateCam(W) {
    const hs = W.heroes.filter((h) => activeHero(h) && h.state !== 'drop');
    const lo = W.halfW, hi = W.S.length - W.halfW;
    if (hs.length && W.secState === 'travel') {
      let minX = Infinity, maxX = -Infinity;
      for (const h of hs) { minX = Math.min(minX, h.x); maxX = Math.max(maxX, h.x); }
      let target = Math.max(W.cam.x, maxX - W.halfW * 0.1);
      target = Math.min(target, minX + W.halfW - 1.4, W.lockX);
      if (target > W.cam.x) W.cam.x = Math.min(target, W.cam.x + 7 * DT);
    }
    W.cam.x = clamp(W.cam.x, lo, Math.max(lo, hi));
    if (W.go && W.cam.x > W.goFrom + 3) W.go = false;
  }

  // ---------------------------------------------------------------- spawning

  function spawnEnemy(W, type, side) {
    const R = W.R;
    const boss = !!R.BOSSES[type];
    const def = R.BOSSES[type] || R.ENEMIES[type] || R.ENEMIES.zombie;
    const scale = def.scale || 1;
    const hp = Math.round(def.hp * (boss ? W.diff.bossHp : W.diff.enemyHp));
    const z = W.zMin + 0.3 + W.rand() * (W.zMax - W.zMin - 0.6);
    const e = {
      id: W.nextId++, kind: 'enemy', type, def, boss, scale, r: 0.38 * scale,
      x: W.cam.x + side * (W.halfW + 1.0 + W.rand() * 1.2), y: 0, z, vx: 0, vy: 0, vz: 0, face: -side,
      hp, maxHp: hp, state: 'enter', st: 0, stun: 0, freeze: 0, flash: 0, barT: 0,
      look: def.looks ? Math.floor(W.rand() * def.looks.length) : 0,
      enterX: W.cam.x + side * (W.halfW - 1.3 - W.rand() * 2.2), born: W.t,
      ai: { side, cool: 0.4 + W.rand() * 0.8, zoff: (W.rand() - 0.5) * 1.6, spread: W.rand(), token: false, think: 0 },
    };
    W.enemies.push(e);
    if (boss) {
      W.boss = e;
      e.ai.cool = 1.5;
      ev(W, 'boss', { id: e.id, etype: type, name: def.name, title: def.title });
    }
    return e;
  }

  function spawnItem(W, kind, x, z, pop) {
    const it = { id: W.nextId++, kind, x, z: clamp(z, W.zMin, W.zMax), y: pop ? 0.5 : 0, vy: pop ? 4.5 : 0, vx: pop ? (W.rand() - 0.5) * 1.5 : 0, t: 0, popped: !!pop };
    W.items.push(it);
    return it;
  }

  // ---------------------------------------------------------------- the brothers (and the companion's body)

  function updateHero(W, h, inp) {
    if (h.out) {
      // 2 players: a brother who's out of lives taps attack to jump back in (uses a continue)
      if (inp.attack && W.mode === '2p' && W.phase === 'play' && W.continues > 0 && W.heroes.some((o) => o !== h && activeHero(o))) {
        W.continues--;
        W.stats.continues++;
        h.out = false;
        h.lives = W.diff.lives;
        respawn(W, h);
        ev(W, 'join', { who: h.who });
      }
      return;
    }
    if (h.freeze > 0) { h.freeze -= DT; return; }
    h.st += DT;
    h.inv = Math.max(0, h.inv - DT);
    h.flash = Math.max(0, h.flash - DT);
    h.comboT += DT;
    fighterBody(W, h, inp);
    if (h.kind === 'hero') {
      clampToView(W, h);
      pickups(W, h);
    }
  }

  // Movement and moves shared by the brothers and the companion. inp is the controller (or the AI) for this step.
  function fighterBody(W, h, inp) {
    const D = h.def;
    switch (h.state) {
      case 'enter': {
        // walking in from the left at the start of a stage
        const to = W.cam.x - W.halfW + 2.2 + h.slot * 1.1;
        h.vx = D.speed;
        h.vz = 0;
        h.face = 1;
        if (h.x >= to) { h.state = 'idle'; h.st = 0; h.vx = 0; }
        break;
      }
      case 'idle': case 'walk': case 'run': case 'land':
        ground(W, h, inp);
        break;
      case 'attack': attackStep(W, h, inp); break;
      case 'jump': jumpStep(W, h, inp); break;
      case 'grab': grabStep(W, h, inp); break;
      case 'toss':
        h.vx = 0; h.vz = 0;
        if (h.st > W.R.MOVES.toss.len) idle(h);
        break;
      case 'special': specialStep(W, h); break;
      case 'hurt':
        h.vx *= 0.85; h.vz = 0;
        if (h.st >= h.stun) idle(h);
        break;
      case 'down': fall(W, h); break;
      case 'lying':
        h.vx = 0;
        if (h.ko && h.st > 0.45) { h.state = 'dizzy'; h.st = 0; }
        else if (!h.ko && h.st > 0.75) { h.state = 'getup'; h.st = 0; }
        break;
      case 'getup':
        if (h.st > 0.35) { idle(h); h.inv = Math.max(h.inv, 1.0); }
        break;
      case 'dizzy':
        if (h.st > 1.6) loseLife(W, h);
        break;
      case 'drop':
        h.vy -= W.R.WORLD.GRAVITY * 0.6 * DT;
        h.y += h.vy * DT;
        h.vx = h.vz = 0;
        if (h.y <= 0) { h.y = 0; h.vy = 0; idle(h); ev(W, 'land', { x: h.x, z: h.z, big: true }); }
        break;
      case 'celebrate': break;
    }
    if (h.state !== 'grab' && h.state !== 'drop' && h.state !== 'down') {
      h.x += h.vx * DT;
      h.z = clamp(h.z + h.vz * DT, W.zMin, W.zMax);
    }
  }

  function idle(h) {
    h.state = 'idle';
    h.st = 0;
    h.vx = h.vz = 0;
    h.move = null;
  }

  function ground(W, h, inp) {
    const D = h.def;
    if (inp.special && h.kind === 'hero') return startSpecial(W, h);
    if (inp.jump) return startJump(W, h, inp);
    if (inp.attack) {
      if (h.state === 'run') return startMove(W, h, 'dashHit', W.R.MOVES.dashHit);
      if (h.weapon) return startWeapon(W, h);
      return comboAttack(W, h);
    }
    if (inp.dash) {
      h.state = 'run';
      h.st = 0;
      h.face = inp.dash;
      ev(W, 'dash', { who: h.who, x: h.x, z: h.z });
    }
    const mx = inp.mx || 0, mz = inp.mz || 0;
    if (h.state === 'run') {
      if (sign(mx) !== h.face) h.state = 'walk';
      else {
        h.vx = h.face * D.run;
        h.vz = mz * D.speedZ;
        return;
      }
    }
    h.vx = mx * D.speed;
    h.vz = mz * D.speedZ;
    if (mx) h.face = sign(mx);
    const moving = Math.abs(mx) > 0.05 || Math.abs(mz) > 0.05;
    if (h.state === 'land' && h.st < 0.1) return;
    h.state = moving ? 'walk' : 'idle';
    // walk into a baddie to grab him
    if (h.kind === 'hero' && !h.weapon && Math.abs(mx) > 0.3) {
      const e = W.enemies.find((e) => grabbable(e) && (e.x - h.x) * h.face > 0.1 && Math.abs(e.x - h.x) < 0.95 && Math.abs(e.z - h.z) < 0.42);
      if (e) {
        h.contact += DT;
        if (h.contact > (e.state === 'hurt' ? 0.02 : 0.14)) startGrab(W, h, e);
      } else h.contact = 0;
    } else h.contact = 0;
  }

  function comboAttack(W, h) {
    const C = h.def.combo;
    if (h.comboT > 0.5) h.combo = 0;
    const name = C[h.combo % C.length];
    h.combo = (h.combo + 1) % C.length;
    startMove(W, h, name, W.R.MOVES[name]);
  }

  function startMove(W, h, name, def, weapon) {
    h.state = 'attack';
    h.st = 0;
    h.move = { name, def, hit: new Set(), weapon: weapon || null, connected: false };
    h.queued = false;
    h.vx = h.vz = 0;
    ev(W, 'swing', { who: h.who, id: h.id, name, weapon: weapon || null, big: !!def.big });
  }

  function startWeapon(W, h) {
    const wd = W.R.WEAPONS[h.weapon.kind];
    startMove(W, h, 'weapon', wd, h.weapon.kind);
  }

  function attackStep(W, h, inp) {
    const m = h.move.def;
    if (inp.attack && h.st >= (m.next != null ? m.next : m.len * 0.5)) h.queued = true;
    if (m.lunge && h.st < m.until) h.vx = h.face * m.lunge * (h.move.name === 'dashHit' ? Math.max(0, 1 - h.st / m.len) : 1);
    else h.vx *= 0.75;
    h.vz = 0;
    if (h.st >= m.at && h.st <= m.until) hitbox(W, h, m);
    if (h.st >= m.len) {
      const weaponDone = h.move.weapon && h.weapon && h.weapon.uses <= 0;
      if (weaponDone) breakWeapon(W, h);
      idle(h);
      h.comboT = 0;
      if (h.queued) {
        h.queued = false;
        if (h.weapon) startWeapon(W, h);
        else comboAttack(W, h);
      }
    }
  }

  // Hit everyone in front of a fighter with move m (a punch, a swing, a kick).
  function hitbox(W, h, m) {
    let any = false;
    for (const e of W.enemies) {
      if (h.move.hit.has(e.id) || !hittable(W, e)) continue;
      const dx = (e.x - h.x) * h.face;
      if (dx < -0.35 || dx > m.reach + e.r * 0.6) continue;
      if (Math.abs(e.z - h.z) > m.depth + (e.boss ? 0.3 : 0)) continue;
      if (e.y - h.y > 1.2 || h.y - e.y > 1.4 * e.scale) continue;
      h.move.hit.add(e.id);
      any = true;
      let knock = !!m.knock, word = m.word;
      if (h.move.weapon && h.weapon) {
        const wd = W.R.WEAPONS[h.weapon.kind];
        knock = (h.weapon.hits % wd.knockEvery) === wd.knockEvery - 1;
      }
      let dmg = m.dmg;
      if (h.kind === 'buddy') dmg *= W.R.BUDDY.power;
      damageEnemy(W, e, dmg, {
        knock, dir: sign(e.x - h.x) || h.face, stun: m.stun || 0.35, push: m.push || 0.4, word, big: m.big || knock,
        by: h, weapon: h.move.weapon, feathers: m.feathers || h.move.name === 'swing' || h.move.name === 'hook',
      });
    }
    if (h.kind === 'hero') {
      for (const c of W.crates) {
        if (c.gone || h.move.hit.has(c.id)) continue;
        const dx = (c.x - h.x) * h.face;
        if (dx < -0.3 || dx > m.reach + 0.3 || Math.abs(c.z - h.z) > m.depth + 0.35) continue;
        h.move.hit.add(c.id);
        c.gone = true;
        any = true;
        ev(W, 'crate', { x: c.x, z: c.z, drop: c.drop });
        spawnItem(W, c.drop, c.x, c.z + 0.3, true);
      }
      W.crates = W.crates.filter((c) => !c.gone);
    }
    if (any && !h.move.connected) {
      h.move.connected = true;
      if (h.move.weapon && h.weapon) {
        h.weapon.uses--;
        h.weapon.hits++;
      }
      h.freeze = m.big ? 0.07 : 0.045;
    }
    return any;
  }

  function startJump(W, h, inp) {
    const D = h.def;
    const running = h.state === 'run';
    h.state = 'jump';
    h.st = 0;
    h.vy = D.jump;
    h.y = 0.01;
    h.move = null;
    h.kicked = false;
    if (inp.mx) h.face = sign(inp.mx);
    h.vx = running ? h.face * D.run * 0.85 : (inp.mx || 0) * D.speed;
    h.vz = (inp.mz || 0) * D.speedZ * 0.8;
    ev(W, 'jump', { who: h.who, x: h.x, z: h.z });
  }

  function jumpStep(W, h, inp) {
    if (inp.attack && !h.kicked) {
      h.kicked = true;
      h.move = { name: 'jumpKick', def: W.R.MOVES.jumpKick, hit: new Set(), weapon: null, connected: false, at: h.st };
      ev(W, 'swing', { who: h.who, id: h.id, name: 'jumpKick' });
    }
    if (h.move) {
      const was = h.move.connected;
      hitbox(W, h, h.move.def);
      if (!was && h.move.connected) h.freeze = 0.04;
    }
    h.vy -= W.R.WORLD.GRAVITY * DT;
    h.y += h.vy * DT;
    if (h.y <= 0) {
      h.y = 0;
      h.vy = 0;
      h.state = 'land';
      h.st = 0;
      h.vx = h.vz = 0;
      h.move = null;
      ev(W, 'land', { x: h.x, z: h.z });
    }
  }

  // ---------------------------------------------------------------- grab and toss

  function grabbable(e) {
    return !e.boss && ['idle', 'walk', 'hurt', 'windup', 'recover'].includes(e.state) && e.y < 0.1;
  }

  function startGrab(W, h, e) {
    h.state = 'grab';
    h.st = 0;
    h.grab = e;
    h.bops = 0;
    h.bopT = -1;
    h.queued = false;
    h.vx = h.vz = 0;
    h.contact = 0;
    e.state = 'held';
    e.st = 0;
    e.heldBy = h;
    e.face = -h.face;
    ev(W, 'grab', { who: h.who, x: e.x, y: 1.3, z: e.z });
  }

  function grabStep(W, h, inp) {
    const e = h.grab;
    if (!e || e.state !== 'held' || e.gone) {
      h.grab = null;
      return idle(h);
    }
    e.x = h.x + h.face * 0.72;
    e.z = h.z + 0.03;
    e.y = 0;
    if (h.bopT >= 0) {
      h.bopT += DT;
      if (inp.attack) h.queued = (inp.mx || 0) * h.face < -0.3 ? 'back' : 'bop';
      if (inp.jump) h.queued = 'back';
      if (h.bopT >= W.R.MOVES.bop.at && !h.bopHit) {
        h.bopHit = true;
        const m = W.R.MOVES.bop;
        e.hp -= m.dmg * (h.kind === 'buddy' ? W.R.BUDDY.power : 1);
        e.flash = 0.15;
        e.barT = 2;
        h.score += 10;
        W.stats.hits++;
        ev(W, 'hit', { x: e.x, y: 1.3 * e.scale, z: e.z, word: m.word, by: h.who, feathers: true });
        h.freeze = e.freeze = 0.05;
        if (e.hp <= 0) return toss(W, h, h.face);
      }
      if (h.bopT >= W.R.MOVES.bop.len) h.bopT = -1;
      return;
    }
    const away = (inp.mx || 0) * h.face < -0.3;
    const q = h.queued;
    h.queued = false;
    if (inp.jump || (inp.attack && away) || q === 'back') return toss(W, h, -h.face);
    if (inp.attack || q === 'bop') {
      if (h.bops >= 2) return toss(W, h, h.face);
      h.bops++;
      h.bopT = 0;
      h.bopHit = false;
      ev(W, 'swing', { who: h.who, id: h.id, name: 'bop' });
      return;
    }
    if (h.st > 2.0) {
      // he wriggles free
      h.grab = null;
      e.heldBy = null;
      e.state = 'hurt';
      e.st = 0;
      e.stun = 0.25;
      e.vx = h.face * 2.5;
      idle(h);
    }
  }

  function toss(W, h, dir) {
    const e = h.grab;
    const T = W.R.MOVES.toss;
    h.grab = null;
    e.heldBy = null;
    h.face = dir;
    h.state = 'toss';
    h.st = 0;
    h.bopT = -1;
    e.hp -= T.dmg;
    e.flash = 0.2;
    e.barT = 2;
    e.x = h.x + dir * 0.45;
    e.y = 0.9;
    e.state = 'down';
    e.st = 0;
    e.thrown = true;
    e.thrownBy = h;
    e.hitIds = new Set([e.id]);
    e.vx = dir * T.speed;
    e.vy = 4.6;
    e.ko = e.hp <= 0;
    if (e.ko) e.hp = 0;
    h.score += 30;
    W.stats.hits++;
    ev(W, 'toss', { who: h.who, x: e.x, y: 1.4, z: e.z, dir, word: T.word });
  }

  // ---------------------------------------------------------------- specials

  function startSpecial(W, h) {
    const cost = W.diff.specialCost;
    h.hp = Math.max(1, h.hp - cost);
    h.state = 'special';
    h.st = 0;
    h.vx = h.vz = 0;
    h.special = h.def.special;
    h.specDone = false;
    h.inv = Math.max(h.inv, 1.2);
    h.move = null;
    W.stats.specials++;
    if (h.special === 'dunk') {
      h.vy = 7.6;
      h.y = 0.01;
      h.vx = h.face * 1.4;
    }
    ev(W, 'special', { who: h.who, id: h.id, kind: h.special, x: h.x, z: h.z, name: h.def.specialName, cost });
  }

  function specialStep(W, h) {
    const S = W.R.SPECIALS;
    if (h.special === 'dunk') {
      const D = S.dunk;
      if (h.y > 0 || h.vy > 0) {
        h.vy -= W.R.WORLD.GRAVITY * DT;
        h.y = Math.max(0, h.y + h.vy * DT);
        if (h.st > D.slamAt) h.vx *= 0.9;
      }
      if (!h.specDone && h.st >= D.slamAt) {
        h.specDone = true;
        const x = h.x + h.face * D.ahead;
        ringBlast(W, h, { x, z: h.z, max: D.radius, speed: 14, dmg: D.dmg, zScale: D.radius / D.depth, kind: 'dunk' });
        ev(W, 'dunk', { who: h.who, x, z: h.z, fromY: h.y + 2.2 });
      }
      if (h.st >= D.len && h.y <= 0) { h.y = 0; idle(h); }
    } else {
      const P = S.peace;
      if (!h.specDone && h.st >= P.at) {
        h.specDone = true;
        ringBlast(W, h, { x: h.x, z: h.z, max: P.radius, speed: P.speed, dmg: P.dmg, zScale: P.zScale, kind: 'peace' });
        ev(W, 'peaceWave', { who: h.who, x: h.x, z: h.z, max: P.radius });
      }
      if (h.st >= P.len) idle(h);
    }
  }

  // A shockwave ring that spreads out from (x, z) and knocks down the other team.
  function ringBlast(W, owner, o) {
    W.shots.push({
      id: W.nextId++, kind: 'ring', team: owner.kind === 'enemy' ? 'gang' : 'kids', owner,
      x: o.x, z: o.z, y: 0, r: 0, max: o.max, speed: o.speed, dmg: o.dmg, zScale: o.zScale || 1.6,
      knock: o.knock !== false, stunOnly: !!o.stunOnly, hit: new Set(), style: o.kind,
    });
  }

  // ---------------------------------------------------------------- calling the brother / team-up

  function callBrother(W, slot) {
    if (W.phase !== 'play') return false;
    if (W.mode === '2p') return teamUp(W);
    if (W.mode !== '1p') return false;
    const h = W.heroes[0];
    if (!activeHero(h)) return false;
    W.stats.calls++;
    const B = W.R.BUDDY;
    W.buddyT = B.visit;
    h.shield = true;
    if (!W.buddy) {
      const who = h.who === 'tommy' ? 'teddy' : 'tommy';
      W.buddy = {
        id: W.nextId++, kind: 'buddy', who, slot: 1, def: W.R.HEROES[who],
        x: W.cam.x - W.halfW - 0.6, y: 0, z: clamp(h.z + 0.6, W.zMin, W.zMax), vx: 0, vy: 0, vz: 0, face: 1, r: 0.35, scale: 1,
        hp: 1, maxHp: 1, state: 'bEnter', st: 0, move: null, combo: 0, comboT: 9, queued: false,
        weapon: null, grab: null, bops: 0, bopT: -1, contact: 0, inv: 99, freeze: 0, flash: 0, wantTreat: 1, score: 0,
      };
      ev(W, 'buddy', { who, x: W.buddy.x, z: W.buddy.z });
    } else {
      W.buddy.wantTreat++;
      if (W.buddy.state === 'bye' || W.buddy.state === 'leave') { W.buddy.state = 'bGive'; W.buddy.st = 0; }
      ev(W, 'buddyAgain', { who: W.buddy.who });
    }
    return true;
  }

  function updateBuddy(W, b) {
    const h = W.heroes[0];
    if (b.freeze > 0) { b.freeze -= DT; return; }
    b.st += DT;
    b.comboT += DT;
    const B = W.R.BUDDY;
    const run = (tx, tz, sp) => {
      const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
      if (d < 0.15) { b.vx = b.vz = 0; return true; }
      b.vx = (dx / d) * sp;
      b.vz = (dz / d) * sp * 0.8;
      if (Math.abs(dx) > 0.05) b.face = sign(dx);
      b.x += b.vx * DT;
      b.z = clamp(b.z + b.vz * DT, W.zMin, W.zMax);
      return false;
    };
    if (W.phase === 'celebrate') return;
    if (W.phase !== 'play' && W.phase !== 'clear') return;
    switch (b.state) {
      case 'bEnter': {
        const tx = Math.max(viewL(W) + 1, h.x - 1.6);
        if (run(tx, h.z + (h.z > W.zMin + 1 ? -0.7 : 0.7), b.def.run) || b.st > 2.5) { b.state = 'hello'; b.st = 0; b.face = 1; }
        break;
      }
      case 'hello':
        // says hi with his signature move: Teddy shadow-boxes, Tommy does his Y. It bonks anyone close.
        b.vx = b.vz = 0;
        if (b.st > 0.35 && !b.helloDone) {
          b.helloDone = true;
          ringBlast(W, b, { x: b.x, z: b.z, max: B.helloRadius, speed: 9, dmg: 4, zScale: 1.6, knock: false, stunOnly: true, kind: 'hello' });
          ev(W, 'hello', { who: b.who, x: b.x, z: b.z });
        }
        if (b.st > 1.0) { b.state = 'bGive'; b.st = 0; }
        break;
      case 'bGive': {
        if (!activeHero(h)) { b.state = 'fight'; b.st = 0; break; }
        if (b.wantTreat <= 0) { b.state = 'fight'; b.st = 0; break; }
        const tx = h.x - h.face * 0.95;
        if (run(clamp(tx, viewL(W), viewR(W)), h.z, b.def.run) || b.st > 2.2) {
          b.face = sign(h.x - b.x) || 1;
          b.state = 'giving';
          b.st = 0;
        }
        break;
      }
      case 'giving':
        b.vx = b.vz = 0;
        if (b.st > 0.35 && !b.gave && b.wantTreat > 0) {
          b.gave = true;
          b.wantTreat--;
          const T = W.R.TREATS[W.treatN++ % W.R.TREATS.length];
          if (activeHero(h)) h.hp = Math.min(h.maxHp, h.hp + B.treatHeal);
          W.stats.treats++;
          ev(W, 'treat', { who: b.who, to: h.who, emoji: T.emoji, name: T.name, x: b.x, z: b.z, tx: h.x, tz: h.z });
        }
        if (b.st > 0.75) {
          b.gave = false;
          b.state = b.wantTreat > 0 ? 'bGive' : 'fight';
          b.st = 0;
        }
        break;
      case 'fight': case 'idle': case 'walk': case 'run': case 'attack': case 'land': case 'jump': {
        if (b.state === 'fight') b.state = 'idle';
        W.buddyT -= DT;
        if (W.buddyT <= 0 || W.phase === 'clear') {
          if (b.state === 'attack' || b.state === 'jump') { fighterBody(W, b, {}); break; }
          b.state = 'bye';
          b.st = 0;
          ev(W, 'bye', { who: b.who });
          break;
        }
        if (b.wantTreat > 0 && b.state !== 'attack') { b.state = 'bGive'; b.st = 0; break; }
        fighterBody(W, b, brains().buddy(W, b));
        b.x = clamp(b.x, viewL(W), viewR(W));
        break;
      }
      case 'bye':
        b.vx = b.vz = 0;
        if (b.st > 1.0) { b.state = 'leave'; b.st = 0; }
        break;
      case 'leave':
        run(W.cam.x - W.halfW - 2, b.z, b.def.run);
        if (b.x < W.cam.x - W.halfW - 1.2 || b.st > 3) {
          W.buddy = null;
          if (h) h.shield = false;
          ev(W, 'buddyGone', { who: b.who });
        }
        break;
      case 'grab': case 'hurt': case 'toss': default:
        fighterBody(W, b, {});
        if (!['grab', 'toss', 'hurt', 'attack', 'jump', 'land'].includes(b.state)) b.state = 'idle';
    }
  }

  function teamUp(W) {
    if (W.teamCd > 0) return false;
    const hs = W.heroes.filter(standing);
    if (hs.length < 2) return false;
    W.teamCd = W.diff.teamCd;
    W.stats.teamups++;
    for (const h of hs) {
      if (h.grab) { h.grab.state = 'hurt'; h.grab.st = 0; h.grab.stun = 0.2; h.grab.heldBy = null; h.grab = null; }
      h.state = 'team';
      h.st = 0;
      h.vx = h.vz = 0;
      h.vy = h.who === 'teddy' ? 7.6 : 0;
      h.inv = 3;
    }
    setPhase(W, 'team');
    ev(W, 'teamup', {});
    return true;
  }

  function stepTeam(W) {
    for (const h of W.heroes) {
      if (h.state !== 'team') continue;
      h.st += DT;
      if (h.vy || h.y > 0) {
        h.vy -= W.R.WORLD.GRAVITY * DT;
        h.y = Math.max(0, h.y + h.vy * DT);
        if (h.y === 0) h.vy = 0;
      }
    }
    if (W.phaseT >= 0.85 && !W.teamBlasted) {
      W.teamBlasted = true;
      ev(W, 'blast', { x: W.cam.x });
      for (const e of W.enemies) {
        if (e.ko || e.state === 'enter' && Math.abs(e.x - W.cam.x) > W.halfW) continue;
        if (e.heldBy) { e.heldBy.grab = null; e.heldBy = null; }
        e.x = clamp(e.x, viewL(W), viewR(W));
        const dmg = e.boss ? e.maxHp * 0.18 : 999;
        damageEnemy(W, e, dmg, { knock: true, dir: sign(e.x - W.cam.x) || 1, word: 'KA-BOOM!', big: true, by: W.heroes[0], special: true });
      }
    }
    if (W.phaseT >= 1.6) {
      W.teamBlasted = false;
      for (const h of W.heroes) if (h.state === 'team') { h.y = 0; idle(h); }
      setPhase(W, 'play');
    }
  }

  // ---------------------------------------------------------------- getting bonked

  function hittable(W, e) {
    if (e.gone || e.ko) return false;
    if (['down', 'lying', 'getup', 'dizzy', 'flag', 'held'].includes(e.state)) return false;
    if (e.state === 'enter' && (e.x < viewL(W) || e.x > viewR(W))) return false;
    return true;
  }

  function damageEnemy(W, e, dmg, o) {
    if (e.gone || (e.ko && !o.force)) return;
    e.hp -= dmg;
    e.flash = 0.15;
    e.barT = 2.2;
    W.stats.hits++;
    const by = o.by;
    if (by && by.score != null) by.score += 10;
    ev(W, 'hit', { x: e.x, y: e.y + 1.25 * e.scale, z: e.z, word: o.word || 'POW!', big: !!o.big, by: by && by.who, weapon: o.weapon || null, feathers: !!o.feathers, boss: e.boss });
    if (e.heldBy) {
      const g = e.heldBy;
      g.grab = null;
      e.heldBy = null;
      if (g.state === 'grab') idle(g);
    }
    const dir = o.dir || 1;
    if (e.hp <= 0) {
      e.hp = 0;
      knockDown(W, e, dir, true);
      return;
    }
    if (e.boss) {
      // bosses shrug off small hits; a big hit makes them stagger (not again for a moment), a special knocks them down
      if (o.special) knockDown(W, e, dir, false);
      else if (o.knock && W.t > (e.armorT || 0)) {
        e.armorT = W.t + 1.6;
        e.state = 'hurt';
        e.st = 0;
        e.stun = 0.45;
        e.vx = dir * 2.5;
        e.y = 0;
      }
      return;
    }
    if (o.knock) knockDown(W, e, dir, false);
    else {
      e.state = 'hurt';
      e.st = 0;
      e.stun = (o.stun || 0.35) * (o.stunOnly ? 1.4 : 1);
      e.vx = dir * (o.push || 0.4) * 2.2;
      e.vz = 0;
      e.face = -dir;
    }
  }

  function knockDown(W, f, dir, ko) {
    if (f.grab) {
      const g = f.grab;
      g.heldBy = null;
      g.state = 'hurt';
      g.st = 0;
      g.stun = 0.25;
      f.grab = null;
    }
    if (f.kind === 'hero' && f.weapon) dropWeapon(W, f);
    f.state = 'down';
    f.st = 0;
    f.vy = ko ? 5.2 : 4.2;
    f.vx = dir * (ko ? 3.8 : 3.0) * (f.boss ? 0.5 : 1);
    f.vz = 0;
    f.y = Math.max(f.y, 0.02);
    f.face = -dir;
    f.ko = !!(ko || f.ko);
    f.move = null;
    if (f.kind === 'enemy') f.x = clamp(f.x, viewL(W), viewR(W));
    if (f.kind === 'enemy' && ko) {
      if (f.boss && !W.bossDown) {
        W.bossDown = true;
        ev(W, 'bossKO', { x: f.x, z: f.z, name: f.def.name });
        stageClear(W);
      }
      ev(W, 'ko', { x: f.x, y: 1.4 * f.scale, z: f.z, etype: f.type, boss: f.boss });
    }
    ev(W, 'knock', { x: f.x, z: f.z, kind: f.kind, who: f.who || f.type, ko: f.ko });
  }

  // Flying through the air after a knock-down or a toss. A tossed baddie bowls over anyone he hits.
  function fall(W, f) {
    f.vy -= W.R.WORLD.GRAVITY * DT;
    f.y += f.vy * DT;
    f.x += f.vx * DT;
    // the screen edges are walls: bounce off them so nobody ends up off-screen
    const L = viewL(W), Rr = viewR(W);
    if (f.x < L && f.vx < 0) { f.x = L; f.vx = -f.vx * 0.4; }
    if (f.x > Rr && f.vx > 0) { f.x = Rr; f.vx = -f.vx * 0.4; }
    if (f.thrown) {
      for (const o of W.enemies) {
        if (f.hitIds.has(o.id) || !hittable(W, o)) continue;
        if (Math.abs(o.x - f.x) < 0.85 && Math.abs(o.z - f.z) < 0.6) {
          f.hitIds.add(o.id);
          damageEnemy(W, o, W.R.MOVES.toss.hitOthers, { knock: !o.boss, dir: sign(f.vx) || 1, word: 'STRIKE!', big: true, by: f.thrownBy });
        }
      }
    }
    if (f.y <= 0) {
      f.y = 0;
      f.vy = 0;
      f.vx = 0;
      f.thrown = false;
      f.state = 'lying';
      f.st = 0;
      ev(W, 'land', { x: f.x, z: f.z, big: true, kind: f.kind });
    }
  }

  function hurtHero(W, h, dmg, o = {}) {
    if (h.kind !== 'hero' || !activeHero(h) || h.inv > 0 || h.ko) return false;
    if (['down', 'lying', 'getup', 'dizzy', 'special', 'enter', 'drop', 'celebrate', 'team'].includes(h.state)) return false;
    if (W.phase !== 'play') return false;
    const dir = o.dir || -h.face;
    if (h.shield) {
      // the companion blocks one hit
      h.shield = false;
      h.inv = 0.9;
      W.stats.saves++;
      ev(W, 'saved', { x: h.x, y: 1.5, z: h.z, who: h.who, buddy: W.buddy ? W.buddy.who : (h.who === 'tommy' ? 'teddy' : 'tommy') });
      const a = o.by;
      if (a && a.kind === 'enemy' && !a.boss) {
        a.state = 'hurt';
        a.st = 0;
        a.stun = 0.6;
        a.vx = -dir * 3;
      }
      return false;
    }
    if (h.grab) {
      const g = h.grab;
      g.heldBy = null;
      g.state = 'hurt';
      g.st = 0;
      g.stun = 0.2;
      h.grab = null;
    }
    h.hp -= dmg * W.diff.enemyDmg;
    h.flash = 0.25;
    W.stats.ouch = (W.stats.ouch || 0) + dmg * W.diff.enemyDmg;
    ev(W, 'ouch', { x: h.x, y: 1.5, z: h.z, who: h.who, word: o.word || 'OOF!', big: !!o.knock });
    if (h.hp <= 0) {
      h.hp = 0;
      knockDown(W, h, dir, true);
      W.stats.deaths++;
      return true;
    }
    if (o.knock) knockDown(W, h, dir, false);
    else {
      h.state = 'hurt';
      h.st = 0;
      h.stun = 0.38;
      h.vx = dir * 1.6;
      h.move = null;
    }
    h.inv = W.diff.mercy;
    return true;
  }

  function loseLife(W, h) {
    h.lives--;
    h.ko = false;
    if (h.lives > 0) {
      respawn(W, h);
      return;
    }
    h.out = true;
    h.state = 'out';
    h.shield = false;
    ev(W, 'out', { who: h.who });
    if (!W.heroes.some(activeHero)) {
      if (W.buddy) W.buddy = null;
      setPhase(W, 'continue');
    }
  }

  function respawn(W, h) {
    h.hp = h.maxHp;
    h.ko = false;
    h.state = 'drop';
    h.st = 0;
    h.x = clamp(W.cam.x - W.halfW * 0.45 + h.slot * 1.2, viewL(W) + 1, viewR(W) - 1);
    h.z = clamp((W.zMin + W.zMax) / 2 + (h.slot ? 0.6 : -0.4), W.zMin, W.zMax);
    h.y = 6;
    h.vy = 0;
    h.vx = h.vz = 0;
    h.inv = 2.6;
    h.face = 1;
    ev(W, 'respawn', { who: h.who, x: h.x, z: h.z });
  }

  // After "CONTINUE?": everybody back in with full lives. Returns false when there are no continues left.
  function continueGame(W) {
    if (W.phase !== 'continue' || W.continues <= 0) return false;
    W.continues--;
    W.stats.continues++;
    for (const h of W.heroes) {
      h.out = false;
      h.lives = W.diff.lives;
      respawn(W, h);
    }
    setPhase(W, 'play');
    return true;
  }

  // ---------------------------------------------------------------- weapons and food

  function pickups(W, h) {
    if (!['idle', 'walk', 'run', 'land'].includes(h.state) || h.y > 0.1) return;
    for (const it of W.items) {
      if (it.gone || it.y > 0.3 || (it.popped && it.t < 0.3)) continue;
      if (Math.abs(it.x - h.x) > 0.75 || Math.abs(it.z - h.z) > 0.55) continue;
      const food = W.R.FOOD[it.kind];
      if (food) {
        it.gone = true;
        const before = h.hp;
        h.hp = Math.min(h.maxHp, h.hp + food.heal);
        h.score += 50;
        ev(W, 'eat', { who: h.who, kind: it.kind, emoji: food.emoji, name: food.name, x: it.x, z: it.z, heal: h.hp - before });
      } else if (W.R.WEAPONS[it.kind] && !h.weapon) {
        it.gone = true;
        h.weapon = { kind: it.kind, uses: it.uses != null ? it.uses : W.R.WEAPONS[it.kind].uses, hits: 0 };
        ev(W, 'pickup', { who: h.who, kind: it.kind, name: W.R.WEAPONS[it.kind].name, x: it.x, z: it.z });
      }
    }
    W.items = W.items.filter((i) => !i.gone);
  }

  function dropWeapon(W, h) {
    const it = spawnItem(W, h.weapon.kind, h.x, h.z, true);
    it.uses = h.weapon.uses;
    h.weapon = null;
    ev(W, 'drop', { who: h.who, kind: it.kind });
  }

  function breakWeapon(W, h) {
    ev(W, 'break', { who: h.who, kind: h.weapon.kind, x: h.x + h.face * 0.8, y: 1.2, z: h.z });
    h.weapon = null;
  }

  function updateItems(W) {
    for (const it of W.items) {
      it.t += DT;
      if (it.y > 0 || it.vy > 0) {
        it.vy -= W.R.WORLD.GRAVITY * DT;
        it.y += it.vy * DT;
        it.x += it.vx * DT;
        if (it.y <= 0) { it.y = 0; it.vy = 0; it.vx = 0; }
      }
      // something that pops out of a crate or a baddie always lands on-screen
      if (it.popped) it.x = clamp(it.x, viewL(W), viewR(W));
    }
  }

  // ---------------------------------------------------------------- the gang

  function updateEnemy(W, e) {
    if (e.freeze > 0) { e.freeze -= DT; return; }
    e.st += DT;
    e.flash = Math.max(0, e.flash - DT);
    e.barT = Math.max(0, e.barT - DT);
    if (W.phase === 'clear' && !e.ko && !['down', 'lying'].includes(e.state)) {
      // the boss is bonked: everyone else gives up
      e.ko = true;
      e.state = 'dizzy';
      e.st = 0.6;
    }
    switch (e.state) {
      case 'enter': {
        const dx = e.enterX - e.x;
        const sp = e.def.speed * W.diff.enemySpeed * 1.25;
        e.face = sign(dx) || e.face;
        e.vx = sign(dx) * sp;
        e.vz = 0;
        if (Math.abs(dx) < 0.1 || W.t - e.born > 6) {
          e.state = 'idle';
          e.st = 0;
          e.vx = 0;
          if (e.x < viewL(W)) e.x = viewL(W);
          if (e.x > viewR(W)) e.x = viewR(W);
        }
        break;
      }
      case 'idle': case 'walk': case 'windup': case 'attack': case 'recover':
        brains().enemy(W, e);
        break;
      case 'hurt':
        e.vx *= 0.85;
        e.vz = 0;
        if (e.st >= e.stun) { e.state = 'idle'; e.st = 0; e.ai.cool = Math.max(e.ai.cool, 0.3); }
        break;
      case 'held':
        e.vx = e.vz = 0;
        if (!e.heldBy || e.heldBy.grab !== e) { e.heldBy = null; e.state = 'hurt'; e.st = 0; e.stun = 0.2; }
        break;
      case 'down': fall(W, e); break;
      case 'lying':
        e.vx = e.vz = 0;
        if (e.ko && e.st > 0.5) { e.state = 'dizzy'; e.st = 0; }
        else if (!e.ko && e.st > 0.85) { e.state = 'getup'; e.st = 0; }
        break;
      case 'getup':
        if (e.st > 0.4) { e.state = 'idle'; e.st = 0; e.ai.cool = Math.max(e.ai.cool, 0.6); }
        break;
      case 'dizzy':
        // sitting with stars going round, then up with a white flag
        if (e.st > 1.3) { e.state = 'flag'; e.st = 0; ev(W, 'flag', { id: e.id, x: e.x, z: e.z }); }
        break;
      case 'flag':
        if (e.st > 0.95) poof(W, e);
        break;
    }
    if (e.state !== 'down' && e.state !== 'held') {
      e.x += e.vx * DT;
      e.z = clamp(e.z + e.vz * DT, W.zMin, W.zMax);
    }
    if (e.state !== 'enter') e.x = clamp(e.x, viewL(W), viewR(W));
  }

  function poof(W, e) {
    e.gone = true;
    W.stats.kos++;
    const killer = W.heroes.reduce((a, h) => (!a || Math.abs(h.x - e.x) < Math.abs(a.x - e.x) ? h : a), null);
    if (killer) killer.score += e.def.score || 100;
    ev(W, 'poof', { id: e.id, x: e.x, z: e.z, scale: e.scale, boss: e.boss });
    if (!e.boss && W.phase === 'play' && W.rand() < (e.def.drop || 0)) {
      const kinds = ['cookie', 'cookie', 'icecream', 'melon'];
      spawnItem(W, kinds[Math.floor(W.rand() * kinds.length)], e.x, e.z, true);
    }
    if (e.boss) W.boss = null;
  }

  // Keep the gang from standing inside each other (and gently out of the brothers).
  function separate(W) {
    const E = W.enemies;
    for (let i = 0; i < E.length; i++) {
      const a = E[i];
      if (!movable(a)) continue;
      for (let j = i + 1; j < E.length; j++) {
        const b = E[j];
        if (!movable(b)) continue;
        const dx = b.x - a.x, dz = (b.z - a.z) * 1.6;
        const min = (a.r + b.r) * 1.25;
        const d2 = dx * dx + dz * dz;
        if (d2 > min * min || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), push = (min - d) * 0.25;
        const nx = dx / d, nz = dz / d / 1.6;
        a.x -= nx * push; a.z -= nz * push;
        b.x += nx * push; b.z += nz * push;
      }
      for (const h of W.heroes) {
        if (!standing(h) || h.y > 0.3) continue;
        const dx = a.x - h.x, dz = a.z - h.z;
        if (Math.abs(dx) < 0.55 && Math.abs(dz) < 0.32) a.x += (sign(dx) || -h.face) * (0.55 - Math.abs(dx)) * 0.3;
      }
    }
    for (const a of E) {
      if (!movable(a)) continue;
      a.z = clamp(a.z, W.zMin, W.zMax);
      a.x = clamp(a.x, viewL(W), viewR(W));
    }
  }
  const movable = (e) => !e.gone && ['idle', 'walk', 'windup', 'recover', 'hurt', 'getup'].includes(e.state);

  // ---------------------------------------------------------------- flying things

  // A thrown thing from the gang (a note, a pie, a dodgeball...) at a target point.
  function throwShot(W, e, kind, tx, tz) {
    const S = W.R.SHOTS[kind];
    const y = S.up ? 1.4 * e.scale : 1.1;
    const dx = tx - e.x;
    const dir = sign(dx) || e.face;
    const s = {
      id: W.nextId++, kind, team: 'gang', owner: e, emoji: S.emoji, x: e.x + dir * 0.6 * e.scale, y, z: e.z,
      vx: dir * S.speed, vy: S.up, vz: 0, g: S.up ? 0 : 0, r: S.r, dmg: S.dmg, knock: !!S.knock, life: S.life, t: 0,
      bounce: !!S.bounce, wobble: !!S.wobble, hit: new Set(),
    };
    if (S.up) {
      // aim the arc at the target: pick gravity so it comes down there
      const dist = Math.max(1.5, Math.abs(dx));
      const tFlight = dist / S.speed;
      s.g = (2 * (S.up * tFlight + y - 0.9)) / (tFlight * tFlight);
    }
    s.vz = ((tz - e.z) / Math.max(0.4, Math.abs(dx) / S.speed)) * 0.9;
    W.shots.push(s);
    ev(W, 'throw', { kind, x: s.x, z: s.z, id: s.id });
    return s;
  }

  function updateShots(W) {
    for (const s of W.shots) {
      s.t = (s.t || 0) + DT;
      if (s.kind === 'ring') { ringStep(W, s); continue; }
      s.vy -= (s.g || 0) * DT;
      s.x += s.vx * DT;
      s.y += s.vy * DT;
      s.z = clamp(s.z + s.vz * DT, W.zMin - 0.3, W.zMax + 0.3);
      if (s.wobble) s.y = 1.3 + Math.sin(s.t * 9) * 0.25;
      if (s.y <= 0.25 && s.vy < 0) {
        if (s.bounce && !s.bounced) { s.bounced = true; s.vy = -s.vy * 0.55; s.y = 0.25; }
        else { s.gone = true; ev(W, 'splat', { kind: s.kind, x: s.x, z: s.z }); continue; }
      }
      for (const h of W.heroes) {
        if (s.gone || s.hit.has(h.id) || !standing(h)) continue;
        if (Math.abs(h.x - s.x) < s.r + 0.3 && Math.abs(h.z - s.z) < 0.5 && s.y > h.y - 0.2 && s.y < h.y + 2.1) {
          s.hit.add(h.id);
          if (hurtHero(W, h, s.dmg, { knock: s.knock, dir: sign(s.vx), by: s.owner, word: 'BONK!' }) || h.inv > 0) {
            s.gone = true;
            ev(W, 'splat', { kind: s.kind, x: s.x, y: s.y, z: s.z, hit: true });
          }
        }
      }
      if (s.t > s.life || s.x < W.cam.x - W.halfW - 2.5 || s.x > W.cam.x + W.halfW + 2.5) s.gone = true;
    }
    W.shots = W.shots.filter((s) => !s.gone);
  }

  function ringStep(W, s) {
    s.r += s.speed * DT;
    if (s.team === 'kids') {
      for (const e of W.enemies) {
        if (s.hit.has(e.id) || !hittable(W, e)) continue;
        const d = Math.hypot(e.x - s.x, (e.z - s.z) * s.zScale);
        if (d > s.r + e.r) continue;
        s.hit.add(e.id);
        let dmg = s.dmg;
        if (s.owner && s.owner.kind === 'buddy') dmg *= W.R.BUDDY.power;
        const word = s.style === 'dunk' ? 'BOING!' : s.style === 'peace' ? 'PEACE!' : 'HI!';
        damageEnemy(W, e, dmg, { knock: s.knock, dir: sign(e.x - s.x) || 1, word, big: s.knock, by: s.owner, special: s.knock, stun: 0.6, stunOnly: s.stunOnly });
      }
    } else {
      for (const h of W.heroes) {
        if (s.hit.has(h.id) || !standing(h)) continue;
        const d = Math.hypot(h.x - s.x, (h.z - s.z) * s.zScale);
        if (d > s.r + 0.3 || d < s.r - 0.7) continue;
        if (h.y > 0.35) continue; // jumped over it!
        s.hit.add(h.id);
        hurtHero(W, h, s.dmg, { knock: true, dir: sign(h.x - s.x) || 1, by: s.owner, word: 'THUD!' });
      }
    }
    if (s.r >= s.max) s.gone = true;
  }

  // ---------------------------------------------------------------- stage clear and the celebration

  function stageClear(W) {
    if (W.phase === 'clear' || W.phase === 'celebrate' || W.phase === 'done') return;
    setPhase(W, 'clear');
    W.pending = [];
    for (const h of W.heroes) {
      if (h.grab) { h.grab.heldBy = null; h.grab = null; if (h.state === 'grab') idle(h); }
      if (h.ko) { h.ko = false; h.hp = Math.max(1, h.hp); if (h.state === 'dizzy') { h.state = 'getup'; h.st = 0; } }
    }
    ev(W, 'clear', {});
  }

  function stepClear(W) {
    // wait for the boss and the gang to wave their white flags and poof, then celebrate
    if ((!W.enemies.length && W.phaseT > 1.2) || W.phaseT > 6) {
      W.enemies = [];
      W.shots = [];
      W.items = [];
      setPhase(W, 'celebrate');
      const cx = W.cam.x;
      W.heroes.forEach((h) => {
        if (h.out || h.state === 'out') { h.out = false; h.lives = Math.max(1, h.lives); h.state = 'idle'; h.y = 0; }
        h.ko = false;
        h.grab = null;
        h.state = 'celebrate';
        h.st = 0;
        h.y = 0;
        h.vy = h.vx = h.vz = 0;
        h.weapon = null;
      });
      if (W.mode === '1p') {
        // the other brother runs in for the high-five
        const me = W.heroes[0];
        const who = me.who === 'tommy' ? 'teddy' : 'tommy';
        if (!W.buddy) {
          W.buddy = {
            id: W.nextId++, kind: 'buddy', who, slot: 1, def: W.R.HEROES[who], x: cx - W.halfW - 1, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
            face: 1, r: 0.35, scale: 1, hp: 1, maxHp: 1, st: 0, inv: 99, freeze: 0, flash: 0, weapon: null, score: 0,
          };
        }
        W.buddy.state = 'celebrate';
        W.buddy.st = 0;
        W.buddy.y = 0;
      }
      const pair = celebrants(W);
      pair.forEach((f) => {
        f.cx = cx + (f.who === 'teddy' ? -1.05 : 1.05);
        f.cz = 0.2;
        f.fromX = f.x;
        f.fromZ = f.z;
      });
      ev(W, 'celebrate', {});
    }
  }

  // Everyone on stage for the celebration: both brothers (in 1 player, one of them is the companion).
  function celebrants(W) {
    const list = W.heroes.slice();
    if (W.mode === '1p' && W.buddy) list.push(W.buddy);
    return list;
  }

  // The celebration's timeline (the renderer poses them from phaseT):
  // 0-1.1 walk to the middle, 1.1-3.3 signature moves, 3.3-3.9 step in, 3.9 HIGH FIVE!, then cheer.
  const CELEB = { walk: 1.1, moves: 3.3, five: 3.9, done: 6.2 };

  function stepCelebrate(W) {
    const t = W.phaseT;
    for (const f of celebrants(W)) {
      if (f.cx == null) continue;
      if (t < CELEB.walk) {
        const u = Math.min(1, t / (CELEB.walk * 0.85));
        f.x = f.fromX + (f.cx - f.fromX) * u;
        f.z = f.fromZ + (f.cz - f.fromZ) * u;
      } else if (t > CELEB.moves && t < CELEB.five) {
        const u = (t - CELEB.moves) / (CELEB.five - CELEB.moves);
        const toward = f.who === 'teddy' ? 1 : -1;
        f.x = f.cx + toward * 0.32 * u;
      }
      f.st = t;
    }
    if (t >= CELEB.five && !W.fived) {
      W.fived = true;
      ev(W, 'highfive', { x: W.cam.x, z: 0.2 });
    }
    if (t >= CELEB.done) setPhase(W, 'done');
  }

  function clampToView(W, h) {
    if (h.state === 'enter' || h.state === 'celebrate') return;
    h.x = clamp(h.x, viewL(W), viewR(W));
  }

  window.BrawlSim = {
    DT, create, step, secX, spawnEnemy, spawnItem, callBrother, teamUp, continueGame, celebrants, CELEB,
    // used by js/brains.js
    hurtHero, throwShot, ringBlast, startMove, hittable, standing, activeHero, viewL, viewR, ev, knockDown, damageEnemy,
    clamp, sign,
  };
})();
