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
    deck.push(getRandomFromWeights(pool));
  }
  shuffle(deck);

  // Guarantee at least one cave tile is near the top of the stack (drawn early)
  if (pool.cave && pool.cave > 0) {
    let caveIdx = deck.lastIndexOf('cave');
    if (caveIdx === -1) {
      // If no cave tile exists in the deck, replace one near the top (last elements of array)
      const targetIdx = deck.length - 1 - Math.floor(Math.random() * 10);
      deck[targetIdx] = 'cave';
    } else {
      // Swap the existing cave tile into the top 10 elements of the deck
      const targetIdx = deck.length - 1 - Math.floor(Math.random() * 10);
      const temp = deck[targetIdx];
      deck[targetIdx] = deck[caveIdx];
      deck[caveIdx] = temp;
    }
  }

  // 2. Initialize grid state with center starting tile
  const { x: sx, y: sy, terrain: st } = CFG.startTile;
  const placedTiles = {};
  placedTiles[`${sx},${sy}`] = { terrainType: st, revealed: true, entity: null };

  const state = {
    isDiscovered: true,
    isCleared: false,
    placedTiles,
    tileStack: deck,
    hasCaveEntranceSpawned: false
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
  const isFirstCaveEntranceNeeded = terrain === 'cave' && !locState.hasCaveEntranceSpawned;

  if (isTraversable && (isFirstCaveEntranceNeeded || Math.random() < CFG.entitySpawnChance)) {
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
  if (terrain === 'cave') {
    const locState = STATE.locations[locationId];
    if (locState && !locState.hasCaveEntranceSpawned) {
      type = 'cave_entrance';
      locState.hasCaveEntranceSpawned = true;
    } else if (Math.random() < CFG.caveEntranceChance) {
      type = 'cave_entrance';
      if (locState) locState.hasCaveEntranceSpawned = true;
    }
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

// Draw a random item from an object of weights (e.g. { grass: 30, forest: 10 })
function getRandomFromWeights(weightsObj) {
  const entries = Object.entries(weightsObj);
  const totalWeight = entries.reduce((sum, [_, weight]) => sum + weight, 0);
  let roll = Math.random() * totalWeight;
  for (const [terrain, weight] of entries) {
    if (roll < weight) {
      return terrain;
    }
    roll -= weight;
  }
  return entries[entries.length - 1][0];
}
