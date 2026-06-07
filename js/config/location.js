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
      cave: 20,
      chasm: 15,
      forest: 5,
      snow: 10
    },
    plains: {
      grass: 90,
      forest: 5,
      rock: 2,
      water: 3,
      chasm: 0,
      deep_water: 0
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

  // ---------------------------------------------------------------------------
  // TILE ENTITY SPAWNS
  // Per-tile-terrain spawn tables. Entity values are DIRECT SPAWN PERCENTAGES
  // (0–100). The engine sums all values for a tile; rolls a number in [0, 100).
  // If the roll falls below the total → a weighted pick is made from the table.
  // If the roll is ≥ the total → no entity spawns on that tile.
  //
  // Example: grass totals 30 → 30% chance of any entity on a grass tile,
  //          with sheep_source being the most likely (12 out of 30).
  //
  // Entity keys understood by the engine:
  //   treasure | sheep_source | wood_source | ore_deposit | enemy_army |
  //   burial_mound | dolmen  (cave_entrance is handled separately)
  // ---------------------------------------------------------------------------
  tileEntitySpawns: {
    grass: {
      entities: {
        sheep_source: 7,  // pastoral — primary feature of open land
        treasure: 3,  // hidden stash
        enemy_army: 10,  // raiding warbands
        dolmen: 2,  // ancient standing stone
        burial_mound: 1   // rare; further boosted by raidLocationEffects
      },
      // Monster pool for enemy_army on this tile type
      monsterPool: ['Fenrir Pack Wolf', 'Giant Brood-Spider']
    },
    forest: {
      entities: {
        wood_source: 10,  // forest = primary wood source
        sheep_source: 1,  // forest-edge sheep
        treasure: 3,
        enemy_army: 12,  // wolves and spiders lurk here
        dolmen: 2,
        burial_mound: 1
      },
      monsterPool: ['Fenrir Pack Wolf', 'Giant Brood-Spider']
    },
    rock: {
      entities: {
        ore_deposit: 8,  // rocky ground = iron / silver
        treasure: 4,  // hidden among boulders
        enemy_army: 8,
        dolmen: 1,
        burial_mound: 2
      },
      monsterPool: ['Cave Troll', 'Fenrir Pack Wolf']
    },
    cave: {
      entities: {
        ore_deposit: 12,
        treasure: 8,
        enemy_army: 18,  // dark = dangerous
        dolmen: 2
        // burial_mound absent from raw cave tiles
      },
      monsterPool: ['Cave Troll', 'Fenrir Pack Wolf']
    },
    snow: {
      entities: {
        treasure: 4,
        enemy_army: 10,  // harsh climate, relentless enemies
        ore_deposit: 4,
        dolmen: 3,
        burial_mound: 1
      },
      monsterPool: ['Frost Giant (Jotunn)', 'Fenrir Pack Wolf']
    },
    water: {
      entities: {
        treasure: 7,  // sunken hoard
        enemy_army: 8
      },
      monsterPool: ['Giant Brood-Spider']
    }
  },

  // ---------------------------------------------------------------------------
  // LOCATION EFFECTS
  // Named overlays applied on top of tileEntitySpawns. Each effect:
  //   applyToTiles  – tile terrain types this can appear on, or '*' for all.
  //   spawnChance   – extra probability percentage (0–100) this effect appears on a
  //                   matching tile that has no entity yet.
  //   entity        – entity type to place.
  //
  // Effects are activated via locationBiomeEffects and raidLocationEffects.
  // ---------------------------------------------------------------------------
  locationEffects: {
    // Burial grounds scattered on any solid ground in raid locations
    burial_ground: {
      applyToTiles: ['grass', 'rock', 'snow', 'forest'],
      spawnChance: 12,
      entity: 'burial_mound'
    },
    // Mountain / cave worlds have extra ore in rocky areas
    rich_veins: {
      applyToTiles: ['rock', 'cave'],
      spawnChance: 10,
      entity: 'ore_deposit'
    },
    // Dense forests have extra wood sources
    old_growth: {
      applyToTiles: ['forest'],
      spawnChance: 10,
      entity: 'wood_source'
    },
    // Spiritually significant land → more dolmens
    sacred_land: {
      applyToTiles: ['grass', 'forest', 'snow'],
      spawnChance: 5,
      entity: 'dolmen'
    },
    // Fortified raid sites have extra enemy encampments on rock / grass
    war_camp: {
      applyToTiles: ['grass', 'snow', 'rock'],
      spawnChance: 8,
      entity: 'enemy_army'
    }
  },

  // ---------------------------------------------------------------------------
  // LOCATION BIOME EFFECTS
  // Maps each locationType (the biome of the location) to the list of
  // locationEffects keys that are active for it.
  // ---------------------------------------------------------------------------
  locationBiomeEffects: {
    forest: ['old_growth'],
    mountain: ['rich_veins'],
    cave: ['rich_veins'],
    plains: [],
    snow: [],
    water: [],
    default: []
  },

  // ---------------------------------------------------------------------------
  // RAID LOCATION EFFECTS
  // Controls extra overlays for raid locations specifically.
  //   all        – effect keys applied to EVERY raid_ location.
  //   <locationId> – additional effects for that specific named location
  //                  (merged on top of 'all').
  // ---------------------------------------------------------------------------
  raidLocationEffects: {
    all: ['burial_ground', 'sacred_land'],               // every raid gets burial mounds
    raid_village: ['old_growth'],       // village raids also have forested areas
    raid_fortress: ['war_camp'],         // fortresses have extra enemy camps
    raid_monastery: ['sacred_land']       // monasteries have dolmens
  },

  // Specialized monster pools per locationType (used as fallback if a tile's
  // own monsterPool is not defined)
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
  sheepSource: {
    sheepMin: 1,
    sheepMax: 1
  },

  // Chance settings for cave portals under diminishing returns
  cavePortalBaseChance: 0.02,
  cavePortalDecayFactor: 2,

  // Treasure loot settings
  treasure: {
    goldMin: 5,
    goldMax: 16,
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
    maxTimeFactorCap: 2.5,
    bossThreshold: 1.40,
    bosses: ['Frost Giant (Jotunn)', 'Lindwurm'],
    maxCountLimit: 6
  }
};
