/* ==========================================================================
   WORLD MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE } from './state.js';

export function initializeWorld() {
  const size = 15;
  const tiles = [];
  const revealed = [];

  // 1. Generate Procedural Layout
  for (let y = 0; y < size; y++) {
    const row = [];
    const fogRow = [];
    for (let x = 0; x < size; x++) {
      let terrain = 'plains';
      
      // Northern Tundra / Snow
      if (y <= 2) {
        terrain = 'snow';
      } 
      // Southern/Border Mountains
      else if (y >= 13 || x === 14 || (x === 0 && y >= 11)) {
        terrain = 'mountain';
      }
      // Fjord Inlet / Ocean Channel (sailable)
      else if (y === 7 || y === 8) {
        terrain = 'water';
      }
      // Ocean coastal sea (Left side)
      else if (x <= 2) {
        terrain = 'water';
      }
      // Rivers running into Fjord
      else if (x === 8 && y >= 3 && y <= 6) {
        terrain = 'river';
      }
      else if (x === 6 && y >= 9 && y <= 12) {
        terrain = 'river';
      }
      // Forests patches
      else if ((x >= 9 && x <= 12 && y >= 3 && y <= 6) || (x >= 3 && x <= 5 && y >= 9 && y <= 11)) {
        terrain = 'forest';
      }

      row.push(terrain);
      
      // Always fully revealed (no fog of war on world map)
      fogRow.push(false);
    }
    tiles.push(row);
    revealed.push(fogRow);
  }

  STATE.worldMap.tiles = tiles;
  STATE.worldMap.revealed = revealed;

  // 2. Spawn Static Locations (Coordinates, Names, Types)
  STATE.worldMap.locations = {
    "2,7": { id: "town_1", name: "Fjordgard Kaufang", type: "town", terrain: "water" },
    "8,4": { id: "town_2", name: "Heimdall Sogn", type: "town", terrain: "plains" },
    "12,11": { id: "town_3", name: "Ullsgard Outpost", type: "town", terrain: "plains" },
    "4,3": { id: "raid_1", name: "St. Alban Monastery", type: "raid", terrain: "forest" },
    "1,9": { id: "raid_2", name: "Lindisfarne Shore", type: "raid", terrain: "water" },
    "10,1": { id: "raid_3", name: "Barrow Mound of Balder", type: "raid", terrain: "snow" },
    "13,12": { id: "raid_4", name: "Jotunn Crag Cave", type: "raid", terrain: "mountain" },
    "8,12": { id: "raid_5", name: "Thjazi Keep Ruins", type: "raid", terrain: "forest" }
  };
  
  // Set initial party spawn point
  STATE.party.worldX = 2;
  STATE.party.worldY = 7;
}

// Check adjacent traversability
export function getAdjacentCoords(cx, cy) {
  const coords = [];
  const deltas = [
    { x: 0, y: -1 }, // North
    { x: 0, y: 1 },  // South
    { x: -1, y: 0 }, // West
    { x: 1, y: 0 }   // East
  ];

  for (const d of deltas) {
    const nx = cx + d.x;
    const ny = cy + d.y;
    if (nx >= 0 && nx < 15 && ny >= 0 && ny < 15) {
      coords.push({ x: nx, y: ny });
    }
  }
  return coords;
}
