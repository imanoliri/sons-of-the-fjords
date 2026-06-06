/* ==========================================================================
   LOCATION MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE } from './state.js';

// Spawns/Initializes the Carcassonne stack for a location
export function generateLocationMap(locationId, worldTileTerrain) {
  // Check if location already has state, if so, return it
  if (STATE.locations[locationId]) {
    return STATE.locations[locationId];
  }

  // 1. Generate Tile Stack Deck based on world tile class
  const deck = [];
  const terrainPools = {
    water: ['grass', 'grass', 'forest', 'water', 'water', 'chasm', 'chasm'],
    forest: ['grass', 'forest', 'forest', 'forest', 'rock', 'chasm', 'grass'],
    snow: ['snow', 'snow', 'snow', 'mountain', 'rock', 'chasm', 'cave'],
    mountain: ['rock', 'rock', 'mountain', 'mountain', 'cave', 'cave', 'chasm'],
    plains: ['grass', 'grass', 'grass', 'forest', 'rock', 'water', 'chasm']
  };

  const pool = terrainPools[worldTileTerrain] || terrainPools.plains;
  
  // Create a deck of 120 tiles (large enough to cover the 10x10 grid exploration)
  for (let i = 0; i < 120; i++) {
    const randomTerrain = pool[Math.floor(Math.random() * pool.length)];
    deck.push(randomTerrain);
  }

  // Shuffler
  shuffle(deck);

  // 2. Initialize 10x10 grid state
  const placedTiles = {};
  
  // Spawn starting tile at center 5,5
  placedTiles["5,5"] = {
    terrainType: 'grass',
    revealed: true,
    entity: null
  };

  // Build local state
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
  
  // Decide entity spawn (35% chance) - only on traversable terrains (not chasm or mountain)
  let entity = null;
  const isTraversable = terrain !== 'chasm' && terrain !== 'mountain';
  if (isTraversable && Math.random() < 0.35) {
    entity = generateRandomEntity(locationId, terrain);
  }

  locState.placedTiles[`${x},${y}`] = {
    terrainType: terrain,
    revealed: true,
    entity
  };

  return terrain;
}

// Generate random entity for location
function generateRandomEntity(locationId, terrain) {
  const types = ['treasure', 'enemy_army', 'burial_mound', 'dolmen'];
  const roll = Math.random();

  let type = 'treasure';
  if (roll < 0.25) type = 'treasure';
  else if (roll < 0.65) type = 'enemy_army';
  else if (roll < 0.85) type = 'burial_mound';
  else type = 'dolmen';

  // Override cave portal inside mountains/cave cells
  if (terrain === 'cave' && Math.random() < 0.5) {
    type = 'cave_entrance';
  }

  const magicObjects = {
    odin: 'Shard of Gungnir',
    thor: 'Mjolnir\'s Core',
    freya: 'Freya\'s Amber Tear',
    hel: 'Hel\'s Urn of Ash',
    loki: 'Loki\'s Trickster Coin'
  };

  if (type === 'treasure') {
    return {
      type: 'treasure',
      silver: Math.floor(Math.random() * 12) + 5,
      items: Math.random() < 0.4 ? ['Mead Horn', 'Valkyrie Herb'] : [],
      isLooted: false
    };
  } 
  else if (type === 'enemy_army') {
    // Determine monster difficulty based on location ID or type
    const monstersPool = ['Giant Brood-Spider', 'Fenrir Pack Wolf', 'Draugr Warrior', 'Cave Troll'];
    const selectedMonster = monstersPool[Math.floor(Math.random() * monstersPool.length)];
    const count = Math.floor(Math.random() * 2) + 1; // 1-2 monsters

    return {
      type: 'enemy_army',
      monsters: [{ monsterClass: selectedMonster, count }],
      isDefeated: false
    };
  } 
  else if (type === 'burial_mound') {
    return {
      type: 'burial_mound',
      relicItemName: 'Ancient Burial Shield',
      isExplored: false
    };
  } 
  else if (type === 'dolmen') {
    const keys = Object.keys(magicObjects);
    const godKey = keys[Math.floor(Math.random() * keys.length)];
    return {
      type: 'dolmen',
      magicObjectId: magicObjects[godKey],
      godName: godKey,
      isVisited: false
    };
  }
  else if (type === 'cave_entrance') {
    return {
      type: 'cave_entrance',
      targetLocationId: `${locationId}_sub_cave`
    };
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
