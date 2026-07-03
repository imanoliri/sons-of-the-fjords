/* ==========================================================================
   COMBAT SPAWNER MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE, notify, adjustResource, recordMonsterKill, recordSoldierKill, updateSoldierStat, markSoldierDead } from './state.js';
import { COMBAT_CONFIG as CFG } from './config/combat.js';
import { GODS_CONFIG as GC } from './config/gods.js';
import { sortPoolByPoints, checkAndAutoDeploy } from './combat_deployment.js';

function getMonsterStats(mClass) {
  return CFG.monsters[mClass] || CFG.monsterFallback;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function spawnMonsterGroup(group, groupIndex) {
  const grid = STATE.combat.grid;
  const enemyRef = group.enemyRef || null;
  const startLanes = Array.from({ length: CFG.gridRows }, (_, i) => i);
  shuffleArray(startLanes);

  let spawnIndex = 0;
  let charmedMonsterData = null;

  const activeBlessings = new Set();
  if (STATE.activeBlessing) activeBlessings.add(STATE.activeBlessing);
  if (STATE.permanentlyActivatedBlessings) {
    STATE.permanentlyActivatedBlessings.forEach(b => activeBlessings.add(b));
  }
  const hasLokiBlessing = activeBlessings.has('loki');
  const lokiBlessing = GC.modifiers.blessings.loki;
  const lokiM3 = GC.modifiers.milestones.loki.find(m => m.index === 2);

  for (const m of group) {
    for (let i = 0; i < m.count; i++) {
      const spawnedCount = STATE.combat.spawnedCount;
      const isCharmed = spawnedCount === STATE.combat.charmedIndex;
      const isConfused = !isCharmed && spawnedCount === STATE.combat.confusedIndex;
      const stats = getMonsterStats(m.monsterClass);

      if (isCharmed) {
        charmedMonsterData = {
          mClass: m.monsterClass,
          stats: stats,
          spawnedCount: spawnedCount
        };
        STATE.combat.spawnedCount++;
        continue;
      }

      const lane = startLanes[spawnIndex % CFG.gridRows];
      spawnIndex++;

      let spawnRow = lane;
      let spawnCol = CFG.gridCols - 1;
      if (grid[spawnRow][CFG.gridCols - 1]) {
        spawnCol = CFG.gridCols - 2;
      }

      if (grid[spawnRow][spawnCol]) {
        let found = false;
        for (let c = CFG.gridCols - 1; c >= 0; c--) {
          if (!grid[spawnRow][c]) {
            spawnCol = c;
            found = true;
            break;
          }
        }
        if (!found) {
          let bestDist = Infinity;
          for (let r = 0; r < CFG.gridRows; r++) {
            for (let c = CFG.gridCols - 1; c >= 0; c--) {
              if (!grid[r][c]) {
                const dist = Math.abs(r - lane);
                if (dist < bestDist) {
                  bestDist = dist;
                  spawnRow = r;
                  spawnCol = c;
                  found = true;
                }
              }
            }
          }
        }

        if (!found) {
          console.warn(`Could not spawn monster ${m.monsterClass}: grid is completely full.`);
          continue;
        }
      }

      if (isConfused) {
        notify('COMBAT_EFFECT_TRIGGER', { effect: 'loki_confuse', unit: { name: m.monsterClass } });
      }

      const mUnit = {
        id: Date.now() + "_" + spawnedCount + "_" + Math.floor(Math.random() * 1000),
        name: m.monsterClass + (isConfused ? ' 😵' : ''),
        type: m.monsterClass,
        hp: stats.hp,
        maxHp: stats.hp,
        dmg: stats.dmg,
        speed: stats.speed,
        range: stats.range,
        alliance: isConfused ? 'player' : 'enemy',
        isCharmed: false,
        charmedTicksLeft: 0,
        isConfused: isConfused,
        confusedTicksLeft: isConfused ? (lokiM3?.confuseDurationTicks ?? 2) : 0,
        row: spawnRow,
        col: spawnCol,
        enemyRef: enemyRef,
        abilityCooldowns: {}
      };
      if (stats.abilities) {
        stats.abilities.forEach(ab => {
          if (ab.type !== 'freeze_aura') {
            mUnit.abilityCooldowns[ab.type] = 0;
          }
        });
      }
      
      STATE.combat.waveMonsters.push(mUnit);
      grid[spawnRow][spawnCol] = mUnit;
      STATE.combat.spawnedCount++;
      notify('COMBAT_SPAWN', mUnit);
    }
  }

  if (charmedMonsterData) {
    notify('COMBAT_EFFECT_TRIGGER', { effect: 'loki_charm', unit: { name: charmedMonsterData.mClass } });

    const enemies = STATE.combat.waveMonsters.filter(m => m.alliance === 'enemy');
    let targetEnemy = null;
    if (enemies.length > 0) {
      targetEnemy = enemies[Math.floor(Math.random() * enemies.length)];
    }

    let spawnLane = startLanes[spawnIndex % CFG.gridRows];
    spawnIndex++;
    let spawnCol = CFG.gridCols - 2;
    let found = false;

    if (targetEnemy) {
      spawnLane = targetEnemy.row;
      let checkCol = targetEnemy.col - 1;
      for (let c = checkCol; c >= 0; c--) {
        if (!grid[spawnLane][c]) {
          spawnCol = c;
          found = true;
          break;
        }
      }
      if (!found) {
        for (let c = targetEnemy.col + 1; c < CFG.gridCols; c++) {
          if (!grid[spawnLane][c]) {
            spawnCol = c;
            found = true;
            break;
          }
        }
      }
    } else {
      for (let c = CFG.gridCols - 2; c >= 0; c--) {
        if (!grid[spawnLane][c]) {
          spawnCol = c;
          found = true;
          break;
        }
      }
    }

    if (!found || grid[spawnLane][spawnCol]) {
      found = false;
      let bestDist = Infinity;
      for (let r = 0; r < CFG.gridRows; r++) {
        for (let c = CFG.gridCols - 1; c >= 0; c--) {
          if (!grid[r][c]) {
            const dist = Math.abs(r - spawnLane);
            if (dist < bestDist) {
              bestDist = dist;
              spawnLane = r;
              spawnCol = c;
              found = true;
            }
          }
        }
      }
    }

    if (found) {
      const mUnit = {
        id: Date.now() + "_" + charmedMonsterData.spawnedCount + "_" + Math.floor(Math.random() * 1000),
        name: charmedMonsterData.mClass + ' 🌀',
        type: charmedMonsterData.mClass,
        hp: charmedMonsterData.stats.hp,
        maxHp: charmedMonsterData.stats.hp,
        dmg: charmedMonsterData.stats.dmg,
        speed: charmedMonsterData.stats.speed,
        range: charmedMonsterData.stats.range,
        alliance: 'player',
        isCharmed: true,
        charmedTicksLeft: lokiBlessing?.charmDurationTicks ?? 2,
        isConfused: false,
        confusedTicksLeft: 0,
        row: spawnLane,
        col: spawnCol,
        abilityCooldowns: {}
      };
      if (charmedMonsterData.stats.abilities) {
        charmedMonsterData.stats.abilities.forEach(ab => {
          if (ab.type !== 'freeze_aura') {
            mUnit.abilityCooldowns[ab.type] = 0;
          }
        });
      }
      STATE.combat.waveMonsters.push(mUnit);
      grid[spawnLane][spawnCol] = mUnit;
      notify('COMBAT_SPAWN', mUnit);
    } else {
      console.warn(`Could not spawn charmed monster ${charmedMonsterData.mClass}: grid is completely full.`);
    }
  }
}

export function checkGroupDefeated(unit) {
  if (STATE.combat.isWarHornBattle && unit.enemyRef) {
    const remainingEnemiesOfGroup = STATE.combat.waveMonsters.some(
      m => m.enemyRef === unit.enemyRef && m.hp > 0 && m.alliance === 'enemy'
    );
    if (!remainingEnemiesOfGroup) {
      unit.enemyRef.isDefeated = true;
      const locId = STATE.combat.locationId;
      const locState = STATE.locations[locId];
      if (locState) {
        let matchedCoordKey = null;
        for (const [coordKey, tile] of Object.entries(locState.placedTiles)) {
          if (tile.entity === unit.enemyRef) {
            matchedCoordKey = coordKey;
            break;
          }
        }
        if (!matchedCoordKey) {
          for (const [coordKey, entity] of Object.entries(locState.preGeneratedEntities)) {
            if (entity === unit.enemyRef) {
              matchedCoordKey = coordKey;
              break;
            }
          }
        }
        if (matchedCoordKey) {
          if (locState.placedTiles[matchedCoordKey] && locState.placedTiles[matchedCoordKey].entity) {
            locState.placedTiles[matchedCoordKey].entity.isDefeated = true;
          }
          if (locState.preGeneratedEntities[matchedCoordKey]) {
            locState.preGeneratedEntities[matchedCoordKey].isDefeated = true;
          }
        }
      }
      import('./location.js').then(({ checkRaidCleared }) => {
        checkRaidCleared(locId);
      });
    }
  }
}

export function removeUnitFromRegistry(unit) {
  if (unit.alliance === 'player' && !unit.isCharmed && !unit.isUndead && !unit.isConfused) {
    const killerName = unit._lastAttackerName || 'Unknown enemy';
    markSoldierDead(unit.id, `Slain by ${killerName} in combat`);
    const idx = STATE.band.findIndex(u => u.id === unit.id);
    if (idx !== -1) STATE.band.splice(idx, 1);
  } else {
    const idx = STATE.combat.waveMonsters.findIndex(m => m.id === unit.id);
    if (idx !== -1) {
      STATE.combat.waveMonsters.splice(idx, 1);
      checkGroupDefeated(unit);
    }
  }
}

export function handleUnitReachEnd(unit) {
  if (unit.alliance === 'player') {
    if (unit.isCharmed || unit.isConfused) {
      const idx = STATE.combat.waveMonsters.findIndex(m => m.id === unit.id);
      if (idx !== -1) STATE.combat.waveMonsters.splice(idx, 1);
      notify('COMBAT_UPDATE');
      return;
    }
    if (unit.isUndead) {
      const idx = STATE.combat.waveMonsters.findIndex(m => m.id === unit.id);
      if (idx !== -1) STATE.combat.waveMonsters.splice(idx, 1);
      notify('COMBAT_UPDATE');
      return;
    }
    const reward = CFG.playerCrossReward;
    Object.entries(reward).forEach(([res, amt]) => adjustResource(res, amt));
    updateSoldierStat(unit.id, 'timesReachedEnd', 1);
    const poolUnit = { ...unit, hp: unit.maxHp, row: undefined, col: undefined };
    STATE.combat.pool.push(poolUnit);
    sortPoolByPoints();
    notify('COMBAT_SUCCESS_REPLACE', unit);
  } else {
    const resTypes = ['gold', 'food', 'wood', 'sheep'];
    const rType = resTypes[Math.floor(Math.random() * resTypes.length)];
    adjustResource(rType, -CFG.enemyBreachDrain);
    notify('COMBAT_BREACH', { unit, stolen: rType });

    const sizeR = CFG.gridRows;
    const sizeC = CFG.gridCols;
    const grid = STATE.combat.grid;

    const startLanes = Array.from({ length: sizeR }, (_, i) => i);
    startLanes.sort(() => Math.random() - 0.5);

    let relocated = false;
    for (const lane of startLanes) {
      if (!grid[lane][sizeC - 1]) {
        unit.row = lane;
        unit.col = sizeC - 1;
        grid[lane][sizeC - 1] = unit;
        relocated = true;
        break;
      }
    }

    if (!relocated) {
      const idx = STATE.combat.waveMonsters.findIndex(m => m.id === unit.id);
      if (idx !== -1) {
        STATE.combat.waveMonsters.splice(idx, 1);
        checkGroupDefeated(unit);
      }
    }
  }
}
