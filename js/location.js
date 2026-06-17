/* ==========================================================================
   LOCATION MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE } from './state.js';
import { LOCATION_CONFIG as CFG } from './config/location.js';
import { GODS_CONFIG } from './config/gods.js';
import { getActiveMap as getActiveWorldMap } from './world.js';

// Spawns/Initializes the Carcassonne stack for a location
export function generateLocationMap(locationId, worldTileTerrain, parentLocationId = null, parentCoords = null) {
  // Return existing state if already initialized, but update difficulty and undefeated enemy counts
  if (STATE.locations[locationId]) {
    const existingState = STATE.locations[locationId];

    const activeMap = getActiveWorldMap();
    const locMeta = Object.values(activeMap?.locations || {}).find(loc => loc.id === locationId) || {};
    const dangerLevel = locMeta.dangerLevel || 3;
    const difficulty = calculateDifficulty(locationId, dangerLevel);
    existingState.difficulty = difficulty;

    // Scale counts of undefeated enemy armies
    for (const key in existingState.placedTiles) {
      const tile = existingState.placedTiles[key];
      if (tile.entity && tile.entity.type === 'enemy_army' && !tile.entity.isDefeated) {
        updateEnemyArmyAmount(tile.entity, difficulty);
      }
    }
    for (const key in existingState.preGeneratedEntities) {
      const ent = existingState.preGeneratedEntities[key];
      if (ent && ent.type === 'enemy_army' && !ent.isDefeated) {
        updateEnemyArmyAmount(ent, difficulty);
      }
    }

    return existingState;
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

  const activeMap = getActiveWorldMap();
  const locMeta = Object.values(activeMap?.locations || {}).find(loc => loc.id === locationId) || {};
  const locationType = state.isSubCave ? 'cave' : (locMeta.locationType || worldTileTerrain || 'default');
  const raidType     = locMeta.raidType || null;

  // Calculate difficulty scaling
  const dangerLevel = locMeta.dangerLevel || 3;
  const difficulty = calculateDifficulty(locationId, dangerLevel);

  // Store in state for UI display
  state.locationType = locationType;
  state.raidType     = raidType;
  state.dangerLevel = dangerLevel;
  state.subCaveDepth = (locationId.match(/_sub_cave_/g) || []).length;
  state.difficulty = difficulty;

  // 8.5. If not a sub-cave, randomly choose a reachable cave tile to host the first cave entrance
  if (!state.isSubCave) {
    const caveCoords = Array.from(reachableCoords).filter(key => {
      const [x, y] = key.split(',').map(Number);
      if (x === sx && y === sy) return false;
      return preGeneratedGrid[key] === 'cave';
    });
    if (caveCoords.length > 0) {
      const chosenCaveKey = caveCoords[Math.floor(Math.random() * caveCoords.length)];
      const [cx, cy] = chosenCaveKey.split(',').map(Number);
      const entranceEntity = buildEntityOfType(locationId, 'cave_entrance', 'cave', cx, cy, locationType, raidType, difficulty, locationId.startsWith('raid_'));
      if (entranceEntity) {
        state.preGeneratedEntities[chosenCaveKey] = entranceEntity;
      }
    }
  }

  // 9. Pre-generate all entities on the rest of the traversable tiles
  //    using per-tile spawn tables (tileEntitySpawns) from config.
  const isRaid = locationId.startsWith('raid_');

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      if (x === sx && y === sy) continue;
      const coordKey = `${x},${y}`;

      // Skip if we already pre-placed the primary cave entrance here
      if (state.preGeneratedEntities[coordKey]) continue;

      const terrain = preGeneratedGrid[coordKey];
      if (CFG.nonTraversable.includes(terrain)) continue;

      // --- Primary tile roll (percentage-based, no spawnChance field) ---
      const tileTable = (CFG.tileEntitySpawns || {})[terrain];
      let entity = null;
      if (tileTable) {
        entity = buildEntityFromTileTable(locationId, terrain, x, y, tileTable, locationType, raidType, difficulty, isRaid);
      }

      if (entity) {
        state.preGeneratedEntities[coordKey] = entity;
        continue;
      }

      // --- Location-effect overlay roll (only on tiles with no entity yet) ---
      const activeEffectKeys = getLocationEffectKeys(locationId, locationType, isRaid);
      for (const effectKey of activeEffectKeys) {
        const effect = (CFG.locationEffects || {})[effectKey];
        if (!effect) continue;
        const tileOk = effect.applyToTiles === '*' || effect.applyToTiles.includes(terrain);
        if (!tileOk) continue;
        if (Math.random() * 100 < effect.spawnChance) {
          entity = buildEntityOfType(locationId, effect.entity, terrain, x, y, locationType, raidType, difficulty, isRaid);
          if (entity) {
            state.preGeneratedEntities[coordKey] = entity;
            break;
          }
        }
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

// ---------------------------------------------------------------------------
// Build an entity using a tile's entity spawn table (percentage-based roll).
// Entity values in tileTable.entities are direct spawn % (0–100).
// We sum them; roll [0, 100). If roll < total → weighted pick; else no spawn.
// ---------------------------------------------------------------------------
function buildEntityFromTileTable(locationId, terrain, x, y, tileTable, locationType, raidType, difficulty, isRaid) {
  const entities = tileTable.entities || {};
  const entries = Object.entries(entities);
  if (entries.length === 0) return null;

  // Sum of all entity percentages = total spawn probability out of 100
  const totalChance = entries.reduce((sum, [, v]) => sum + v, 0);
  const roll = Math.random() * 100;
  if (roll >= totalChance) return null; // no entity this tile

  // Weighted pick within the spawning band
  let type = null;
  let cursor = 0;
  const pickRoll = Math.random() * totalChance;
  for (const [key, weight] of entries) {
    cursor += weight;
    if (pickRoll < cursor) { type = key; break; }
  }
  if (!type) type = entries[entries.length - 1][0];

  // burial_mound only on raid_ locations
  if (type === 'burial_mound' && !isRaid) type = 'treasure';

  // sheep_source restricted to grass tiles
  if (type === 'sheep_source' && terrain !== 'grass') type = 'treasure';

  // Resolve monster pool: prefer tile-specific, fall back to biome pool
  const resolvedPool = tileTable.monsterPool || null;
  return buildEntityOfType(locationId, type, terrain, x, y, locationType, raidType, difficulty, isRaid, resolvedPool);
}

// ---------------------------------------------------------------------------
// Build an entity object for a given type string.
// resolvedPool overrides the biome-level monster pool when provided.
// ---------------------------------------------------------------------------
function buildEntityOfType(locationId, type, terrain, x, y, locationType, raidType, difficulty, isRaid, resolvedPool = null) {
  // Cave entrance override: if terrain is 'cave', check portal logic first
  if (terrain === 'cave') {
    const locState = STATE.locations[locationId];
    if (locState) {
      const isFirstTopLevelEntrance = !locState.isSubCave && !locState.hasCaveEntranceSpawned;
      if (isFirstTopLevelEntrance) {
        locState.hasCaveEntranceSpawned = true;
        locState.caveEntranceCount = (locState.caveEntranceCount || 0) + 1;
        const targetId = (x !== null && y !== null)
          ? `${locationId}_sub_cave_${x}_${y}`
          : `${locationId}_sub_cave`;
        return { type: 'cave_entrance', targetLocationId: targetId };
      } else {
        const currentCount = locState.caveEntranceCount || 0;
        const rollChance = CFG.cavePortalBaseChance / Math.pow(CFG.cavePortalDecayFactor, currentCount);
        if (Math.random() < rollChance) {
          locState.hasCaveEntranceSpawned = true;
          locState.caveEntranceCount = currentCount + 1;
          const targetId = (x !== null && y !== null)
            ? `${locationId}_sub_cave_${x}_${y}`
            : `${locationId}_sub_cave`;
          return { type: 'cave_entrance', targetLocationId: targetId };
        }
        // Cave tile that didn't roll a portal — fall through to normal entity
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

  if (type === 'wood_source') {
    const ws = CFG.woodSource || { woodMin: 3, woodMax: 7 };
    return {
      type: 'wood_source',
      wood: Math.floor(Math.random() * (ws.woodMax - ws.woodMin + 1)) + ws.woodMin,
      isLooted: false
    };
  }

  if (type === 'ore_deposit') {
    const od = CFG.oreDeposit || { goldMin: 5, goldMax: 12 };
    return {
      type: 'ore_deposit',
      gold: Math.floor(Math.random() * (od.goldMax - od.goldMin + 1)) + od.goldMin,
      isLooted: false
    };
  }

  if (type === 'sheep_source') {
    const ss = CFG.sheepSource || { sheepMin: 1, sheepMax: 1 };
    return {
      type: 'sheep_source',
      sheep: Math.floor(Math.random() * (ss.sheepMax - ss.sheepMin + 1)) + ss.sheepMin,
      isLooted: false
    };
  }

  if (type === 'fishing_spot') {
    const fs = CFG.fishingSpot || { foodMin: 4, foodMax: 8 };
    return {
      type: 'fishing_spot',
      food: Math.floor(Math.random() * (fs.foodMax - fs.foodMin + 1)) + fs.foodMin,
      isLooted: false
    };
  }

  if (type === 'berry_bush') {
    const bb = CFG.berryBush || { foodMin: 3, foodMax: 6 };
    return {
      type: 'berry_bush',
      food: Math.floor(Math.random() * (bb.foodMax - bb.foodMin + 1)) + bb.foodMin,
      isLooted: false
    };
  }

  if (type === 'enemy_army') {
    const e = CFG.enemyArmy;
    const pools = CFG.monsterPoolsByBiome || {};
    let pool;
    if (locationType && locationType !== 'default' && pools[locationType]) {
      pool = [...pools[locationType]];
    } else if (resolvedPool) {
      pool = [...resolvedPool];
    } else {
      pool = [...(pools.default || e.monsterPool)];
    }

    // ---------------------------------------------------------------------------
    // Apply map-specific monster pool overrides (four tiers, lowest priority first).
    // Priority (highest → lowest): byLocationId > byRaidType > byBiomeType > global
    // `prevent` is collected across all tiers and applied as a final hard-block.
    // ---------------------------------------------------------------------------
    function applyOverrideTier(pool, tier, preventSet) {
      if (!tier) return pool;
      if (tier.prevent?.length) tier.prevent.forEach(m => preventSet.add(m));
      if (tier.remove?.length)  pool = pool.filter(m => !tier.remove.includes(m));
      if (tier.add?.length) {
        tier.add.forEach(m => preventSet.delete(m));
        pool = [...pool, ...tier.add];
      }
      return pool;
    }

    function applyMapPoolOverrides(pool, overrides, biomeType, raidType, locationId) {
      if (!overrides) return pool;
      const preventSet = new Set();
      pool = applyOverrideTier(pool, overrides.global,                      preventSet); // lowest priority
      pool = applyOverrideTier(pool, overrides.byBiomeType?.[biomeType],    preventSet);
      pool = applyOverrideTier(pool, overrides.byRaidType?.[raidType],      preventSet); // higher than biome
      pool = applyOverrideTier(pool, overrides.byLocationId?.[locationId],  preventSet); // highest priority
      if (preventSet.size) pool = pool.filter(m => !preventSet.has(m));     // final hard-block
      return pool;
    }

    const activeMap = getActiveWorldMap();
    pool = applyMapPoolOverrides(pool, activeMap?.monsterPoolOverrides, locationType, raidType, locationId);

    const ds = CFG.difficultyScaling || {};
    if (difficulty >= (ds.bossThreshold || 1.40)) {
      const bosses = ds.bosses || ['Frost Giant (Jotunn)', 'Lindwurm'];
      pool = pool.concat(bosses);
    }

    const selectedMonster = pool[Math.floor(Math.random() * pool.length)];
    let countMin = Math.floor(e.countMin * difficulty);
    let countMax = Math.floor(e.countMax * difficulty);
    const maxLimit = ds.maxCountLimit || 6;
    countMin = Math.min(maxLimit, Math.max(1, countMin));
    countMax = Math.min(maxLimit, Math.max(countMin, countMax));
    let count = Math.floor(Math.random() * (countMax - countMin + 1)) + countMin;
    // Return enemy army entity config

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
    const keys = Object.keys(GODS_CONFIG.magicObjects);
    const godKey = keys[Math.floor(Math.random() * keys.length)];
    return {
      type: 'dolmen',
      magicObjectId: GODS_CONFIG.magicObjects[godKey],
      godName: godKey,
      isVisited: false
    };
  }

  if (type === 'cave_entrance') {
    const targetId = (x !== null && y !== null)
      ? `${locationId}_sub_cave_${x}_${y}`
      : `${locationId}_sub_cave`;
    return { type: 'cave_entrance', targetLocationId: targetId };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Return the list of active locationEffect keys for this location.
// Merges locationBiomeEffects (by locationType) with raidLocationEffects
// (both the 'all' entry and any entry matching this specific locationId).
// ---------------------------------------------------------------------------
function getLocationEffectKeys(locationId, locationType, isRaid) {
  // 1. Biome-based effects
  const biomeMap = CFG.locationBiomeEffects || {};
  const keys = [...(biomeMap[locationType] || biomeMap.default || [])];

  // 2. Raid-based effects (all raids + location-specific)
  if (isRaid) {
    const raidMap = CFG.raidLocationEffects || {};
    const toAdd = [
      ...(raidMap.all || []),
      ...(raidMap[locationId] || [])
    ];
    for (const k of toAdd) {
      if (!keys.includes(k)) keys.push(k);
    }
  }

  return keys;
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

// Pick a random key from { key: weight } — same logic as getRandomFromWeights
// but returns null for empty objects.
function weightedRandom(weightsObj) {
  const entries = Object.entries(weightsObj);
  if (entries.length === 0) return null;
  const totalWeight = entries.reduce((sum, [_, w]) => sum + w, 0);
  if (totalWeight <= 0) return null;
  let roll = Math.random() * totalWeight;
  for (const [key, w] of entries) {
    if (roll < w) return key;
    roll -= w;
  }
  return entries[entries.length - 1][0];
}

// Re-scale the monster counts of an existing undefeated enemy army without changing classes
function updateEnemyArmyAmount(entity, difficultyMultiplier) {
  const e = CFG.enemyArmy;
  const ds = CFG.difficultyScaling || {};
  if (!entity.monsters) return;
  for (const monster of entity.monsters) {
    let countMin = Math.floor(e.countMin * difficultyMultiplier);
    let countMax = Math.floor(e.countMax * difficultyMultiplier);
    const maxLimit = ds.maxCountLimit || 6;
    countMin = Math.min(maxLimit, Math.max(1, countMin));
    countMax = Math.min(maxLimit, Math.max(countMin, countMax));

    monster.count = Math.floor(Math.random() * (countMax - countMin + 1)) + countMin;
  }
}

// Compute location difficulty incorporating danger level, cave depth, and time scaling
function calculateDifficulty(locationId, dangerLevel) {
  const ds = CFG.difficultyScaling || { dangerMultipliers: [0.8, 0.9, 1.0, 1.1, 1.2], caveDepthFactor: 0.35, timeFactor: 0.02, maxTimeFactorCap: 2.5 };
  const baseMulti = ds.dangerMultipliers[dangerLevel - 1] || 1.0;
  const subCaveDepth = (locationId.match(/_sub_cave_/g) || []).length;
  const dayValue = STATE.day || 1;
  const maxCap = ds.maxTimeFactorCap !== undefined ? ds.maxTimeFactorCap : 2.5;
  return baseMulti + (subCaveDepth * ds.caveDepthFactor) + Math.min(maxCap, dayValue * ds.timeFactor);
}
