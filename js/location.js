/* ==========================================================================
   LOCATION MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE } from './state.js';
import { LOCATION_CONFIG as CFG } from './config/location.js';

// Spawns/Initializes the Carcassonne stack for a location
export function generateLocationMap(locationId, worldTileTerrain, parentLocationId = null, parentCoords = null) {
  // Return existing state if already initialized
  if (STATE.locations[locationId]) {
    return STATE.locations[locationId];
  }

  const pool = CFG.terrainPools[worldTileTerrain] || CFG.terrainPools.plains;
  const { x: sx, y: sy } = CFG.startTile;

  let preGeneratedGrid = {};
  let reachableCoords = new Set();
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    preGeneratedGrid = {};

    // 1. Fill 10x10 grid with weighted random terrains
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        preGeneratedGrid[`${x},${y}`] = getRandomFromWeights(pool);
      }
    }

    // 2. Select a start tile terrain from pool that is traversable
    let st = 'grass';
    if (!CFG.nonTraversable.includes(preGeneratedGrid[`${sx},${sy}`])) {
      st = preGeneratedGrid[`${sx},${sy}`];
    } else {
      const traversables = Object.keys(pool).filter(t => !CFG.nonTraversable.includes(t));
      st = traversables.length > 0 ? traversables[Math.floor(Math.random() * traversables.length)] : 'grass';
    }
    preGeneratedGrid[`${sx},${sy}`] = st;

    // 3. Perform BFS from start tile (sx, sy) to find all reachable cells
    reachableCoords = new Set();
    const queue = [[sx, sy]];
    reachableCoords.add(`${sx},${sy}`);

    while (queue.length > 0) {
      const [cx, cy] = queue.shift();
      const neighbors = [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1]
      ];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10) {
          const nKey = `${nx},${ny}`;
          if (!reachableCoords.has(nKey)) {
            const terrain = preGeneratedGrid[nKey];
            if (!CFG.nonTraversable.includes(terrain)) {
              reachableCoords.add(nKey);
              queue.push([nx, ny]);
            }
          }
        }
      }
    }

    // We accept the layout if there is a reasonably large reachable area (at least 35 tiles)
  }

  // 3.5. pocket-connecting patch: Locate unreachable pockets and connect them by swapping skin non-traversable tiles
  for (let iter = 0; iter < 5; iter++) {
    // Recompute reachable coords
    reachableCoords = new Set();
    const queue = [[sx, sy]];
    reachableCoords.add(`${sx},${sy}`);
    while (queue.length > 0) {
      const [cx, cy] = queue.shift();
      const neighbors = [
        [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]
      ];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10) {
          const nKey = `${nx},${ny}`;
          if (!reachableCoords.has(nKey)) {
            const terrain = preGeneratedGrid[nKey];
            if (!CFG.nonTraversable.includes(terrain)) {
              reachableCoords.add(nKey);
              queue.push([nx, ny]);
            }
          }
        }
      }
    }

    // Find unreachable traversable tiles
    const unreachableTraversable = [];
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const key = `${x},${y}`;
        const terrain = preGeneratedGrid[key];
        if (!CFG.nonTraversable.includes(terrain) && !reachableCoords.has(key)) {
          unreachableTraversable.push(key);
        }
      }
    }

    // No unreachable pockets remaining
    if (unreachableTraversable.length === 0) {
      break;
    }

    let connectionFound = false;
    for (const uKey of unreachableTraversable) {
      const [ux, uy] = uKey.split(',').map(Number);
      const uNeighbors = [
        [ux + 1, uy], [ux - 1, uy], [ux, uy + 1], [ux, uy - 1]
      ];
      for (const [nx, ny] of uNeighbors) {
        if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10) {
          const nKey = `${nx},${ny}`;
          const nTerrain = preGeneratedGrid[nKey];
          // If neighbor is non-traversable, check if it borders the reachable area
          if (CFG.nonTraversable.includes(nTerrain)) {
            const nnNeighbors = [
              [nx + 1, ny], [nx - 1, ny], [nx, ny + 1], [nx, ny - 1]
            ];
            let bordersReachable = false;
            for (const [nnx, nny] of nnNeighbors) {
              if (nnx >= 0 && nnx < 10 && nny >= 0 && nny < 10) {
                const nnKey = `${nnx},${nny}`;
                if (reachableCoords.has(nnKey)) {
                  bordersReachable = true;
                  break;
                }
              }
            }

            if (bordersReachable) {
              // Swap this skin tile (nKey) with a safe traversable tile from reachableCoords
              let safeSwapKey = null;
              const reachableArray = Array.from(reachableCoords).filter(k => k !== `${sx},${sy}` && k !== nKey);
              shuffle(reachableArray);

              for (const candidateKey of reachableArray) {
                const testReachable = new Set();
                const testQueue = [[sx, sy]];
                testReachable.add(`${sx},${sy}`);
                while (testQueue.length > 0) {
                  const [tcx, tcy] = testQueue.shift();
                  const tcNeighbors = [
                    [tcx + 1, tcy], [tcx - 1, tcy], [tcx, tcy + 1], [tcx, tcy - 1]
                  ];
                  for (const [tnx, tny] of tcNeighbors) {
                    if (tnx >= 0 && tnx < 10 && tny >= 0 && tny < 10) {
                      const tnKey = `${tnx},${tny}`;
                      if (tnKey !== candidateKey && reachableCoords.has(tnKey) && !testReachable.has(tnKey)) {
                        testReachable.add(tnKey);
                        testQueue.push([tnx, tny]);
                      }
                    }
                  }
                }

                if (testReachable.size === reachableCoords.size - 1) {
                  safeSwapKey = candidateKey;
                  break;
                }
              }

              if (safeSwapKey) {
                const temp = preGeneratedGrid[nKey];
                preGeneratedGrid[nKey] = preGeneratedGrid[safeSwapKey];
                preGeneratedGrid[safeSwapKey] = temp;
                connectionFound = true;
                break;
              }
            }
          }
        }
      }
      if (connectionFound) break;
    }

    if (!connectionFound) {
      break;
    }
  }

  // Final recompute of reachableCoords to include the newly opened pockets
  reachableCoords = new Set();
  const finalQueue = [[sx, sy]];
  reachableCoords.add(`${sx},${sy}`);
  while (finalQueue.length > 0) {
    const [cx, cy] = finalQueue.shift();
    const neighbors = [
      [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]
    ];
    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10) {
        const nKey = `${nx},${ny}`;
        if (!reachableCoords.has(nKey)) {
          const terrain = preGeneratedGrid[nKey];
          if (!CFG.nonTraversable.includes(terrain)) {
            reachableCoords.add(nKey);
            finalQueue.push([nx, ny]);
          }
        }
      }
    }
  }

  // 4. Fill all unreachable cells with non-traversable terrain to eliminate pockets
  const defaultNonTraversable = CFG.nonTraversable[0] || 'mountain';
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const key = `${x},${y}`;
      if (!reachableCoords.has(key)) {
        preGeneratedGrid[key] = defaultNonTraversable;
      }
    }
  }

  // 5. Ensure at least one cave tile is reachable and in the grid if cave is a possible terrain
  if (pool.cave && pool.cave > 0) {
    let hasReachableCave = false;
    for (const key of reachableCoords) {
      if (preGeneratedGrid[key] === 'cave') {
        hasReachableCave = true;
        break;
      }
    }
    if (!hasReachableCave) {
      const keysArray = Array.from(reachableCoords).filter(k => k !== `${sx},${sy}`);
      if (keysArray.length > 0) {
        const randomKey = keysArray[Math.floor(Math.random() * keysArray.length)];
        preGeneratedGrid[randomKey] = 'cave';
      }
    }
  }

  // 6. Spawn exit entity if this is a sub-cave
  let startEntity = null;
  if (parentLocationId && parentCoords) {
    startEntity = {
      type: 'cave_entrance',
      targetLocationId: parentLocationId,
      targetCoords: parentCoords,
      isExit: true,
      visited: true
    };
  }

  // 7. Initialize grid state with center starting tile drawn from the grid
  const placedTiles = {};
  const startTerrain = preGeneratedGrid[`${sx},${sy}`];
  placedTiles[`${sx},${sy}`] = { terrainType: startTerrain, revealed: true, entity: startEntity };

  // 8. Build tileStack as the remaining unplaced coordinates (for the deck counter in UI)
  const deck = [];
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      if (x !== sx || y !== sy) {
        deck.push(`${x},${y}`);
      }
    }
  }

  const state = {
    isDiscovered: true,
    isCleared: false,
    placedTiles,
    preGeneratedGrid,
    preGeneratedEntities: {},
    tileStack: deck,
    hasCaveEntranceSpawned: false,
    isSubCave: (parentLocationId !== null),
    caveEntranceCount: 0
  };

  STATE.locations[locationId] = state;

  // 9. Pre-generate all entities on the rest of the traversable tiles
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      if (x === sx && y === sy) continue;
      const coordKey = `${x},${y}`;
      const terrain = preGeneratedGrid[coordKey];
      const isTraversable = !CFG.nonTraversable.includes(terrain);
      const isFirstCaveEntranceNeeded = terrain === 'cave' && !state.isSubCave && !state.hasCaveEntranceSpawned;

      let entity = null;
      if (isTraversable && (isFirstCaveEntranceNeeded || Math.random() < CFG.entitySpawnChance)) {
        entity = generateRandomEntity(locationId, terrain, x, y);
      }
      if (entity) {
        state.preGeneratedEntities[coordKey] = entity;
      }
    }
  }

  return state;
}

// Draw a tile and place it
export function discoverTile(locationId, x, y) {
  const locState = STATE.locations[locationId];
  if (!locState || !locState.preGeneratedGrid) return null;

  const coordKey = `${x},${y}`;
  const terrain = locState.preGeneratedGrid[coordKey];
  if (!terrain) return null;

  // Remove coordinate from unexplored stack
  const idx = locState.tileStack.indexOf(coordKey);
  if (idx !== -1) {
    locState.tileStack.splice(idx, 1);
  }

  // Get the pre-generated entity
  const entity = locState.preGeneratedEntities[coordKey] || null;

  locState.placedTiles[coordKey] = { terrainType: terrain, revealed: true, entity };
  return terrain;
}

// Generate random entity for location tile
function generateRandomEntity(locationId, terrain, x = null, y = null) {
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
    if (locState) {
      const isFirstTopLevelEntrance = !locState.isSubCave && !locState.hasCaveEntranceSpawned;
      if (isFirstTopLevelEntrance) {
        type = 'cave_entrance';
        locState.hasCaveEntranceSpawned = true;
        locState.caveEntranceCount = (locState.caveEntranceCount || 0) + 1;
      } else {
        const currentCount = locState.caveEntranceCount || 0;
        const rollChance = CFG.cavePortalBaseChance / Math.pow(CFG.cavePortalDecayFactor, currentCount);
        if (Math.random() < rollChance) {
          type = 'cave_entrance';
          locState.hasCaveEntranceSpawned = true;
          locState.caveEntranceCount = currentCount + 1;
        }
      }
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
    const targetId = (x !== null && y !== null) ? `${locationId}_sub_cave_${x}_${y}` : `${locationId}_sub_cave`;
    return { type: 'cave_entrance', targetLocationId: targetId };
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
