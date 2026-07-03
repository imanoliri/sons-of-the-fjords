/* ==========================================================================
   CONFIG: COMBAT — Sons of the Fjords
   ========================================================================== */

export const COMBAT_CONFIG = {
  gridRows: 8,
  gridCols: 10,

  // Milliseconds per combat tick
  tickIntervalMs: 600,

  // Player units can only be deployed on columns 0–deployColLimit (inclusive)
  deployColLimit: 1,

  // Rewards / penalties
  playerCrossReward: { gold: 1 },           // Player unit reaches enemy end
  enemyBreachDrain: 2,                      // Resources drained when enemy breaches

  // Pool sort points per unit type (higher = sorted first)
  poolSortPoints: {
    huskarl:     4,
    berserker:   3,
    shieldmaiden: 2,
    huntsman:    1,
    runecaster:  1
  },

  // Monster stat table
  monsters: {
    // Standard Foes
    'Brood Spider':  { hp: 20,  dmg: 3,  speed: 2, range: 2, emoji: '🕷️', isDistractableWithSheep: true, abilities: [{ type: 'web_spit', cooldownTicks: 4, durationTicks: 3 }] },
    'Fenrir Pack Wolf':    { hp: 25,  dmg: 4,  speed: 3, range: 1, emoji: '🐺', isDistractableWithSheep: true, abilities: [{ type: 'lane_hop', cooldownTicks: 5 }] },
    'Draugr Warrior':      { hp: 35,  dmg: 5,  speed: 1, range: 1, emoji: '🧟', isDistractableWithSheep: true },
    'Cave Troll':          { hp: 70,  dmg: 8,  speed: 1, range: 1, emoji: '🧌', isDistractableWithSheep: true, abilities: [{ type: 'ground_slam', cooldownTicks: 4, splashRows: 1, dmgMultiplier: 0.6 }] },
    // Bosses
    'Frost Giant (Jotunn)':{ hp: 120, dmg: 10, speed: 1, range: 1, emoji: '❄️', isBribableWithGold: true, isDistractableWithSheep: true, abilities: [{ type: 'freeze_aura', radius: 2, attackSkipProbability: 1.0 }] },
    'Lindwurm':            { hp: 50,  dmg: 6,  speed: 2, range: 1, emoji: '🐉', isWaterborn: true, isDistractableWithSheep: true, abilities: [{ type: 'acid_spit', maxStacks: 3, dmgIncreasePerStack: 1 }] },
    // New Monsters & Foes for specific worlds
    'Ice Wolf':            { hp: 30,  dmg: 5,  speed: 3, range: 1, emoji: '🐺', isDistractableWithSheep: true }, // Tundra/Frozen Wastes
    'Mercenary Guard':     { hp: 45,  dmg: 6,  speed: 2, range: 1, emoji: '♆', isBribableWithGold: true }, // Iron Coast
    'Shore Raider':        { hp: 40,  dmg: 5,  speed: 2, range: 1, emoji: '🏴‍☠️', isWaterborn: true, isBribableWithGold: true }, // Iron Coast / Dark Archipelago
    'Archipelago Wraith':  { hp: 38,  dmg: 6,  speed: 1, range: 2, emoji: '👻', isFlying: true }, // Dark Archipelago ruins
    // Muspelheim's Edge Monsters
    'Fire Giant':          { hp: 130, dmg: 12, speed: 1, range: 1, emoji: '🔥', isBribableWithGold: true, isDistractableWithSheep: true },
    'Lava Beetle':         { hp: 22,  dmg: 4,  speed: 3, range: 1, emoji: '🪲', isDistractableWithSheep: true },
    'Cinder Spinner':      { hp: 28,  dmg: 5,  speed: 2, range: 2, emoji: '🕷️', isDistractableWithSheep: true },
    // Whispering Swamps Monsters
    'Bog Mummy':           { hp: 42,  dmg: 5,  speed: 1, range: 1, emoji: '🧟', isDistractableWithSheep: true },
    'Swamp Hag':           { hp: 45,  dmg: 6,  speed: 2, range: 2, emoji: '🧙‍♀️', isBribableWithGold: true },
    // Jotunheim Peaks Monsters
    'Ymir Frost-Shaman':   { hp: 60,  dmg: 7,  speed: 1, range: 2, emoji: '🔮', isBribableWithGold: true },
    'Rime-Crag Gargoyle':  { hp: 50,  dmg: 8,  speed: 2, range: 1, emoji: '🦇', isFlying: true, isDistractableWithSheep: true },
    // Ash Wolf and Swamp Wolf to enable Odin favor progression
    'Ash Wolf':            { hp: 30,  dmg: 5,  speed: 3, range: 1, emoji: '🐺', isDistractableWithSheep: true },
    'Swamp Wolf':          { hp: 32,  dmg: 5,  speed: 3, range: 1, emoji: '🐺', isDistractableWithSheep: true }
  },

  // Fallback stats for unknown monsters
  monsterFallback: { hp: 30, dmg: 4, speed: 2, range: 1, emoji: '👾' }
};
