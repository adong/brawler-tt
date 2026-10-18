/* Double TTrouble: the six stages. Edit freely, then reload the page.

   Each stage is a street you walk along to the right. It stops the screen at each `section` until everyone there is
   bonked, then shows GO →.
     length    how long the street is, in metres (a screen is about 14 m wide)
     theme     which scenery to draw (js/scenery.js): park, subway, rooftop, mall, gym, castle
     boss      the boss waiting at the end (bosses are in js/rules.js)
   Each section:
     at        where the screen stops: 'start', 'end', or metres along the street (the middle of the screen)
     waves     groups of enemies, one after another. A wave comes in when no more than `when` (default 1) of the
               last one are still standing. from: 'right' (default), 'left' or 'both'.
               Enemy types: zombie, robot, gremlin, or the stage's boss.
     items     things lying in the street: food (melon, cookie, icecream) or things to swing (pillow, chicken, bat).
               x is metres from the middle of the screen, z is depth (-2.6 far ... 1.2 near).
     crates    boxes to bonk open, with something inside (drop). look: box, bin, present (changes with the theme). */
window.BRAWL_STAGES = [
  {
    id: 'park', name: 'SUNNY PARK', emoji: '🌳', theme: 'park', length: 74, boss: 'grumble',
    story: 'The Grumble Gang snatched every pillow in town! Get them back!',
    sections: [
      {
        at: 'start',
        items: [{ kind: 'pillow', x: 3, z: 0.4 }],
        waves: [
          { enemies: ['zombie', 'zombie'] },
          { enemies: ['gremlin', 'zombie'], from: 'both' },
        ],
      },
      {
        at: 26,
        crates: [{ x: 4, z: -2.1, drop: 'melon' }],
        waves: [
          { enemies: ['gremlin', 'gremlin'] },
          { enemies: ['zombie', 'gremlin', 'zombie'], from: 'both' },
        ],
      },
      {
        at: 46,
        items: [{ kind: 'chicken', x: -2, z: -1.2 }],
        waves: [
          { enemies: ['zombie', 'zombie', 'gremlin'] },
          { enemies: ['gremlin', 'gremlin', 'zombie'], from: 'left' },
        ],
      },
      {
        at: 'end', boss: true,
        crates: [{ x: -4, z: -2.2, drop: 'cookie' }],
        waves: [
          { enemies: ['grumble'] },
          { enemies: ['gremlin', 'gremlin'], when: 1 },
        ],
      },
    ],
  },
  {
    id: 'subway', name: 'SUBWAY PLATFORM', emoji: '🚇', theme: 'subway', length: 78, boss: 'dj',
    story: 'The gang ran down into the subway. Mind the gap!',
    sections: [
      {
        at: 'start',
        waves: [
          { enemies: ['zombie', 'robot'] },
          { enemies: ['zombie', 'zombie', 'robot'], from: 'both' },
        ],
      },
      {
        at: 26,
        items: [{ kind: 'bat', x: 2, z: -0.4 }],
        crates: [{ x: -3, z: -2.2, drop: 'cookie' }],
        waves: [
          { enemies: ['robot', 'robot'] },
          { enemies: ['zombie', 'robot', 'zombie'], from: 'left' },
        ],
      },
      {
        at: 48,
        crates: [{ x: 3, z: -2.2, drop: 'icecream' }],
        waves: [
          { enemies: ['zombie', 'zombie', 'zombie'] },
          { enemies: ['robot', 'zombie', 'robot'], from: 'both' },
        ],
      },
      {
        at: 'end', boss: true,
        items: [{ kind: 'pillow', x: -3, z: 0.6 }],
        waves: [
          { enemies: ['dj', 'zombie'] },
          { enemies: ['zombie', 'zombie'], when: 1 },
        ],
      },
    ],
  },
  {
    id: 'rooftop', name: 'ROOFTOP', emoji: '🏙️', theme: 'rooftop', length: 78, boss: 'rocket',
    story: 'Up on the roofs at sunset. Something is buzzing up there...',
    sections: [
      {
        at: 'start',
        items: [{ kind: 'chicken', x: 2, z: 0.2 }],
        waves: [
          { enemies: ['gremlin', 'gremlin', 'robot'] },
          { enemies: ['gremlin', 'gremlin', 'gremlin'], from: 'both' },
        ],
      },
      {
        at: 27,
        crates: [{ x: 2, z: -2.2, drop: 'melon' }],
        waves: [
          { enemies: ['robot', 'robot', 'gremlin'] },
          { enemies: ['robot', 'gremlin', 'robot'], from: 'left' },
        ],
      },
      {
        at: 49,
        items: [{ kind: 'pillow', x: -2, z: -0.8 }],
        waves: [
          { enemies: ['gremlin', 'robot', 'gremlin', 'robot'] },
          { enemies: ['robot', 'robot'], from: 'both' },
        ],
      },
      {
        at: 'end', boss: true,
        crates: [{ x: 4, z: -2.2, drop: 'icecream' }],
        waves: [
          { enemies: ['rocket'] },
          { enemies: ['gremlin', 'robot'], when: 1 },
        ],
      },
    ],
  },
  {
    id: 'mall', name: 'THE MALL', emoji: '🛍️', theme: 'mall', length: 82, boss: 'megabolt',
    story: 'They are hiding in the toy shop. Shhh... PILLOW FIGHT!',
    sections: [
      {
        at: 'start',
        waves: [
          { enemies: ['robot', 'zombie', 'gremlin'] },
          { enemies: ['zombie', 'robot', 'zombie'], from: 'both' },
        ],
      },
      {
        at: 26,
        items: [{ kind: 'bat', x: -2, z: 0.4 }],
        crates: [{ x: 4, z: -2.2, drop: 'cookie' }],
        waves: [
          { enemies: ['gremlin', 'gremlin', 'gremlin'] },
          { enemies: ['robot', 'robot', 'zombie'], from: 'left' },
        ],
      },
      {
        at: 50,
        crates: [{ x: -3, z: -2.2, drop: 'icecream' }, { x: 3, z: 0.9, drop: 'chicken' }],
        waves: [
          { enemies: ['robot', 'zombie', 'robot', 'zombie'] },
          { enemies: ['gremlin', 'robot', 'gremlin'], from: 'both' },
        ],
      },
      {
        at: 'end', boss: true,
        items: [{ kind: 'melon', x: -4, z: -1.6 }],
        waves: [
          { enemies: ['megabolt'] },
          { enemies: ['robot', 'robot'], when: 1 },
        ],
      },
    ],
  },
  {
    id: 'gym', name: 'SCHOOL GYM', emoji: '🏀', theme: 'gym', length: 82, boss: 'coach',
    story: "Teddy's favourite place: the basketball court. Time for dodgeball!",
    sections: [
      {
        at: 'start',
        items: [{ kind: 'pillow', x: 2.5, z: 0.3 }],
        waves: [
          { enemies: ['zombie', 'gremlin', 'zombie'] },
          { enemies: ['robot', 'gremlin', 'robot'], from: 'both' },
        ],
      },
      {
        at: 27,
        crates: [{ x: 3, z: -2.2, drop: 'melon' }],
        waves: [
          { enemies: ['zombie', 'zombie', 'zombie', 'gremlin'] },
          { enemies: ['robot', 'zombie', 'gremlin'], from: 'left' },
        ],
      },
      {
        at: 51,
        items: [{ kind: 'chicken', x: -2, z: -1 }],
        waves: [
          { enemies: ['gremlin', 'robot', 'gremlin', 'robot'] },
          { enemies: ['zombie', 'robot', 'zombie', 'gremlin'], from: 'both' },
        ],
      },
      {
        at: 'end', boss: true,
        crates: [{ x: -4, z: -2.2, drop: 'icecream' }],
        waves: [
          { enemies: ['coach'] },
          { enemies: ['zombie', 'robot'], when: 1 },
        ],
      },
    ],
  },
  {
    id: 'castle', name: 'ZOMBIE CASTLE', emoji: '🏰', theme: 'castle', length: 90, boss: 'king',
    story: "The King Zombie's silly castle, full of pillows. The last pillow fight!",
    sections: [
      {
        at: 'start',
        items: [{ kind: 'bat', x: 2.5, z: 0.2 }],
        waves: [
          { enemies: ['zombie', 'zombie', 'robot'] },
          { enemies: ['gremlin', 'zombie', 'gremlin'], from: 'both' },
        ],
      },
      {
        at: 26,
        crates: [{ x: 3, z: -2.2, drop: 'cookie' }],
        waves: [
          { enemies: ['robot', 'robot', 'zombie'] },
          { enemies: ['zombie', 'gremlin', 'zombie', 'gremlin'], from: 'left' },
        ],
      },
      {
        at: 48,
        items: [{ kind: 'pillow', x: -2, z: -1.2 }],
        crates: [{ x: 4, z: 0.9, drop: 'melon' }],
        waves: [
          { enemies: ['zombie', 'robot', 'gremlin', 'zombie'] },
          { enemies: ['robot', 'robot', 'gremlin'], from: 'both' },
        ],
      },
      {
        at: 68,
        crates: [{ x: -3, z: -2.2, drop: 'icecream' }],
        waves: [
          { enemies: ['gremlin', 'gremlin', 'gremlin', 'gremlin'] },
          { enemies: ['zombie', 'robot', 'zombie', 'robot'], from: 'both' },
        ],
      },
      {
        at: 'end', boss: true,
        items: [{ kind: 'chicken', x: -3, z: 0.5 }],
        waves: [
          { enemies: ['king'] },
          { enemies: ['zombie', 'zombie'], when: 1 },
        ],
      },
    ],
  },
];
