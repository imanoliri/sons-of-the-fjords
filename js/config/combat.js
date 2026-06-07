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
    berserker:   3,
    shieldmaiden: 2,
    huntsman:    1
  },

  // Monster stat table
  monsters: {
    'Giant Brood-Spider':  { hp: 20,  dmg: 3,  speed: 2, range: 2 },
    'Fenrir Pack Wolf':    { hp: 25,  dmg: 4,  speed: 3, range: 1 },
    'Draugr Warrior':      { hp: 35,  dmg: 5,  speed: 1, range: 1 },
    'Cave Troll':          { hp: 70,  dmg: 8,  speed: 1, range: 1 },
    'Frost Giant (Jotunn)':{ hp: 120, dmg: 10, speed: 1, range: 1 },
    'Lindwurm':            { hp: 50,  dmg: 6,  speed: 2, range: 1 }
  },

  // Fallback stats for unknown monsters
  monsterFallback: { hp: 30, dmg: 4, speed: 2, range: 1 }
};
