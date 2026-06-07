/* ==========================================================================
   LOCATION MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE } from './state.js';
import { LOCATION_CONFIG as CFG } from './config/location.js';

// Spawns/Initializes the Carcassonne stack for a location
export function generateLocationMap(locationId, worldTileTerrain) {
  // Return existing state if already initialized
  if (STATE.locations[locationId]) {
    return STATE.locations[locationId];
  }

  // 1. Build tile deck from terrain pool
  const pool = CFG.terrainPools[worldTileTerrain] || CFG.terrainPools.plains;
  const deck = [];
  for (let i = 0; i < CFG.deckSize; i++) {
    deck.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  shuffle(deck);

  // 2. Initialize grid state with center starting tile
  const { x: sx, y: sy, terrain: st } = CFG.startTile;
  const placedTiles = {};
  placedTiles[`${sx},${sy}`] = { terrainType: st, revealed: true, entity: null };

  const state = {
    isDiscovered: true,
    isCleared: false,
    placedTiles,
    tileStack: deck
  };

  STATE.locations[locationId] = state;
  return state;
}

// Draw a tile and place it
export function discoverTile(locationId, x, y) {
  const locState = STATE.locations[locationId];
  if (!locState || locState.tileStack.length === 0) return null;

  const terrain = locState.tileStack.pop();

  // Decide entity spawn — only on traversable terrains
  let entity = null;
  const isTraversable = !CFG.nonTraversable.includes(terrain);
  if (isTraversable && Math.random() < CFG.entitySpawnChance) {
    entity = generateRandomEntity(locationId, terrain);
  }

  locState.placedTiles[`${x},${y}`] = { terrainType: terrain, revealed: true, entity };
  return terrain;
}

// Generate random entity for location tile
function generateRandomEntity(locationId, terrain) {
  const roll = Math.random();
  const w = CFG.entityWeights;

  let type;
  if      (roll < w.treasure)     type = 'treasure';
  else if (roll < w.enemy_army)   type = 'enemy_army';
  else if (roll < w.burial_mound) type = 'burial_mound';
  else                            type = 'dolmen';

  // Cave terrain override
  if (terrain === 'cave' && Math.random() < CFG.caveEntranceChance) {
    type = 'cave_entrance';
  }

  if (type === 'treasure') {
    const t = CFG.treasure;
    return {
      type: 'treasure',
      silver: Math.floor(Math.random() * (t.goldMax - t.goldMin)) + t.goldMin,
      items: Math.random() < t.itemChance ? [...t.itemPool] : [],
      isLooted: false
    };
  }

  if (type === 'enemy_army') {
    const e = CFG.enemyArmy;
    const selectedMonster = e.monsterPool[Math.floor(Math.random() * e.monsterPool.length)];
    const count = Math.floor(Math.random() * (e.countMax - e.countMin + 1)) + e.countMin;
    return {
      type: 'enemy_army',
      monsters: [{ monsterClass: selectedMonster, count }],
      isDefeated: false
    };
  }

  if (type === 'burial_mound') {
    return {
      type: 'burial_mound',
      relicItemName: 'Ancient Burial Shield',
      isExplored: false
    };
  }

  if (type === 'dolmen') {
    const keys = Object.keys(CFG.magicObjects);
    const godKey = keys[Math.floor(Math.random() * keys.length)];
    return {
      type: 'dolmen',
      magicObjectId: CFG.magicObjects[godKey],
      godName: godKey,
      isVisited: false
    };
  }

  if (type === 'cave_entrance') {
    return { type: 'cave_entrance', targetLocationId: `${locationId}_sub_cave` };
  }

  return null;
}

// Utility shuffler
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
