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

  // 3. Initialize Hazards
  STATE.worldMap.hazards = [];
  if (cfg.id === 'frozen_wastes') {
    // Spawn 4 blizzards at random locations away from the starting position
    for (let i = 0; i < 4; i++) {
      let hx, hy;
      do {
        hx = Math.floor(Math.random() * size);
        hy = Math.floor(Math.random() * size);
      } while (Math.abs(hx - cfg.partyStart.x) + Math.abs(hy - cfg.partyStart.y) < 4 || tiles[hy][hx] === 'water');
      STATE.worldMap.hazards.push({ type: 'blizzard', x: hx, y: hy });
    }
  } else if (cfg.id === 'dark_archipelago') {
    // Spawn 4 maelstroms on water cells
    for (let i = 0; i < 4; i++) {
      let hx, hy;
      let attempts = 0;
      do {
        hx = Math.floor(Math.random() * size);
        hy = Math.floor(Math.random() * size);
        attempts++;
      } while (
        (Math.abs(hx - cfg.partyStart.x) + Math.abs(hy - cfg.partyStart.y) < 4 || tiles[hy][hx] !== 'water') &&
        attempts < 100
      );
      STATE.worldMap.hazards.push({ type: 'maelstrom', x: hx, y: hy });
    }
  }

  // 4. Set initial party spawn point from config
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

/** Ticks hazards: moves them randomly and returns collision logs if they touch the player */
export function tickHazards() {
  if (!STATE.worldMap.hazards || STATE.worldMap.hazards.length === 0) return [];
  const size = activeMapConfig.gridSize;
  const tiles = STATE.worldMap.tiles;
  const logs = [];

  for (const hazard of STATE.worldMap.hazards) {
    // 1. Pick a random valid adjacent tile to move into
    const adjs = getAdjacentCoords(hazard.x, hazard.y);
    // Filter movement options based on hazard type
    let validMoves = adjs;
    if (hazard.type === 'blizzard') {
      // Blizzards avoid water
      validMoves = adjs.filter(a => tiles[a.y][a.x] !== 'water');
    } else if (hazard.type === 'maelstrom') {
      // Maelstroms stay in water/river
      validMoves = adjs.filter(a => tiles[a.y][a.x] === 'water' || tiles[a.y][a.x] === 'river');
    }

    if (validMoves.length > 0) {
      const choice = validMoves[Math.floor(Math.random() * validMoves.length)];
      hazard.x = choice.x;
      hazard.y = choice.y;
    }

    // 2. Check collision with player
    if (hazard.x === STATE.party.worldX && hazard.y === STATE.party.worldY) {
      // Trigger penalty
      const isBlizzard = hazard.type === 'blizzard';
      const hazardName = isBlizzard ? '❄️ Blizzard' : '🌀 Maelstrom';
      
      // Damage units
      const dmg = isBlizzard ? 5 : 8;
      let deadUnits = [];
      for (let i = STATE.band.length - 1; i >= 0; i--) {
        const u = STATE.band[i];
        u.hp -= dmg;
        if (u.hp <= 0) {
          deadUnits.push(u.name);
          STATE.band.splice(i, 1);
        }
      }

      // Lose resources
      let resLogs = [];
      if (isBlizzard) {
        // Blizzard loses Food (frozen/lost) & Wood
        const foodLoss = Math.min(STATE.resources.food, 10);
        const woodLoss = Math.min(STATE.resources.wood, 5);
        if (foodLoss > 0) STATE.resources.food -= foodLoss;
        if (woodLoss > 0) STATE.resources.wood -= woodLoss;
        resLogs.push(`lost ${foodLoss} Food and ${woodLoss} Wood`);
      } else {
        // Maelstrom loses Sheep (drowned) & Gold (sunk)
        const sheepLoss = Math.min(STATE.resources.sheep, 2);
        const goldLoss = Math.min(STATE.resources.gold, 15);
        if (sheepLoss > 0) STATE.resources.sheep -= sheepLoss;
        if (goldLoss > 0) STATE.resources.gold -= goldLoss;
        resLogs.push(`lost ${sheepLoss} Sheep and ${goldLoss} Gold`);
      }

      logs.push({
        text: `COLLISION: A ${hazardName} swept over your longship! All units took ${dmg} HP damage. Resources: ${resLogs.join(', ')}.`,
        dead: deadUnits
      });
    }
  }

  return logs;
}
