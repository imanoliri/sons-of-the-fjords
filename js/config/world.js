/* ==========================================================================
   CONFIG: WORLD MAP — Sons of the Fjords
   ========================================================================== */

// ─── MAP DEFINITIONS ────────────────────────────────────────────────────────
// Each map has metadata for the landing screen + the terrain/location data
// used by world.js to build the actual grid.

export const MAPS = [
  // ── MAP 1: Fjordlands ──────────────────────────────────────────────────────
  {
    id: 'fjordlands',
    name: 'Fjordlands',
    subtitle: 'The Classic Norse Saga',
    description: 'Sail winding fjords, march through ancient forests, and plunder monastery treasures. A balanced campaign for seasoned raiders.',
    difficulty: 1,           // 1–4 (shown as ☆ indicators on the card)
    difficultyLabel: 'Balanced',
    emoji: '⚔️',
    newEnemies: [],
    terrainHighlights: ['plains','forest','water','snow','mountain'],
    gridSize: 15,
    partyStart: { x: 2, y: 7 },
    terrainZones: [
      { label: 'snow',     condition: 'y <= 2' },
      { label: 'mountain', condition: 'y >= 13 || x === 14 || (x === 0 && y >= 11)' },
      { label: 'water',    condition: 'y === 7 || y === 8' },
      { label: 'water',    condition: 'x <= 2' },
      { label: 'river',    condition: 'x === 8 && y >= 3 && y <= 6' },
      { label: 'river',    condition: 'x === 6 && y >= 9 && y <= 12' },
      { label: 'forest',   condition: '(x >= 9 && x <= 12 && y >= 3 && y <= 6) || (x >= 3 && x <= 5 && y >= 9 && y <= 11)' },
      { label: 'plains',   condition: 'default' }
    ],
    locations: {
      "3,6":   { id: "town_1", name: "Fjordgard Kaufang",      type: "town", terrain: "plains"   },
      "8,4":   { id: "town_2", name: "Heimdall Sogn",          type: "town", terrain: "plains"   },
      "12,11": { id: "town_3", name: "Ullsgard Outpost",       type: "town", terrain: "plains"   },
      "4,3":   { id: "raid_1", name: "St. Alban Monastery",    type: "raid", terrain: "forest",   locationType: "forest",       raidType: "monastery",    dangerLevel: 1 },
      "3,9":   { id: "raid_2", name: "Lindisfarne Shore",      type: "raid", terrain: "plains",   locationType: "default",      raidType: "settlement",   dangerLevel: 2 },
      "10,1":  { id: "raid_3", name: "Barrow Mound of Balder", type: "raid", terrain: "snow",     locationType: "burial_mound", raidType: "burial_vault", dangerLevel: 3 },
      "13,12": { id: "raid_4", name: "Jotunn Crag Cave",       type: "raid", terrain: "mountain", locationType: "mountain",     raidType: "cave",         dangerLevel: 4 },
      "8,12":  { id: "raid_5", name: "Thjazi Keep Ruins",      type: "raid", terrain: "forest",   locationType: "forest",       raidType: "ruins",        dangerLevel: 5 }
    }
  },

  // ── MAP 2: Iron Coast ─────────────────────────────────────────────────────
  {
    id: 'iron_coast',
    name: 'Iron Coast',
    subtitle: "The Warrior's Shore",
    description: 'A war-torn coastline where rival jarls and mercenary camps block the way inland. Expect heavy resistance and rich plunder. Combat-focused.',
    difficulty: 2,
    difficultyLabel: 'Hard',
    emoji: '🗡️',
    newEnemies: ['Mercenary Guard', 'Shore Raider'],
    terrainHighlights: ['plains','water','mountain','forest'],
    gridSize: 15,
    partyStart: { x: 1, y: 7 },
    terrainZones: [
      { label: 'mountain', condition: 'x >= 12' },
      { label: 'mountain', condition: 'y <= 1 || y >= 13' },
      { label: 'water',    condition: 'x <= 2 && y >= 3 && y <= 11' },
      { label: 'water',    condition: 'x === 6 && y >= 5 && y <= 9' },
      { label: 'river',    condition: 'x === 3 && y >= 3 && y <= 11' },
      { label: 'forest',   condition: '(x >= 7 && x <= 10 && y >= 2 && y <= 5) || (x >= 8 && x <= 11 && y >= 9 && y <= 12)' },
      { label: 'snow',     condition: 'x >= 11 && y <= 4' },
      { label: 'plains',   condition: 'default' }
    ],
    locations: {
      "5,4":   { id: "town_1", name: "Ironhaven Port",          type: "town", terrain: "plains"   },
      "5,10":  { id: "town_2", name: "Bloodfell Crossing",      type: "town", terrain: "plains"   },
      "10,7":  { id: "town_3", name: "Skjoldr Bastion",         type: "town", terrain: "plains"   },
      "4,6":   { id: "raid_1", name: "Jarl Haakon's Longhouse",  type: "raid", terrain: "plains",   locationType: "default",      raidType: "settlement",    dangerLevel: 1 },
      "7,3":   { id: "raid_2", name: "Mercenary War Camp",       type: "raid", terrain: "forest",   locationType: "forest",       raidType: "mercenary_camp",dangerLevel: 2 },
      "4,12":  { id: "raid_3", name: "Tidal Watchtower",         type: "raid", terrain: "plains",   locationType: "default",      raidType: "fortress",      dangerLevel: 3 },
      "11,6":  { id: "raid_4", name: "Warlord's Iron Keep",      type: "raid", terrain: "mountain", locationType: "mountain",     raidType: "fortress",      dangerLevel: 4 },
      "9,11":  { id: "raid_5", name: "Hall of Fallen Berserkers",type: "raid", terrain: "forest",   locationType: "burial_mound", raidType: "warband",       dangerLevel: 5 },
      "8,2":   { id: "raid_6", name: "Coastal Wolf Den",        type: "raid", terrain: "forest",   locationType: "forest",       raidType: "wolf_den",      dangerLevel: 2 }
    },
    monsterPoolOverrides: {
      // Brood-spiders have no place on this military coastline
      global: {
        remove: ['Giant Brood-Spider']
      },
      // Burial grounds stay with their undead — keep out living combatants
      byBiomeType: {
        burial_mound: { prevent: ['Shore Raider', 'Mercenary Guard'] }
      },
      byRaidType: {
        settlement:     { add: ['Shore Raider'], prevent: ['Fenrir Pack Wolf'] },
        fortress:       { add: ['Mercenary Guard'], prevent: ['Fenrir Pack Wolf'] },
        mercenary_camp: { add: ['Mercenary Guard', 'Shore Raider'], prevent: ['Fenrir Pack Wolf'] },
        warband:        { add: ['Mercenary Guard', 'Shore Raider'], prevent: ['Fenrir Pack Wolf'] }
      }
    }
  },

  // ── MAP 3: Whispering Swamps ──────────────────────────────────────────────
  {
    id: 'whispering_swamps',
    name: 'Whispering Swamps',
    subtitle: 'Fens of Niflheim',
    description: 'A dreary marshland where thick fog conceals bog-mummies, creeping horrors, and hidden altars. Navigation is slow and dangerous.',
    difficulty: 3,
    difficultyLabel: 'Haunting',
    emoji: '💀',
    newEnemies: ['Bog Mummy', 'Swamp Hag', 'Swamp Wolf'],
    terrainHighlights: ['water', 'forest', 'plains'],
    gridSize: 15,
    partyStart: { x: 7, y: 0 },
    terrainZones: [
      { label: 'water',    condition: 'x === 7 || y === 7 || (x === y)' },
      { label: 'forest',   condition: 'x <= 4 || x >= 11 || y >= 11' },
      { label: 'plains',   condition: 'default' }
    ],
    locations: {
      "7,1":   { id: "town_1", name: "Bog-Wood Haven",           type: "town", terrain: "plains" },
      "12,12": { id: "town_2", name: "Witch-Cottage Trading",    type: "town", terrain: "plains" },
      "2,6":   { id: "raid_1", name: "Drowned Barrow Mound",     type: "raid", terrain: "forest", locationType: "burial_mound", raidType: "burial_vault", dangerLevel: 2 },
      "10,4":  { id: "raid_2", name: "Lindwurm Feeding Pit",     type: "raid", terrain: "plains", locationType: "default",      raidType: "beast_lair",   dangerLevel: 3 },
      "5,13":  { id: "raid_3", name: "Sanctuary of the Bog-God", type: "raid", terrain: "forest", locationType: "forest",       raidType: "ruins",        dangerLevel: 4 }
    },
    monsterPoolOverrides: {
      global: {
        remove: ['Fenrir Pack Wolf', 'Frost Giant (Jotunn)', 'Cave Troll']
      },
      byBiomeType: {
        forest: { add: ['Bog Mummy', 'Swamp Hag', 'Swamp Wolf'] },
        water: { add: ['Bog Mummy'] }
      },
      byRaidType: {
        burial_vault: { add: ['Bog Mummy'] },
        ruins: { add: ['Swamp Hag'] },
        beast_lair: { add: ['Lindwurm'] }
      }
    }
  },

  // ── MAP 4: Dark Archipelago ───────────────────────────────────────────────
  {
    id: 'dark_archipelago',
    name: 'Dark Archipelago',
    subtitle: 'The Drowned Isles',
    description: 'A labyrinth of waterways and cursed island ruins. Seafaring is essential — your Drakkar is your lifeline. Magic objects abound.',
    difficulty: 3,
    difficultyLabel: 'Treacherous',
    emoji: '🌊',
    newEnemies: ['Archipelago Wraith'],
    terrainHighlights: ['water','plains','forest','mountain'],
    gridSize: 15,
    partyStart: { x: 1, y: 7 },
    terrainZones: [
      { label: 'mountain', condition: 'x === 8 && (y === 7 || y === 8)' },
      { label: 'mountain', condition: 'x >= 12 && y >= 11' },
      { label: 'forest',   condition: '(x === 6 || x === 7) && (y === 3 || y === 4)' },
      { label: 'forest',   condition: '(x >= 11 && x <= 12) && (y >= 5 && y <= 7)' },
      { label: 'river',    condition: 'x === 4 && y >= 5 && y <= 9' },
      { label: 'river',    condition: 'y === 6 && x >= 5 && x <= 9' },
      { label: 'plains',   condition: '(x === 2 || x === 3) && (y >= 5 && y <= 9)' },
      { label: 'plains',   condition: '(x >= 5 && x <= 8) && (y >= 2 && y <= 5)' },
      { label: 'plains',   condition: '(x >= 6 && x <= 9) && (y >= 7 && y <= 10)' },
      { label: 'plains',   condition: '(x >= 10 && x <= 13) && (y >= 4 && y <= 8)' },
      { label: 'plains',   condition: '(x >= 11 && x <= 13) && (y >= 10 && y <= 13)' },
      { label: 'water',    condition: 'default' }                        // base is ocean
    ],
    locations: {
      "2,7":   { id: "town_1", name: "The Drowned Pier",          type: "town", terrain: "plains"   },
      "11,6":  { id: "town_2", name: "Svartalheim Anchorage",     type: "town", terrain: "plains"   },
      "12,12": { id: "town_3", name: "Serpent Isle Outpost",      type: "town", terrain: "plains"   },
      "7,3":   { id: "raid_1", name: "Sunken Monastery of Mimir", type: "raid", terrain: "forest",   locationType: "forest",       raidType: "monastery",   dangerLevel: 1 },
      "6,8":   { id: "raid_2", name: "Wraith Cove Ruins",         type: "raid", terrain: "plains",   locationType: "burial_mound", raidType: "ruins",       dangerLevel: 2 },
      "8,7":   { id: "raid_3", name: "Naglfar Shipwreck",         type: "raid", terrain: "mountain", locationType: "mountain",     raidType: "ruins",       dangerLevel: 3 },
      "10,4":  { id: "raid_4", name: "Isle of Skadi's Curse",      type: "raid", terrain: "plains",   locationType: "default",      raidType: "cursed_isle", dangerLevel: 4 },
      "12,11": { id: "raid_5", name: "Dread Throne of Hel",       type: "raid", terrain: "mountain", locationType: "mountain",     raidType: "underworld",  dangerLevel: 5 }
    },
    monsterPoolOverrides: {
      // Burial grounds keep their Draugr pure — wraiths and raiders are sea threats, not tomb-dwellers
      byBiomeType: {
        burial_mound: { prevent: ['Archipelago Wraith', 'Shore Raider'] }
      },
      // Spectral and coastal enemies appear only where they thematically belong
      byRaidType: {
        ruins:       { add: ['Archipelago Wraith', 'Shore Raider'] },
        cursed_isle: { add: ['Archipelago Wraith'] },
        underworld:  { add: ['Archipelago Wraith'] },
        // Monastery: spiritual undead (Draugr), not sea-wraiths
        monastery:   { add: ['Draugr Warrior'], prevent: ['Archipelago Wraith'] }
      }
    }
  },

  // ── MAP 5: Muspelheim's Edge ──────────────────────────────────────────────
  {
    id: 'muspelheim_edge',
    name: "Muspelheim's Edge",
    subtitle: 'The Obsidian Crater',
    description: 'A scorching wasteland of volcanic ash, lava flows, and ancient fire giant ruins. High risk, scarce food, and burning enemies.',
    difficulty: 4,
    difficultyLabel: 'Apocalyptic',
    emoji: '🌋',
    newEnemies: ['Fire Giant', 'Lava Beetle', 'Cinder Spinner', 'Ash Wolf'],
    terrainHighlights: ['mountain', 'forest', 'plains'],
    gridSize: 15,
    partyStart: { x: 1, y: 1 },
    terrainZones: [
      { label: 'mountain', condition: 'x >= 6 && x <= 8 && y >= 6 && y <= 8' },
      { label: 'river',    condition: 'y === 5 || x === 10' },
      { label: 'forest',   condition: '(x >= 2 && x <= 4 && y >= 8 && y <= 11)' },
      { label: 'plains',   condition: 'default' }
    ],
    locations: {
      "1,2":   { id: "town_1", name: "Surtr's Ash-Forge",         type: "town", terrain: "plains" },
      "13,13": { id: "town_2", name: "Outpost of the Last Hearth", type: "town", terrain: "plains" },
      "7,7":   { id: "raid_1", name: "Volcanic Core Vault",       type: "raid", terrain: "mountain", locationType: "mountain", raidType: "underworld", dangerLevel: 5 },
      "3,10":  { id: "raid_2", name: "Cinder-Web Nest",           type: "raid", terrain: "forest",   locationType: "forest",   raidType: "spider_nest", dangerLevel: 2 },
      "12,4":  { id: "raid_3", name: "Ashen Barrow Mound",        type: "raid", terrain: "plains",   locationType: "burial_mound", raidType: "burial_vault", dangerLevel: 3 }
    },
    monsterPoolOverrides: {
      global: {
        remove: ['Fenrir Pack Wolf', 'Frost Giant (Jotunn)']
      },
      byBiomeType: {
        forest: { add: ['Cinder Spinner'] },
        mountain: { add: ['Fire Giant', 'Ash Wolf', 'Lava Beetle'] },
        burial_mound: { add: ['Draugr Warrior'] }
      },
      byRaidType: {
        spider_nest: { add: ['Cinder Spinner', 'Lava Beetle'] },
        underworld: { add: ['Fire Giant'] }
      }
    }
  },

  // ── MAP 6: Frozen Wastes ──────────────────────────────────────────────────
  {
    id: 'frozen_wastes',
    name: 'Frozen Wastes',
    subtitle: 'The Realm of Jotunn',
    description: 'A blizzard-wracked tundra ruled by frost giants and howling wolves. Few towns, scarce food, and relentless cold. For veteran chieftains only.',
    difficulty: 4,
    difficultyLabel: 'Brutal',
    emoji: '❄️',
    newEnemies: ['Ice Wolf'],
    terrainHighlights: ['snow','mountain','forest'],
    gridSize: 15,
    partyStart: { x: 2, y: 13 },
    terrainZones: [
      { label: 'snow',     condition: 'y <= 8' },
      { label: 'mountain', condition: 'y <= 3 || (x >= 11 && y <= 9)' },
      { label: 'mountain', condition: 'x === 0 || x === 14' },
      { label: 'river',    condition: 'x === 5 && y >= 5 && y <= 12' },
      { label: 'river',    condition: 'x === 9 && y >= 4 && y <= 11' },
      { label: 'forest',   condition: '(x >= 2 && x <= 4 && y >= 6 && y <= 9) || (x >= 6 && x <= 8 && y >= 10 && y <= 13)' },
      { label: 'plains',   condition: 'default' }
    ],
    locations: {
      "3,11":  { id: "town_1", name: "Frost-Beard's Mead Hall",   type: "town", terrain: "plains"   },
      "10,12": { id: "town_2", name: "Nidavellir Forge",          type: "town", terrain: "plains"   },
      "6,4":   { id: "raid_1", name: "Glacier Burial Vault",     type: "raid", terrain: "snow",     locationType: "burial_mound", raidType: "burial_vault", dangerLevel: 1 },
      "4,7":   { id: "raid_2", name: "Skoll's Wolf Den",          type: "raid", terrain: "forest",   locationType: "forest",       raidType: "wolf_den",     dangerLevel: 2 },
      "10,5":  { id: "raid_3", name: "Frost Giant Citadel",      type: "raid", terrain: "mountain", locationType: "mountain",     raidType: "giant_lair",   dangerLevel: 3 },
      "7,12":  { id: "raid_4", name: "Sunken Jotunn Temple",     type: "raid", terrain: "snow",     locationType: "burial_mound", raidType: "underworld",   dangerLevel: 4 },
      "2,2":   { id: "raid_5", name: "Throne of Ymir",           type: "raid", terrain: "snow",     locationType: "mountain",     raidType: "giant_lair",   dangerLevel: 5 }
    },
    monsterPoolOverrides: {
      // Ice Wolves replace pack wolves in frozen biomes (snow & mountain world tiles)
      // Forest and plains pockets keep their standard fauna
      byBiomeType: {
        snow:         { remove: ['Fenrir Pack Wolf'], add: ['Ice Wolf'] },
        mountain:     { remove: ['Fenrir Pack Wolf'], add: ['Ice Wolf'] },
        // Burial vaults are silent — only the undead walk here
        burial_mound: { prevent: ['Ice Wolf', 'Fenrir Pack Wolf'] }
      },
      byRaidType: {
        // The wolf den is home to the real pack — Ice Wolves don't belong here
        wolf_den:     { add: ['Fenrir Pack Wolf'], prevent: ['Ice Wolf'] },
        // Burial vaults get Draugr explicitly; biome alone guarantees the pool
        // but the raidType add is a belt-and-suspenders guarantee
        burial_vault: { add: ['Draugr Warrior'] }
      }
    }
  },

  // ── MAP 7: Jotunheim Peaks ────────────────────────────────────────────────
  {
    id: 'jotunheim_peaks',
    name: 'Jotunheim Peaks',
    subtitle: "The Giant's Ladder",
    description: 'Ascend frozen peaks and high altitude tundra where ancient Jotunn guards stand between you and sacred shrines.',
    difficulty: 4,
    difficultyLabel: 'Extreme',
    emoji: '🦅',
    newEnemies: ['Ymir Frost-Shaman', 'Rime-Crag Gargoyle'],
    terrainHighlights: ['mountain', 'snow', 'plains'],
    gridSize: 15,
    partyStart: { x: 7, y: 14 },
    terrainZones: [
      { label: 'mountain', condition: 'y <= 6 || x <= 2 || x >= 12' },
      { label: 'snow',     condition: 'y <= 10' },
      { label: 'plains',   condition: 'default' }
    ],
    locations: {
      "7,12": { id: "town_1", name: "Rime-Gate Settlement",     type: "town", terrain: "plains" },
      "1,4":  { id: "town_2", name: "High-Peak Hermitage",       type: "town", terrain: "plains" },
      "7,3":  { id: "raid_1", name: "Throne of the Frost Jarl",  type: "raid", terrain: "mountain", locationType: "mountain", raidType: "giant_lair", dangerLevel: 5 },
      "4,8":  { id: "raid_2", name: "Ice-Wind Cave System",      type: "raid", terrain: "snow",     locationType: "mountain", raidType: "cave",       dangerLevel: 3 },
      "10,9": { id: "raid_3", name: "Glacial Burial Cairn",      type: "raid", terrain: "snow",     locationType: "burial_mound", raidType: "burial_vault", dangerLevel: 4 }
    },
    monsterPoolOverrides: {
      global: {
        remove: ['Giant Brood-Spider', 'Fenrir Pack Wolf']
      },
      byBiomeType: {
        snow: { add: ['Ymir Frost-Shaman', 'Ice Wolf'] },
        mountain: { add: ['Rime-Crag Gargoyle', 'Frost Giant (Jotunn)'] }
      },
      byRaidType: {
        giant_lair: { add: ['Frost Giant (Jotunn)'] },
        cave: { add: ['Rime-Crag Gargoyle', 'Ymir Frost-Shaman'] }
      }
    }
  }
];

// ─── DEFAULT / ACTIVE CONFIG (kept for backwards-compat with state.js) ───────
export const WORLD_CONFIG = MAPS[0];
