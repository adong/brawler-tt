/* 中文 for Double TTrouble: every word on the page, the toasts and banners, the stage and boss names, the ? panel
   (Kit.lang, from kit/lang.js). The comic bursts (POW!) and the street signs are drawn on canvases, so js/fx.js and
   js/scenery.js ask Kit.lang.t() for them; their words are here too.
   Staying in English on purpose: the kids' names (TEDDY, TOMMY), the game's name and logo (Alan's pick), and the
   1P / 2P labels. */
(function () {
  const L = Kit.lang;
  L.keep([
    'DOUBLE', 'TT', 'ROUBLE', 'TTROUBLE', 'Double TTrouble', 'Claude Code', 'Esc',
    'TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'TEDDY!', 'TOMMY!', 'TEDDY · 1P', 'TOMMY · 2P', 'Teddy (1P)', 'Tommy (2P)',
  ]);

  // the six streets and their stories
  const STAGE = {
    'SUNNY PARK': '阳光公园', 'SUBWAY PLATFORM': '地铁站台', 'ROOFTOP': '天台', 'THE MALL': '大商场',
    'SCHOOL GYM': '学校体育馆', 'ZOMBIE CASTLE': '僵尸城堡',
  };
  // the bosses, and the line under their name
  const BOSS = {
    'BIG GRUMBLE': '大咕噜', 'DJ ZOMBIE': 'DJ 僵尸', 'ROCKET BOLT': '火箭机器人', 'MEGA BOLT': '超级大机器人',
    'ZOMBIE COACH': '僵尸教练', 'KING ZOMBIE': '僵尸国王',
  };
  const WEAPON = { 'BIG PILLOW': '大枕头', 'RUBBER CHICKEN': '橡皮鸡', 'FOAM BAT': '泡泡球棒' };
  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  L.add(STAGE);
  L.add(BOSS);
  L.add(WEAPON);

  L.add({
    // stories (the line under STAGE 1)
    'The Grumble Gang snatched every pillow in town! Get them back!': '咕噜帮抢走了全城的枕头！快去抢回来！',
    'The gang ran down into the subway. Mind the gap!': '坏蛋们跑进地铁站啦。小心站台缝隙！',
    'Up on the roofs at sunset. Something is buzzing up there...': '夕阳下的天台上……好像有什么在嗡嗡响！',
    'They are hiding in the toy shop. Shhh... PILLOW FIGHT!': '他们躲在玩具店里。嘘……枕头大战开始！',
    "Teddy's favourite place: the basketball court. Time for dodgeball!": 'Teddy 最爱的篮球场。来玩躲避球啦！',
    "The King Zombie's silly castle, full of pillows. The last pillow fight!": '僵尸国王的搞笑城堡，堆满了枕头。最后一场枕头大战！',
    // boss lines
    'King of the Gremlins!': '小怪兽的大王！', 'Drops the beat (and notes)!': '会扔音符的打碟高手！',
    'Zooms around the rooftops!': '在天台上飞来飞去！', 'The biggest robot in the mall!': '商场里最大的机器人！',
    'Blows the whistle!': '最爱吹哨子！', 'Ruler of the silly castle!': '搞笑城堡的国王！',

    // title screen
    "Teddy & Tommy's big pillow fight": 'Teddy 和 Tommy 的枕头大战',
    '▶ 1 PLAYER': '▶ 单人', '👫 2 PLAYERS': '👫 双人',
    'Teddy or Tommy (+ call your brother)': 'Teddy 或 Tommy（还能叫兄弟来帮忙）',
    'brothers together, one keyboard': '兄弟一起玩，一个键盘',
    'lots of health, slow baddies': '血多多，坏蛋慢慢',
    'for big kids': '给大孩子玩',
    '🗺️ STAGES': '🗺️ 选关', 'Difficulty': '难度',
    'walk (up/down the street too)': '走路（还能往里往外走）',
    'pillow bonk · jump · special': '枕头打 · 跳 · 大招',
    'dash': '冲刺',
    'call your brother / team-up': '叫兄弟来帮忙 / 兄弟合体',
    "Joystick to walk (flick it twice to dash). 👊 bonk, ⬆️ jump, ⭐ special. Tap your brother's face to call him! On an iPad, two players can play side by side.":
      '摇杆走路（快速拨两下就冲刺）。👊 打，⬆️ 跳，⭐ 大招。点兄弟的头像叫他来帮忙！在 iPad 上，两个人可以并排一起玩。',
    'LOADING…': '加载中…',
    '↻ Turn sideways for a bigger pillow fight!': '↻ 横过来玩，枕头大战看得更清楚！',

    // who's playing?
    "WHO'S PLAYING?": '谁来玩？',
    '🥊 pillow jab · straight · hook': '🥊 枕头刺拳 · 直拳 · 勾拳',
    '🏀 SLAM DUNK special': '🏀 大招：扣篮',
    '🛏️ pillow bop · bop · FLOMP': '🛏️ 枕头 啵 · 啵 · 扑！',
    '✌️ PEACE WAVE special': '✌️ 大招：比耶冲击波',
    '◀ BACK': '◀ 返回',

    // stage select
    'PICK A STAGE': '选一关',

    // the HUD
    'YOU': '你', '🛡️ SAFE': '🛡️ 安全', 'CALL': '呼叫', 'TAP FOR A TREAT': '再点要零食', 'TEAM-UP!': '兄弟合体！',
    'BOSS': '大怪', 'GO ➜': '前进 ➜', 'SPECIAL': '大招', 'JUMP': '跳', 'BONK': '打',
    'OUT': '出局', 'OUT · tap 👊': '出局 · 点 👊 回来', 'OUT · press F': '出局 · 按 F 回来', 'OUT · press J': '出局 · 按 J 回来',
    'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'Call your brother (T)': '叫兄弟来帮忙 (T)',
    'Team-up special (T or Enter)': '兄弟合体大招 (T 或 回车)',

    // banners and toasts
    'PILLOW FIGHT!': '枕头大战！', 'STAGE CLEAR!': '过关啦！', 'BACK IN!': '回来啦！', 'BONK!': '咣！',
    'SLAM DUNK!': '扣篮！', 'PEACE WAVE!': '比耶冲击波！',
    '🪶 THE PILLOW BURST!': '🪶 枕头爆开啦！', '💨 BYE-BYE BAT!': '💨 球棒拜拜！', '💨 BYE-BYE CHICKEN!': '💨 橡皮鸡拜拜！',

    // pause, continue, results
    'P · Esc · Space to resume · Q for the menu · M sound': 'P · Esc · 空格 继续 · Q 回菜单 · M 声音',
    'CONTINUE?': '继续吗？', 'YES! ▶': '继续！▶', '↻ TRY AGAIN': '↻ 再试一次', 'NO': '不了',
    'No continues left, but you can try the stage again!': '没有续关次数了，不过可以重新挑战这一关！',
    'Have another go! (as many as you like on easy)': '再来一次！（简单模式想来几次都行）',
    'YOU WON!': '你们赢啦！',
    'Every pillow is back home. The Grumble Gang waves the white flag! 🏳️': '所有枕头都回家啦。咕噜帮举白旗投降！🏳️',
    '⭐ score': '⭐ 得分', '🏳️ baddies bonked': '🏳️ 打败的坏蛋', '⏱️ time': '⏱️ 用时', '🛡️ saves': '🛡️ 被救了几次',
    '🤜🤛 team-ups': '🤜🤛 兄弟合体',
    'NEXT STAGE ▶': '下一关 ▶', '🗺️ ALL STAGES': '🗺️ 全部关卡', '↻ AGAIN': '↻ 再来一次',
    'Enter: next · R: again · Esc: menu': '回车：下一关 · R：再来 · Esc：菜单',

    // the ? panel (js/keys.js)
    'walk (up and down the street too)': '走路（还能往里往外走）',
    'pillow bonk': '枕头打', 'special': '大招',
    'double-tap A or D': '连按两下 A 或 D', 'double-tap ← or →': '连按两下 ← 或 →',
    'call your brother · team-up': '叫兄弟来帮忙 · 兄弟合体', 'P or Esc · M': 'P 或 Esc · M',
    'In 1 player both sets of keys work, and Space jumps.': '单人时两套按键都能用，空格也能跳。',
    "Joystick, 👊 BONK, ⬆️ JUMP and ⭐. Tap your brother's face to call him.": '摇杆、👊 打、⬆️ 跳 和 ⭐ 大招。点兄弟的头像叫他来帮忙。',

    // comic bursts (drawn on canvases)
    'POW!': '砰！', 'BOP!': '啵！', 'BAM!': '嘭！', 'WHUMP!': '咚！', 'FLOMP!': '扑！', 'FWUMP!': '扑扑！', 'WHOOSH!': '嗖！',
    'SQUAWK!': '嘎嘎！', 'WHAM!': '哐！', 'STRIKE!': '全倒！', 'BOING!': '嘣！', 'PEACE!': '耶！', 'KA-BOOM!': '轰隆！',
    'OOF!': '哎哟！', 'THUD!': '咚隆！', 'HI!': '嗨！', 'WHEE!': '呜呼！', 'HIGH FIVE!': '击掌！', 'SAVED!': '挡住啦！',
    'POOF!': '噗！', 'BEEP!': '哔！', 'BOINK!': '啵嘤！',

    // street signs (drawn on canvases)
    'PILLOW ST.': '枕头街站', 'PILLOW FUN!': '枕头真好玩！',
    TOYS: '玩具', 'ICE CREAM': '冰淇淋', PETS: '宠物', CANDY: '糖果', GAMES: '游戏', SHOES: '鞋子', BOOKS: '图书', PIZZA: '披萨',
    'GO TEDDY!': 'TEDDY 加油！', 'TEAM TOMMY': 'TOMMY 队', 'PILLOW CHAMPS': '枕头冠军', 'BOUNCE!': '弹起来！',
    'HOME 99 · AWAY 0': '主队 99 · 客队 0',

    // the gang (in case a name shows up)
    'HOODIE ZOMBIE': '卫衣僵尸', 'BOLT BOT': '闪电机器人', 'WOBBLY GREMLIN': '摇摇小怪兽',
  });

  // strings with names or numbers in them
  const t = (s) => L.t(s);
  L.rule(/^STAGE (\d+)$/, '第 $1 关');
  L.rule(/^(\d+) · (.+)$/, (m, n, name) => `${n} · ${t(name)}`);                                    // the stage chip
  L.rule(/^(\S+) ([A-Z][A-Z .']+) · (.+)$/, (m, e, name, story) => `${e} ${t(name)} · ${t(story)}`); // under STAGE 1
  L.rule(/^boss: (.+)$/, (m, b) => `大怪：${t(b)}`);
  L.rule(/^(\S+) (.+) is pillow-fight free!$/, (m, e, name) => `${e} ${t(name)}的枕头都抢回来啦！`);
  L.rule(/^(\S+) YUM! \+(\d+)$/, '$1 好吃！+$2');
  L.rule(/^(\S+) (BIG PILLOW|RUBBER CHICKEN|FOAM BAT)!$/, (m, e, w) => `${e} ${WEAPON[w]}！`);
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (.+)!$/, (m, e, item, who) => `${e} ${who} 送来的${TREAT[item]}！`);
  L.rule(/^(.+) IS HERE! 👋$/, '$1 来啦！👋');
  L.rule(/^(.+) SAVED YOU! 🛡️$/, '$1 救了你！🛡️');
  L.rule(/^(.+) IS BACK! 💪$/, '$1 回来啦！💪');
  L.rule(/^(.+) IS OUT!$/, '$1 出局啦！');
  L.rule(/^BYE! (.+)$/, '拜拜！$1');
  L.rule(/^(\d+) continues? left$/, '还能续关 $1 次');
  L.rule(/^🍦 treats from (.+)$/, '🍦 $1 送的零食');
})();
