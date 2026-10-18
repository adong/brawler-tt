/* Double TTrouble: the tuning tables. Everything you might want to tweak lives here: how the brothers move and
   hit, every enemy and boss, pick-ups, treats, the companion and the two difficulty levels.
   Units are metres and seconds. x runs along the street (right is +x), z is depth (up the street is -z, toward
   the camera is +z), y is height. Stages and their waves are in js/stages.js. */
(function () {
  'use strict';

  // ---------------------------------------------------------------- the world

  const WORLD = {
    VIEW_HALF: 7,        // half the visible street width (the game may narrow it on a portrait screen)
    Z_MIN: -2.7,         // the far edge of the street you can walk on
    Z_MAX: 1.3,          // the near edge
    GRAVITY: 18,
    EDGE: 0.55,          // how close to the screen edge anyone may stand
  };

  // ---------------------------------------------------------------- the brothers

  // Moves. len: how long it lasts. at..until: when it can hit. reach: how far in front it hits (from the body
  // centre). depth: how far up/down the street it reaches. dmg: damage. stun: how long a light hit freezes the
  // enemy. knock: knocks down. next: from when a new press chains the next combo hit. word: the comic burst.
  const MOVES = {
    // Teddy: a Tyson-style jab and straight with a pillow in each fist, then a double-pillow hook that knocks down
    jab:      { len: 0.24, at: 0.06, until: 0.14, reach: 1.3, depth: 0.55, dmg: 6, stun: 0.34, push: 0.4, next: 0.1, word: 'BOP!', anim: 'jab' },
    straight: { len: 0.27, at: 0.07, until: 0.15, reach: 1.4, depth: 0.55, dmg: 7, stun: 0.36, push: 0.5, next: 0.11, word: 'POW!', anim: 'straight' },
    hook:     { len: 0.5, at: 0.14, until: 0.27, reach: 1.5, depth: 0.65, dmg: 12, knock: true, next: 0.4, word: 'WHUMP!', big: true, anim: 'hook', lunge: 1.2 },
    // Tommy: pillow, pillow, and a big overhead pillow swing
    poke:     { len: 0.25, at: 0.07, until: 0.15, reach: 1.35, depth: 0.55, dmg: 6, stun: 0.34, push: 0.4, next: 0.1, word: 'BOP!', anim: 'poke' },
    poke2:    { len: 0.27, at: 0.07, until: 0.15, reach: 1.4, depth: 0.55, dmg: 7, stun: 0.36, push: 0.5, next: 0.11, word: 'FWUMP!', anim: 'poke2' },
    swing:    { len: 0.52, at: 0.16, until: 0.29, reach: 1.6, depth: 0.7, dmg: 12, knock: true, next: 0.42, word: 'FLOMP!', big: true, anim: 'swing', lunge: 1.0 },
    // everyone
    jumpKick: { reach: 1.3, depth: 0.55, dmg: 10, knock: true, word: 'BAM!', big: true },
    dashHit:  { len: 0.45, at: 0.04, until: 0.3, reach: 1.25, depth: 0.6, dmg: 11, knock: true, next: 0.45, word: 'WHOOSH!', big: true, anim: 'dash', lunge: 4.5 },
    bop:      { len: 0.24, at: 0.08, until: 0.12, dmg: 5, word: 'BOP!' },          // pillow bop while holding someone
    toss:     { len: 0.42, dmg: 12, hitOthers: 10, speed: 8, word: 'WHEE!' },       // throwing someone you're holding
  };

  // Things you can pick up and swing. uses: how many hits before it goes POOF.
  const WEAPONS = {
    pillow:  { name: 'BIG PILLOW', len: 0.42, at: 0.14, until: 0.26, reach: 1.85, depth: 0.75, dmg: 10, knockEvery: 2, uses: 12, word: 'FLOMP!', anim: 'wswing', feathers: true },
    chicken: { name: 'RUBBER CHICKEN', len: 0.3, at: 0.08, until: 0.17, reach: 1.55, depth: 0.6, dmg: 8, knockEvery: 3, uses: 16, word: 'SQUAWK!', anim: 'wjab', squeak: true },
    bat:     { name: 'FOAM BAT', len: 0.48, at: 0.16, until: 0.28, reach: 1.95, depth: 0.7, dmg: 13, knockEvery: 1, uses: 8, word: 'WHAM!', anim: 'wswing' },
  };

  // Food heals. Walk over it to eat it.
  const FOOD = {
    melon:    { emoji: '🍉', name: 'WATERMELON', heal: 40 },
    cookie:   { emoji: '🍪', name: 'COOKIE', heal: 20 },
    icecream: { emoji: '🍦', name: 'ICE CREAM', heal: 30 },
  };

  const HEROES = {
    teddy: {
      combo: ['jab', 'straight', 'hook'],
      special: 'dunk',      // jumps up and slam-dunks a 🏀: a BOING shockwave where it lands
      specialName: 'SLAM DUNK!',
      speed: 3.4, speedZ: 2.3, run: 6.6, jump: 7.0,
      hello: 'boxing', bye: 'jumpshot', tag: '#8cc2ff',
    },
    tommy: {
      combo: ['poke', 'poke2', 'swing'],
      special: 'peace',     // the Y pose: a ring of ✌️ and ⭐ that spreads out all around him
      specialName: 'PEACE WAVE!',
      speed: 3.5, speedZ: 2.4, run: 6.6, jump: 7.2,
      hello: 'peace', bye: 'peace', tag: '#ffb02e',
    },
  };

  const SPECIALS = {
    dunk:  { len: 0.95, slamAt: 0.55, radius: 2.7, depth: 1.5, dmg: 22, ahead: 1.4 },
    peace: { len: 1.0, at: 0.25, radius: 4.2, speed: 8, dmg: 20, zScale: 1.7 },
    cost: 8,               // health it costs (it never takes your last point)
  };

  // ---------------------------------------------------------------- the silly gang

  // speed: walking speed. attack: how it attacks (see js/brains.js). windup: how long it shows "!" before.
  // look: passed to Kit.people.build (styles in kit/people.js). extras: bits this game adds (ears, crown...).
  // drop: chance it leaves food behind.
  const ENEMIES = {
    zombie: {
      name: 'HOODIE ZOMBIE', hp: 34, speed: 1.25, attack: 'hug', windup: 0.6, reach: 1.1, dmg: 7, score: 100, drop: 0.12,
      looks: [
        { head: 'human', zombie: true, skin: '#8fbf6a', hair: 'short', hairColor: '#2b2f22', shirt: 'hoodie', top: '#6d5a8c', print: 'torn', bottom: '#4a4038', shoes: '#5b4636' },
        { head: 'human', zombie: true, skin: '#9fcf7a', hair: 'short', hairColor: '#33301f', shirt: 'hoodie', top: '#e0663a', bottom: '#38405a', shoes: '#2a2a30' },
        { head: 'human', zombie: true, skin: '#86c08a', hair: 'spiky', hairColor: '#3a2f1f', shirt: 'hoodie', top: '#3a8fd8', print: 'star', bottom: '#4a4038', shoes: '#e6e6e6' },
        { head: 'human', zombie: true, skin: '#a6c96a', hair: 'short', hairColor: '#2b2f22', shirt: 'hoodie', top: '#e04a8a', bottom: '#2b3140', shoes: '#5b4636', shorts: true },
      ],
    },
    robot: {
      name: 'BOLT BOT', hp: 42, speed: 1.8, attack: 'punch', windup: 0.42, reach: 1.2, dmg: 8, score: 150, drop: 0.15,
      looks: [
        { head: 'robot', skin: '#e6eaef', eyes: '#5ef2ff', shirt: 'jacket', top: '#ff8a1f', print: 'panel', bottom: '#5a5f6b', shoes: '#2a2a30' },
        { head: 'robot', skin: '#d8dde4', eyes: '#ff5ef2', shirt: 'jacket', top: '#2fb36a', print: 'bolt', bottom: '#3a3f4b', shoes: '#2a2a30' },
        { head: 'robot', skin: '#eef0f4', eyes: '#ffe14d', shirt: 'jacket', top: '#3d6fe0', print: 'panel', bottom: '#5a5f6b', shoes: '#ff3d3d' },
      ],
    },
    gremlin: {
      name: 'WOBBLY GREMLIN', hp: 22, speed: 2.3, attack: 'hop', windup: 0.38, reach: 2.2, dmg: 6, score: 80, drop: 0.1, scale: 0.72,
      extras: ['ears'],
      looks: [
        { head: 'bear', skin: '#7ccf4a', muzzle: '#c9f2a0', shirt: 'hoodie', top: '#8d5bd8', bottom: '#3a2f5a', shorts: true, shoes: '#ffb02e', belly: true },
        { head: 'bear', skin: '#5ec9b0', muzzle: '#d0fff0', shirt: 'hoodie', top: '#ff8a1f', bottom: '#2b3a63', shorts: true, shoes: '#8d5bd8', belly: true },
        { head: 'bear', skin: '#b0d84a', muzzle: '#f4ffc0', shirt: 'tee', top: '#ff3d7f', print: 'star', bottom: '#2b3a63', shorts: true, shoes: '#18b4ff', belly: true },
      ],
    },
  };

  // Bosses. moves: how often it picks each move (bigger = more often). See js/brains.js for what they do.
  const BOSSES = {
    grumble: {
      name: 'BIG GRUMBLE', title: 'King of the Gremlins', hp: 300, speed: 1.7, scale: 1.45, dmg: 12, score: 2000,
      moves: { swipe: 3, stomp: 3, summon: 1 }, summon: 'gremlin', extras: ['ears'],
      look: { head: 'bear', skin: '#6cc23a', muzzle: '#c9f2a0', shirt: 'hoodie', top: '#5b2fa8', print: 'star', bottom: '#2a1f4a', shorts: true, shoes: '#ffb02e', belly: true },
    },
    dj: {
      name: 'DJ ZOMBIE', title: 'Drops the beat (and notes)', hp: 320, speed: 1.6, scale: 1.35, dmg: 11, score: 2000,
      moves: { swipe: 3, throw: 3, summon: 1 }, throws: 'note', summon: 'zombie',
      look: { head: 'human', zombie: true, skin: '#8fd07a', hair: 'short', hairColor: '#2b2f22', hat: 'capBack', hatColor: '#18b4ff', headphones: '#22212a', shirt: 'hoodie', top: '#ff3d7f', print: 'bolt', bottom: '#20232e', shoes: '#ffd400', belly: true },
    },
    rocket: {
      name: 'ROCKET BOLT', title: 'Zooms around the rooftops', hp: 340, speed: 2.0, scale: 1.35, dmg: 11, score: 2000,
      moves: { swipe: 3, swoop: 3, throw: 2 }, throws: 'bolt',
      look: { head: 'robot', skin: '#dfe6ee', eyes: '#ffd400', shirt: 'jacket', top: '#18b4ff', print: 'bolt', bottom: '#3a3f4b', shoes: '#ff3d3d', pack: '#ff8a1f', packPocket: '#ffd400' },
    },
    megabolt: {
      name: 'MEGA BOLT', title: 'The biggest robot in the mall', hp: 380, speed: 1.4, scale: 1.65, dmg: 13, score: 2500,
      moves: { swipe: 3, zap: 3, charge: 2 },
      look: { head: 'robot', skin: '#f2f4f8', eyes: '#ff5e5e', shirt: 'jacket', top: '#ffd400', print: 'panel', bottom: '#4a4f5b', shoes: '#2a2a30', belly: true },
    },
    coach: {
      name: 'ZOMBIE COACH', title: 'Blows the whistle', hp: 400, speed: 1.7, scale: 1.5, dmg: 13, score: 2500,
      moves: { swipe: 3, throw: 3, charge: 2, summon: 1 }, throws: 'dodgeball', summon: 'zombie', extras: ['whistle'],
      look: { head: 'human', zombie: true, skin: '#94c472', hair: 'short', hairColor: '#2b2f22', hat: 'cap', hatColor: '#e53935', badge: true, shirt: 'jacket', top: '#2f6fdc', print: 'star', bottom: '#2f6fdc', shoes: '#f4f4f4', belly: true },
    },
    king: {
      name: 'KING ZOMBIE', title: 'Ruler of the silly castle', hp: 480, speed: 1.6, scale: 1.75, dmg: 14, score: 4000,
      moves: { swipe: 3, stomp: 2, throw: 2, summon: 1 }, throws: 'pie', summon: 'zombie', extras: ['crown', 'cape'],
      look: { head: 'human', zombie: true, skin: '#8fbf6a', hair: 'short', hairColor: '#2b2f22', shirt: 'jacket', top: '#7a3fd1', print: 'star', bottom: '#3a2a5a', shoes: '#ffd400', belly: true },
    },
  };

  // What bosses throw: emoji, speed along the street, upward speed (0 = flies straight), damage.
  const SHOTS = {
    note:      { emoji: '🎵', speed: 5.2, up: 0, r: 0.45, dmg: 8, life: 3.2, wobble: true },
    bolt:      { emoji: '🔩', speed: 5.5, up: 5, r: 0.4, dmg: 8, life: 2.5 },
    zap:       { emoji: '⚡', speed: 8.5, up: 0, r: 0.5, dmg: 10, life: 2.2, knock: true },
    dodgeball: { emoji: '🏐', speed: 6.0, up: 4, r: 0.45, dmg: 9, life: 3.0, bounce: true },
    pie:       { emoji: '🥧', speed: 5.0, up: 5.5, r: 0.5, dmg: 9, life: 2.5 },
  };

  // ---------------------------------------------------------------- the companion

  const TREATS = [
    { emoji: '🍦', name: 'ICE CREAM' },
    { emoji: '💧', name: 'WATER' },
    { emoji: '🧃', name: 'JUICE BOX' },
    { emoji: '🍪', name: 'COOKIE' },
    { emoji: '🍉', name: 'WATERMELON' },
    { emoji: '🍌', name: 'BANANA' },
  ];

  const BUDDY = {
    visit: 10,         // seconds he stays (1 player); calling again while he's here gives another treat and resets this
    treatHeal: 20,     // health a treat gives back
    power: 0.7,        // his hits are this strong compared with yours
    helloRadius: 2.6,  // his hello move bonks gremlins and zombies this close
  };

  // ---------------------------------------------------------------- difficulty

  const DIFF = {
    easy: {
      name: 'EASY', heroHp: 150, lives: 5, continues: Infinity,
      enemyHp: 0.6, enemyDmg: 0.45, enemySpeed: 0.82, windup: 1.4, bossHp: 0.6, keep: 0.75,
      maxActive: 3, maxAttackers: 1, specialCost: 5, teamCd: 15, mercy: 0.8,
    },
    normal: {
      name: 'NORMAL', heroHp: 100, lives: 3, continues: 2,
      enemyHp: 1, enemyDmg: 1, enemySpeed: 1, windup: 1, bossHp: 1, keep: 1,
      maxActive: 4, maxAttackers: 2, specialCost: 8, teamCd: 25, mercy: 0.45,
    },
  };

  window.BRAWL_RULES = { WORLD, MOVES, WEAPONS, FOOD, HEROES, SPECIALS, ENEMIES, BOSSES, SHOTS, TREATS, BUDDY, DIFF };
})();
