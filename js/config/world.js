/* ==========================================================================
   CONFIG: WORLD MAP — Sons of the Fjords
   ========================================================================== */

export const WORLD_CONFIG = {
  gridSize: 15,

  // Party starting position on the world map
  partyStart: { x: 2, y: 7 },

  // Terrain zone rules (evaluated top-to-bottom, first match wins)
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

  // Static named locations keyed by "x,y"
  locations: {
    "3,6":   { id: "town_1", name: "Fjordgard Kaufang",      type: "town", terrain: "plains"   },
    "8,4":   { id: "town_2", name: "Heimdall Sogn",          type: "town", terrain: "plains"   },
    "12,11": { id: "town_3", name: "Ullsgard Outpost",       type: "town", terrain: "plains"   },
    "4,3":   { id: "raid_1", name: "St. Alban Monastery",    type: "raid", terrain: "forest"   },
    "3,9":   { id: "raid_2", name: "Lindisfarne Shore",      type: "raid", terrain: "plains"   },
    "10,1":  { id: "raid_3", name: "Barrow Mound of Balder", type: "raid", terrain: "snow"     },
    "13,12": { id: "raid_4", name: "Jotunn Crag Cave",       type: "raid", terrain: "mountain" },
    "8,12":  { id: "raid_5", name: "Thjazi Keep Ruins",      type: "raid", terrain: "forest"   }
  }
};
