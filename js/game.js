/* Double TTrouble: the game shell. Three.js scene and camera, the brothers and the gang as kit people with
   pillows, the HUD, menus, the companion's visits and treats, the stage-clear celebration, the touch controls and
   the test hooks (window.game). The rules live in js/sim.js; this file only draws what the engine says and turns
   its events into effects and sounds. */
(function () {
  'use strict';
  const T = THREE, Kit = window.Kit, G = Kit.gfx;
  const Sim = window.BrawlSim, Brains = window.BrawlBrains, Input = window.BrawlInput, Poses = window.BrawlPoses;
  const Fx = window.BrawlFx, Sfx = window.BrawlSfx, Scenery = window.BrawlScenery;
  const R = window.BRAWL_RULES, STAGES = window.BRAWL_STAGES, TITLE = window.BRAWL_TITLE;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const PI = Math.PI;

  document.title = TITLE.NAME;
  $('logo1').textContent = TITLE.LINE1;
  $('logo2').innerHTML = TITLE.LINE2.replace('TT', '<i>TT</i>');
  $('tagline').textContent = TITLE.TAG;

  // ---------------------------------------------------------------- saved progress

  const SAVE_KEY = 'doubleTTrouble.v1';
  let save = { cleared: [], diff: 'easy', hero: 'teddy' };
  try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* storage blocked */ }
  const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ } };
  const anyCleared = () => save.cleared.some(Boolean);
  const unlocked = (i) => i === 0 || !!save.cleared[i - 1] || !!save.cleared[i];

  // ---------------------------------------------------------------- three.js

  const canvas = $('game');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(32, 1, 0.1, 220);
  const hemi = new T.HemisphereLight('#ffffff', '#6a9a4a', 1.0);
  const sun = new T.DirectionalLight('#fff1d6', 1.0);
  sun.position.set(-4, 10, 8);
  scene.add(hemi, sun, sun.target);
  Fx.init(scene);

  let vw = 0, vh = 0;
  function resize() {
    const w = window.innerWidth || 800, h = window.innerHeight || 600;
    if (w === vw && h === vh) return;
    vw = w; vh = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (W) W.halfW = pickHalfW();
  }
  // How much street fits across the screen: a little less on a narrow (portrait) screen.
  const pickHalfW = () => {
    const a = (window.innerWidth || 800) / (window.innerHeight || 600);
    return a >= 1.5 ? 7 : a >= 1.2 ? 6.2 : a >= 0.9 ? 5.3 : 4.5;
  };

  // ---------------------------------------------------------------- models

  // A puffy pillow: a box whose middle bulges out.
  function pillowGeo(w, h, d) {
    const g = new T.BoxGeometry(w, h, d, 6, 2, 6);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / (w / 2), z = p.getZ(i) / (d / 2);
      p.setY(i, p.getY(i) * (1 - 0.55 * x * x) * (1 - 0.55 * z * z) + 0.0);
      p.setX(i, p.getX(i) * (1 - 0.1 * z * z));
      p.setZ(i, p.getZ(i) * (1 - 0.1 * x * x));
    }
    g.computeVertexNormals();
    return g;
  }
  const pillowTexCache = {};
  function pillowTex(base, ink, pattern) {
    const key = base + ink + pattern;
    if (pillowTexCache[key]) return pillowTexCache[key];
    const [c, g] = G.makeCanvas(128, 128);
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = ink;
    if (pattern === 'stars') {
      for (let i = 0; i < 9; i++) {
        const x = 14 + (i % 3) * 44 + (Math.floor(i / 3) % 2) * 10, y = 18 + Math.floor(i / 3) * 42;
        g.beginPath();
        for (let k = 0; k < 10; k++) { const r = k % 2 ? 4 : 10, a = -PI / 2 + (k * PI) / 5; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
        g.fill();
      }
    } else if (pattern === 'stripes') {
      for (let x = 0; x < 128; x += 32) g.fillRect(x, 0, 12, 128);
    } else {
      for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(16 + (i % 4) * 32, 16 + Math.floor(i / 4) * 32, 6, 0, PI * 2); g.fill(); }
    }
    return (pillowTexCache[key] = G.toTexture(c));
  }
  function makePillow(w, h, d, base, ink, pattern) {
    return new T.Mesh(pillowGeo(w, h, d), new T.MeshStandardMaterial({ color: '#ffffff', map: pillowTex(base, ink, pattern), roughness: 0.95 }));
  }

  // Things to swing. Each one hangs from a hand along the arm's -y, so it follows every pose.
  function makeWeapon(kind) {
    const g = new T.Group();
    const m = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7 }, o));
    if (kind === 'pillow') {
      const p = makePillow(0.6, 0.24, 0.92, '#ffffff', '#7ab8ff', 'stripes');
      p.rotation.x = PI / 2;
      p.position.y = -0.42;
      g.add(p);
    } else if (kind === 'chicken') {
      const yel = m('#ffd84a'), org = m('#ff8a1f');
      const add = (w, h, d, mat, x, y, z) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); g.add(b); return b; };
      add(0.05, 0.14, 0.05, org, -0.04, -0.07, 0);
      add(0.05, 0.14, 0.05, org, 0.04, -0.07, 0);
      add(0.2, 0.42, 0.22, yel, 0, -0.34, 0);
      add(0.12, 0.16, 0.13, yel, 0, -0.62, -0.03);
      add(0.06, 0.06, 0.1, org, 0, -0.62, -0.13);
      add(0.04, 0.1, 0.1, m('#ff3d3d'), 0, -0.73, -0.02);
      add(0.02, 0.025, 0.02, m('#14121f'), 0.06, -0.6, -0.08);
      add(0.02, 0.025, 0.02, m('#14121f'), -0.06, -0.6, -0.08);
    } else {
      const grip = new T.Mesh(new T.CylinderGeometry(0.045, 0.05, 0.22, 10), m('#22212a'));
      grip.position.y = -0.05;
      g.add(grip);
      const foam = new T.Mesh(new T.CylinderGeometry(0.12, 0.065, 0.8, 12), m('#ff7a2f', { roughness: 0.95 }));
      foam.position.y = -0.55;
      g.add(foam);
      const cap = new T.Mesh(new T.SphereGeometry(0.12, 12, 8), m('#ffd400', { roughness: 0.95 }));
      cap.position.y = -0.95;
      g.add(cap);
    }
    return g;
  }

  const WEAPON_EMOJI = { pillow: '🪶', chicken: '🐔', bat: '🏏' };

  // Bits this game adds to the kit's people: gremlin ears, the King's crown and cape, the Coach's whistle.
  function addExtras(p, extras, look) {
    const m = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6 }, o));
    for (const x of extras || []) {
      if (x === 'ears') {
        for (const s of [-1, 1]) {
          const ear = new T.Mesh(new T.ConeGeometry(0.11, 0.42, 4), m(look.skin));
          ear.rotation.z = -s * (PI / 2 - 0.35);
          ear.position.set(s * 0.42, 0.12, 0);
          p.head.add(ear);
          const inner = new T.Mesh(new T.ConeGeometry(0.06, 0.26, 4), m('#ff9ab8'));
          inner.rotation.copy(ear.rotation);
          inner.position.set(s * 0.43, 0.12, -0.04);
          p.head.add(inner);
        }
      } else if (x === 'crown') {
        const gold = m('#ffd400', { metalness: 0.6, roughness: 0.3, emissive: '#7a5a00', emissiveIntensity: 0.3 });
        const band = new T.Mesh(new T.BoxGeometry(0.58, 0.14, 0.54), gold);
        band.position.y = 0.38;
        p.head.add(band);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * PI * 2;
          const sp = new T.Mesh(new T.ConeGeometry(0.06, 0.2, 4), gold);
          sp.position.set(Math.sin(a) * 0.22, 0.54, Math.cos(a) * 0.2);
          p.head.add(sp);
        }
        const gem = new T.Mesh(new T.BoxGeometry(0.1, 0.08, 0.04), m('#ff3d7f', { emissive: '#ff3d7f', emissiveIntensity: 0.4 }));
        gem.position.set(0, 0.38, -0.28);
        p.head.add(gem);
      } else if (x === 'cape') {
        const cape = new T.Mesh(new T.PlaneGeometry(0.95, 1.25), m('#c0303a', { side: T.DoubleSide }));
        cape.position.set(0, 0.05, 0.27);
        cape.rotation.x = 0.12;
        p.hips.add(cape);
        p.cape = cape;
      } else if (x === 'whistle') {
        const w = new T.Mesh(new T.BoxGeometry(0.1, 0.07, 0.12), m('#d8dde4', { metalness: 0.7, roughness: 0.25 }));
        w.position.set(0.08, 0.38, -0.25);
        p.hips.add(w);
        const str = new T.Mesh(new T.BoxGeometry(0.02, 0.3, 0.02), m('#e53935'));
        str.position.set(0.04, 0.52, -0.22);
        str.rotation.z = 0.3;
        p.hips.add(str);
      }
    }
  }

  function buildHeroModel(who) {
    const entry = Kit.roster.get(who);
    const p = Kit.people.build(entry.look);
    p.gloves = [];
    if (who === 'teddy') {
      // a small pillow in each fist, like puffy boxing gloves
      for (const arm of [p.armL, p.armR]) {
        const g = makePillow(0.3, 0.3, 0.3, '#8cc8ff', '#ffffff', 'stars');
        g.position.set(0, -0.72, -0.02);
        arm.add(g);
        p.gloves.push(g);
      }
    } else {
      // one big pillow, held by a corner
      const g = makePillow(0.46, 0.22, 0.72, '#c8f0dc', '#ffffff', 'dots');
      g.rotation.x = PI / 2;
      g.position.set(0, -0.98, 0);
      p.armR.add(g);
      p.gloves.push(g);
    }
    return p;
  }

  function enemyLook(f) {
    const def = f.def;
    return def.looks ? def.looks[f.look % def.looks.length] : def.look;
  }

  function buildEnemyModel(f) {
    const look = enemyLook(f);
    const p = Kit.people.build(look);
    addExtras(p, f.def.extras, look);
    p.root.scale.setScalar(f.scale || 1);
    return p;
  }

  // Faces for menus and the HUD: the kit's portraits for the brothers, our own for the bosses (with their extras).
  function snapFaces(list) {
    const r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.setSize(152, 152, false);
    r.outputEncoding = T.sRGBEncoding;
    const sc = new T.Scene();
    sc.add(new T.HemisphereLight('#ffffff', '#8a6e58', 0.9));
    const key = new T.DirectionalLight('#fff4e0', 1.1);
    key.position.set(-1.5, 3, -3);
    sc.add(key);
    const cam = new T.PerspectiveCamera(30, 1, 0.1, 30);
    const out = {};
    try {
      for (const it of list) {
        const p = it.build();
        const s = p.root.scale.x;
        Kit.people.pose(p, 0, 'idle', 1);
        p.hips.rotation.x = 0;
        sc.add(p.root);
        cam.position.set(0.8 * s, 1.95 * s, -2.7 * s);
        cam.lookAt(0, 1.66 * s, 0);
        r.render(sc, cam);
        out[it.id] = r.domElement.toDataURL('image/png');
        sc.remove(p.root);
      }
    } finally {
      r.dispose();
      r.forceContextLoss();
    }
    return out;
  }

  // ---------------------------------------------------------------- views of the fighters

  const views = new Map();
  const itemViews = new Map(), crateViews = new Map(), shotViews = new Map();
  let shadowTex = null, exclTex = null;
  const tmpA = new T.Vector3(), tmpB = new T.Vector3();

  function blobShadow(size) {
    if (!shadowTex) shadowTex = G.radialTexture(64, [[0, 'rgba(20,18,40,0.5)'], [0.6, 'rgba(20,18,40,0.3)'], [1, 'rgba(20,18,40,0)']]);
    const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    m.rotation.x = -PI / 2;
    m.scale.set(size, size * 0.6, 1);
    m.renderOrder = 1;
    scene.add(m);
    return m;
  }

  function exclTexture() {
    if (exclTex) return exclTex;
    const [c, g] = G.makeCanvas(64, 64);
    g.fillStyle = '#ffd400';
    g.beginPath(); g.arc(32, 32, 28, 0, PI * 2); g.fill();
    g.lineWidth = 5; g.strokeStyle = '#14121f'; g.stroke();
    g.fillStyle = '#14121f';
    g.font = `40px ${G.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('!', 32, 35);
    return (exclTex = G.toTexture(c));
  }

  function spriteOf(emoji, size) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: G.emojiTexture(emoji), transparent: true, depthWrite: false }));
    s.scale.set(size, size, 1);
    return s;
  }

  function makeView(f) {
    const v = { id: f.id, kind: f.kind, angle: f.face > 0 ? -PI / 2 - 0.3 : PI / 2 + 0.3, mats: [], held: null, heldKind: null };
    v.p = f.kind === 'enemy' ? buildEnemyModel(f) : buildHeroModel(f.who);
    scene.add(v.p.root);
    v.p.root.traverse((o) => { if (o.isMesh && o.material && o.material.emissive) v.mats.push(o.material); });
    v.shadow = blobShadow(1.1 * (f.scale || 1));
    // dizzy stars
    v.dizzy = new T.Group();
    v.orbit = ['⭐', '💫', '⭐', '🐤'].map((e) => { const s = spriteOf(e, 0.38); v.dizzy.add(s); return s; });
    v.dizzy.visible = false;
    scene.add(v.dizzy);
    if (f.kind === 'enemy') {
      // the "!" before an attack, a little health bar, and the white flag
      v.excl = new T.Sprite(new T.SpriteMaterial({ map: exclTexture(), transparent: true, depthWrite: false, depthTest: false }));
      v.excl.scale.set(0.55, 0.55, 1);
      v.excl.renderOrder = 15;
      v.excl.visible = false;
      scene.add(v.excl);
      if (!f.boss) {
        v.bar = new T.Group();
        const bg = new T.Mesh(new T.PlaneGeometry(0.9, 0.12), new T.MeshBasicMaterial({ color: '#14121f', depthTest: false, transparent: true, opacity: 0.8 }));
        const fill = new T.Mesh(new T.PlaneGeometry(0.84, 0.07), new T.MeshBasicMaterial({ color: '#ff5aa0', depthTest: false }));
        fill.geometry.translate(0.42, 0, 0);
        fill.position.set(-0.42, 0, 0.01);
        bg.renderOrder = fill.renderOrder = 14;
        v.bar.add(bg, fill);
        v.barFill = fill;
        v.bar.visible = false;
        scene.add(v.bar);
      }
      // the white flag: a stick out past the hand, with the cloth flying off the top
      const flag = new T.Group();
      const stick = new T.Mesh(new T.BoxGeometry(0.05, 1.0, 0.05), new T.MeshStandardMaterial({ color: '#8a5a32' }));
      stick.position.y = -0.4;
      const cloth = new T.Mesh(new T.PlaneGeometry(0.62, 0.44), new T.MeshStandardMaterial({ color: '#ffffff', side: T.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.35 }));
      cloth.geometry.translate(0.31, 0, 0);
      cloth.position.set(0, -0.68, 0.02);
      cloth.rotation.y = PI / 2;
      flag.add(stick, cloth);
      flag.position.set(0, -0.6, 0);
      flag.visible = false;
      v.p.armR.add(flag);
      v.flag = flag;
      v.cloth = cloth;
    } else {
      v.ball = spriteOf('🏀', 0.72);
      v.ball.visible = false;
      scene.add(v.ball);
      if (f.kind === 'buddy' || (W && W.mode === '2p')) {
        const label = f.kind === 'buddy' ? f.def === R.HEROES.teddy ? 'TEDDY' : 'TOMMY' : f.slot ? '2P' : '1P';
        v.tag = G.nameTag(label, f.kind === 'buddy' ? R.HEROES[f.who].tag : f.slot ? '#ffb02e' : '#8cc2ff');
        v.tag.scale.multiplyScalar(f.kind === 'buddy' ? 0.85 : 0.6);
        v.tag.material.depthTest = false;
        v.tag.renderOrder = 12;
        scene.add(v.tag);
      }
    }
    return v;
  }

  function dropView(v) {
    scene.remove(v.p.root, v.shadow, v.dizzy);
    if (v.excl) scene.remove(v.excl);
    if (v.bar) scene.remove(v.bar);
    if (v.ball) scene.remove(v.ball);
    if (v.tag) scene.remove(v.tag);
  }

  function setHeld(v, f) {
    const kind = f.weapon ? f.weapon.kind : null;
    if (v.heldKind === kind) return;
    if (v.held) v.p.armR.remove(v.held);
    v.held = null;
    v.heldKind = kind;
    if (kind) {
      v.held = makeWeapon(kind);
      v.held.position.set(0, -0.66, 0);
      v.p.armR.add(v.held);
    }
    // Teddy's right glove and Tommy's pillow go away while he swings something else
    v.p.gloves.forEach((g, i) => { g.visible = !kind || (f.who === 'teddy' && i === 0); });
  }

  function syncFighter(f, dt) {
    let v = views.get(f.id);
    if (!v) { v = makeView(f); views.set(f.id, v); }
    v.seen = true;
    const p = v.p;
    const visible = !(f.out || f.state === 'out');
    p.root.visible = visible;
    v.shadow.visible = visible;
    if (!visible) { v.dizzy.visible = false; if (v.tag) v.tag.visible = false; if (v.ball) v.ball.visible = false; return; }
    if (f.kind !== 'enemy') setHeld(v, f);

    let hints;
    let target = f.face > 0 ? -PI / 2 - 0.3 : PI / 2 + 0.3;
    if (f.state === 'celebrate') {
      hints = Poses.celebrate(p, f, W.phaseT, clock, dt);
      if (hints.face === 'cam') target = PI;
      else if (hints.face === 'in') target = f.who === 'teddy' ? -PI / 2 - 0.55 : PI / 2 + 0.55;
      else target = (f.cx || f.x) >= f.x ? -PI / 2 - 0.3 : PI / 2 + 0.3;
      if (hints.shot && !v.shotDone) {
        v.shotDone = true;
        Kit.people.handWorld(p, 1, tmpA);
        Fx.arc('🏀', tmpA.clone(), { x: f.x + 0.6, y: 6, z: f.z - 2 }, 0.8, 0.55, 0.5, () => {});
        if (!demo) Sfx.whoosh(true);
      }
      if (hints.face === 'cam' && f.who === 'tommy' && Math.random() < dt * 3) Fx.floatUp(Math.random() < 0.5 ? '✌️' : '⭐', f.x + (Math.random() - 0.5), 2.4, f.z, 0.5);
    } else {
      v.shotDone = false;
      hints = Poses.apply(p, f, clock, dt, W);
    }
    // turn to face (quickly)
    let d = target - v.angle;
    while (d > PI) d -= PI * 2;
    while (d < -PI) d += PI * 2;
    v.angle += d * (1 - Math.exp(-18 * dt));
    p.root.rotation.y = v.angle;
    const hop = (hints && hints.hop) || 0;
    p.root.position.set(f.x, f.y + hop, f.z);
    // gremlins wobble as they walk; capes flap
    if (p.cape) p.cape.rotation.x = 0.15 + Math.abs(f.vx || 0) * 0.08 + Math.sin(clock * 6) * 0.05;

    // hit flash, and blinking while invulnerable
    const flash = f.flash > 0.08;
    if (flash !== v.flashing) {
      v.flashing = flash;
      for (const m of v.mats) { m.emissive.set(flash ? '#ffffff' : '#000000'); m.emissiveIntensity = flash ? (f.boss ? 0.3 : 0.5) : 1; }
    }
    if (f.kind === 'hero' && f.inv > 0 && !['special', 'team', 'celebrate', 'drop'].includes(f.state) && f.state !== 'getup') {
      p.root.visible = Math.floor(clock * 14) % 2 === 0;
    }
    const s = f.scale || 1;
    v.shadow.position.set(f.x, 0.02, f.z);
    const sh = Math.max(0.35, 1 - (f.y + hop) / 4);
    v.shadow.scale.set(1.1 * s * sh, 0.66 * s * sh, 1);

    // dizzy stars over the head
    const dizzy = f.state === 'dizzy' || (f.kind === 'enemy' && f.state === 'hurt' && f.stun >= 0.6);
    v.dizzy.visible = dizzy;
    if (dizzy) {
      p.head.getWorldPosition(tmpA);
      v.dizzy.position.set(tmpA.x, tmpA.y + 0.55 * s, tmpA.z);
      v.orbit.forEach((o, i) => { const a = clock * 3.2 + (i * PI) / 2; o.position.set(Math.cos(a) * 0.5 * s, Math.sin(a * 2) * 0.05, Math.sin(a) * 0.5 * s); });
    }
    if (f.kind === 'enemy') {
      v.excl.visible = f.state === 'windup';
      if (v.excl.visible) {
        v.excl.position.set(f.x, f.y + 2.45 * s + Math.abs(Math.sin(clock * 12)) * 0.12, f.z);
        const k = 0.5 + Math.min(1, f.st * 4) * 0.15;
        v.excl.scale.set(k, k, 1);
      }
      if (v.bar) {
        v.bar.visible = f.barT > 0 && !f.ko;
        if (v.bar.visible) {
          v.bar.position.set(f.x, f.y + 2.3 * s, f.z);
          v.barFill.scale.x = Math.max(0.001, f.hp / f.maxHp);
        }
      }
      v.flag.visible = !!(hints && hints.flag);
      if (v.flag.visible) v.cloth.rotation.y = PI / 2 + Math.sin(clock * 12) * 0.5;
    } else {
      v.ball.visible = !!(hints && hints.ball);
      if (v.ball.visible) {
        p.root.updateMatrixWorld(true);
        Kit.people.handWorld(p, -1, tmpA);
        Kit.people.handWorld(p, 1, tmpB);
        v.ball.position.copy(tmpA).add(tmpB).multiplyScalar(0.5);
        v.ball.position.y += 0.15;
      }
      if (v.tag) {
        v.tag.visible = f.state !== 'celebrate';
        v.tag.position.set(f.x, f.y + hop + 2.55, f.z);
      }
    }
  }

  function syncWorld(dt) {
    for (const v of views.values()) v.seen = false;
    for (const h of W.heroes) syncFighter(h, dt);
    if (W.buddy) syncFighter(W.buddy, dt);
    for (const e of W.enemies) syncFighter(e, dt);
    for (const [id, v] of views) if (!v.seen) { dropView(v); views.delete(id); }

    // pick-ups
    const seenI = new Set();
    for (const it of W.items) {
      seenI.add(it.id);
      let v = itemViews.get(it.id);
      if (!v) {
        v = { g: new T.Group() };
        const food = R.FOOD[it.kind];
        if (food) {
          v.obj = spriteOf(food.emoji, 0.75);
          v.obj.position.y = 0.45;
        } else {
          v.obj = makeWeapon(it.kind);
          v.obj.rotation.set(0, 0.3, PI / 2);
          v.obj.position.set(-0.4, 0.2, 0);
          const glow = new T.Sprite(new T.SpriteMaterial({ map: G.glowTexture(), color: '#fff3a0', transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.6 }));
          glow.scale.set(1.5, 0.9, 1);
          glow.position.y = 0.2;
          v.g.add(glow);
          v.glow = glow;
        }
        v.g.add(v.obj);
        v.shadow = blobShadow(0.7);
        scene.add(v.g);
        itemViews.set(it.id, v);
      }
      v.g.position.set(it.x, it.y + Math.sin(clock * 3 + it.id) * 0.06, it.z);
      v.shadow.position.set(it.x, 0.02, it.z);
      if (v.glow) v.glow.material.opacity = 0.4 + Math.sin(clock * 5) * 0.2;
    }
    for (const [id, v] of itemViews) if (!seenI.has(id)) { scene.remove(v.g, v.shadow); itemViews.delete(id); }

    // crates
    const seenC = new Set();
    for (const c of W.crates) {
      seenC.add(c.id);
      if (!crateViews.has(c.id)) {
        const g = Scenery.crate(W.S.theme);
        g.position.set(c.x, 0, c.z);
        g.rotation.y = (c.id % 5) * 0.2 - 0.4;
        scene.add(g);
        crateViews.set(c.id, g);
      }
    }
    for (const [id, g] of crateViews) if (!seenC.has(id)) { scene.remove(g); crateViews.delete(id); }

    // thrown things
    const seenS = new Set();
    for (const s of W.shots) {
      if (s.kind === 'ring') continue;
      seenS.add(s.id);
      let v = shotViews.get(s.id);
      if (!v) {
        v = spriteOf(s.emoji, s.kind === 'zap' ? 1.0 : 0.9);
        v.renderOrder = 6;
        scene.add(v);
        // a soft glow behind it, so it's easy to see coming
        const col = { zap: '#5ef2ff', note: '#ff7ad8', bolt: '#ffe14d', dodgeball: '#ffd400', pie: '#ffffff' }[s.kind] || '#ffffff';
        const glow = new T.Sprite(new T.SpriteMaterial({ map: G.glowTexture(), color: col, transparent: true, depthWrite: false, opacity: 0.85 }));
        glow.scale.set(1.5, 1.5, 1);
        glow.renderOrder = 5;
        glow.position.z = -0.01;
        v.add(glow);
        shotViews.set(s.id, v);
      }
      v.position.set(s.x, s.y, s.z);
      if (s.kind !== 'zap' && s.kind !== 'note') v.material.rotation -= (s.vx > 0 ? 1 : -1) * 10 * (1 / 60);
      if (s.kind === 'note') v.material.rotation = Math.sin(clock * 8) * 0.3;
    }
    for (const [id, v] of shotViews) if (!seenS.has(id)) { scene.remove(v); shotViews.delete(id); }
  }

  function clearWorldViews() {
    for (const v of views.values()) dropView(v);
    views.clear();
    for (const v of itemViews.values()) scene.remove(v.g, v.shadow);
    itemViews.clear();
    for (const g of crateViews.values()) scene.remove(g);
    crateViews.clear();
    for (const v of shotViews.values()) scene.remove(v);
    shotViews.clear();
    Fx.clear();
  }

  // ---------------------------------------------------------------- the stage

  let stageView = null;
  function buildStage() {
    if (stageView) scene.remove(stageView.group);
    let seed = (W.si + 1) * 9301;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    stageView = Scenery.build(W.S.theme, W.S.length, rnd);
    scene.add(stageView.group);
    scene.background = stageView.sky;
    const info = stageView.info;
    hemi.color.set(info.hemi[0]);
    hemi.groundColor.set(info.hemi[1]);
    hemi.intensity = info.hemi[2];
    sun.color.set(info.sun[0]);
    sun.intensity = info.sun[1];
    scene.fog = new T.Fog(info.fog, 40, 110);
  }

  // ---------------------------------------------------------------- camera

  let camX = 7, shake = 0, zoom = 1;
  function updateCamera(dt) {
    camX += (W.cam.x - camX) * (1 - Math.exp(-7 * dt));
    if (Math.abs(W.cam.x - camX) > 12) camX = W.cam.x;
    const celebrating = W.phase === 'celebrate' || W.phase === 'done';
    zoom += ((celebrating ? 0.62 : 1) - zoom) * (1 - Math.exp(-3 * dt));
    const vfov = (camera.fov * PI) / 180;
    const tanH = Math.tan(vfov / 2) * camera.aspect;
    const D = ((W.halfW + 0.35) / tanH) * zoom;
    const pitch = celebrating ? 0.3 : 0.5;
    const zc = (W.zMin + W.zMax) / 2;
    const lookY = celebrating ? 1.5 : 2.1;
    shake = Math.max(0, shake - dt * 2.5);
    const sx = (Math.random() - 0.5) * shake * 0.5, sy = (Math.random() - 0.5) * shake * 0.4;
    camera.position.set(camX + sx, lookY + D * Math.sin(pitch) + sy, zc + D * Math.cos(pitch));
    camera.lookAt(camX + sx * 0.5, lookY, zc - 0.35);
    sun.position.set(camX - 4, 10, 8);
    sun.target.position.set(camX, 0, 0);
  }

  // ---------------------------------------------------------------- portraits

  const faces = Kit.portraits([Kit.roster.get('teddy'), Kit.roster.get('tommy')], { size: 152 });
  let bossFaces = {};
  function ensureBossFaces() {
    if (Object.keys(bossFaces).length) return;
    bossFaces = snapFaces(Object.entries(R.BOSSES).map(([id, def]) => ({ id, build: () => buildEnemyModel({ def, look: 0, scale: 1 }) })));
  }
  const heroName = (who) => (who === 'tommy' ? 'TOMMY' : 'TEDDY');
  const otherOf = (who) => (who === 'tommy' ? 'teddy' : 'tommy');

  // ---------------------------------------------------------------- HUD

  const hud = $('hud');
  const cards = [$('pc0'), $('pc1')];
  const lag = [1, 1];
  let bossLag = 1;
  const last = {};
  const setText = (el, key, text) => { if (last[key] !== text) { last[key] = text; el.textContent = text; } };

  function setupHud() {
    const two = W.mode === '2p';
    W.heroes.forEach((h, i) => {
      const c = cards[i];
      c.classList.remove('hidden', 'teddy', 'tommy');
      c.classList.add(h.who);
      c.querySelector('.face img').src = faces[h.who];
      c.querySelector('.nm').textContent = heroName(h.who);
      c.querySelector('.who').textContent = two ? (i ? '2P' : '1P') : 'YOU';
    });
    cards[1].classList.toggle('hidden', !two);
    const bud = $('budCard');
    bud.classList.toggle('hidden', two);
    if (!two) {
      const who = otherOf(W.heroes[0].who);
      bud.classList.remove('teddy', 'tommy');
      bud.classList.add(who);
      bud.querySelector('img').src = faces[who];
      bud.querySelector('.bl2').textContent = heroName(who) + '!';
    }
    $('teamBtn').classList.toggle('hidden', !two);
    $('teamF0').src = faces.teddy;
    $('teamF1').src = faces.tommy;
    $('stageChip').textContent = `${W.si + 1} · ${W.S.name}`;
    $('bossbar').classList.add('hidden');
    $('go').classList.add('hidden');
    for (const k in last) delete last[k];
    lag[0] = lag[1] = 1;
    bossLag = 1;
    // touch buttons: each brother's special
    document.querySelectorAll('.c0 .spc .se').forEach((e) => { e.textContent = W.heroes[0].who === 'tommy' ? '✌️' : '🏀'; });
    $('touch').classList.toggle('two', two);
  }

  function updateHud(dt) {
    W.heroes.forEach((h, i) => {
      const c = cards[i];
      const frac = clamp(h.hp / h.maxHp, 0, 1);
      lag[i] = lag[i] > frac ? Math.max(frac, lag[i] - dt * 0.6) : frac;
      const hp = c.querySelector('.hp');
      hp.querySelector('.fill').style.transform = `scaleX(${frac})`;
      hp.querySelector('.lag').style.transform = `scaleX(${lag[i]})`;
      hp.classList.toggle('low', frac < 0.5 && frac >= 0.25);
      hp.classList.toggle('crit', frac < 0.25);
      setText(c.querySelector('.lives'), 'lives' + i, h.out ? '' : '❤️'.repeat(Math.min(h.lives, 6)));
      setText(c.querySelector('.score'), 'score' + i, String(h.score));
      const w = c.querySelector('.wpn');
      w.classList.toggle('on', !!h.weapon);
      if (h.weapon) setText(w, 'w' + i, `${WEAPON_EMOJI[h.weapon.kind]} ×${h.weapon.uses}`);
      c.querySelector('.shield').classList.toggle('on', !!h.shield && !h.out);
      const out = c.querySelector('.out');
      out.classList.toggle('on', !!h.out && W.mode === '2p');
      if (h.out) setText(out, 'out' + i, W.continues > 0 ? (touchMode ? 'OUT · tap 👊' : `OUT · press ${i ? 'J' : 'F'}`) : 'OUT');
    });
    // the companion's card (1 player)
    if (W.mode === '1p') {
      const bud = $('budCard');
      const here = !!W.buddy && W.phase !== 'celebrate';
      bud.classList.toggle('here', here);
      bud.style.setProperty('--fill', here ? clamp(W.buddyT / R.BUDDY.visit, 0, 1).toFixed(3) : '0');
      setText(bud.querySelector('.bl1'), 'bl1', here ? 'TAP FOR A TREAT' : 'CALL');
      if (!here && !touchMode && !bud.querySelector('.bl1 kbd')) {
        bud.querySelector('.bl1').innerHTML = 'CALL <kbd>T</kbd>';
        last.bl1 = 'CALL';
      }
    } else {
      const tb = $('teamBtn');
      const ready = W.teamCd <= 0;
      tb.classList.toggle('ready', ready);
      tb.style.setProperty('--fill', (1 - W.teamCd / W.diff.teamCd).toFixed(3));
    }
    // the boss's bar
    const b = W.boss;
    const bb = $('bossbar');
    if (b && !b.gone && W.phase !== 'celebrate') {
      if (bb.classList.contains('hidden')) {
        bb.classList.remove('hidden');
        ensureBossFaces();
        bb.querySelector('img').src = bossFaces[b.type] || '';
        bb.querySelector('.nm').textContent = b.def.name;
        bossLag = 1;
      }
      const frac = clamp(b.hp / b.maxHp, 0, 1);
      bossLag = bossLag > frac ? Math.max(frac, bossLag - dt * 0.5) : frac;
      bb.querySelector('.fill').style.transform = `scaleX(${frac})`;
      bb.querySelector('.lag').style.transform = `scaleX(${bossLag})`;
    } else if (!bb.classList.contains('hidden') && (!b || W.phase === 'celebrate')) bb.classList.add('hidden');
    $('go').classList.toggle('hidden', !(W.go && W.phase === 'play'));
    // banners and toasts time out in game time
    if (bannerUntil && clock > bannerUntil) { $('banner').classList.remove('show'); $('bsub').classList.remove('show'); bannerUntil = 0; }
    for (let i = toasts.length - 1; i >= 0; i--) if (clock > toasts[i].until) { toasts[i].el.remove(); toasts.splice(i, 1); }
  }

  let bannerUntil = 0;
  function banner(text, cls, dur = 1.4, sub = '') {
    if (demo) return;
    const b = $('banner');
    b.className = 'banner';
    void b.offsetWidth;
    b.textContent = text;
    b.classList.add('show');
    if (cls) b.classList.add(cls);
    const s = $('bsub');
    s.textContent = sub;
    s.classList.toggle('show', !!sub);
    bannerUntil = clock + dur;
  }
  const toasts = [];
  function toast(text, cls) {
    if (demo) return;
    const el = document.createElement('div');
    el.className = 'toast' + (cls ? ' ' + cls : '');
    el.textContent = text;
    $('toasts').appendChild(el);
    toasts.push({ el, until: clock + 2.2 });
    while (toasts.length > 3) toasts.shift().el.remove();
  }
  function hurtFace(who) {
    const i = W.heroes.findIndex((h) => h.who === who);
    if (i < 0) return;
    const f = cards[i].querySelector('.face');
    f.classList.remove('hurt');
    void f.offsetWidth;
    f.classList.add('hurt');
  }

  // ---------------------------------------------------------------- events from the engine

  const sfx = (name, ...a) => { if (!demo && Sfx[name]) Sfx[name](...a); };
  const ui = (name) => { if (Sfx[name]) Sfx[name](); };
  let slowUntil = 0;

  function handleEvents() {
    for (const e of W.events) {
      switch (e.type) {
        case 'hit': {
          Fx.pow(e.x, e.y, e.z, e.word, e.big);
          if (e.feathers || e.weapon === 'pillow' || e.by === 'tommy' || e.by === 'teddy') Fx.feathers(e.x, e.y - 0.2, e.z, e.big ? 7 : 3);
          if (e.weapon === 'chicken') sfx('squawk');
          else if (e.weapon === 'bat') sfx('bonk');
          else sfx('flomp', e.big);
          if (e.big) shake = Math.max(shake, 0.35);
          break;
        }
        case 'ouch':
          Fx.pow(e.x, e.y, e.z, e.word || 'OOF!', e.big);
          sfx('ouch');
          hurtFace(e.who);
          shake = Math.max(shake, e.big ? 0.6 : 0.3);
          break;
        case 'knock': if (e.kind === 'hero') sfx('down'); break;
        case 'land': Fx.dust(e.x, e.z, e.big ? 6 : 3, e.big); if (e.big) sfx('land'); break;
        case 'ko': sfx('ko'); break;
        case 'flag': sfx('flag'); break;
        case 'poof': Fx.poof(e.x, 1.0 * (e.scale || 1), e.z, e.scale || 1); sfx('poof'); break;
        case 'grab': sfx('grab'); break;
        case 'toss': Fx.pow(e.x, e.y, e.z, e.word, true); sfx('toss'); break;
        case 'swing': sfx('whoosh', e.big); break;
        case 'jump': sfx('jump'); break;
        case 'dash': Fx.dust(e.x, e.z, 4); sfx('dash'); break;
        case 'special': {
          sfx('specialUp');
          toast(e.name, 'save');
          break;
        }
        case 'dunk': {
          const h = W.heroes.find((x) => x.who === e.who) || W.buddy;
          const from = h ? { x: h.x, y: h.y + 2.3, z: h.z } : { x: e.x, y: 3, z: e.z };
          Fx.arc('🏀', from, { x: e.x, y: 0.3, z: e.z }, 0.12, 0.7, 0.1, () => {
            Fx.arc('🏀', { x: e.x, y: 0.3, z: e.z }, { x: e.x + 2, y: 0.3, z: e.z + 0.3 }, 0.7, 0.6, 2.2);
          });
          Fx.ring(e.x, e.z, R.SPECIALS.dunk.radius, 14, 'dunk', R.SPECIALS.dunk.radius / R.SPECIALS.dunk.depth);
          Fx.pow(e.x, 1.4, e.z, 'BOING!', true);
          Fx.dust(e.x, e.z, 10, true);
          sfx('dunk');
          shake = Math.max(shake, 0.8);
          break;
        }
        case 'peaceWave':
          Fx.ring(e.x, e.z, e.max, R.SPECIALS.peace.speed, 'peace', R.SPECIALS.peace.zScale);
          Fx.pow(e.x + 0.9, 3.5, e.z, 'PEACE!', false);
          sfx('peace');
          break;
        case 'hello':
          Fx.ring(e.x, e.z, R.BUDDY.helloRadius, 9, 'hello', 1.6);
          Fx.pow(e.x, 2.6, e.z, 'HI!', false);
          sfx('peace');
          break;
        case 'stomp':
          Fx.ring(e.x, e.z, 3.4, 6.5, 'stomp', 1.6);
          Fx.dust(e.x, e.z, 12, true);
          Fx.pow(e.x, 0.8, e.z, 'THUD!', true);
          sfx('stomp');
          shake = Math.max(shake, 1);
          break;
        case 'windup': if (e.boss) sfx('windup'); break;
        case 'eswing': {
          const k = e.kind;
          if (k === 'hug' && Math.random() < 0.4) sfx('zombie');
          else if (k === 'punch') sfx('beep');
          else if (k === 'hop') sfx('giggle');
          else if (k === 'throw') sfx(e.etype === 'dj' ? 'note' : 'throwIt');
          else if (k === 'zap') sfx('zap');
          else if (k === 'summon') sfx(e.etype === 'coach' ? 'whistle' : 'zombie');
          else if (k === 'charge' || k === 'swoop') sfx('dash');
          break;
        }
        case 'splat':
          if (e.hit) Fx.pow(e.x, e.y || 1.2, e.z, 'BONK!', false);
          else Fx.dust(e.x, e.z, 3);
          sfx('splat');
          break;
        case 'bonkWall':
          Fx.pow(e.x, e.y, e.z, 'BONK!', true);
          sfx('bonk');
          shake = Math.max(shake, 0.5);
          break;
        case 'angry': Fx.floatUp('💢', e.x, e.y, e.z, 0.9); break;
        case 'crate': Fx.poof(e.x, 0.6, e.z, 0.8); sfx('crate'); break;
        case 'eat': {
          const food = R.FOOD[e.kind];
          Fx.floatUp(food.emoji, e.x, 1.6, e.z, 0.8);
          Fx.floatUp('💚', e.x + 0.4, 2.0, e.z, 0.5);
          toast(`${food.emoji} YUM! +${Math.round(e.heal)}`, 'food');
          sfx('eat');
          break;
        }
        case 'pickup': toast(`${WEAPON_EMOJI[e.kind]} ${e.name}!`); sfx('pickup'); break;
        case 'break':
          Fx.poof(e.x, e.y, e.z, 0.7);
          if (e.kind === 'pillow') Fx.feathers(e.x, e.y, e.z, 14);
          toast(e.kind === 'pillow' ? '🪶 THE PILLOW BURST!' : `💨 BYE-BYE ${e.kind === 'bat' ? 'BAT' : 'CHICKEN'}!`);
          sfx('poof');
          break;
        case 'buddy':
          toast(`${heroName(e.who)} IS HERE! 👋`, 'save');
          sfx('buddy');
          popBud();
          break;
        case 'buddyAgain': popBud(); sfx('click'); break;
        case 'treat': {
          const h = W.heroes[0];
          Fx.arc(e.emoji, { x: e.x, y: 1.6, z: e.z }, { x: h.x, y: 1.6, z: h.z }, 0.5, 0.75, 1.1, () => { if (W) Fx.floatUp('💚', h.x, 2.2, h.z, 0.5); });
          toast(`${e.emoji} ${e.name} FROM ${heroName(e.who)}!`, 'food');
          sfx('treat');
          break;
        }
        case 'saved':
          Fx.pow(e.x, e.y + 0.4, e.z, 'SAVED!', true);
          toast(`${heroName(e.buddy)} SAVED YOU! 🛡️`, 'save');
          sfx('saved');
          break;
        case 'bye': toast(`BYE! ${e.who === 'teddy' ? '🏀' : '✌️'}`); break;
        case 'teamup':
          banner('TEAM-UP!', null, 1.3);
          sfx('teamup');
          break;
        case 'blast':
          Fx.ring(W.cam.x, (W.zMin + W.zMax) / 2, W.halfW * 1.5, 16, 'blast', 1.6);
          Fx.ring(W.cam.x, (W.zMin + W.zMax) / 2, W.halfW * 1.2, 12, 'peace', 1.6);
          Fx.confetti(W.cam.x, 4, -0.5, 40);
          sfx('blast');
          shake = Math.max(shake, 1.2);
          break;
        case 'boss': {
          const def = R.BOSSES[e.etype];
          banner(def.name, 'boss', 2.2, def.title + '!');
          sfx('bossIn');
          break;
        }
        case 'bossKO':
          slowUntil = clock + 1.1;
          banner('BONK!', 'clear', 1.2);
          sfx('ko');
          shake = Math.max(shake, 1);
          break;
        case 'clear':
          sfx('fanfare');
          break;
        case 'celebrate':
          banner('STAGE CLEAR!', 'clear', 2.4);
          break;
        case 'highfive':
          Fx.pow(e.x, 2.6, e.z + 0.3, 'HIGH FIVE!', true);
          Fx.stars(e.x, 2.6, e.z, 10);
          Fx.confetti(e.x, 5, e.z - 0.5, 60);
          sfx('clap');
          sfx('cheer');
          break;
        case 'go': sfx('go'); break;
        case 'respawn': Fx.stars(e.x, 2, e.z, 4); break;
        case 'join': toast(`${heroName(e.who)} IS BACK! 💪`, 'save'); sfx('buddy'); break;
        case 'out': toast(`${heroName(e.who)} IS OUT!`); sfx('out'); break;
        case 'phase':
          if (e.phase === 'play' && !W.started) { W.started = true; banner('PILLOW FIGHT!', null, 1.0); sfx('fight'); }
          if (e.phase === 'continue') showContinue();
          if (e.phase === 'done') stageDone();
          break;
      }
    }
    W.events.length = 0;
  }

  function popBud() {
    const b = $('budCard');
    b.classList.remove('pop');
    void b.offsetWidth;
    b.classList.add('pop');
  }

  // ---------------------------------------------------------------- game flow

  let W = null;
  let demo = false;
  let screen = 'loading';
  let mode = '1p';
  let acc = 0, clock = 0;
  let held = false;
  let touchMode = false;
  const botMem = [{ opts: {} }, { opts: {} }];
  let autoplay = false;

  function startWorld(opts) {
    clearWorldViews();
    W = Sim.create(Object.assign({ halfW: pickHalfW() }, opts));
    demo = W.mode === 'demo';
    camX = W.cam.x;
    zoom = 1;
    shake = 0;
    acc = 0;
    botMem[0] = { opts: { call: true, callEvery: 6 } };
    botMem[1] = { opts: { call: true, callEvery: 9 } };
    buildStage();
    if (!demo) setupHud();
    Input.setTwoPlayer(W.mode === '2p');
    Input.clear();
  }

  function startStage(i) {
    hideScreens();
    startWorld({ stage: i, mode, hero: save.hero, difficulty: save.diff });
    screen = 'play';
    hud.classList.remove('hidden');
    showTouch();
    Input.setEnabled(true);
    banner(`STAGE ${i + 1}`, 'small', 1.6, `${W.S.emoji} ${W.S.name} · ${W.S.story}`);
    sfx('ready');
    Kit.sound.music('play');
  }

  function startDemo() {
    const order = [0, 4, 1, 3, 2, 5];
    const i = order[Math.floor(Math.random() * order.length)];
    startWorld({ stage: i, mode: 'demo', difficulty: 'easy', seed: (Math.random() * 1e9) | 0, continues: Infinity });
  }

  function hideScreens() {
    for (const id of ['title', 'pick', 'stagesScr', 'pause', 'cont', 'results']) $(id).classList.add('hidden');
  }

  function showTitle() {
    hideScreens();
    hud.classList.add('hidden');
    $('touch').classList.add('hidden');
    $('banner').classList.remove('show');
    $('bsub').classList.remove('show');
    screen = 'title';
    $('title').classList.remove('hidden');
    $('stagesBtn').classList.toggle('hidden', !anyCleared());
    markLevel();
    Input.setEnabled(false);
    if (!W || !demo) startDemo();
    Kit.sound.music('title');
  }

  function markLevel() {
    document.querySelectorAll('.lvl').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === save.diff)));
  }

  let pickSel = 'teddy';
  function showPick() {
    hideScreens();
    screen = 'pick';
    pickSel = save.hero || 'teddy';
    $('pick').classList.remove('hidden');
    document.querySelectorAll('.pick').forEach((b) => {
      b.querySelector('img').src = faces[b.dataset.hero];
      b.classList.toggle('sel', b.dataset.hero === pickSel);
    });
  }

  function choose(m) {
    mode = m;
    if (m === '1p') return showPick();
    afterPick();
  }

  function afterPick() {
    if (anyCleared()) showStages();
    else startStage(0);
  }

  let stageSel = 0;
  function showStages() {
    hideScreens();
    screen = 'stages';
    $('stagesScr').classList.remove('hidden');
    ensureBossFaces();
    const grid = $('stageGrid');
    grid.innerHTML = '';
    stageSel = 0;
    STAGES.forEach((s, i) => {
      const b = document.createElement('button');
      const done = !!save.cleared[i], open = unlocked(i);
      b.className = 'stg' + (done ? ' done' : '') + (!open ? ' locked' : '') + (open && !done ? ' next' : '');
      b.innerHTML = `<span class="n">${i + 1}</span>${done ? '<span class="ok">✅</span>' : !open ? '<span class="ok">🔒</span>' : ''}<span class="e">${s.emoji}</span><b>${s.name}</b><small>boss: ${R.BOSSES[s.boss].name}</small>`;
      b.addEventListener('click', () => { if (open) { gesture(); startStage(i); } });
      grid.appendChild(b);
      if (open) stageSel = i;
    });
    focusStage();
  }
  function focusStage() {
    document.querySelectorAll('.stg').forEach((b, i) => b.classList.toggle('focus', i === stageSel));
  }

  function showTouch() {
    $('touch').classList.toggle('hidden', !touchMode || screen !== 'play');
  }

  function pause(on) {
    if (on && screen === 'play') {
      screen = 'pause';
      $('pause').classList.remove('hidden');
      Input.setEnabled(false);
      Kit.sound.music('pause');
    } else if (!on && screen === 'pause') {
      screen = 'play';
      $('pause').classList.add('hidden');
      Input.clear();
      Input.setEnabled(true);
      Kit.sound.music('play');
    }
  }

  let contLeft = 0;
  function showContinue() {
    if (demo) return;
    screen = 'cont';
    Input.setEnabled(false);
    $('cont').classList.remove('hidden');
    const can = W.continues > 0;
    contLeft = W.difficulty === 'easy' ? Infinity : 9.99;
    $('contN').textContent = can ? (contLeft === Infinity ? '💪' : '9') : '😢';
    $('contSub').textContent = !can ? 'No continues left, but you can try the stage again!' : W.continues === Infinity ? 'Have another go! (as many as you like on easy)' : `${W.continues} continue${W.continues > 1 ? 's' : ''} left`;
    $('cont').querySelector('.big').textContent = can ? 'CONTINUE?' : 'GAME OVER';
    $('contYes').textContent = can ? 'YES! ▶' : '↻ TRY AGAIN';
    Kit.sound.music('over');
  }

  function doContinue() {
    $('cont').classList.add('hidden');
    if (W.continues > 0 && Sim.continueGame(W)) {
      screen = 'play';
      Input.setEnabled(true);
      Kit.sound.music('play');
      banner('BACK IN!', 'small', 1.0);
    } else startStage(W.si);
  }

  function stageDone() {
    if (demo) return startDemo();
    save.cleared[W.si] = true;
    store();
    screen = 'results';
    Input.setEnabled(false);
    $('touch').classList.add('hidden');
    hud.classList.add('hidden');
    const last = W.si === STAGES.length - 1;
    const fs = $('resFaces');
    fs.innerHTML = '';
    for (const who of ['teddy', 'tommy']) {
      const img = document.createElement('img');
      img.src = faces[who];
      fs.appendChild(img);
    }
    $('resTitle').textContent = last ? 'YOU WON!' : 'STAGE CLEAR!';
    $('resSub').textContent = last ? 'Every pillow is back home. The Grumble Gang waves the white flag! 🏳️' : `${W.S.emoji} ${W.S.name} is pillow-fight free!`;
    const st = W.stats;
    const score = W.heroes.reduce((a, h) => a + h.score, 0);
    const mm = Math.floor(st.time / 60), ss = Math.floor(st.time % 60);
    const rows = [['⭐ score', score], ['🏳️ baddies bonked', st.kos], ['⏱️ time', `${mm}:${String(ss).padStart(2, '0')}`]];
    if (W.mode === '1p') rows.push(['🍦 treats from ' + heroName(otherOf(W.heroes[0].who)), st.treats], ['🛡️ saves', st.saves]);
    else rows.push(['🤜🤛 team-ups', st.teamups]);
    $('resStats').innerHTML = rows.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('');
    $('nextBtn').textContent = last ? '🗺️ ALL STAGES' : 'NEXT STAGE ▶';
    $('resStagesBtn').classList.toggle('hidden', last);
    $('results').classList.remove('hidden');
    Kit.sound.music('title');
  }

  function nextStage() {
    if (W.si >= STAGES.length - 1) showStages();
    else startStage(W.si + 1);
  }

  // ---------------------------------------------------------------- the loop

  function stepSim() {
    const inputs = W.heroes.map((h, i) => {
      if (demo || autoplay) return Brains.bot(W, h, botMem[i]);
      return Input.read(i);
    });
    Sim.step(W, inputs);
  }

  function tick(dt) {
    clock += dt;
    resize();
    if (!W) return;
    const running = demo || screen === 'play';
    if (running) {
      const scale = clock < slowUntil ? 0.35 : 1;
      acc += dt * scale;
      let n = 0;
      while (acc >= Sim.DT && n < 12) { stepSim(); acc -= Sim.DT; n++; }
      if (n >= 12) acc = 0;
    }
    if (screen === 'cont' && contLeft !== Infinity && W.continues > 0) {
      contLeft -= dt;
      $('contN').textContent = String(Math.max(0, Math.ceil(contLeft - 1)));
      if (contLeft <= 0) { W.continues = 0; showContinue(); }
    }
    handleEvents();
    syncWorld(dt);
    Fx.update(dt);
    if (stageView) stageView.update(dt, camX, clock);
    updateCamera(dt);
    if (!demo && screen !== 'title') updateHud(dt);
  }

  let lastT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - (lastT || now)) / 1000));
    lastT = now;
    if (!held) tick(dt);
    renderer.render(scene, camera);
  }

  // ---------------------------------------------------------------- buttons and keys

  let soundOn = false;
  function gesture() {
    if (!soundOn) { soundOn = true; Kit.sound.init(); Kit.sound.music(screen === 'play' ? 'play' : 'title'); }
  }
  function setMuteIcons() {
    document.querySelectorAll('.muteBtn').forEach((b) => { b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊'; });
  }
  function toggleMute() { gesture(); Kit.sound.toggleMute(); setMuteIcons(); }

  const click = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); gesture(); ui('click'); fn(); });
  click('play1', () => choose('1p'));
  click('play2', () => choose('2p'));
  click('stagesBtn', () => { mode = mode || '1p'; showStages(); });
  click('pickBack', showTitle);
  click('stagesBack', showTitle);
  click('pauseBtn', () => pause(true));
  click('resumeBtn', () => pause(false));
  click('quitBtn', showTitle);
  click('contYes', doContinue);
  click('contNo', showTitle);
  click('nextBtn', nextStage);
  click('againBtn', () => startStage(W.si));
  click('resStagesBtn', showStages);
  click('menuBtn', showTitle);
  document.querySelectorAll('.muteBtn').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); toggleMute(); }));
  document.querySelectorAll('.lvl').forEach((b) => b.addEventListener('click', () => { gesture(); save.diff = b.dataset.level; store(); markLevel(); ui('click'); }));
  document.querySelectorAll('.pick').forEach((b) => b.addEventListener('click', () => { gesture(); save.hero = b.dataset.hero; store(); ui('click'); afterPick(); }));
  const budPress = (e) => { e.preventDefault(); e.stopPropagation(); gesture(); if (screen === 'play') Input.press(0, 'call'); };
  $('budCard').addEventListener('pointerdown', budPress);
  $('teamBtn').addEventListener('pointerdown', budPress);

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    gesture();
    const k = e.code;
    if (k === 'KeyM') return toggleMute();
    if (screen === 'play') {
      if (k === 'KeyP' || k === 'Escape') pause(true);
      return;
    }
    if (screen === 'pause') {
      if (k === 'KeyP' || k === 'Escape' || k === 'Space') pause(false);
      else if (k === 'KeyQ') showTitle();
      return;
    }
    if (e.repeat) return;
    const go = k === 'Enter' || k === 'NumpadEnter' || k === 'KeyF' || k === 'KeyJ' || k === 'Space';
    if (screen === 'title') {
      if (go || k === 'Digit1') choose('1p');
      else if (k === 'Digit2') choose('2p');
      else if (k === 'KeyS' && anyCleared()) { mode = '1p'; showStages(); }
      else if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'KeyA' || k === 'KeyD') { save.diff = save.diff === 'easy' ? 'normal' : 'easy'; store(); markLevel(); ui('click'); }
    } else if (screen === 'pick') {
      if (k === 'Escape') showTitle();
      else if (k === 'ArrowLeft' || k === 'KeyA' || k === 'ArrowRight' || k === 'KeyD') {
        pickSel = pickSel === 'teddy' ? 'tommy' : 'teddy';
        document.querySelectorAll('.pick').forEach((b) => b.classList.toggle('sel', b.dataset.hero === pickSel));
        ui('click');
      } else if (go) { save.hero = pickSel; store(); afterPick(); }
    } else if (screen === 'stages') {
      if (k === 'Escape') showTitle();
      else if (k === 'ArrowLeft' || k === 'KeyA') { stageSel = Math.max(0, stageSel - 1); focusStage(); }
      else if (k === 'ArrowRight' || k === 'KeyD') { stageSel = Math.min(STAGES.length - 1, stageSel + 1); focusStage(); }
      else if (k === 'ArrowUp' || k === 'KeyW') { stageSel = Math.max(0, stageSel - 3); focusStage(); }
      else if (k === 'ArrowDown' || k === 'KeyS') { stageSel = Math.min(STAGES.length - 1, stageSel + 3); focusStage(); }
      else if (go && unlocked(stageSel)) startStage(stageSel);
    } else if (screen === 'cont') {
      if (go) doContinue();
      else if (k === 'Escape') showTitle();
    } else if (screen === 'results') {
      if (k === 'Enter' || k === 'NumpadEnter') nextStage();
      else if (k === 'KeyR') startStage(W.si);
      else if (k === 'Escape') showTitle();
    }
  });

  window.addEventListener('pointerdown', (e) => {
    gesture();
    if (e.pointerType === 'touch' && !touchMode) { touchMode = true; document.body.classList.add('touch'); showTouch(); }
  }, true);
  if (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) { touchMode = true; document.body.classList.add('touch'); }
  Input.bindTouch($('touch'));

  const api = { autoPause: true };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (api.autoPause) pause(true); Kit.sound.suspend(); } else Kit.sound.resume();
  });

  // ---------------------------------------------------------------- test hooks: window.game

  Object.assign(api, {
    // advance the game by `seconds` right now and draw (for the throttled Browser pane)
    step(seconds = 1 / 60) {
      const n = Math.max(1, Math.round(seconds / (1 / 60)));
      for (let i = 0; i < n; i++) tick(1 / 60);
      renderer.render(scene, camera);
      return api.state();
    },
    hold(v = true) { held = !!v; return held; },
    // jump straight into a stage: { stage, mode: '1p' | '2p', hero, difficulty }
    start(o = {}) {
      mode = o.mode || '1p';
      if (o.hero) save.hero = o.hero;
      if (o.difficulty) save.diff = o.difficulty;
      startStage(o.stage || 0);
      return api.state();
    },
    state() {
      if (!W) return { screen };
      return {
        screen, phase: W.phase, stage: W.si, mode: W.mode, t: +W.t.toFixed(2), camX: +W.cam.x.toFixed(2), sec: W.sec, secState: W.secState, go: W.go,
        heroes: W.heroes.map((h) => ({ who: h.who, hp: Math.round(h.hp), lives: h.lives, state: h.state, x: +h.x.toFixed(2), z: +h.z.toFixed(2), weapon: h.weapon && h.weapon.kind, shield: h.shield })),
        enemies: W.enemies.map((e) => ({ type: e.type, hp: Math.round(e.hp), state: e.state, x: +e.x.toFixed(2), z: +e.z.toFixed(2) })),
        buddy: W.buddy ? { who: W.buddy.who, state: W.buddy.state, t: +W.buddyT.toFixed(1) } : null, boss: W.boss ? W.boss.type : null,
        teamCd: +W.teamCd.toFixed(1), fx: Fx.count(),
      };
    },
    // let the bot play the brothers (in a real stage, through the real renderer)
    autoplay(v = true) { autoplay = !!v; return autoplay; },
    press(slot, act) { Input.press(slot, act); },
    call() { Input.press(0, 'call'); },
    // jump to a section of the stage (the last one is the boss)
    warp(sec) {
      if (!W) return;
      const s = Math.min(sec, W.S.sections.length - 1);
      W.enemies = []; W.pending = []; W.shots = [];
      W.sec = s; W.secState = 'travel';
      W.cam.x = Sim.secX(W, W.S.sections[s]) - 0.01;
      camX = W.cam.x;
      for (const h of W.heroes) { if (h.out) continue; h.x = W.cam.x - 2 + h.slot * 1.2; h.state = 'idle'; h.y = 0; }
      if (W.phase === 'intro') { W.phase = 'play'; W.started = true; }
      return api.state();
    },
    world: () => W,
    calm(v = true) { document.body.classList.toggle('calm', !!v); },
    // hide banners and toasts (for clean screenshots)
    quiet() { bannerUntil = 1e-6; for (const t of toasts) t.until = 0; if (W) updateHud(0); },
    camera: () => ({ x: camera.position.x, y: camera.position.y, z: camera.position.z }),
    renderer,
  });
  window.game = api;
  window.BrawlGame = { gesture };

  // ---------------------------------------------------------------- go

  resize();
  setMuteIcons();
  $('loading').classList.add('hidden');
  showTitle();
  requestAnimationFrame(frame);
})();
