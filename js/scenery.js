/* Double TTrouble: the six streets, built from boxes and canvas-painted textures (no image files).
   BrawlScenery.build(theme, length, rand) returns { group, light, update(t, camX) }.
   The street you walk on is z -2.7 (far) to 1.3 (near); scenery sits behind it (z < -3) and a little in front. */
(function () {
  'use strict';
  const T = THREE;
  const G = () => window.Kit.gfx;

  const mats = {};
  const mat = (color, o) => {
    const key = color + JSON.stringify(o || {});
    return mats[key] || (mats[key] = new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0 }, o)));
  };
  const basic = (color, o) => new T.MeshBasicMaterial(Object.assign({ color }, o));

  // a box sitting on y (its bottom), centred on x, z
  function box(parent, w, h, d, m, x, y, z, ry) {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), typeof m === 'string' ? mat(m) : m);
    mesh.position.set(x, y + h / 2, z);
    if (ry) mesh.rotation.y = ry;
    parent.add(mesh);
    return mesh;
  }
  function cyl(parent, r1, r2, h, m, x, y, z, seg = 12) {
    const mesh = new T.Mesh(new T.CylinderGeometry(r1, r2, h, seg), typeof m === 'string' ? mat(m) : m);
    mesh.position.set(x, y + h / 2, z);
    parent.add(mesh);
    return mesh;
  }
  function canvasTex(w, h, draw, rx, ry) {
    const [c, g] = G().makeCanvas(w, h);
    draw(g, w, h);
    const t = G().toTexture(c, !!rx);
    if (rx) t.repeat.set(rx, ry || 1);
    return t;
  }
  function plane(parent, w, h, m, x, y, z, rx) {
    const mesh = new T.Mesh(new T.PlaneGeometry(w, h), m);
    mesh.position.set(x, y, z);
    if (rx) mesh.rotation.x = rx;
    parent.add(mesh);
    return mesh;
  }
  // the ground: a long flat strip
  function floor(parent, L, z0, z1, tex, color) {
    const m = new T.MeshStandardMaterial({ color: color || '#ffffff', map: tex || null, roughness: 0.9 });
    const w = L + 60;
    if (tex) tex.repeat.set(w / 4, (z1 - z0) / 4);
    const mesh = plane(parent, w, z1 - z0, m, L / 2, 0, (z0 + z1) / 2, -Math.PI / 2);
    return mesh;
  }
  function skyTexture(stops) {
    return canvasTex(8, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      stops.forEach(([o, c]) => gr.addColorStop(o, c));
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
  }
  // Signs are part of the story, so they speak the player's language (Kit.lang; they're redrawn on a switch).
  const tr = (s) => (window.Kit.lang ? window.Kit.lang.t(s) : s);
  const zhFont = (px) => (window.Kit.lang && window.Kit.lang.is('zh') ? `900 ${px}px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif` : null);
  function sign(parent, text, w, h, bg, fg, x, y, z, font) {
    text = tr(text);
    const tex = canvasTex(512, Math.round((512 * h) / w), (g, cw, ch) => {
      g.fillStyle = bg;
      G().roundRect(g, 4, 4, cw - 8, ch - 8, Math.min(28, ch / 4));
      g.fill();
      g.lineWidth = 8;
      g.strokeStyle = '#14121f';
      g.stroke();
      g.fillStyle = fg;
      g.font = zhFont(Math.round(ch * 0.55)) || `${Math.round(ch * 0.55)}px ${font || G().FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, cw / 2, ch / 2 + ch * 0.04, cw - 30);
    });
    return plane(parent, w, h, new T.MeshStandardMaterial({ map: tex, roughness: 0.8 }), x, y, z);
  }
  function emojiSprite(parent, e, size, x, y, z) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: G().emojiTexture(e), transparent: true }));
    s.scale.set(size, size, 1);
    s.position.set(x, y, z);
    parent.add(s);
    return s;
  }
  function cloud(parent, x, y, z, s) {
    const g = new T.Group();
    const m = mat('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35 });
    [[0, 0, 1.6, 0.8], [1.1, -0.15, 1.2, 0.6], [-1.1, -0.2, 1.1, 0.55], [0.4, 0.4, 1.0, 0.6]].forEach(([dx, dy, w, h]) => box(g, w * 1.4, h, 0.8, m, dx, dy, 0));
    g.position.set(x, y, z);
    g.scale.setScalar(s);
    parent.add(g);
    return g;
  }
  function tree(parent, x, z, h, leaf) {
    box(parent, 0.35, h * 0.45, 0.35, '#8a5a32', x, 0, z);
    box(parent, h * 0.55, h * 0.38, h * 0.55, leaf, x, h * 0.4, z);
    box(parent, h * 0.4, h * 0.25, h * 0.4, leaf === '#4fb84a' ? '#5fcc56' : '#6fcf5a', x + 0.15, h * 0.75, z + 0.1);
  }
  function bench(parent, x, z, col) {
    box(parent, 1.8, 0.1, 0.5, col, x, 0.45, z);
    box(parent, 1.8, 0.45, 0.08, col, x, 0.55, z - 0.25);
    box(parent, 0.1, 0.45, 0.45, '#3a3a44', x - 0.75, 0, z);
    box(parent, 0.1, 0.45, 0.45, '#3a3a44', x + 0.75, 0, z);
  }
  function lamp(parent, x, z, glow) {
    box(parent, 0.12, 3.2, 0.12, '#2f3a4a', x, 0, z);
    box(parent, 0.45, 0.3, 0.45, mat('#fff4c0', { emissive: '#ffe48a', emissiveIntensity: glow || 0.6 }), x, 3.2, z);
  }

  // ---------------------------------------------------------------- the themes

  const THEMES = {};

  THEMES.park = (g, L, rnd) => {
    const grass = canvasTex(128, 128, (c) => {
      c.fillStyle = '#7fd35a'; c.fillRect(0, 0, 128, 128);
      c.fillStyle = '#74c94f';
      for (let i = 0; i < 4; i++) c.fillRect(0, i * 32, 128, 16);
      c.fillStyle = '#9be36f';
      for (let i = 0; i < 60; i++) c.fillRect(Math.random() * 128, Math.random() * 128, 2, 5);
    }, 1);
    floor(g, L, -40, 12, grass);
    const path = canvasTex(128, 128, (c) => {
      c.fillStyle = '#f0d9a8'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = '#d9bf88'; c.lineWidth = 3;
      for (let y = 0; y < 128; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < 128; x += 32) c.strokeRect(x + 2, y + 2, 28, 28);
    }, 1);
    const p = floor(g, L, -3.0, 1.7, path);
    p.position.y = 0.01;
    // hills, a fence, trees, benches, lamps, a playground, flowers
    const hill = mat('#62c04a');
    for (let x = -20; x < L + 30; x += 22 + rnd() * 10) {
      const m = new T.Mesh(new T.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), hill);
      m.scale.set(14 + rnd() * 6, 5 + rnd() * 3, 6);
      m.position.set(x, 0, -30 - rnd() * 5);
      g.add(m);
    }
    for (let x = -12; x < L + 12; x += 1.2) {
      box(g, 0.14, 0.9, 0.08, '#ffffff', x, 0, -3.45);
    }
    box(g, L + 26, 0.1, 0.06, '#ffffff', L / 2, 0.55, -3.42);
    box(g, L + 26, 0.1, 0.06, '#ffffff', L / 2, 0.25, -3.42);
    for (let x = -8; x < L + 12; x += 5 + rnd() * 4) tree(g, x, -5 - rnd() * 6, 3.5 + rnd() * 2.5, rnd() < 0.5 ? '#4fb84a' : '#3fa84a');
    for (let x = 6; x < L; x += 14 + rnd() * 6) bench(g, x, -4.0, '#e2733a');
    for (let x = 2; x < L + 10; x += 11) lamp(g, x, -3.9, 0.3);
    // playground
    const px = L * 0.45;
    box(g, 0.2, 2.6, 0.2, '#ff3d7f', px - 1.5, 0, -6.2);
    box(g, 0.2, 2.6, 0.2, '#ff3d7f', px + 1.5, 0, -6.2);
    box(g, 3.3, 0.18, 0.2, '#ff3d7f', px, 2.5, -6.2);
    box(g, 0.5, 0.06, 0.25, '#ffd400', px - 0.6, 1.0, -6.2);
    box(g, 0.5, 0.06, 0.25, '#18b4ff', px + 0.6, 1.0, -6.2);
    const slide = box(g, 0.8, 0.08, 3.0, '#ffd400', px + 4, 1.0, -6.5);
    slide.rotation.x = 0.55;
    box(g, 0.9, 2.0, 0.9, '#18b4ff', px + 4, 0, -7.8);
    for (let x = -6; x < L + 10; x += 2.5 + rnd() * 3) {
      emojiSprite(g, rnd() < 0.5 ? '🌼' : '🌷', 0.5, x, 0.25, 2.3 + rnd() * 0.8);
    }
    for (let i = 0; i < 9; i++) cloud(g, -10 + rnd() * (L + 20), 9 + rnd() * 4, -26 - rnd() * 8, 1 + rnd());
    return { sky: [[0, '#6fc3ff'], [0.7, '#bfe6ff'], [1, '#e8f7ff']], hemi: ['#ffffff', '#6a9a4a', 1.0], sun: ['#fff1d6', 1.0], fog: '#d6efff' };
  };

  THEMES.subway = (g, L, rnd) => {
    const tiles = canvasTex(128, 128, (c) => {
      c.fillStyle = '#b8bcc6'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = '#9da2ad'; c.lineWidth = 3;
      for (let i = 0; i <= 128; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 128); c.moveTo(0, i); c.lineTo(128, i); c.stroke(); }
    }, 1);
    floor(g, L, -3.3, 12, tiles);
    // yellow safety strip, the platform edge and the tracks behind
    box(g, L + 60, 0.02, 0.35, mat('#ffd400', { emissive: '#ffb000', emissiveIntensity: 0.15 }), L / 2, 0, -3.1);
    box(g, L + 60, 0.9, 0.3, '#8a8f99', L / 2, -0.9, -3.45);
    box(g, L + 60, 0.05, 3.2, '#3b3530', L / 2, -0.85, -5.1);
    for (const z of [-4.4, -5.6]) box(g, L + 60, 0.12, 0.12, mat('#c9ccd4', { metalness: 0.6, roughness: 0.3 }), L / 2, -0.8, z);
    for (let x = -20; x < L + 30; x += 0.9) box(g, 0.25, 0.08, 1.8, '#5a4636', x, -0.82, -5.0);
    // the far wall: tiles, a blue stripe, the station name, posters
    const wallTex = canvasTex(256, 256, (c) => {
      c.fillStyle = '#f2f4f7'; c.fillRect(0, 0, 256, 256);
      c.strokeStyle = '#d5dae2'; c.lineWidth = 3;
      for (let y = 0; y < 256; y += 21) for (let x = (y / 21) % 2 ? 0 : 21; x < 256; x += 42) c.strokeRect(x, y, 42, 21);
    }, 1);
    wallTex.repeat.set((L + 60) / 4, 4);
    plane(g, L + 60, 16, new T.MeshStandardMaterial({ map: wallTex, roughness: 0.6 }), L / 2, 7, -6.8);
    box(g, L + 60, 1.2, 0.1, '#2f6fdc', L / 2, 6.4, -6.75);
    box(g, L + 60, 0.5, 0.06, '#2f6fdc', L / 2, 1.2, -6.75);
    box(g, L + 60, 0.15, 0.06, '#ffd400', L / 2, 1.75, -6.75);
    for (let x = 4; x < L + 6; x += 16) sign(g, 'PILLOW ST.', 4, 0.9, '#2f6fdc', '#ffffff', x, 2.8, -6.7);
    const posters = ['🍦', '🏀', '🦖', '🚀', '🐻', '🛸'];
    for (let x = 12; x < L + 6; x += 16) {
      const t = canvasTex(128, 170, (c) => {
        c.fillStyle = ['#ff8ab0', '#ffd45a', '#8cd8ff', '#a6f08a'][Math.floor(rnd() * 4)];
        c.fillRect(0, 0, 128, 170);
        c.font = `80px ${G().EMOJI_FONT}`; c.textAlign = 'center'; c.fillText(posters[Math.floor(rnd() * posters.length)], 64, 100);
        c.fillStyle = '#14121f'; c.font = zhFont(20) || `18px ${G().FONT}`; c.fillText(tr('PILLOW FUN!'), 64, 150);
      });
      plane(g, 1.5, 2, new T.MeshStandardMaterial({ map: t }), x, 3.0, -6.7);
    }
    // pillars at the platform's far edge, ceiling lights
    for (let x = 0; x < L + 10; x += 8) {
      box(g, 0.7, 6, 0.7, '#e7e2d6', x, 0, -3.4);
      box(g, 0.75, 0.4, 0.75, '#2f6fdc', x, 0, -3.4);
    }
    for (let x = -4; x < L + 10; x += 6) box(g, 3.2, 0.25, 0.3, basic('#fffbe8'), x, 5.6, -6.6);
    for (let x = 10; x < L; x += 19) bench(g, x, 2.2, '#2f6fdc');
    // a train that zooms past now and then
    const train = new T.Group();
    const car = mat('#e9edf2', { metalness: 0.3, roughness: 0.4 });
    for (let i = 0; i < 4; i++) {
      box(train, 11.5, 3.0, 2.6, car, i * 12, -0.7, 0);
      box(train, 11.5, 0.35, 2.65, '#e53935', i * 12, 0.3, 0);
      for (let w = -4.5; w <= 4.5; w += 1.8) box(train, 1.2, 0.9, 2.7, basic('#9fdcff'), i * 12 + w, 1.0, 0);
    }
    train.position.set(-200, 0, -5.0);
    g.add(train);
    let trainT = 4;
    return {
      sky: [[0, '#3a3f4f'], [1, '#5a6070']], hemi: ['#ffffff', '#7a7f8c', 1.0], sun: ['#fffbe8', 0.7], fog: '#5a6070',
      update(dt, camX) {
        trainT -= dt;
        if (trainT < 0) { trainT = 14 + Math.random() * 8; train.position.x = camX - 70; train.userData.go = true; }
        if (train.userData.go) {
          train.position.x += dt * 30;
          if (train.position.x > camX + 40) train.userData.go = false;
        }
      },
    };
  };

  THEMES.rooftop = (g, L, rnd) => {
    const tar = canvasTex(128, 128, (c) => {
      c.fillStyle = '#7a7280'; c.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 300; i++) { c.fillStyle = Math.random() < 0.5 ? '#6a6370' : '#8a8290'; c.fillRect(Math.random() * 128, Math.random() * 128, 3, 3); }
      c.strokeStyle = '#655e6b'; c.lineWidth = 2; c.strokeRect(1, 1, 126, 126);
    }, 1);
    floor(g, L, -3.6, 4, tar);
    // the parapet wall at the back and the drop to the street in front
    const brick = canvasTex(128, 64, (c) => {
      c.fillStyle = '#c4644a'; c.fillRect(0, 0, 128, 64);
      c.strokeStyle = '#9a4a36'; c.lineWidth = 3;
      for (let y = 0; y < 64; y += 16) for (let x = (y / 16) % 2 ? 16 : 0; x < 128; x += 32) c.strokeRect(x, y, 32, 16);
    }, 1);
    brick.repeat.set((L + 60) / 2, 1);
    const wall = box(g, L + 60, 0.9, 0.4, new T.MeshStandardMaterial({ map: brick }), L / 2, 0, -3.7);
    box(g, L + 60, 0.12, 0.55, '#e6d6c6', L / 2, 0.9, -3.7);
    void wall;
    box(g, L + 60, 0.5, 0.3, '#e6d6c6', L / 2, -0.5, 4.1);
    // water towers, air conditioners, antennas, a washing line
    for (let x = 6; x < L + 10; x += 17 + rnd() * 6) {
      const z = -6 - rnd() * 2;
      for (const dx of [-0.8, 0.8]) for (const dz of [-0.8, 0.8]) box(g, 0.12, 2.2, 0.12, '#4a3a30', x + dx, 0, z + dz);
      cyl(g, 1.3, 1.3, 2.4, '#a86a3a', x, 2.2, z);
      const roof = new T.Mesh(new T.ConeGeometry(1.45, 0.9, 12), mat('#7a4a2a'));
      roof.position.set(x, 5.05, z);
      g.add(roof);
    }
    for (let x = 0; x < L + 10; x += 9 + rnd() * 5) {
      const ac = new T.Group();
      box(ac, 1.6, 1.0, 1.0, '#c9cfd6', 0, 0, 0);
      cyl(ac, 0.38, 0.38, 0.05, '#4a5058', 0, 1.0, 0, 16);
      ac.position.set(x, 0, -4.6 - rnd() * 0.8);
      g.add(ac);
    }
    for (let x = 14; x < L; x += 26) {
      box(g, 0.08, 3.2, 0.08, '#7a7f8a', x, 0, -4.4);
      box(g, 0.08, 3.2, 0.08, '#7a7f8a', x + 5, 0, -4.4);
      const line = box(g, 5, 0.03, 0.03, '#ffffff', x + 2.5, 3.0, -4.4);
      void line;
      ['#ff8ab0', '#8cd8ff', '#ffd45a', '#a6f08a'].forEach((col, i) => box(g, 0.7, 0.8, 0.04, col, x + 0.8 + i * 1.15, 2.2, -4.4));
    }
    // the city skyline at sunset
    const winTex = canvasTex(64, 128, (c) => {
      c.fillStyle = '#4a3a6a'; c.fillRect(0, 0, 64, 128);
      for (let y = 6; y < 128; y += 14) for (let x = 6; x < 64; x += 14) {
        c.fillStyle = Math.random() < 0.55 ? '#ffd86a' : '#2e2448';
        c.fillRect(x, y, 8, 8);
      }
    }, 1);
    for (let x = -30; x < L + 40; x += 4 + rnd() * 4) {
      const h = 6 + rnd() * 16, w = 3 + rnd() * 4;
      const t = winTex.clone(); t.needsUpdate = true; t.repeat.set(w / 3, h / 6);
      box(g, w, h, 3, new T.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.25 }), x, -2, -22 - rnd() * 14);
    }
    const sun = new T.Mesh(new T.CircleGeometry(4, 32), basic('#ffd27a'));
    sun.position.set(L * 0.5, 7, -60);
    g.add(sun);
    for (let i = 0; i < 6; i++) cloud(g, -10 + rnd() * (L + 20), 12 + rnd() * 5, -45, 1.4 + rnd());
    return {
      sky: [[0, '#5a3d8a'], [0.45, '#e2709a'], [0.8, '#ffb46a'], [1, '#ffd88a']], hemi: ['#ffe0d0', '#5a4a6a', 0.95], sun: ['#ffc69a', 1.0], fog: '#e898a0',
      follow: sun,
    };
  };

  THEMES.mall = (g, L, rnd) => {
    const chk = canvasTex(128, 128, (c) => {
      c.fillStyle = '#fff3e0'; c.fillRect(0, 0, 128, 128);
      c.fillStyle = '#ffd9b8'; c.fillRect(0, 0, 64, 64); c.fillRect(64, 64, 64, 64);
    }, 1);
    floor(g, L, -4.6, 12, chk).material.roughness = 0.35;
    const shops = [['TOYS', '#ff3d7f', '🧸'], ['ICE CREAM', '#18b4ff', '🍦'], ['PETS', '#2fb36a', '🐶'], ['CANDY', '#ff8a1f', '🍭'], ['GAMES', '#8d5bd8', '🎮'], ['SHOES', '#e53935', '👟'], ['BOOKS', '#2f6fdc', '📚'], ['PIZZA', '#ffb000', '🍕']];
    let i = Math.floor(rnd() * shops.length);
    for (let x = -6; x < L + 12; x += 9) {
      const [name, col, em] = shops[i++ % shops.length];
      box(g, 8.2, 4.4, 0.4, '#f7efe6', x, 0, -4.9);
      box(g, 6.4, 2.8, 0.1, mat('#bfe8ff', { roughness: 0.15, metalness: 0.2, emissive: '#a8dcff', emissiveIntensity: 0.25 }), x, 0.2, -4.68);
      // the awning: stripes
      for (let s = 0; s < 8; s++) box(g, 0.8, 0.12, 0.9, s % 2 ? '#ffffff' : col, x - 2.8 + s * 0.8, 3.0, -4.3).rotation.x = -0.35;
      sign(g, name, 4.2, 0.85, col, '#ffffff', x, 3.75, -4.65);
      emojiSprite(g, em, 1.3, x - 1.6, 1.3, -4.55);
      emojiSprite(g, em, 1.0, x + 1.7, 1.0, -4.55);
      box(g, 0.8, 4.4, 0.8, '#e8dccc', x + 4.5, 0, -4.9);
    }
    // the upper floor
    box(g, L + 60, 0.5, 2.0, '#efe3d4', L / 2, 4.4, -5.0);
    box(g, L + 60, 0.9, 0.08, mat('#cfefff', { transparent: true, opacity: 0.5 }), L / 2, 4.9, -4.05);
    box(g, L + 60, 0.08, 0.12, '#c0a070', L / 2, 5.8, -4.05);
    for (let x = -4; x < L + 10; x += 9) {
      const [, col] = shops[(i + Math.floor(x)) % shops.length];
      box(g, 7.6, 3.5, 0.3, col, x, 4.9, -6.2);
      box(g, 6, 2.2, 0.1, mat('#bfe8ff', { roughness: 0.15, emissive: '#a8dcff', emissiveIntensity: 0.3 }), x, 5.4, -6.0);
    }
    plane(g, L + 60, 10, mat('#f7efe6'), L / 2, 9, -7.2);
    for (let x = -4; x < L + 10; x += 9) box(g, 6, 1.6, 0.1, mat('#cfefff', { emissive: '#bfe8ff', emissiveIntensity: 0.5 }), x, 8.2, -7.1);
    // plants, a fountain, balloons
    for (let x = 4; x < L + 6; x += 9) {
      cyl(g, 0.4, 0.3, 0.6, '#c46a3a', x, 0, -3.6);
      box(g, 0.9, 1.0, 0.9, '#3fa84a', x, 0.6, -3.6);
    }
    const fx = L * 0.55;
    cyl(g, 2.2, 2.4, 0.6, '#e8dccc', fx, 0, -6.5, 20);
    cyl(g, 2.0, 2.0, 0.05, mat('#7fd4ff', { emissive: '#4ab8ff', emissiveIntensity: 0.3, roughness: 0.1 }), fx, 0.55, -6.5, 20);
    cyl(g, 0.25, 0.3, 1.6, '#e8dccc', fx, 0.6, -6.5);
    for (let x = 3; x < L + 6; x += 7 + rnd() * 5) {
      const b = emojiSprite(g, '🎈', 0.9, x, 5.5 + rnd() * 1.5, -3.8 - rnd());
      b.userData.bob = rnd() * 6;
    }
    return { sky: [[0, '#fff3e0'], [1, '#ffe2c0']], hemi: ['#ffffff', '#c8a888', 1.05], sun: ['#fffaf0', 0.8], fog: '#fff0dc' };
  };

  THEMES.gym = (g, L, rnd) => {
    const wood = canvasTex(256, 128, (c) => {
      c.fillStyle = '#e6a75c'; c.fillRect(0, 0, 256, 128);
      for (let y = 0; y < 128; y += 16) {
        c.fillStyle = (y / 16) % 2 ? '#dc9c52' : '#eab066';
        c.fillRect(0, y, 256, 15);
        c.fillStyle = '#c4854a';
        c.fillRect((y * 37) % 256, y, 2, 16);
      }
    }, 1);
    floor(g, L, -4.0, 12, wood).material.roughness = 0.45;
    // court lines: a centre circle and keys every so often
    const line = mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.2 });
    box(g, L + 60, 0.012, 0.08, line, L / 2, 0.005, -2.9);
    box(g, L + 60, 0.012, 0.08, line, L / 2, 0.005, 1.5);
    for (let x = 14; x < L; x += 28) {
      box(g, 0.08, 0.012, 4.4, line, x, 0.005, -0.7);
      const ring = new T.Mesh(new T.RingGeometry(1.4, 1.5, 40), line);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.008, -0.7);
      g.add(ring);
    }
    // bleachers
    for (let r = 0; r < 5; r++) box(g, L + 60, 0.5, 0.8, r % 2 ? '#2f6fdc' : '#3d86f0', L / 2, r * 0.5, -4.6 - r * 0.8);
    // fans in the stands: little emoji
    const fans = ['😀', '😄', '🤩', '😆', '🥳', '😺'];
    for (let x = -6; x < L + 8; x += 1.6 + rnd() * 1.6) {
      const r = Math.floor(rnd() * 4) + 1;
      const s = emojiSprite(g, fans[Math.floor(rnd() * fans.length)], 1.0, x, r * 0.5 + 0.5, -4.6 - r * 0.8 + 0.1);
      s.userData.bob = rnd() * 6;
    }
    // the wall: hoops, banners, a scoreboard, windows
    plane(g, L + 60, 12, mat('#f0e6d6'), L / 2, 5, -9);
    for (let x = 10; x < L + 6; x += 20) {
      box(g, 2.6, 1.6, 0.1, '#ffffff', x, 4.2, -8.6);
      box(g, 0.9, 0.7, 0.12, mat('#ffffff', { emissive: '#ff6a00', emissiveIntensity: 0 }), x, 4.4, -8.55).material = mat('#ff3d3d');
      const rim = new T.Mesh(new T.TorusGeometry(0.42, 0.04, 6, 20), mat('#ff6a00', { metalness: 0.4 }));
      rim.rotation.x = Math.PI / 2;
      rim.position.set(x, 4.1, -8.1);
      g.add(rim);
      const net = new T.Mesh(new T.CylinderGeometry(0.42, 0.26, 0.6, 12, 1, true), mat('#ffffff', { wireframe: true }));
      net.position.set(x, 3.78, -8.1);
      g.add(net);
    }
    const flags = ['GO TEDDY!', 'TEAM TOMMY', 'PILLOW CHAMPS', 'BOUNCE!'];
    for (let x = 0; x < L + 6; x += 10) sign(g, flags[Math.floor((x / 10) % flags.length)], 3.4, 0.8, ['#e53935', '#ffd400', '#2fb36a', '#8d5bd8'][Math.floor(x / 10) % 4], '#ffffff', x, 6.6, -8.9);
    for (let x = -8; x < L + 10; x += 6) box(g, 3.5, 1.6, 0.1, mat('#bfe8ff', { emissive: '#bfe8ff', emissiveIntensity: 0.5 }), x, 8.0, -8.95);
    sign(g, 'HOME 99 · AWAY 0', 5, 1.2, '#14121f', '#ffd400', L * 0.5, 6.5, -8.8);
    return { sky: [[0, '#f0e6d6'], [1, '#e8dcc8']], hemi: ['#fffaf0', '#b08a5a', 1.05], sun: ['#fff6e0', 0.8], fog: '#efe4d2' };
  };

  THEMES.castle = (g, L, rnd) => {
    const stone = canvasTex(128, 128, (c) => {
      c.fillStyle = '#8e86a8'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = '#6e6688'; c.lineWidth = 4;
      for (let y = 0; y < 128; y += 32) for (let x = (y / 32) % 2 ? 32 : 0; x < 128; x += 64) c.strokeRect(x + 2, y + 2, 60, 28);
    }, 1);
    floor(g, L, -4.2, 12, stone);
    // a purple carpet down the hall
    box(g, L + 60, 0.015, 2.2, mat('#b03a7a'), L / 2, 0.005, -0.7);
    box(g, L + 60, 0.016, 0.12, '#ffd400', L / 2, 0.005, -1.8);
    box(g, L + 60, 0.016, 0.12, '#ffd400', L / 2, 0.005, 0.4);
    const wallTex = canvasTex(128, 128, (c) => {
      c.fillStyle = '#7d7598'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = '#5f5878'; c.lineWidth = 4;
      for (let y = 0; y < 128; y += 32) for (let x = (y / 32) % 2 ? 32 : 0; x < 128; x += 64) c.strokeRect(x + 2, y + 2, 60, 28);
    }, 1);
    wallTex.repeat.set((L + 60) / 4, 2);
    box(g, L + 60, 7, 0.6, new T.MeshStandardMaterial({ map: wallTex }), L / 2, 0, -4.8);
    for (let x = -12; x < L + 12; x += 1.6) box(g, 0.9, 0.7, 0.6, '#7d7598', x, 7, -4.8);
    // arched windows glowing, banners with a silly crown, torches
    for (let x = -4; x < L + 10; x += 8) {
      box(g, 1.4, 2.4, 0.1, mat('#ffe48a', { emissive: '#ffcf4a', emissiveIntensity: 0.8 }), x, 3.2, -4.45);
      const arch = new T.Mesh(new T.CircleGeometry(0.7, 16, 0, Math.PI), mat('#ffe48a', { emissive: '#ffcf4a', emissiveIntensity: 0.8 }));
      arch.position.set(x, 5.6, -4.44);
      g.add(arch);
      box(g, 0.1, 2.4, 0.12, '#5f5878', x, 3.2, -4.4);
      box(g, 1.4, 0.1, 0.12, '#5f5878', x, 4.4, -4.4);
    }
    for (let x = 0; x < L + 10; x += 8) {
      const tex = canvasTex(64, 128, (c) => {
        c.fillStyle = '#7a3fd1'; c.fillRect(0, 0, 64, 128);
        c.fillStyle = '#ffd400';
        c.beginPath(); c.moveTo(0, 128); c.lineTo(32, 100); c.lineTo(64, 128); c.fill();
        c.font = `40px ${G().EMOJI_FONT}`; c.textAlign = 'center'; c.fillText('👑', 32, 60);
      });
      plane(g, 1.1, 2.4, new T.MeshStandardMaterial({ map: tex, side: T.DoubleSide }), x, 4.4, -4.45);
    }
    const flames = [];
    for (let x = 4; x < L + 10; x += 8) {
      box(g, 0.14, 0.7, 0.14, '#4a3a30', x, 2.2, -4.35);
      const f = emojiSprite(g, '🔥', 0.7, x, 3.15, -4.3);
      flames.push(f);
      const glow = new T.Sprite(new T.SpriteMaterial({ map: G().glowTexture(), color: '#ffb04a', transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
      glow.scale.set(2.2, 2.2, 1);
      glow.position.set(x, 3.1, -4.25);
      g.add(glow);
    }
    // towers far behind, a smiling moon, stars, friendly bats
    for (let x = -10; x < L + 20; x += 18 + rnd() * 6) {
      const h = 10 + rnd() * 6;
      box(g, 3, h, 3, '#5c547a', x, 0, -14 - rnd() * 4);
      const roof = new T.Mesh(new T.ConeGeometry(2.3, 3, 4), mat('#7a3fd1'));
      roof.position.set(x, h + 1.5, -15);
      roof.rotation.y = Math.PI / 4;
      g.add(roof);
    }
    const moon = emojiSprite(g, '🌝', 6, L * 0.5, 13, -40);
    for (let i = 0; i < 40; i++) emojiSprite(g, '✨', 0.5 + rnd() * 0.5, -10 + rnd() * (L + 20), 9 + rnd() * 8, -30);
    const bats = [];
    for (let i = 0; i < 5; i++) bats.push(emojiSprite(g, '🦇', 0.8, rnd() * L, 8 + rnd() * 3, -10));
    return {
      sky: [[0, '#1e1440'], [0.6, '#4a2f7a'], [1, '#7a4fa8']], hemi: ['#d8c8ff', '#3a2a5a', 0.95], sun: ['#ffd8a8', 0.75], fog: '#3a2a5a',
      follow: moon,
      update(dt, camX, t) {
        flames.forEach((f, i) => { const s = 0.65 + Math.sin(t * 9 + i) * 0.08; f.scale.set(s, s, 1); });
        bats.forEach((b, i) => { b.position.x = camX + Math.sin(t * 0.3 + i * 1.7) * 9; b.position.y = 8.5 + Math.sin(t * 2 + i) * 0.8; });
      },
    };
  };

  // ---------------------------------------------------------------- building a stage

  function build(theme, L, rand) {
    const rnd = rand || Math.random;
    const g = new T.Group();
    const info = (THEMES[theme] || THEMES.park)(g, L, rnd);
    const sky = skyTexture(info.sky);
    const follow = info.follow;
    const bobbers = [];
    g.traverse((o) => { if (o.userData && o.userData.bob != null) bobbers.push(o); });
    return {
      group: g,
      sky,
      info,
      update(dt, camX, t) {
        if (follow) follow.position.x = camX * 0.8;
        for (const b of bobbers) b.position.y += Math.sin(t * 2 + b.userData.bob) * 0.002;
        if (info.update) info.update(dt, camX, t);
      },
    };
  }

  // A crate to bonk open: a cardboard box, a bin or a present, depending on the stage.
  function crate(theme) {
    const g = new T.Group();
    if (theme === 'subway' || theme === 'rooftop') {
      cyl(g, 0.38, 0.32, 0.9, '#4aa86a', 0, 0, 0, 14);
      cyl(g, 0.42, 0.42, 0.1, '#3a8a56', 0, 0.9, 0, 14);
      box(g, 0.2, 0.08, 0.08, '#2a6a40', 0, 1.0, 0);
    } else if (theme === 'mall' || theme === 'castle') {
      box(g, 0.85, 0.75, 0.85, theme === 'castle' ? '#8d5bd8' : '#ff3d7f', 0, 0, 0);
      box(g, 0.87, 0.77, 0.16, '#ffd400', 0, 0, 0);
      box(g, 0.16, 0.77, 0.87, '#ffd400', 0, 0, 0);
      box(g, 0.4, 0.18, 0.18, '#ffd400', -0.12, 0.75, 0).rotation.z = 0.5;
      box(g, 0.4, 0.18, 0.18, '#ffd400', 0.12, 0.75, 0).rotation.z = -0.5;
    } else {
      const tex = canvasTex(64, 64, (c) => {
        c.fillStyle = '#c99a5a'; c.fillRect(0, 0, 64, 64);
        c.fillStyle = '#b5864a'; c.fillRect(0, 28, 64, 8);
        c.strokeStyle = '#8a6030'; c.lineWidth = 3; c.strokeRect(1, 1, 62, 62);
        c.font = `22px ${G().EMOJI_FONT}`; c.textAlign = 'center'; c.fillText('❓', 32, 24);
      });
      box(g, 0.85, 0.8, 0.85, new T.MeshStandardMaterial({ map: tex }), 0, 0, 0);
    }
    return g;
  }

  window.BrawlScenery = { build, crate, THEMES };
})();
