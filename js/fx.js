/* Double TTrouble: effects. Comic POW bursts, flying stars, pillow feathers, dust, poof clouds, shockwave rings,
   emoji sprites (thrown notes and pies, treats flying to a brother) and confetti. Textures are painted once. */
(function () {
  'use strict';
  const T = THREE;
  let scene, G;
  const live = [];
  const burstCache = {};
  let featherTex = null, puffTex = null, ringTex = null;

  // Burst colours per word: [outer, inner, text]
  const STYLE = {
    'POW!': ['#ffd400', '#ff8a1f', '#e8203a'], 'BOP!': ['#ffe14d', '#ffffff', '#1f6fe0'], 'BAM!': ['#ffd400', '#ff8a1f', '#e8203a'],
    'WHUMP!': ['#ff8a1f', '#ffd400', '#7a1fd1'], 'FLOMP!': ['#ffffff', '#ffe9f4', '#e8207a'], 'FWUMP!': ['#ffffff', '#e8f6ff', '#1f6fe0'],
    'WHOOSH!': ['#18b4ff', '#ffffff', '#ff3d7f'], 'SQUAWK!': ['#ffd400', '#fff6a8', '#e85a1f'], 'WHAM!': ['#ff3d3d', '#ffd400', '#ffffff'],
    'STRIKE!': ['#2fb36a', '#d8ffd0', '#ffffff'], 'BOING!': ['#ff8a1f', '#ffd400', '#ffffff'], 'PEACE!': ['#ff9fd0', '#fff2a8', '#b02a8a'],
    'KA-BOOM!': ['#ff3d7f', '#ffd400', '#ffffff'], 'OOF!': ['#c8c8d8', '#ffffff', '#3a3a5a'], 'BONK!': ['#ff5aa0', '#ffd400', '#ffffff'],
    'THUD!': ['#c58a4a', '#ffd9a0', '#ffffff'], 'HI!': ['#ffd400', '#ffffff', '#2fb36a'], 'WHEE!': ['#8cd8ff', '#ffffff', '#ff3d7f'],
    'HIGH FIVE!': ['#ffd400', '#ff8a1f', '#ffffff'], 'SAVED!': ['#4aa8ff', '#d8f0ff', '#ffffff'], 'POOF!': ['#ffffff', '#f0f0ff', '#8d5bd8'],
    'BEEP!': ['#5ef2ff', '#ffffff', '#1f4fe0'], 'BOINK!': ['#9be37a', '#e8ffd8', '#3a2a5a'],
  };

  function burstTexture(word) {
    if (burstCache[word]) return burstCache[word];
    const [c, g] = G.makeCanvas(256, 256);
    const [outer, inner, text] = STYLE[word] || STYLE['POW!'];
    const star = (r1, r2, n, fill) => {
      g.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? r2 * (0.85 + ((i * 37) % 7) / 30) : r1 * (0.88 + ((i * 53) % 5) / 25);
        g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
      }
      g.closePath();
      g.fillStyle = fill;
      g.fill();
    };
    g.lineJoin = 'round';
    star(124, 70, 12, '#14121f');
    star(114, 62, 12, outer);
    star(84, 52, 10, inner);
    g.translate(128, 132);
    g.rotate(-0.12);
    const size = word.length > 8 ? 36 : word.length > 5 ? 46 : 60;
    g.font = `${size}px ${G.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = '#14121f';
    g.strokeText(word, 0, 0, 230);
    g.fillStyle = text;
    g.fillText(word, 0, 0, 230);
    return (burstCache[word] = G.toTexture(c));
  }

  function sprite(tex, size, x, y, z, o = {}) {
    const m = new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: !o.onTop, color: o.color || '#ffffff' });
    if (o.add) m.blending = T.AdditiveBlending;
    const s = new T.Sprite(m);
    s.scale.set(size, size, 1);
    s.position.set(x, y, z);
    s.renderOrder = o.onTop ? 20 : 5;
    scene.add(s);
    return s;
  }

  function add(s, fx) {
    live.push(Object.assign({ s, t: 0, life: 0.6, vx: 0, vy: 0, vz: 0, g: 0, spin: 0, size: s.scale.x, drag: 0 }, fx));
  }

  // ---------------------------------------------------------------- one-shots

  function pow(x, y, z, word, big) {
    const s = sprite(burstTexture(word), 0.1, x, y, z + 0.6, { onTop: true });
    s.material.rotation = (Math.random() - 0.5) * 0.5;
    add(s, { kind: 'burst', life: big ? 0.7 : 0.5, size: big ? 1.7 : 1.2 });
    stars(x, y, z, big ? 6 : 3);
  }

  function stars(x, y, z, n) {
    const tex = G.emojiTexture('⭐');
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2.5 + Math.random() * 3;
      const s = sprite(tex, 0.3, x, y, z + 0.4, { onTop: true });
      add(s, { kind: 'spark', life: 0.55 + Math.random() * 0.25, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 2, g: 9, spin: (Math.random() - 0.5) * 12 });
    }
  }

  // Pillow fights make feathers: they puff out, then flutter down.
  function feathers(x, y, z, n = 6) {
    if (!featherTex) {
      const [c, g] = G.makeCanvas(64, 64);
      g.translate(32, 32);
      g.rotate(0.6);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(0, 0, 8, 26, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#d8d8e8';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -24);
      g.lineTo(0, 28);
      g.stroke();
      featherTex = G.toTexture(c);
    }
    for (let i = 0; i < n; i++) {
      const s = sprite(featherTex, 0.28 + Math.random() * 0.12, x + (Math.random() - 0.5) * 0.4, y + (Math.random() - 0.5) * 0.4, z + 0.3);
      add(s, { kind: 'feather', life: 1.4 + Math.random() * 0.8, vx: (Math.random() - 0.5) * 4, vy: 1.5 + Math.random() * 2.5, vz: (Math.random() - 0.5) * 1.5, g: 5, drag: 3, spin: (Math.random() - 0.5) * 6, ph: Math.random() * 6 });
    }
  }

  function dust(x, z, n = 5, big = false) {
    const tex = G.dotTexture();
    for (let i = 0; i < n; i++) {
      const s = sprite(tex, big ? 0.8 : 0.5, x + (Math.random() - 0.5) * 0.6, 0.15, z + (Math.random() - 0.5) * 0.4, { color: '#e8dcc0' });
      s.material.opacity = 0.8;
      add(s, { kind: 'dust', life: 0.5 + Math.random() * 0.3, vx: (Math.random() - 0.5) * (big ? 4 : 2.4), vy: 0.6 + Math.random() * 0.8, size: s.scale.x });
    }
  }

  // A cartoon smoke-puff cloud (an enemy poofing away, a broken pillow).
  function poof(x, y, z, scale = 1) {
    if (!puffTex) {
      const [c, g] = G.makeCanvas(128, 128);
      g.fillStyle = '#ffffff';
      [[64, 70, 34], [38, 74, 24], [90, 74, 24], [52, 48, 24], [80, 50, 22]].forEach(([px, py, r]) => { g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill(); });
      g.strokeStyle = '#c8c8e0';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(64, 70, 34, 0.2, 2.9);
      g.stroke();
      puffTex = G.toTexture(c);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const s = sprite(puffTex, 0.6 * scale, x + Math.cos(a) * 0.3 * scale, y + Math.sin(a) * 0.4 * scale, z + 0.2);
      add(s, { kind: 'puff', life: 0.55 + Math.random() * 0.2, vx: Math.cos(a) * 1.6 * scale, vy: Math.sin(a) * 1.6 * scale + 0.6, size: 0.7 * scale, drag: 4 });
    }
    const s = sprite(puffTex, 1.2 * scale, x, y, z + 0.3);
    add(s, { kind: 'puff', life: 0.5, size: 1.5 * scale });
    const w = sprite(burstTexture('POOF!'), 0.1, x, y + 0.6 * scale, z + 0.5, { onTop: true });
    add(w, { kind: 'burst', life: 0.6, size: 1.0 });
  }

  // A flat shockwave ring on the ground. style: dunk (orange), peace (pink, with ✌️ and ⭐ riding it), stomp
  // (brown dust), hello (a small yellow one), blast (the team-up, screen-wide).
  function ring(x, z, max, speed, style, zScale = 1.6) {
    if (!ringTex) {
      const [c, g] = G.makeCanvas(256, 256);
      const gr = g.createRadialGradient(128, 128, 60, 128, 128, 127);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.45, 'rgba(255,255,255,0.35)');
      gr.addColorStop(0.75, 'rgba(255,255,255,1)');
      gr.addColorStop(0.9, 'rgba(255,255,255,1)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 256, 256);
      ringTex = G.toTexture(c);
    }
    const col = { dunk: '#ff7a10', peace: '#ff5ab8', stomp: '#a0602a', hello: '#ffc400', blast: '#ffe14d', zap: '#18c8ff' }[style] || '#ffffff';
    const m = new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshBasicMaterial({ map: ringTex, color: col, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.06, z);
    m.renderOrder = 3;
    scene.add(m);
    const riders = [];
    if (style === 'peace' || style === 'hello' || style === 'dunk') {
      const n = style === 'peace' ? 10 : 6;
      for (let i = 0; i < n; i++) {
        const e = style === 'peace' ? (i % 2 ? '⭐' : '✌️') : style === 'dunk' ? (i % 2 ? '⭐' : '💥') : '✨';
        riders.push({ s: sprite(G.emojiTexture(e), style === 'peace' ? 0.55 : 0.4, x, 0.6, z), a: (i / n) * Math.PI * 2 });
      }
    }
    live.push({ kind: 'ring', s: m, t: 0, life: max / speed + 0.25, max, speed, zScale, riders, x, z, style });
  }

  // An emoji that flies from one place to another in an arc (a treat to a brother, a basketball to a hoop).
  function arc(emoji, from, to, dur = 0.6, size = 0.6, height = 1.2, onDone) {
    const s = sprite(G.emojiTexture(emoji), size, from.x, from.y, from.z, { onTop: true });
    live.push({ kind: 'arc', s, t: 0, life: dur, from, to, height, size, onDone, vx: 0, vy: 0, g: 0, spin: 0 });
    return s;
  }

  // Float a little emoji up and away (+40 health, a heart...).
  function floatUp(emoji, x, y, z, size = 0.6) {
    const s = sprite(G.emojiTexture(emoji), size, x, y, z + 0.4, { onTop: true });
    add(s, { kind: 'spark', life: 1.0, vy: 1.6, size });
  }

  function confetti(x, y, z, n = 40) {
    const tex = G.dotTexture();
    const cols = ['#ff3d7f', '#ffd400', '#18b4ff', '#2fb36a', '#ff8a1f', '#8d5bd8'];
    for (let i = 0; i < n; i++) {
      const s = sprite(tex, 0.18, x + (Math.random() - 0.5) * 8, y + Math.random() * 2, z + (Math.random() - 0.5) * 2, { color: cols[i % cols.length] });
      add(s, { kind: 'feather', life: 2.5 + Math.random(), vx: (Math.random() - 0.5) * 2, vy: Math.random() * 3, g: 3, drag: 2.5, ph: Math.random() * 6 });
    }
  }

  // ---------------------------------------------------------------- update

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const e = live[i];
      e.t += dt;
      const u = e.t / e.life;
      if (u >= 1) {
        remove(e);
        live.splice(i, 1);
        if (e.onDone) e.onDone();
        continue;
      }
      if (e.kind === 'ring') {
        const r = Math.min(e.max, e.t * e.speed);
        e.s.scale.set(r + 0.01, (r + 0.01) / e.zScale, 1);
        e.s.material.opacity = u > 0.7 ? (1 - u) / 0.3 : 1;
        e.riders.forEach((rd, k) => {
          const a = rd.a + e.t * 2;
          rd.s.position.set(e.x + Math.cos(a) * r, 0.5 + Math.abs(Math.sin(e.t * 8 + k)) * 0.3, e.z + (Math.sin(a) * r) / e.zScale);
          rd.s.material.opacity = e.s.material.opacity;
        });
        continue;
      }
      if (e.kind === 'arc') {
        const p = Math.min(1, u);
        e.s.position.set(
          e.from.x + (e.to.x - e.from.x) * p,
          e.from.y + (e.to.y - e.from.y) * p + Math.sin(p * Math.PI) * e.height,
          e.from.z + (e.to.z - e.from.z) * p,
        );
        e.s.material.rotation += dt * 6;
        continue;
      }
      if (e.drag) {
        const k = Math.exp(-e.drag * dt);
        e.vx *= k;
        e.vz *= k;
        if (e.vy < 0) e.vy *= k;
      }
      e.vy -= e.g * dt;
      e.s.position.x += e.vx * dt + (e.kind === 'feather' ? Math.sin(e.t * 5 + e.ph) * 0.8 * dt : 0);
      e.s.position.y += e.vy * dt;
      e.s.position.z += e.vz * dt;
      if (e.kind === 'feather') {
        e.vy = Math.max(e.vy, -0.7);
        if (e.s.position.y < 0.05) { e.s.position.y = 0.05; e.vx = 0; e.vy = 0; }
        e.s.material.rotation = Math.sin(e.t * 4 + e.ph) * 0.8;
        e.s.material.opacity = u > 0.75 ? (1 - u) / 0.25 : 1;
        continue;
      }
      e.s.material.rotation += e.spin * dt;
      if (e.kind === 'burst') {
        // pop in with an overshoot, hold, then shrink away
        const k = u < 0.18 ? (u / 0.18) * 1.25 : u < 0.3 ? 1.25 - ((u - 0.18) / 0.12) * 0.25 : u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1;
        e.s.scale.setScalar(e.size * k);
      } else if (e.kind === 'dust' || e.kind === 'puff') {
        e.s.scale.setScalar(e.size * (1 + u * (e.kind === 'puff' ? 0.8 : 1.5)));
        e.s.material.opacity = (e.kind === 'dust' ? 0.8 : 1) * (1 - u);
      } else {
        e.s.material.opacity = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
      }
    }
  }

  function remove(e) {
    scene.remove(e.s);
    if (e.s.material.map && e.kind === 'ring') e.s.geometry.dispose();
    e.s.material.dispose();
    if (e.riders) e.riders.forEach((r) => { scene.remove(r.s); r.s.material.dispose(); });
  }

  function clear() {
    for (const e of live) remove(e);
    live.length = 0;
  }

  function init(sc) {
    scene = sc;
    G = window.Kit.gfx;
    Object.keys(STYLE).forEach(burstTexture); // paint them now, not mid-fight
  }

  window.BrawlFx = { init, pow, stars, feathers, dust, poof, ring, arc, floatUp, confetti, update, clear, sprite, burstTexture, count: () => live.length };
})();
