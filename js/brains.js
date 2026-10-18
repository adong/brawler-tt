/* Double TTrouble: brains. How the gang and the bosses decide what to do, how the companion fights beside you,
   and the simple bot that plays the game in the headless check (node tools/check.js) and behind the title screen.
   Only a few of the gang attack at once (they take turns, like in the old arcade brawlers); the others wait a
   few steps away. Every attack shows a "!" first (the windup), so there's time to get out of the way. */
(function () {
  'use strict';
  const DT = 1 / 60;
  const Sim = () => window.BrawlSim;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

  // ---------------------------------------------------------------- who attacks

  function targetOf(W, e) {
    let best = null, bd = Infinity;
    for (const h of W.heroes) {
      if (!Sim().standing(h)) continue;
      const d = Math.abs(h.x - e.x) + Math.abs(h.z - e.z) * 1.5 + (e.ai.tgt === h.id ? -1.2 : 0);
      if (d < bd) { bd = d; best = h; }
    }
    if (best) e.ai.tgt = best.id;
    return best;
  }

  // Hand out attack turns: the closest few (and every boss) may attack, the rest hang back.
  function tokens(W) {
    const busy = [], wait = [];
    for (const e of W.enemies) {
      if (e.boss) { e.ai.token = true; continue; }
      if (e.state === 'windup' || e.state === 'attack') { e.ai.token = true; busy.push(e); continue; }
      if (!['idle', 'walk', 'recover'].includes(e.state)) { e.ai.token = false; continue; }
      const t = targetOf(W, e);
      e.ai.dist = t ? Math.abs(t.x - e.x) + Math.abs(t.z - e.z) : 99;
      wait.push(e);
    }
    wait.sort((a, b) => a.ai.dist - b.ai.dist);
    let free = W.diff.maxAttackers - busy.length;
    const sides = {};
    for (const e of busy) sides[e.ai.tgt] = e.ai.side;
    for (const e of wait) {
      e.ai.token = free > 0;
      if (!e.ai.token) continue;
      free--;
      // a second attacker on the same brother comes round the other side
      if (sides[e.ai.tgt] != null && sides[e.ai.tgt] === e.ai.side && !e.ai.flanked) { e.ai.side = -e.ai.side; e.ai.flanked = true; }
      sides[e.ai.tgt] = e.ai.side;
    }
  }

  // ---------------------------------------------------------------- the gang

  function enemy(W, e) {
    if (e.boss) return boss(W, e);
    const ai = e.ai;
    const t = targetOf(W, e);
    const sp = e.def.speed * W.diff.enemySpeed;
    ai.cool -= DT;
    switch (e.state) {
      case 'idle': case 'walk': {
        if (!t) { e.vx = e.vz = 0; e.state = 'idle'; return; }
        // stay on whichever side of the brother you're on (unless you're coming round to flank him)
        if (Math.abs(e.x - t.x) > 0.4 && !(ai.token && ai.flanked)) ai.side = sign(e.x - t.x);
        if (!ai.token) ai.flanked = false;
        let tx, tz, speed;
        if (ai.token) {
          const reach = e.def.attack === 'hop' ? 1.9 : e.def.reach * 0.85;
          tx = t.x + ai.side * reach;
          tz = t.z;
          speed = sp;
          // the spot is off-screen: come round the other side
          if (tx < Sim().viewL(W) + 0.2 || tx > Sim().viewR(W) - 0.2) { ai.side = -ai.side; tx = t.x + ai.side * reach; }
          // coming round to his other side: walk around him (up or down the street), not through him
          if (sign(e.x - t.x) !== ai.side && Math.abs(e.x - t.x) < 1.2) {
            ai.flankT = (ai.flankT || 0) + DT;
            if (ai.flankT > 2.5) { ai.side = sign(e.x - t.x) || ai.side; ai.flanked = false; ai.flankT = 0; }
            else {
              const up = t.z - W.zMin > W.zMax - t.z ? -1 : 1;
              tx = e.x + ai.side * 0.6;
              tz = clamp(t.z + up * 0.85, W.zMin, W.zMax);
            }
          } else ai.flankT = 0;
          const dx = tx - e.x, dz = tz - e.z;
          if (Math.abs(dx) < 0.28 && Math.abs(dz) < 0.22 && ai.cool <= 0) {
            e.face = sign(t.x - e.x) || e.face;
            e.state = 'windup';
            e.st = 0;
            e.vx = e.vz = 0;
            Sim().ev(W, 'windup', { id: e.id, x: e.x, y: 2.3 * e.scale, z: e.z });
            return;
          }
        } else {
          // hang back a few steps away, bobbing about
          tx = t.x + ai.side * (2.7 + ai.spread * 1.3);
          tz = clamp(t.z + ai.zoff, W.zMin + 0.2, W.zMax - 0.2);
          speed = sp * 0.55;
          if (tx < Sim().viewL(W) + 0.3 || tx > Sim().viewR(W) - 0.3) { ai.side = -ai.side; tx = t.x + ai.side * (2.7 + ai.spread * 1.3); }
          ai.think -= DT;
          if (ai.think <= 0) { ai.think = 1.5 + W.rand() * 2; ai.zoff = (W.rand() - 0.5) * 1.8; }
        }
        moveTo(W, e, tx, tz, speed, t);
        return;
      }
      case 'windup': {
        e.vx = e.vz = 0;
        if (t) e.face = sign(t.x - e.x) || e.face;
        const wind = e.def.windup * W.diff.windup;
        if (e.st >= wind) { e.state = 'attack'; e.st = 0; e.hitDone = false; startAttack(W, e, t); }
        return;
      }
      case 'attack': attackStep(W, e); return;
      case 'recover':
        e.vx *= 0.8; e.vz = 0;
        if (e.st >= (e.recover || 0.6)) { e.state = 'idle'; e.st = 0; ai.cool = (0.5 + W.rand() * 0.9) * W.diff.windup; }
        return;
    }
  }

  function moveTo(W, e, tx, tz, speed, t) {
    const dx = tx - e.x, dz = tz - e.z;
    const d = Math.hypot(dx, dz * 1.3);
    if (d < 0.12) {
      e.vx = e.vz = 0;
      e.state = 'idle';
      if (t) e.face = sign(t.x - e.x) || e.face;
      return;
    }
    e.vx = (dx / d) * speed;
    e.vz = (dz / d) * speed * 0.75;
    e.state = 'walk';
    // face the brother you're after, even when walking backwards
    if (t) e.face = sign(t.x - e.x) || e.face;
  }

  function startAttack(W, e, t) {
    const a = e.def.attack;
    Sim().ev(W, 'eswing', { id: e.id, kind: a, x: e.x, z: e.z, etype: e.type });
    if (a === 'hop') {
      const dist = t ? clamp(Math.abs(t.x - e.x) - 0.3, 0.5, 2.6) : 1.5;
      e.vy = 5;
      e.vx = e.face * dist / 0.55;
      e.y = 0.01;
    }
  }

  function attackStep(W, e) {
    const a = e.def.attack;
    const dmg = e.def.dmg;
    if (a === 'hop') {
      e.vy -= W.R.WORLD.GRAVITY * DT;
      e.y += e.vy * DT;
      if (!e.hitDone) e.hitDone = touchHero(W, e, 0.75, 0.5, dmg, false);
      if (e.y <= 0) {
        e.y = 0; e.vy = 0; e.vx = 0;
        e.state = 'recover'; e.st = 0; e.recover = 0.6;
        Sim().ev(W, 'land', { x: e.x, z: e.z, kind: 'enemy' });
      }
      return;
    }
    if (a === 'hug') {
      // a slow zombie lunge with arms out
      e.vx = e.st < 0.25 ? e.face * 2.0 : 0;
      if (!e.hitDone && e.st > 0.08 && e.st < 0.3) e.hitDone = reachHero(W, e, e.def.reach, 0.5, dmg, false);
      if (e.st > 0.35) { e.state = 'recover'; e.st = 0; e.recover = 0.75; e.vx = 0; }
      return;
    }
    // punch (robots)
    e.vx = e.st < 0.12 ? e.face * 1.2 : 0;
    if (!e.hitDone && e.st > 0.06 && e.st < 0.18) e.hitDone = reachHero(W, e, e.def.reach, 0.5, dmg, false);
    if (e.st > 0.3) { e.state = 'recover'; e.st = 0; e.recover = 0.55; e.vx = 0; }
  }

  // A blow in front of e: hits the first brother within reach. Returns true once something's hit (or blocked).
  function reachHero(W, e, reach, depth, dmg, knock, word) {
    for (const h of W.heroes) {
      if (!Sim().standing(h) || h.y > 1.0) continue;
      const dx = (h.x - e.x) * e.face;
      if (dx < -0.2 || dx > reach + 0.15) continue;
      if (Math.abs(h.z - e.z) > depth) continue;
      Sim().hurtHero(W, h, dmg, { knock, dir: e.face, by: e, word });
      return true;
    }
    return false;
  }

  // Bumping into a brother (hops, charges, swoops).
  function touchHero(W, e, rx, rz, dmg, knock) {
    for (const h of W.heroes) {
      if (!Sim().standing(h)) continue;
      if (Math.abs(h.x - e.x) < rx && Math.abs(h.z - e.z) < rz && Math.abs(h.y - e.y) < 1.2) {
        Sim().hurtHero(W, h, dmg, { knock, dir: sign(h.x - e.x) || e.face, by: e });
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- bosses

  const BOSS_WIND = { swipe: 0.55, stomp: 0.55, throw: 0.5, charge: 0.65, zap: 0.75, summon: 0.6, swoop: 0.45 };

  function boss(W, e) {
    const ai = e.ai;
    const t = targetOf(W, e);
    const D = e.def;
    const sp = D.speed * W.diff.enemySpeed;
    const angry = e.hp < e.maxHp * 0.5;
    if (angry && !ai.angry) { ai.angry = true; Sim().ev(W, 'angry', { id: e.id, x: e.x, y: 2.8 * e.scale, z: e.z }); }
    ai.cool -= DT;
    switch (e.state) {
      case 'idle': case 'walk': {
        if (!t) { e.vx = e.vz = 0; e.state = 'idle'; return; }
        if (Math.abs(e.x - t.x) > 0.5) ai.side = sign(e.x - t.x);
        if (!ai.plan && ai.cool <= 0) ai.plan = pickBossMove(W, e, t);
        const plan = ai.plan;
        if (!plan) {
          // between moves: keep a little distance and shuffle about
          let tx = t.x + ai.side * (2.6 + ai.spread);
          if (tx < Sim().viewL(W) + 0.5 || tx > Sim().viewR(W) - 0.5) { ai.side = -ai.side; tx = t.x + ai.side * (2.6 + ai.spread); }
          moveTo(W, e, tx, clamp(t.z + ai.zoff * 0.5, W.zMin, W.zMax), sp * 0.6, t);
          return;
        }
        // walk to where the move starts
        let tx = e.x, tz = e.z, ready = true;
        const reach = 1.25 * e.scale;
        if (plan === 'swipe') {
          tx = t.x + ai.side * reach * 0.8; tz = t.z;
          ready = Math.abs(tx - e.x) < 0.35 && Math.abs(tz - e.z) < 0.3;
        } else if (plan === 'charge' || plan === 'zap') {
          tz = t.z;
          if (Math.abs(t.x - e.x) < 3) tx = t.x + ai.side * 3.4;
          ready = Math.abs(tz - e.z) < 0.25 && Math.abs(t.x - e.x) >= 2.8;
        } else if (plan === 'throw') {
          if (Math.abs(t.x - e.x) < 2.6) tx = t.x + ai.side * 3.6;
          ready = Math.abs(t.x - e.x) >= 2.4;
        }
        if (tx < Sim().viewL(W) + 0.3 || tx > Sim().viewR(W) - 0.3) { ai.side = -ai.side; ai.plan = null; return; }
        if (!ready && ai.planT > 3.5) { ai.plan = null; ai.planT = 0; ai.cool = 0.3; return; }
        ai.planT = (ai.planT || 0) + DT;
        if (!ready) { moveTo(W, e, tx, tz, sp, t); return; }
        e.vx = e.vz = 0;
        e.face = sign(t.x - e.x) || e.face;
        e.state = 'windup';
        e.st = 0;
        e.move = plan;
        ai.plan = null;
        ai.planT = 0;
        Sim().ev(W, 'windup', { id: e.id, x: e.x, y: 2.3 * e.scale, z: e.z, move: plan, boss: true });
        return;
      }
      case 'windup': {
        e.vx = e.vz = 0;
        if (t && e.move !== 'charge' && e.move !== 'zap') e.face = sign(t.x - e.x) || e.face;
        if (e.st >= BOSS_WIND[e.move] * (W.diff.windup > 1 ? 1.3 : 1)) {
          e.state = 'attack';
          e.st = 0;
          e.hitDone = false;
          bossStart(W, e, t);
        }
        return;
      }
      case 'attack': bossAttack(W, e, t); return;
      case 'recover':
        e.vx *= 0.8; e.vz = 0;
        if (e.st >= (e.recover || 0.7)) {
          e.state = 'idle';
          e.st = 0;
          ai.cool = (1.0 + W.rand() * 0.9) * (angry ? 0.7 : 1) * (W.diff.windup > 1 ? 1.4 : 1);
        }
        return;
    }
  }

  function pickBossMove(W, e, t) {
    const dx = Math.abs(t.x - e.x);
    const minions = W.enemies.filter((o) => !o.boss && !o.ko).length;
    const opts = [];
    for (const [m, w] of Object.entries(e.def.moves)) {
      let weight = w;
      if (m === 'swipe' && dx > 3) weight *= 0.5;
      if ((m === 'throw' || m === 'zap' || m === 'charge') && dx < 2) weight *= 0.4;
      if (m === 'summon' && (minions >= 2 || W.t - (e.ai.summoned || -99) < 12)) weight = 0;
      if (m === e.ai.last) weight *= 0.5;
      if (weight > 0) opts.push([m, weight]);
    }
    let r = W.rand() * opts.reduce((a, o) => a + o[1], 0);
    for (const [m, w] of opts) { if ((r -= w) <= 0) { e.ai.last = m; return m; } }
    return 'swipe';
  }

  function bossStart(W, e, t) {
    const m = e.move;
    Sim().ev(W, 'eswing', { id: e.id, kind: m, x: e.x, z: e.z, etype: e.type, boss: true });
    if (m === 'stomp') {
      const tx = t ? clamp(t.x, Sim().viewL(W) + 1, Sim().viewR(W) - 1) : e.x;
      e.vy = 8.5;
      e.y = 0.01;
      e.vx = clamp((tx - e.x) / 0.95, -6, 6);
      e.vz = t ? clamp((t.z - e.z) / 0.95, -2, 2) : 0;
    } else if (m === 'swoop') {
      e.swoop = { phase: 'up', tx: t ? t.x : e.x, tz: t ? t.z : e.z };
    } else if (m === 'summon') {
      e.ai.summoned = W.t;
      const type = e.def.summon || 'zombie';
      Sim().spawnEnemy(W, type, 1);
      Sim().spawnEnemy(W, type, -1);
    } else if (m === 'throw') {
      const kind = e.def.throws || 'note';
      const tz = t ? t.z : e.z, tx = t ? t.x : e.x + e.face * 4;
      const spread = kind === 'note' ? [-0.9, 0, 0.9] : [-0.7, 0.7];
      spread.forEach((dz, i) => Sim().throwShot(W, e, kind, tx + e.face * i * 0.4, clamp(tz + dz, W.zMin, W.zMax)));
    } else if (m === 'zap') {
      Sim().throwShot(W, e, 'zap', e.x + e.face * 8, e.z);
    }
  }

  function bossAttack(W, e, t) {
    const m = e.move;
    const D = e.def;
    const reach = 1.25 * e.scale;
    switch (m) {
      case 'swipe':
        e.vx = e.st < 0.15 ? e.face * 1.5 : 0;
        if (!e.hitDone && e.st > 0.1 && e.st < 0.28) e.hitDone = reachHero(W, e, reach + 0.3, 0.65, D.dmg, true, 'WHUMP!');
        if (e.st > 0.45) done(e, 0.6);
        return;
      case 'stomp':
        e.vy -= W.R.WORLD.GRAVITY * DT;
        e.y += e.vy * DT;
        if (e.y <= 0) {
          e.y = 0; e.vy = 0; e.vx = 0; e.vz = 0;
          Sim().ringBlast(W, e, { x: e.x, z: e.z, max: 3.4, speed: 6.5, dmg: D.dmg * 0.8, zScale: 1.6, kind: 'stomp' });
          Sim().ev(W, 'stomp', { id: e.id, x: e.x, z: e.z });
          done(e, 0.9);
        }
        return;
      case 'charge': {
        e.vx = e.face * 7.5 * W.diff.enemySpeed;
        e.vz = 0;
        if (!e.hitDone) e.hitDone = touchHero(W, e, 0.6 * e.scale, 0.5, D.dmg, true);
        const edge = e.face > 0 ? Sim().viewR(W) - 0.1 : Sim().viewL(W) + 0.1;
        if ((e.face > 0 ? e.x >= edge : e.x <= edge) || e.st > 2.2) {
          e.vx = 0;
          Sim().ev(W, 'bonkWall', { id: e.id, x: e.x, y: 2 * e.scale, z: e.z });
          done(e, 1.1);
        }
        return;
      }
      case 'swoop': {
        const s = e.swoop;
        if (s.phase === 'up') {
          e.y = Math.min(2.4, e.y + 7 * DT);
          e.vx = 0;
          if (e.st > 0.4) { s.phase = 'dive'; s.t0 = e.st; s.fromX = e.x; s.fromZ = e.z; s.tx = t ? t.x : s.tx; s.tz = t ? t.z : s.tz; }
        } else {
          const u = Math.min(1, (e.st - s.t0) / 0.7);
          const over = e.face * 1.5;
          e.x = s.fromX + (s.tx + over - s.fromX) * u;
          e.z = s.fromZ + (s.tz - s.fromZ) * u;
          e.y = 2.4 * (1 - u) * (1 - u) + 0.0;
          e.vx = 0; e.vz = 0;
          if (!e.hitDone && e.y < 1.5) e.hitDone = touchHero(W, e, 0.9, 0.55, D.dmg, true);
          if (u >= 1) { e.y = 0; done(e, 0.9); }
        }
        return;
      }
      case 'zap': case 'throw': case 'summon':
        e.vx = 0;
        if (e.st > 0.45) done(e, 0.6);
        return;
      default:
        done(e, 0.5);
    }
  }

  function done(e, rec) {
    e.state = 'recover';
    e.st = 0;
    e.recover = rec;
    e.vx = e.vz = 0;
  }

  // ---------------------------------------------------------------- the companion

  // Input for the companion while he fights beside you: go to the nearest baddie and bonk him.
  function buddy(W, b) {
    const h = W.heroes[0];
    let best = null, bd = Infinity;
    for (const e of W.enemies) {
      if (!Sim().hittable(W, e) || e.x < Sim().viewL(W) || e.x > Sim().viewR(W)) continue;
      const d = Math.abs(e.x - b.x) + Math.abs(e.z - b.z) * 1.5;
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) {
      // nobody to bonk: stay near your brother
      const tx = h.x - h.face * 1.5, tz = clamp(h.z + 0.6, W.zMin, W.zMax);
      return steer(b, tx, tz, 0.4);
    }
    return fightInput(W, b, best, 1.0);
  }

  function steer(f, tx, tz, slack) {
    const dx = tx - f.x, dz = tz - f.z;
    return {
      mx: Math.abs(dx) > slack ? sign(dx) * Math.min(1, Math.abs(dx)) : 0,
      mz: Math.abs(dz) > 0.12 ? sign(dz) * Math.min(1, Math.abs(dz) * 2) : 0,
    };
  }

  // Walk to a spot beside the target, face him, then press attack whenever a hit can start.
  function fightInput(W, f, e, gap, mem) {
    const side = Math.abs(e.x - f.x) < 0.3 ? -(f.face || 1) : sign(f.x - e.x);
    let tx = e.x + side * gap;
    if (tx < Sim().viewL(W) + 0.1 || tx > Sim().viewR(W) - 0.1) tx = e.x - side * gap;
    const inp = steer(f, tx, e.z, 0.18);
    const dx = (e.x - f.x) * f.face;
    const inRange = dx > 0.3 && dx < 1.35 + e.r && Math.abs(e.z - f.z) < 0.4;
    if (inRange) {
      inp.mx = 0;
      if (!mem || !mem.next || W.t > mem.next) {
        inp.attack = true;
        if (mem) mem.next = W.t + (mem.opts && mem.opts.kid ? 0.3 + W.rand() * 0.5 : 0.12);
      }
    } else if (Math.abs(tx - f.x) < 0.3 && Math.abs(e.z - f.z) < 0.3 && dx < 0) {
      inp.mx = sign(e.x - f.x); // turn round
    }
    return inp;
  }

  // ---------------------------------------------------------------- the test bot

  // A simple player for the headless check and the title-screen demo. mem keeps a little state between steps.
  function bot(W, h, mem = {}) {
    const inp = { mx: 0, mz: 0 };
    if (!Sim().standing(h) || W.phase !== 'play') {
      if (h.out && W.mode === '2p') inp.attack = W.t % 1 < 0.02;
      return inp;
    }
    const opts = mem.opts || {};
    // holding a baddie: bop bop toss (mashing, like a kid would)
    if (h.state === 'grab') {
      if (W.t > (mem.nextBop || 0)) { inp.attack = true; mem.nextBop = W.t + 0.2; }
      return inp;
    }
    // a "little kid" bot: slow to react, mashes now and then, never dodges or uses the special
    if (opts.kid) {
      opts.special = false;
      opts.dodge = false;
      if (W.t < (mem.daydream || 0)) return inp;
      if (W.rand() < 0.002) mem.daydream = W.t + 0.6 + W.rand();
    }
    // companion / team-up now and then
    if (opts.call && W.t > (mem.nextCall || 6)) {
      if (W.mode === '1p' || W.teamCd <= 0) {
        mem.nextCall = W.t + (opts.callEvery || 14);
        inp.call = true;
      }
    }
    const foes = W.enemies.filter((e) => Sim().hittable(W, e) && e.x > Sim().viewL(W) - 0.5 && e.x < Sim().viewR(W) + 0.5);
    // special when crowded
    const close = foes.filter((e) => Math.abs(e.x - h.x) < 2.4 && Math.abs(e.z - h.z) < 1.2).length;
    if (opts.special !== false && close >= 3 && h.hp > h.maxHp * 0.3 && W.t > (mem.nextSpecial || 0)) {
      mem.nextSpecial = W.t + 3;
      inp.special = true;
      return inp;
    }
    // hurt? go and eat something
    const food = W.items.find((it) => W.R.FOOD[it.kind] && it.x > Sim().viewL(W) && it.x < Sim().viewR(W));
    if (food && h.hp < h.maxHp * 0.5) return Object.assign(inp, steer(h, food.x, food.z, 0.2));
    // something to swing lying close by
    const wpn = !h.weapon && W.items.find((it) => W.R.WEAPONS[it.kind] && Math.abs(it.x - h.x) < 4 && it.x > Sim().viewL(W) && it.x < Sim().viewR(W));
    if (wpn && close === 0) return Object.assign(inp, steer(h, wpn.x, wpn.z, 0.2));
    // crates in reach
    if (!foes.length) {
      const crate = W.crates.find((c) => c.x > Sim().viewL(W) && c.x < Sim().viewR(W));
      if (crate) return fightInput(W, h, { x: crate.x, z: crate.z, r: 0.3 }, 1.0, mem);
      if (W.secState === 'travel') { inp.mx = 1; inp.mz = sign(-0.4 - h.z) * 0.5; }
      return inp;
    }
    // jump over a shockwave coming at us
    for (const s of W.shots) {
      if (s.team !== 'gang' || opts.kid) continue;
      if (s.kind === 'ring') {
        const d = Math.hypot(h.x - s.x, (h.z - s.z) * s.zScale);
        if (d > s.r && d - s.r < 0.9 && !s.hit.has(h.id)) { inp.jump = true; return inp; }
      } else if (opts.dodge !== false && Math.abs(s.z - h.z) < 0.6 && (s.x - h.x) * s.vx < 0 && Math.abs(s.x - h.x) < 3) {
        inp.mz = h.z > (W.zMin + W.zMax) / 2 ? -1 : 1;
        return inp;
      }
    }
    // pick the closest baddie, preferring one in our lane
    let best = null, bd = Infinity;
    for (const e of foes) {
      const d = Math.abs(e.x - h.x) + Math.abs(e.z - h.z) * 2.2;
      if (d < bd) { bd = d; best = e; }
    }
    // a boss charging along our lane: step out of the way
    if (best.boss && best.state === 'windup' && (best.move === 'charge' || best.move === 'zap') && Math.abs(best.z - h.z) < 0.7) {
      inp.mz = h.z > (W.zMin + W.zMax) / 2 ? -1 : 1;
      return inp;
    }
    const gap = h.weapon ? 1.3 : best.boss ? 0.95 + best.r * 0.5 : 1.0;
    return Object.assign(inp, fightInput(W, h, best, gap, mem));
  }

  window.BrawlBrains = { tokens, enemy, buddy, bot, fightInput };
})();
