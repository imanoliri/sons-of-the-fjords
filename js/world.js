/* ==========================================================================
   WORLD MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE } from './state.js';
import { MAPS, WORLD_CONFIG } from './config/world.js';
import { COMBAT_CONFIG } from './config/combat.js';
import { BIOME_MONSTER_POOLS } from './config/biomes.js';

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

  STATE.worldMap.id = cfg.id;
  STATE.worldMap.name = cfg.name;
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

  // 3b. Initialize Roaming Bands
  STATE.worldMap.roamingBands = [];
  const numBands = 3;
  for (let i = 0; i < numBands; i++) {
    let rx, ry, attempts = 0;
    let terrain = '';
    do {
      rx = Math.floor(Math.random() * size);
      ry = Math.floor(Math.random() * size);
      terrain = tiles[ry][rx];
      attempts++;
    } while (
      (Math.abs(rx - cfg.partyStart.x) + Math.abs(ry - cfg.partyStart.y) < 5 ||
      (terrain === 'water' && cfg.id !== 'dark_archipelago' && cfg.id !== 'iron_coast')) &&
      attempts < 100
    );

    const isNaval = (terrain === 'water');
    const pool = getMonsterPoolForTile(rx, ry);
    const selectedMonster = pool[Math.floor(Math.random() * pool.length)] || 'Fenrir Pack Wolf';
    const difficulty = cfg.difficulty || 1;
    let countMin = Math.max(1, Math.floor(2 * difficulty));
    let countMax = Math.max(countMin, Math.floor(4 * difficulty));
    const count = Math.floor(Math.random() * (countMax - countMin + 1)) + countMin;

    const monsterCfg = COMBAT_CONFIG.monsters[selectedMonster] || {};
    const bandName = selectedMonster;
    const bandEmoji = monsterCfg.emoji || '🛡️';

    STATE.worldMap.roamingBands.push({
      id: `band_${Date.now()}_${i}`,
      name: bandName,
      emoji: bandEmoji,
      type: isNaval ? 'naval' : 'land',
      x: rx,
      y: ry,
      isDefeated: false,
      monsters: [{ monsterClass: selectedMonster, count }]
    });
  }

  // 4. Set initial party spawn point from config
  STATE.party.worldX = cfg.partyStart.x;
  STATE.party.worldY = cfg.partyStart.y;
}

// TODO: Consolidate this monster pool resolution logic with generateEntity() in location.js 
// to avoid duplication once the location generation and map-specific overrides are unified.
export function getMonsterPoolForTile(x, y) {
  const terrain = STATE.worldMap.tiles[y][x];
  const activeMap = getActiveMap();

  let pool = [...(BIOME_MONSTER_POOLS[terrain] || BIOME_MONSTER_POOLS.default)];
  if (terrain === 'water') {
    pool = Object.keys(COMBAT_CONFIG.monsters);
  }

  const overrides = activeMap?.monsterPoolOverrides;
  if (overrides) {
    const tiers = [overrides.global, overrides.byBiomeType?.[terrain]];
    for (const tier of tiers) {
      if (!tier) continue;
      if (tier.remove) pool = pool.filter(m => !tier.remove.includes(m));
      if (tier.add) pool = [...pool, ...tier.add];
    }
  }

  if (terrain === 'water') {
    pool = pool.filter(m => {
      const cfg = COMBAT_CONFIG.monsters[m];
      return cfg && (cfg.isWaterborn || cfg.isFlying);
    });
    if (pool.length === 0) pool = ['Lindwurm', 'Shore Raider'];
  }

  return pool;
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

function findNextStepTowards(startX, startY, targetX, targetY, isNaval, size, tiles) {
  const queue = [[{ x: startX, y: startY }]];
  const visited = new Set();
  visited.add(`${startX},${startY}`);

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];

    if (current.x === targetX && current.y === targetY) {
      return path[1] || { x: startX, y: startY };
    }

    const adjs = [];
    const deltas = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
    for (const d of deltas) {
      const nx = current.x + d.x;
      const ny = current.y + d.y;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
        adjs.push({ x: nx, y: ny });
      }
    }

    for (const neighbor of adjs) {
      const key = `${neighbor.x},${neighbor.y}`;
      if (!visited.has(key)) {
        const terrain = tiles[neighbor.y][neighbor.x];
        let traversable = false;
        if (isNaval) {
          traversable = (terrain === 'water' || terrain === 'river');
        } else {
          traversable = (terrain !== 'water');
        }

        if (traversable || (neighbor.x === targetX && neighbor.y === targetY)) {
          visited.add(key);
          queue.push([...path, neighbor]);
        }
      }
    }
  }

  return null;
}

export function tickRoamingBands() {
  if (!STATE.worldMap.roamingBands || STATE.worldMap.roamingBands.length === 0) return [];
  const size = activeMapConfig.gridSize;
  const tiles = STATE.worldMap.tiles;
  const logs = [];

  for (const band of STATE.worldMap.roamingBands) {
    if (band.isDefeated) continue;

    const px = STATE.party.worldX;
    const py = STATE.party.worldY;

    if (band.cooldownTicks > 0) {
      const isSameTile = (band.x === px && band.y === py);
      if (!isSameTile) {
        band.cooldownTicks--;
      }
      continue;
    }

    const dist = Math.abs(band.x - px) + Math.abs(band.y - py);

    let nextStep = null;
    const isNaval = (band.type === 'naval');

    if (dist <= 5) {
      nextStep = findNextStepTowards(band.x, band.y, px, py, isNaval, size, tiles);
    }

    if (!nextStep) {
      const adjs = getAdjacentCoords(band.x, band.y);
      let validMoves = adjs;
      if (isNaval) {
        validMoves = adjs.filter(a => tiles[a.y][a.x] === 'water' || tiles[a.y][a.x] === 'river');
      } else {
        validMoves = adjs.filter(a => tiles[a.y][a.x] !== 'water');
      }
      if (validMoves.length > 0) {
        nextStep = validMoves[Math.floor(Math.random() * validMoves.length)];
      }
    }

    if (nextStep) {
      band.x = nextStep.x;
      band.y = nextStep.y;
    }

    if (band.x === STATE.party.worldX && band.y === STATE.party.worldY) {
      logs.push({
        text: `WARBAND ENCOUNTER: The mobile enemy group '${band.name}' intercepted your party! Prepare for battle!`,
        band: band
      });
    }
  }

  return logs;
}

/** Ticks hazards: moves them randomly and returns collision logs if they touch the player */
export function tickHazards() {
  const logs = [];

  // Tick Weather Hazards
  if (STATE.worldMap.hazards && STATE.worldMap.hazards.length > 0) {
    const size = activeMapConfig.gridSize;
    const tiles = STATE.worldMap.tiles;

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
  }

  // Tick Roaming Bands
  const bandLogs = tickRoamingBands();
  logs.push(...bandLogs);

  return logs;
}
