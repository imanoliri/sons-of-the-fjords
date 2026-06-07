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
    },
    cave: {
      cave: 50,
      rock: 20,
      mountain: 15,
      chasm: 15
    }
  },

  // Terrains that cannot have entities spawned on them
  nonTraversable: ['chasm', 'mountain', 'deep_water'],

  // Entity spawn probability
  entitySpawnChance: 0.35,
  entityWeights: {
    treasure: 0.25,
    enemy_army: 0.65,
    burial_mound: 0.85,
    dolmen: 1.00
  },

  // Specialized entity weights per biome type (cumulative thresholds)
  entityWeightsByBiome: {
    forest: {
      treasure: 0.15,
      wood_source: 0.35,
      enemy_army: 0.70,
      burial_mound: 0.85,
      dolmen: 1.00
    },
    mountain: {
      treasure: 0.15,
      ore_deposit: 0.35,
      enemy_army: 0.75,
      burial_mound: 0.85,
      dolmen: 1.00
    },
    cave: {
      treasure: 0.15,
      ore_deposit: 0.40,
      enemy_army: 0.80,
      burial_mound: 0.90,
      dolmen: 1.00
    },
    burial_mound: {
      treasure: 0.15,
      enemy_army: 0.55,
      burial_mound: 0.90,
      dolmen: 1.00
    },
    default: {
      treasure: 0.25,
      enemy_army: 0.65,
      burial_mound: 0.85,
      dolmen: 1.00
    }
  },

  // Specialized monster pools per biome
  monsterPoolsByBiome: {
    forest: ['Fenrir Pack Wolf', 'Giant Brood-Spider'],
    mountain: ['Cave Troll', 'Fenrir Pack Wolf'],
    cave: ['Cave Troll', 'Fenrir Pack Wolf'],
    burial_mound: ['Draugr Warrior'],
    default: ['Giant Brood-Spider', 'Fenrir Pack Wolf']
  },

  // Resource nodes harvest yield settings
  woodSource: {
    woodMin: 3,
    woodMax: 7
  },
  oreDeposit: {
    goldMin: 5,
    goldMax: 12
  },

  // Chance settings for cave portals under diminishing returns
  cavePortalBaseChance: 0.02,
  cavePortalDecayFactor: 2,

  // Treasure loot settings
  treasure: {
    goldMin: 5,
    goldMax: 16,   // Math.floor(Math.random() * 12) + 5
    itemChance: 0.0,
    itemPool: []
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
  },

  // Difficulty scaling parameters
  difficultyScaling: {
    dangerMultipliers: [0.8, 0.9, 1.0, 1.1, 1.2],
    caveDepthFactor: 0.35,
    timeFactor: 0.02,
    bossThreshold: 1.40,
    bosses: ['Frost Giant (Jotunn)', 'Lindwurm'],
    maxCountLimit: 6
  }
};
