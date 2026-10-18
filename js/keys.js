/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: "Double TTrouble",
  cols: ["Teddy (1P)", "Tommy (2P)"],
  keys: [
    ["walk (up and down the street too)", "W A S D", "↑ ← ↓ →"],
    ["pillow bonk", "F", "J"],
    ["jump", "G", "K"],
    ["special", "H", "L"],
    ["dash", "double-tap A or D", "double-tap ← or →"],
    ["call your brother · team-up", "T", "Enter"],
    ["pause · sound", "P or Esc · M", ""],
  ],
  note: "In 1 player both sets of keys work, and Space jumps.",
  touch: "Joystick, 👊 BONK, ⬆️ JUMP and ⭐. Tap your brother's face to call him.",
});
