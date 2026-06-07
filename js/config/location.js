/* ==========================================================================
   CONFIG: LOCATION / DUNGEON — Sons of the Fjords
   ========================================================================== */

export const LOCATION_CONFIG = {
  gridSize: 10,
  deckSize: 120,

  // Starting tile placed at center
  startTile: { x: 5, y: 5, terrain: 'grass' },

  // Terrain pools per world-tile terrain type
  // Each pool entry appears with its weight (repeated entries = higher weight)
  terrainPools: {
    water: {
      grass: 30,
      forest: 10,
      water: 30,
      chasm: 15,
      deep_water: 15
    },
    forest: {
      grass: 30,
      forest: 55,
      rock: 15,
      water: 5,
      mountain: 5
    },
    snow: {
      snow: 45,
      grass: 5,
      mountain: 10,
      rock: 15,
      chasm: 5,
      cave: 5
    },
    mountain: {
      rock: 30,
      mountain: 30,
      cave: 25,
      chasm: 15,
      forest: 5,
      snow: 5
    },
    plains: {
      grass: 60,
      forest: 15,
      rock: 15,
      water: 5,
      chasm: 5,
      deep_water: 5
    }
  },

  // Terrains that cannot have entities spawned on them
  nonTraversable: ['chasm', 'mountain', 'deep_water'],

  // Entity spawn probability (roll < threshold triggers that type, checked in order)
  entitySpawnChance: 0.35,
  entityWeights: {
    treasure: 0.25,   // 0.00 – 0.25
    enemy_army: 0.65,   // 0.25 – 0.65
    burial_mound: 0.85,  // 0.65 – 0.85
    dolmen: 1.00    // 0.85 – 1.00
  },

  // Chance a cave terrain cell spawns a cave_entrance instead of normal entity
  caveEntranceChance: 0.5,

  // Treasure loot settings
  treasure: {
    goldMin: 5,
    goldMax: 16,   // Math.floor(Math.random() * 12) + 5
    itemChance: 0.4,
    itemPool: ['Mead Horn', 'Valkyrie Herb']
  },

  // Enemy army settings
  enemyArmy: {
    countMin: 1,
    countMax: 2,
    monsterPool: ['Giant Brood-Spider', 'Fenrir Pack Wolf', 'Draugr Warrior', 'Cave Troll']
  },

  // Magic objects awarded by dolmens (god key → relic name)
  magicObjects: {
    odin: "Shard of Gungnir",
    thor: "Mjolnir's Core",
    freya: "Freya's Amber Tear",
    hel: "Hel's Urn of Ash",
    loki: "Loki's Trickster Coin"
  }
};
