/* ==========================================================================
   WORLD MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE } from './state.js';
import { MAPS, WORLD_CONFIG } from './config/world.js';

// Currently active map config (defaults to first map)
let activeMapConfig = MAPS[0];

/** Set the active map before calling initializeWorld() */
export function setActiveMap(mapId) {
  const found = MAPS.find(m => m.id === mapId);
  if (found) activeMapConfig = found;
}

/** Get all available maps (for the landing screen picker) */
export function getAvailableMaps() {
  return MAPS;
}

/** Get the currently selected map config */
export function getActiveMap() {
  return activeMapConfig;
}

export function initializeWorld() {
  const cfg = activeMapConfig;
  const size = cfg.gridSize;
  const tiles = [];
  const revealed = [];

  // 1. Generate Procedural Layout
  for (let y = 0; y < size; y++) {
    const row = [];
    const fogRow = [];
    for (let x = 0; x < size; x++) {
      let terrain = 'plains';

      // Evaluate the terrain zones from config
      for (const zone of cfg.terrainZones) {
        if (zone.condition === 'default') {
          terrain = zone.label;
          break;
        }
        const isMatch = new Function('x', 'y', `return (${zone.condition});`)(x, y);
        if (isMatch) {
          terrain = zone.label;
          break;
        }
      }

      row.push(terrain);
      fogRow.push(false); // Always revealed (no fog on world map)
    }
    tiles.push(row);
    revealed.push(fogRow);
  }

  STATE.worldMap.tiles = tiles;
  STATE.worldMap.revealed = revealed;

  // 2. Spawn Static Locations from config
  STATE.worldMap.locations = { ...cfg.locations };

  // 3. Set initial party spawn point from config
  STATE.party.worldX = cfg.partyStart.x;
  STATE.party.worldY = cfg.partyStart.y;
}

// Check adjacent traversability
export function getAdjacentCoords(cx, cy) {
  const size = activeMapConfig.gridSize;
  const coords = [];
  const deltas = [
    { x: 0, y: -1 }, // North
    { x: 0, y: 1  }, // South
    { x: -1, y: 0 }, // West
    { x: 1, y: 0  }  // East
  ];

  for (const d of deltas) {
    const nx = cx + d.x;
    const ny = cy + d.y;
    if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
      coords.push({ x: nx, y: ny });
    }
  }
  return coords;
}
