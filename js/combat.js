/* ==========================================================================
   COMBAT MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE, notify, adjustResource, recordMonsterKill, getEffectiveStats, updateSoldierStat, recordSoldierKill, recordSoldierRuneCast, markSoldierDead, addSoldierEvent } from './state.js';
import { COMBAT_CONFIG as CFG } from './config/combat.js';
import { SOLDIERS_CONFIG } from './config/soldiers.js';
import { GODS_CONFIG as GC } from './config/gods.js';

let combatTimer = null;

export function sortPoolByPoints() {
  let order = [...(STATE.combat.formationOrder || ['shieldmaiden', 'huntsman', 'berserker', 'huskarl', 'runecaster'])];
  const requiredTypes = ['berserker', 'shieldmaiden', 'huntsman', 'huskarl', 'runecaster'];
  let modified = false;
  requiredTypes.forEach(t => {
    if (!order.includes(t)) {
      order.push(t);
      modified = true;
    }
  });
  if (modified) {
    STATE.combat.formationOrder = order;
  }
  STATE.combat.pool.sort((a, b) => {
    const idxA = order.indexOf(a.type);
    const idxB = order.indexOf(b.type);
    const ptsA = idxA !== -1 ? (order.length - idxA) : 1;
    const ptsB = idxB !== -1 ? (order.length - idxB) : 1;
    
    const pA = ptsA * (a.hp / a.maxHp);
    const pB = ptsB * (b.hp / b.maxHp);
    return pB - pA;
  });
}

// Initialize combat map grid & pool
function spawnMonsterGroup(group, groupIndex) {
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
        // 1. Try to find a free cell in the same lane, searching from right to left
        for (let c = CFG.gridCols - 1; c >= 0; c--) {
          if (!grid[spawnRow][c]) {
            spawnCol = c;
            found = true;
            break;
          }
        }
        // 2. If the lane is full, search other lanes from right to left, preferring lanes closer to the target lane
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

        // 3. If the entire board is full, we must skip spawning this unit to avoid bricking the game
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
        enemyRef: enemyRef
      };
      
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

    // Safety fallback: if target position is still occupied or we didn't find any place in target lane
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
        col: spawnCol
      };
      STATE.combat.waveMonsters.push(mUnit);
      grid[spawnLane][spawnCol] = mUnit;
      notify('COMBAT_SPAWN', mUnit);
    } else {
      console.warn(`Could not spawn charmed monster ${charmedMonsterData.mClass}: grid is completely full.`);
    }
  }
}

// Initialize combat map grid & pool
export function startCombat(locationId, coordKey, enemyData) {
  if (combatTimer) {
    clearInterval(combatTimer);
    combatTimer = null;
  }
  STATE.combat.active = true;
  STATE.combat.paused = true;
  STATE.combat.locationId = locationId;
  STATE.combat.entityCoordKey = coordKey;
  STATE.combat.fleeMode = false;
  STATE.combat.stance = 'attack';
  STATE.combat.deployHistory = [];
  STATE.combat.activeDoTs = [];
  
  if (coordKey !== 'war_horn') {
    STATE.combat.isWarHornBattle = false;
  }

  // 1. Initialize grid
  const grid = [];
  for (let r = 0; r < CFG.gridRows; r++) {
    const row = [];
    for (let c = 0; c < CFG.gridCols; c++) row.push(null);
    grid.push(row);
  }
  STATE.combat.grid = grid;

  // 2. Clone active band into deployment pool
  STATE.combat.pool = STATE.band.map(u => ({ ...u, maxHp: u.maxHp, hp: u.hp, currentHp: u.hp, alliance: 'player', selected: false }));
  sortPoolByPoints();

  // Track combat participation in Hall of Fame
  STATE.combat.pool.forEach(u => {
    updateSoldierStat(u.id, 'combatsParticipated', 1);
    addSoldierEvent(u.id, 'Entered combat');
  });

  // Initialize group queues
  const groups = enemyData.monsterGroups || [enemyData.monsters];
  STATE.combat.pendingSpawnGroups = [...groups];
  STATE.combat.spawnedCount = 0;
  STATE.combat.waveMonsters = [];

  // Determine Loki favor effects for all monsters in the campaign/fight
  let totalMonstersCount = 0;
  for (const group of groups) {
    totalMonstersCount += group.reduce((sum, m) => sum + m.count, 0);
  }

  const activeBlessings = new Set();
  if (STATE.activeBlessing) activeBlessings.add(STATE.activeBlessing);
  if (STATE.permanentlyActivatedBlessings) {
    STATE.permanentlyActivatedBlessings.forEach(b => activeBlessings.add(b));
  }
  const hasLokiBlessing = activeBlessings.has('loki');

  let confusedIndex = -1;
  const lokiM3 = GC.modifiers.milestones.loki.find(m => m.index === 2);
  const confuseChance = lokiM3?.confuseChance ?? 0.25;
  if (STATE.godQuests.loki?.[2] && Math.random() < confuseChance) {
    if (totalMonstersCount > 0) {
      confusedIndex = Math.floor(Math.random() * totalMonstersCount);
    }
  }

  let charmedIndex = -1;
  const lokiBlessing = GC.modifiers.blessings.loki;
  const charmChance = lokiBlessing?.charmChance ?? 0.25;
  if (hasLokiBlessing && Math.random() < charmChance) {
    if (totalMonstersCount > 0) {
      charmedIndex = Math.floor(Math.random() * totalMonstersCount);
    }
  }

  STATE.combat.confusedIndex = confusedIndex;
  STATE.combat.charmedIndex = charmedIndex;

  // Spawn the first group immediately
  if (STATE.combat.pendingSpawnGroups.length > 0) {
    const firstGroup = STATE.combat.pendingSpawnGroups.shift();
    spawnMonsterGroup(firstGroup, 0);
  }

  checkAndAutoDeploy();
  notify('COMBAT_START');
  combatTimer = setInterval(combatTick, STATE.combat.combatIntervalMs || CFG.tickIntervalMs);
}

export function adjustCombatSpeed(newSpeedMs) {
  STATE.combat.combatIntervalMs = newSpeedMs;
  if (STATE.combat.active && combatTimer) {
    clearInterval(combatTimer);
    combatTimer = setInterval(combatTick, newSpeedMs);
  }
}

function combatTick() {
  if (STATE.combat.paused || !STATE.combat.active) return;
  STATE.combat.plansDefinedThisTick = {};
  STATE.combat.selectedPlans = [];

  // Spawn next enemy group if any are pending
  if (STATE.combat.pendingSpawnGroups && STATE.combat.pendingSpawnGroups.length > 0) {
    const nextGroup = STATE.combat.pendingSpawnGroups.shift();
    const groupIdx = STATE.combat.pendingSpawnGroups.length;
    spawnMonsterGroup(nextGroup, groupIdx);
  }

  const grid = STATE.combat.grid;
  const gridSnapshot = grid.map(row => [...row]);
  const sizeR = CFG.gridRows;
  const sizeC = CFG.gridCols;

  // Reset per-tick rune targeting set (radius-overlap prevention)
  const runeTargetedCells = new Set();

  // Process active Odin Rune Damage-over-Time ticks
  if (!STATE.combat.activeDoTs) STATE.combat.activeDoTs = [];
  STATE.combat.activeDoTs = STATE.combat.activeDoTs.filter(dot => {
    dot.ticksLeft--;
    const target = dot.unit;
    if (target && target.hp > 0) {
      const dmgDealt = Math.min(target.hp, dot.dmgPerTick);
      target.hp = Math.max(0, target.hp - dot.dmgPerTick);
      if (dot.attackerId) {
        updateSoldierStat(dot.attackerId, 'runeDamageDealt', dmgDealt);
        updateSoldierStat(dot.attackerId, 'damageDealt', dmgDealt);
      }
      notify('COMBAT_DAMAGE', { attacker: { name: 'Odin Rune' }, defender: target });
      if (target.hp <= 0) {
        if (grid[target.row] && grid[target.row][target.col] === target) {
          grid[target.row][target.col] = null;
          removeUnitFromRegistry(target);
          if (target.alliance === 'enemy') recordMonsterKill(target.type);
          if (dot.attackerId) {
            recordSoldierKill(dot.attackerId, target.type);
            updateSoldierStat(dot.attackerId, 'runeKills', 1);
          }
          notify('COMBAT_DEATH', target);
        }
      }
    }
    return dot.ticksLeft > 0 && target && target.hp > 0;
  });

  const boardUnits = [];
  for (let r = 0; r < sizeR; r++)
    for (let c = 0; c < sizeC; c++)
      if (grid[r][c]) boardUnits.push(grid[r][c]);

  for (const unit of boardUnits) {
    if (unit.hp <= 0) continue;

    // Process stunned units — skip their action this tick
    if (unit.stunnedTicksLeft > 0) {
      unit.stunnedTicksLeft--;
      continue;
    }

    // Freya Milestone 2: Any unit below 25% HP heals 1 HP/tick
    if (unit.alliance === 'player' && STATE.godQuests.freya?.[1]) {
      const effStats = getEffectiveStats(unit);
      const m2Config = GC.modifiers.milestones.freya.find(m => m.index === 1);
      const healThreshold = m2Config?.healThreshold ?? 0.25;
      const healAmount = m2Config?.healAmount ?? 1;
      if (unit.hp < effStats.maxHp.total * healThreshold) {
        unit.hp = Math.min(effStats.maxHp.total, unit.hp + healAmount);
        updateSoldierStat(unit.id, 'damageHealed', healAmount);
        notify('COMBAT_EFFECT_TRIGGER', { effect: 'unit_heal', unit: unit, amount: healAmount });
      }
    }

    // Freya Champion Blessing: Shieldmaidens heal 2 HP per tick when not in melee
    if (unit.alliance === 'player' && unit.type === 'shieldmaiden') {
      const isFreyaActive = STATE.activeBlessing === 'freya' || (STATE.permanentlyActivatedBlessings && STATE.permanentlyActivatedBlessings.includes('freya'));
      if (isFreyaActive) {
        const currentTarget = findTargetInLane(unit, gridSnapshot);
        // "not in melee": target is null or distance to target is greater than 1
        const inMelee = currentTarget && Math.abs(currentTarget.col - unit.col) <= 1;
        if (!inMelee) {
          const effStats = getEffectiveStats(unit);
          if (unit.hp < effStats.maxHp.total) {
            const healAmount = GC.modifiers.blessings.freya?.healAmount ?? 2;
            unit.hp = Math.min(effStats.maxHp.total, unit.hp + healAmount);
            updateSoldierStat(unit.id, 'damageHealed', healAmount);
            notify('COMBAT_EFFECT_TRIGGER', { effect: 'unit_heal', unit: unit, amount: healAmount });
          }
        }
      }
    }

    if (unit.isUndead) {
      unit.undeadTicksLeft--;
      if (unit.undeadTicksLeft <= 0) {
        grid[unit.row][unit.col] = null;
        notify('COMBAT_DEATH', unit);
        continue;
      }
    }

    // Loki Milestone 3 Confusion Tick
    if (unit.isConfused) {
      unit.confusedTicksLeft--;
      if (unit.confusedTicksLeft <= 0) {
        unit.isConfused = false;
        unit.alliance = 'enemy';
        unit.name = unit.type;
        notify('COMBAT_UPDATE');
      }
    }

    // Loki Champion Blessing: Charm Tick Countdown
    if (unit.isCharmed) {
      unit.charmedTicksLeft--;
      if (unit.charmedTicksLeft <= 0) {
        unit.isCharmed = false;
        unit.alliance = 'enemy';
        unit.name = unit.type;
        notify('COMBAT_EFFECT_TRIGGER', { effect: 'loki_charm_wearoff', unit: unit });
        notify('COMBAT_UPDATE');
      }
    }

    const target = unit.isFleeing ? null : findTargetInLane(unit, gridSnapshot);

    // ---- RUNECASTER: Divine Rune AI ----
    if (unit.type === 'runecaster' && unit.alliance === 'player' && !unit.isFleeing) {
      if (!unit.runeCooldowns) unit.runeCooldowns = {};
      for (const g of Object.keys(unit.runeCooldowns)) {
        if (unit.runeCooldowns[g] > 0) {
          unit.runeCooldowns[g]--;
        }
      }

      // Gather available runes (god milestone 5 unlocked + not on cooldown)
      const godNames = ['odin', 'thor', 'hel', 'loki', 'freya'];
      const availableRunes = godNames.filter(g =>
        STATE.godQuests[g]?.[4] === true && (!unit.runeCooldowns[g] || unit.runeCooldowns[g] <= 0)
      );

      let bestRune = null;
      let bestScore = 0;

      // Helper: get all cells in radius 1 (Manhattan)
      const getRadius1Cells = (row, col) => {
        const cells = [];
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const nr = row + dr, nc = col + dc;
            if (nr >= 0 && nr < sizeR && nc >= 0 && nc < sizeC) cells.push({ r: nr, c: nc });
          }
        return cells;
      };

      // Helper: cell key for rune targeting set
      const cellKey = (r, c) => `${r},${c}`;

      // All enemies on board
      const allEnemies = [];
      for (let r = 0; r < sizeR; r++)
        for (let c = 0; c < sizeC; c++) {
          const cell = grid[r][c];
          if (cell && cell.alliance === 'enemy' && cell.hp > 0) allEnemies.push(cell);
        }

      // All player allies on board
      const allAllies = [];
      for (let r = 0; r < sizeR; r++)
        for (let c = 0; c < sizeC; c++) {
          const cell = grid[r][c];
          if (cell && cell.alliance === 'player' && cell.hp > 0 && cell.id !== unit.id) allAllies.push(cell);
        }

      if (availableRunes.length > 0 && STATE.resources.gold >= 1) {
        for (const rune of availableRunes) {
          let score = 0;
          let runeTarget = null;

          if (rune === 'odin') {
            // Score: enemies in radius 1 around densest cell × (25 immediate + 15 DoT)
            let bestCluster = null, bestCount = 0;
            for (const e of allEnemies) {
              const neighbors = getRadius1Cells(e.row, e.col);
              const count = neighbors.filter(n => grid[n.r]?.[n.c]?.alliance === 'enemy').length;
              if (count > bestCount) { bestCount = count; bestCluster = e; }
            }
            if (bestCluster) {
              // Ensure no overlap with already-targeted cells this tick
              const alreadyTargeted = getRadius1Cells(bestCluster.row, bestCluster.col)
                .some(n => runeTargetedCells.has(cellKey(n.r, n.c)));
              if (!alreadyTargeted) {
                score = bestCount * (25 + 15); // 25 immediate + 5×3 DoT
                runeTarget = bestCluster;
              }
            }
          }

          if (rune === 'thor') {
            // Score: direct 50 + splash to radius-1 enemies × 10 + stunned count × 20
            const topEnemy = allEnemies.reduce((best, e) => (e.hp > (best?.hp ?? 0) ? e : best), null);
            if (topEnemy) {
              const already = runeTargetedCells.has(cellKey(topEnemy.row, topEnemy.col));
              if (!already) {
                const splashCells = getRadius1Cells(topEnemy.row, topEnemy.col);
                const splashEnemies = splashCells.filter(n => grid[n.r]?.[n.c]?.alliance === 'enemy').length;
                score = 50 + splashEnemies * 10 + splashEnemies * 20;
                runeTarget = topEnemy;
              }
            }
          }

          if (rune === 'hel') {
            // Score: HP removed by halving (favors high-HP units)
            // Target: advancing enemy closest to player side with highest HP
            const threatening = allEnemies
              .filter(e => e.col < sizeC / 2)
              .sort((a, b) => b.hp - a.hp);
            const topThreat = threatening[0] || allEnemies.sort((a, b) => b.hp - a.hp)[0];
            if (topThreat) {
              const already = runeTargetedCells.has(cellKey(topThreat.row, topThreat.col));
              if (!already) {
                score = Math.floor(topThreat.hp / 2);
                runeTarget = topThreat;
              }
            }
          }

          if (rune === 'loki') {
            // Score: enemy dmg × (proximity to col 0) — favors imminent threats
            let bestLoki = null, bestLokiScore = 0;
            for (const e of allEnemies) {
              const proximityScore = (sizeC - e.col) * 5; // closer to player = higher
              const dmgScore = getEffectiveStats(e).dmg.total * 3;
              const total = proximityScore + dmgScore;
              if (total > bestLokiScore) { bestLokiScore = total; bestLoki = e; }
            }
            if (bestLoki) {
              const already = runeTargetedCells.has(cellKey(bestLoki.row, bestLoki.col));
              if (!already) { score = bestLokiScore; runeTarget = bestLoki; }
            }
          }

          if (rune === 'freya') {
            // Include ALL player units (including the runecaster itself, excluding charmed/confused/undead) for healing targets
            const allPlayerUnits = [];
            for (let r = 0; r < sizeR; r++) {
              for (let c = 0; c < sizeC; c++) {
                const cell = grid[r][c];
                if (cell && cell.alliance === 'player' && cell.hp > 0 && !cell.isCharmed && !cell.isConfused && !cell.isUndead) {
                  allPlayerUnits.push(cell);
                }
              }
            }

            let bestHeal = null, bestHealScore = 0;
            for (const ally of allPlayerUnits) {
              const neighbors = getRadius1Cells(ally.row, ally.col);
              const healSum = neighbors.reduce((sum, n) => {
                const cell = grid[n.r]?.[n.c];
                if (cell && cell.alliance === 'player' && !cell.isCharmed && !cell.isConfused && !cell.isUndead) {
                  const m = getEffectiveStats(cell).maxHp.total - cell.hp;
                  return sum + Math.max(0, m);
                }
                return sum;
              }, 0);
              
              // If number of enemies is bigger than our soldiers, use 50% HP danger threshold; otherwise, 80%.
              const enemyCount = allEnemies.filter(e => !e.isCharmed && !e.isConfused && !e.isUndead).length;
              // include the runecaster in player soldiers count:
              const allyCount = allPlayerUnits.length;
              const ratioThreshold = enemyCount > allyCount ? 0.5 : 0.8;

              // Only trigger if at least one ally in this cluster is in danger (below the adaptive threshold)
              const hasCriticalAlly = neighbors.some(n => {
                const cell = grid[n.r]?.[n.c];
                return cell && cell.alliance === 'player' && !cell.isCharmed && !cell.isConfused && !cell.isUndead && cell.hp < getEffectiveStats(cell).maxHp.total * ratioThreshold;
              });

              if (healSum > bestHealScore && hasCriticalAlly) {
                bestHealScore = healSum;
                bestHeal = ally;
              }
            }
            
            if (bestHeal) {
              const already = getRadius1Cells(bestHeal.row, bestHeal.col)
                .some(n => runeTargetedCells.has(cellKey(n.r, n.c)));
              if (!already) {
                score = bestHealScore;
                runeTarget = bestHeal;
              }
            }
          }

          if (score > bestScore) { bestScore = score; bestRune = { name: rune, target: runeTarget }; }
        }
      }

      if (bestRune && bestRune.target && STATE.resources.gold >= 1) {
        // Deduct gold & mark rune used
        adjustResource('gold', -1);
        unit.runeCooldowns[bestRune.name] = 10;
        // Hall of Fame: track rune cast
        if (unit.alliance === 'player') {
          recordSoldierRuneCast(unit.id, bestRune.name);
        }
        const rt = bestRune.target;
        const rnName = bestRune.name;

        // Mark targeted area to prevent double-targeting this tick
        getRadius1Cells(rt.row, rt.col).forEach(n => runeTargetedCells.add(cellKey(n.r, n.c)));
        runeTargetedCells.add(cellKey(rt.row, rt.col));

        notify('COMBAT_EFFECT_TRIGGER', { effect: `rune_${rnName}`, unit: unit, target: rt });

        if (rnName === 'odin') {
          // 25 AoE damage + 5/tick DoT for 3 ticks
          getRadius1Cells(rt.row, rt.col).forEach(n => {
            const cell = grid[n.r]?.[n.c];
            if (cell && cell.alliance === 'enemy' && cell.hp > 0) {
              cell.hp = Math.max(0, cell.hp - 25);
              if (unit.alliance === 'player') {
                updateSoldierStat(unit.id, 'runeDamageDealt', 25);
                updateSoldierStat(unit.id, 'damageDealt', 25);
              }
              notify('COMBAT_DAMAGE', { attacker: { name: '⚡ Odin Rune' }, defender: cell });
              if (!STATE.combat.activeDoTs) STATE.combat.activeDoTs = [];
              STATE.combat.activeDoTs.push({ unit: cell, dmgPerTick: 5, ticksLeft: 3, attackerId: unit.alliance === 'player' ? unit.id : null });
              if (cell.hp <= 0) {
                if (grid[cell.row]?.[cell.col] === cell) { grid[cell.row][cell.col] = null; removeUnitFromRegistry(cell); if (cell.alliance === 'enemy') recordMonsterKill(cell.type); if (unit.alliance === 'player') { recordSoldierKill(unit.id, cell.type); updateSoldierStat(unit.id, 'runeKills', 1); } notify('COMBAT_DEATH', cell); }
              }
            }
          });
        } else if (rnName === 'thor') {
          // 50 direct + 10 splash + 2-tick stun
          rt.hp = Math.max(0, rt.hp - 50);
          if (unit.alliance === 'player') {
            updateSoldierStat(unit.id, 'runeDamageDealt', 50);
            updateSoldierStat(unit.id, 'damageDealt', 50);
          }
          notify('COMBAT_DAMAGE', { attacker: { name: '🔨 Thor Rune' }, defender: rt });
          getRadius1Cells(rt.row, rt.col).forEach(n => {
            const cell = grid[n.r]?.[n.c];
            if (cell && cell.alliance === 'enemy' && cell.hp > 0 && cell.id !== rt.id) {
              cell.hp = Math.max(0, cell.hp - 10);
              if (unit.alliance === 'player') {
                updateSoldierStat(unit.id, 'runeDamageDealt', 10);
                updateSoldierStat(unit.id, 'damageDealt', 10);
              }
              notify('COMBAT_DAMAGE', { attacker: { name: '🔨 Thor Rune' }, defender: cell });
            }
          });
          // Stun all in radius 1
          getRadius1Cells(rt.row, rt.col).forEach(n => {
            const cell = grid[n.r]?.[n.c];
            if (cell && cell.alliance === 'enemy' && cell.hp > 0) {
              cell.stunnedTicksLeft = 2;
            }
          });
          if (rt.hp > 0) rt.stunnedTicksLeft = 2;
          // Death checks
          [rt, ...getRadius1Cells(rt.row, rt.col).map(n => grid[n.r]?.[n.c]).filter(Boolean)].forEach(cell => {
            if (cell && cell.hp <= 0 && grid[cell.row]?.[cell.col] === cell) {
              grid[cell.row][cell.col] = null; removeUnitFromRegistry(cell);
              if (cell.alliance === 'enemy') recordMonsterKill(cell.type); if (unit.alliance === 'player') { recordSoldierKill(unit.id, cell.type); updateSoldierStat(unit.id, 'runeKills', 1); } notify('COMBAT_DEATH', cell);
            }
          });
        } else if (rnName === 'hel') {
          // Halve current HP
          const dmg = rt.hp - Math.ceil(rt.hp / 2);
          rt.hp = Math.ceil(rt.hp / 2);
          if (unit.alliance === 'player') {
            updateSoldierStat(unit.id, 'runeDamageDealt', dmg);
            updateSoldierStat(unit.id, 'damageDealt', dmg);
          }
          notify('COMBAT_DAMAGE', { attacker: { name: '💀 Hel Rune' }, defender: rt });
          if (rt.hp <= 0 && grid[rt.row]?.[rt.col] === rt) {
            grid[rt.row][rt.col] = null; removeUnitFromRegistry(rt);
            if (rt.alliance === 'enemy') recordMonsterKill(rt.type); if (unit.alliance === 'player') { recordSoldierKill(unit.id, rt.type); updateSoldierStat(unit.id, 'runeKills', 1); } notify('COMBAT_DEATH', rt);
          }
        } else if (rnName === 'loki') {
          // Teleport enemy to beginning of its lane (rightmost column)
          if (grid[rt.row]?.[rt.col] === rt) {
            grid[rt.row][rt.col] = null;
            // Find rightmost free cell in enemy's starting side
            let placed = false;
            for (let c = sizeC - 1; c >= sizeC - 3; c--) {
              if (!grid[rt.row][c]) { rt.col = c; grid[rt.row][c] = rt; placed = true; break; }
            }
            if (!placed) { rt.col = sizeC - 1; grid[rt.row][sizeC - 1] = rt; }
          }
          notify('COMBAT_EFFECT_TRIGGER', { effect: 'loki_rune_teleport', unit: rt });
        } else if (rnName === 'freya') {
          // Heal all allies in radius 1 to full HP (excluding charmed, confused, or undead)
          getRadius1Cells(rt.row, rt.col).forEach(n => {
            const cell = grid[n.r]?.[n.c];
            if (cell && cell.alliance === 'player' && cell.hp > 0 && !cell.isCharmed && !cell.isConfused && !cell.isUndead) {
              const effMax = getEffectiveStats(cell).maxHp.total;
              const healedAmt = effMax - cell.hp;
              if (healedAmt > 0) {
                cell.hp = effMax;
                if (unit.alliance === 'player') {
                  updateSoldierStat(unit.id, 'runeHealingDone', healedAmt);
                }
                updateSoldierStat(cell.id, 'damageHealed', healedAmt);
                notify('COMBAT_EFFECT_TRIGGER', { effect: 'unit_heal', unit: cell, amount: healedAmt });
              }
            }
          });
        }

        notify('COMBAT_UPDATE');
        continue; // Runecaster cast a rune, no normal attack this tick
      }
    }
    // ---- END RUNECASTER ----

    if (target && target.hp > 0) {
      // Loki Milestone 2: Enemy attack speed reduced by 10% (10% miss chance)
      if (unit.alliance === 'enemy' && STATE.godQuests.loki?.[1]) {
        const lokiM2 = GC.modifiers.milestones.loki.find(m => m.index === 1);
        const missChance = lokiM2?.enemyMissChance ?? 0.10;
        if (Math.random() < missChance) {
          notify('COMBAT_EFFECT_TRIGGER', { effect: 'loki_miss', unit: unit });
          continue; // Skip attack this tick
        }
      }
      // Hel Milestone 4: Enemy attack speed reduced by 10% (10% miss chance)
      if (unit.alliance === 'enemy' && STATE.godQuests.hel?.[3]) {
        const helM4 = GC.modifiers.milestones.hel.find(m => m.index === 3);
        const missChance = helM4?.enemyMissChance ?? 0.10;
        if (Math.random() < missChance) {
          notify('COMBAT_EFFECT_TRIGGER', { effect: 'hel_miss', unit: unit });
          continue; // Skip attack this tick
        }
      }

      // Thor Milestone 3: Player units attack speed increased by 10% (10% chance to attack again)
      const isPlayer = unit.alliance === 'player';
      const hasThorAttackSpeed = isPlayer && STATE.godQuests.thor?.[2];
      const thorM3 = GC.modifiers.milestones.thor.find(m => m.index === 2);
      const doubleAttackChance = thorM3?.doubleAttackChance ?? 0.10;
      const isDoubleAttack = hasThorAttackSpeed && Math.random() < doubleAttackChance;
      if (isDoubleAttack) {
        notify('COMBAT_EFFECT_TRIGGER', { effect: 'thor_double', unit: unit });
        if (unit.alliance === 'player') updateSoldierStat(unit.id, 'doubleAttacks', 1);
      }
      const attackCount = isDoubleAttack ? 2 : 1;

      for (let i = 0; i < attackCount; i++) {
        const currentTarget = (i === 0) ? target : (unit.isFleeing ? null : findTargetInLane(unit, gridSnapshot));
        if (!currentTarget || currentTarget.hp <= 0) break;

        let dmgTaken = getEffectiveStats(unit).dmg.total;


        // Heavy armor: reduces incoming damage by 1
        if (currentTarget.type === 'huskarl') {
          dmgTaken = Math.max(0, dmgTaken - 1);
          notify('COMBAT_EFFECT_TRIGGER', { effect: 'huskarl_armor', unit: currentTarget });
          if (currentTarget.alliance === 'player') {
            updateSoldierStat(currentTarget.id, 'blockedHits', 1);
            updateSoldierStat(currentTarget.id, 'damageBlocked', 1);
          }
        }

        // Freya Milestone 4: Shieldmaidens block 1 DMG per hit
        if (currentTarget.alliance === 'player' && currentTarget.type === 'shieldmaiden' && STATE.godQuests.freya?.[3]) {
          const m4Config = GC.modifiers.milestones.freya.find(m => m.index === 3);
          const blockAmount = m4Config?.blockAmount ?? 1;
          dmgTaken = Math.max(0, dmgTaken - blockAmount);
          notify('COMBAT_EFFECT_TRIGGER', { effect: 'shieldmaiden_block', unit: currentTarget, amount: blockAmount });
          if (currentTarget.alliance === 'player') {
            updateSoldierStat(currentTarget.id, 'blockedHits', 1);
            updateSoldierStat(currentTarget.id, 'damageBlocked', blockAmount);
          }
        }

        let nextHp = currentTarget.hp - dmgTaken;

        // Hel Milestone 2: Player units survive lethal hits once with 1 HP (once per battle)
        if (nextHp <= 0 && currentTarget.alliance === 'player' && STATE.godQuests.hel?.[1] && !currentTarget.hasSurvivedLethal) {
          const helM2 = GC.modifiers.milestones.hel.find(m => m.index === 1);
          if (helM2?.surviveLethal ?? true) {
            currentTarget.hasSurvivedLethal = true;
            nextHp = 1;
            notify('COMBAT_EFFECT_TRIGGER', { effect: 'hel_survive', unit: currentTarget });
          }
        }

        currentTarget.hp = nextHp;
        // Hall of Fame: track damage received
        if (currentTarget.alliance === 'player') {
          updateSoldierStat(currentTarget.id, 'damageReceived', dmgTaken);
        }
        // Track last attacker for death cause
        if (unit.alliance === 'enemy' && currentTarget.alliance === 'player') {
          currentTarget._lastAttackerName = unit.type || unit.name;
        }
        notify('COMBAT_DAMAGE', { attacker: unit, defender: currentTarget });
        unit.isAttacking = true;
        setTimeout(() => { unit.isAttacking = false; }, 200);
        // Hall of Fame: track attack stats
        if (unit.alliance === 'player') {
          updateSoldierStat(unit.id, 'attacksMade', 1);
          updateSoldierStat(unit.id, 'damageDealt', dmgTaken);
        }

        // Hel Champion Blessing: Once-per-battle 50% chance to turn into an undead when hurt under 50% max HP
        if (currentTarget.alliance === 'enemy' && currentTarget.hp > 0 && !currentTarget.helUndeadChecked) {
          const activeBlessings = new Set();
          if (STATE.activeBlessing) activeBlessings.add(STATE.activeBlessing);
          if (STATE.permanentlyActivatedBlessings) {
            STATE.permanentlyActivatedBlessings.forEach(b => activeBlessings.add(b));
          }
          if (activeBlessings.has('hel')) {
            const helBlessing = GC.modifiers.blessings.hel;
            const threshold = helBlessing?.threshold ?? 0.5;
            if (currentTarget.hp < currentTarget.maxHp * threshold) {
              currentTarget.helUndeadChecked = true;
              const raiseChance = helBlessing?.raiseChance ?? 0.5;
              if (Math.random() < raiseChance) {
                const duration = helBlessing?.raiseDurationTicks ?? 3;
                currentTarget.name = 'Draugr (Undead) 💀';
                currentTarget.type = 'Draugr Warrior';
                currentTarget.hp = 15;
                currentTarget.maxHp = 15;
                currentTarget.dmg = 4;
                currentTarget.speed = 1;
                currentTarget.range = 1;
                currentTarget.alliance = 'player';
                currentTarget.isUndead = true;
                currentTarget.undeadTicksLeft = duration;
                
                notify('COMBAT_EFFECT_TRIGGER', { effect: 'hel_undead', unit: currentTarget });
                notify('COMBAT_UPDATE');
              }
            }
          }
        }

        if (currentTarget.hp <= 0) {
          grid[currentTarget.row][currentTarget.col] = null;
          removeUnitFromRegistry(currentTarget);
          if (currentTarget.alliance === 'enemy') {
            recordMonsterKill(currentTarget.type);
            // Hall of Fame: track kill
            if (unit.alliance === 'player') {
              recordSoldierKill(unit.id, currentTarget.type);
            }

            // Hel Milestone 3: Slain enemies drop +1 extra Gold
            if (STATE.godQuests.hel?.[2]) {
              const helM3 = GC.modifiers.milestones.hel.find(m => m.index === 2);
              const goldDrop = helM3?.goldDrop ?? 1;
              adjustResource('gold', goldDrop);
            }
          }
          notify('COMBAT_DEATH', currentTarget);
        }
      }
    } else {
      let dir = 0;
      let shouldMove = true;
      const stance = unit.stance || STATE.combat.stance || 'attack';
      if (unit.alliance === 'enemy') {
        dir = -1;
        // Hel Milestone 4: Enemy movement speed reduced by 10%
        if (STATE.godQuests.hel?.[3]) {
          const helM4 = GC.modifiers.milestones.hel.find(m => m.index === 3);
          const slowChance = Math.abs(helM4?.enemySpeedModifier ?? -0.10);
          if (Math.random() < slowChance) {
            shouldMove = false;
          }
        }
      } else if (unit.isFleeing) {
        dir = -1;
      } else {
        if (stance === 'attack') dir = 1;
        else if (stance === 'retreat' || stance === 'defend') dir = -1;
        else shouldMove = false;
      }

      if (shouldMove) {
        const effectiveLeap = getEffectiveStats(unit).leap?.total || 0;
        const fullLeapVal = 1 + effectiveLeap;
        let leapVal = 1; // Default normal movement

        const isRetreatingOrFleeing = unit.isFleeing || (unit.alliance === 'player' && stance === 'retreat');

        if (!isRetreatingOrFleeing && effectiveLeap > 0) {
          let canLeap = false;

          // 1. Can reach the enemy base
          if (unit.alliance === 'player' && dir === 1 && unit.col + fullLeapVal >= sizeC) {
            canLeap = true;
          } else if (unit.alliance === 'enemy' && dir === -1 && unit.col - fullLeapVal < 0) {
            canLeap = true;
          }

          // 2. Can meet an enemy (accounting for whether they are moving or static, and adjacent lanes if Odin's Strategist is active)
          if (!canLeap) {
            const targetRows = [unit.row];
            if (unit.alliance === 'player' && STATE.godQuests.odin?.[0]) {
              if (unit.row > 0) targetRows.push(unit.row - 1);
              if (unit.row < CFG.gridRows - 1) targetRows.push(unit.row + 1);
            }

            for (let step = 1; step <= fullLeapVal + 2; step++) {
              const testCol = unit.col + (dir * step);
              if (testCol >= 0 && testCol < sizeC) {
                for (const r of targetRows) {
                  const cell = gridSnapshot[r][testCol];
                  if (cell && cell.alliance !== unit.alliance) {
                    // If the enemy has no target in range, they will move 1 step forward (moving)
                    const isMoving = !findTargetInLane(cell, gridSnapshot);
                    const maxDistance = isMoving ? (fullLeapVal + 2) : (fullLeapVal + 1);
                    if (step <= maxDistance) {
                      canLeap = true;
                      break;
                    }
                  }
                }
                if (canLeap) break;
              }
            }
          }

          // 3. Can push back an engaged ally (for Berserkers)
          if (!canLeap && unit.type === 'berserker') {
            const nextCol = unit.col + dir;
            if (nextCol >= 0 && nextCol < sizeC) {
              const cell = grid[unit.row][nextCol];
              if (cell && cell.alliance === unit.alliance) {
                const engaged = findTargetInLane(cell, gridSnapshot);
                if (engaged) {
                  const pushDir = -dir;
                  let currentPushCol = cell.col;
                  let pushPossible = true;
                  while (true) {
                    const checkCol = currentPushCol + pushDir;
                    if (checkCol < 0 || checkCol >= sizeC) {
                      pushPossible = false;
                      break;
                    }
                    const other = grid[unit.row][checkCol];
                    if (other) {
                      if (other.alliance !== unit.alliance) {
                        pushPossible = false;
                        break;
                      } else if (other.id === unit.id) {
                        break;
                      } else {
                        currentPushCol = checkCol;
                      }
                    } else {
                      break;
                    }
                  }
                  if (pushPossible) {
                    canLeap = true;
                  }
                }
              }
            }
          }
          if (canLeap) {
            leapVal = fullLeapVal;
          }
        }

        let lastValidCol = unit.col;
        let reachedBoundary = false;
        let berserkerPushedAlly = false;

        for (let step = 1; step <= leapVal; step++) {
          const testCol = unit.col + (dir * step);
          if (testCol < 0 || testCol >= sizeC) {
            reachedBoundary = true;
            break;
          }
          const obstacle = grid[unit.row][testCol];
          if (obstacle) {
            if (obstacle.alliance !== unit.alliance) {
              break;
            }
            
            // If the unit is moving at normal speed (leapVal === 1), it cannot leap over allies.
            if (leapVal === 1) {
              break;
            }
            
            // Berserker specific pushback logic:
            // If the moving unit is a Berserker, and the ally in front (obstacle) is engaged in combat:
            if (unit.type === 'berserker' && !berserkerPushedAlly) {
              const engaged = findTargetInLane(obstacle, gridSnapshot);
              if (engaged) {
                // Determine push chain to the left (reverse of movement direction)
                // Direction of push is -dir
                const pushDir = -dir;
                let pushChain = [];
                let currentPushCol = obstacle.col;
                let pushPossible = true;
                while (true) {
                  const checkCol = currentPushCol + pushDir;
                  if (checkCol < 0 || checkCol >= sizeC) {
                    // Pushes outside the grid
                    pushPossible = false;
                    break;
                  }
                  const other = grid[unit.row][checkCol];
                  if (other) {
                    if (other.alliance !== unit.alliance) {
                      // Cannot push an enemy or non-ally
                      pushPossible = false;
                      break;
                    } else if (other.id === unit.id) {
                      // That's the Berserker itself!
                      // The Berserker starts moving from its current position, so its own cell is vacated when it moves.
                      // This means we can push allies into the Berserker's starting cell (unit.col)!
                      // We treat the Berserker's starting cell as "empty" for the purpose of the pushback chain.
                      pushChain.push(other);
                      break;
                    } else {
                      pushChain.push(other);
                      currentPushCol = checkCol;
                    }
                  } else {
                    // Empty space found, chain can stop here
                    break;
                  }
                }

                if (pushPossible) {
                  // Push the chain (including the engaged obstacle)
                  // We must do the shift backwards starting from the end of the chain
                  const fullChain = [obstacle, ...pushChain];
                  // If the Berserker's own position is in the chain, we only push up to the cell before it
                  const selfIndex = fullChain.findIndex(u => u.id === unit.id);
                  const pushList = selfIndex !== -1 ? fullChain.slice(0, selfIndex) : fullChain;

                  // Clear grid positions for everyone in the pushList
                  pushList.forEach(u => {
                    grid[u.row][u.col] = null;
                  });
                  // Update their columns and re-place them
                  pushList.forEach(u => {
                    u.col = u.col + pushDir;
                    grid[u.row][u.col] = u;
                  });

                  // Place the Berserker at the pushed ally's original position
                  lastValidCol = testCol;
                  berserkerPushedAlly = true;
                  break;
                }
              }
            }

            // Can leap over an ally, but cannot land on an ally's cell ordinarily
            continue;
          }
          lastValidCol = testCol;
        }

        if (effectiveLeap > 0) {
          console.log(`[LEAP DEBUG] Unit: ${unit.name}, col: ${unit.col} -> ${lastValidCol}, leapVal: ${leapVal}, effectiveLeap: ${effectiveLeap}`);
        }

        if (lastValidCol !== unit.col) {
          // If the Berserker pushed someone back into its own starting position, it is already updated
          if (grid[unit.row][unit.col] === unit) {
            grid[unit.row][unit.col] = null;
          }
          const isLeaping = leapVal > 1;
          const oldCol = unit.col;
          unit.col = lastValidCol;
          grid[unit.row][lastValidCol] = unit;

          // Hall of Fame: track movement
          if (unit.alliance === 'player') {
            const hofCellsMoved = Math.abs(lastValidCol - oldCol);
            updateSoldierStat(unit.id, 'cellsMoved', hofCellsMoved);
          }

          if (isLeaping) {
            notify('COMBAT_EFFECT_TRIGGER', { effect: 'unit_leap', unit: unit, oldCol: oldCol });
            if (unit.alliance === 'player') {
              updateSoldierStat(unit.id, 'leaps', 1);
            }
          }

          // ARRIVAL CHECK:
          if (unit.alliance === 'player' && !unit.isCharmed && !unit.isConfused && !unit.isUndead) {
            const r = unit.row;
            const c = unit.col;
            if (c < 10 && STATE.combat.plannedLayout && STATE.combat.plannedLayout[r]?.[c] === unit.type) {
              unit.stance = 'hold';
            }
          }
        }

        if (reachedBoundary) {
          const boundaryCol = unit.col + dir; // The column that crossed the boundary
          const stance = unit.stance || STATE.combat.stance || 'attack';
          if (unit.alliance === 'player' && stance === 'defend' && boundaryCol < 0) {
            // Hold at col 0
          } else {
            grid[unit.row][unit.col] = null;
            if (unit.alliance === 'player' && (unit.isFleeing || stance === 'retreat') && boundaryCol < 0) {
              const poolUnit = { ...unit, hp: unit.hp, row: undefined, col: undefined, isFleeing: false };
              delete poolUnit.stance; // Clear individual stance when returning to pool
              STATE.combat.pool.push(poolUnit);
              sortPoolByPoints();
              notify('COMBAT_UPDATE');
            } else {
              handleUnitReachEnd(unit);
            }
          }
        }
      }
    }
  }

  checkAndAutoDeploy();
  notify('COMBAT_UPDATE');
  checkCombatEndConditions();
}

function findTargetInLane(unit, grid = STATE.combat.grid) {
  const dir = unit.alliance === 'player' ? 1 : -1;
  const range = getEffectiveStats(unit).range.total;

  if (unit.alliance === 'player' && STATE.godQuests.odin?.[0]) {
    let bestTarget = null;
    let bestPriority = Infinity;

    const targetRows = [unit.row, unit.row - 1, unit.row + 1].filter(r => r >= 0 && r < CFG.gridRows);

    for (const rToCheck of targetRows) {
      for (let cToCheck = 0; cToCheck < CFG.gridCols; cToCheck++) {
        const colDist = (cToCheck - unit.col) * dir;
        if (colDist >= 0 && colDist <= range) {
          const cell = grid[rToCheck][cToCheck];
          if (cell && cell.alliance !== unit.alliance) {
            const priorityDist = (rToCheck === unit.row) ? (colDist - 0.1) : colDist;

            if (priorityDist < bestPriority) {
              bestPriority = priorityDist;
              bestTarget = cell;
            } else if (priorityDist === bestPriority) {
              if (rToCheck === unit.row) {
                bestTarget = cell;
              }
            }
          }
        }
      }
    }
    if (bestTarget) {
      if (unit.type === 'huntsman') {
        console.log(`[TARGET DEBUG] (Odin Strategist) Huntsman ${unit.name} at row ${unit.row}, col ${unit.col} targeted ${bestTarget.name} at row ${bestTarget.row}, col ${bestTarget.col}, colDist: ${Math.abs(bestTarget.col - unit.col)}, range: ${range}`);
      }
      return bestTarget;
    }
  } else {
    for (let r = 1; r <= range; r++) {
      const checkCol = unit.col + (r * dir);
      if (checkCol >= 0 && checkCol < CFG.gridCols) {
        const cell = grid[unit.row][checkCol];
        if (cell && cell.alliance !== unit.alliance) {
          if (unit.type === 'huntsman') {
            console.log(`[TARGET DEBUG] (Normal) Huntsman ${unit.name} at row ${unit.row}, col ${unit.col} targeted ${cell.name} at row ${cell.row}, col ${cell.col}, colDist: ${r}, range: ${range}`);
          }
          return cell;
        }
      }
    }
  }

  const nextCol = unit.col + dir;
  if (nextCol >= 0 && nextCol < CFG.gridCols) {
    const nextCell = grid[unit.row][nextCol];
    if (nextCell && nextCell.alliance !== unit.alliance) return nextCell;
  }
  return null;
}

function checkGroupDefeated(unit) {
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

function removeUnitFromRegistry(unit) {
  if (unit.alliance === 'player' && !unit.isCharmed && !unit.isUndead && !unit.isConfused) {
    // Hall of Fame: mark soldier as dead
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

function handleUnitReachEnd(unit) {
  if (unit.alliance === 'player') {
    if (unit.isCharmed || unit.isConfused) {
      const idx = STATE.combat.waveMonsters.findIndex(m => m.id === unit.id);
      if (idx !== -1) STATE.combat.waveMonsters.splice(idx, 1);
      notify('COMBAT_UPDATE');
      checkCombatEndConditions();
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
    addSoldierEvent(unit.id, 'Crossed enemy lines (+1 Gold)');
    const poolUnit = { ...unit, hp: unit.maxHp, row: undefined, col: undefined };
    STATE.combat.pool.push(poolUnit);
    sortPoolByPoints();
    notify('COMBAT_SUCCESS_REPLACE', unit);
  } else {
    const resTypes = ['gold', 'food', 'wood', 'sheep'];
    const rType = resTypes[Math.floor(Math.random() * resTypes.length)];
    adjustResource(rType, -CFG.enemyBreachDrain);
    notify('COMBAT_BREACH', { unit, stolen: rType });

    // Reappear in a random lane on the side opposite to you
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

export function togglePause() {
  STATE.combat.paused = !STATE.combat.paused;
  if (!STATE.combat.paused) {
    STATE.combat.activePlanningType = null;
    if (STATE.combat.planningWizard) {
      STATE.combat.planningWizard.active = false;
    }
    STATE.combat.movePlansMode = false;
    STATE.combat.selectedPlans = [];
  }
  notify('COMBAT_PAUSED');
}

export function deployUnit(poolIndex, row, col) {
  poolIndex = Number(poolIndex);
  row = Number(row);
  col = Number(col);
  if (col > CFG.deployColLimit) return;
  if (STATE.combat.grid[row][col]) return;
  const unit = STATE.combat.pool[poolIndex];
  if (!unit) return;
  unit.row = row;
  unit.col = col;
  STATE.combat.grid[row][col] = unit;
  
  if (STATE.combat.plannedLayout && STATE.combat.plannedLayout[row] && STATE.combat.plannedLayout[row][col] === unit.type) {
    unit.stance = 'hold';
  }

  if (!STATE.combat.deployHistory) STATE.combat.deployHistory = [];
  STATE.combat.deployHistory.push(unit.id);
  updateSoldierStat(unit.id, 'timesDeployed', 1);
  STATE.combat.pool.splice(poolIndex, 1);
  STATE.combat.selectedPoolIndex = null;
  checkAndAutoDeploy();
  notify('COMBAT_UPDATE');
}

export function undeployUnit(row, col) {
  row = Number(row);
  col = Number(col);
  const unit = STATE.combat.grid[row][col];
  if (!unit || unit.alliance !== 'player' || unit.isCharmed || unit.isConfused || unit.isUndead) return;

  // Clear one plan of this unit's type in the same lane to prevent immediate auto-redeploy
  if (STATE.combat.plannedLayout) {
    for (let checkC = 0; checkC < 10; checkC++) {
      if (STATE.combat.plannedLayout[row][checkC] === unit.type) {
        STATE.combat.plannedLayout[row][checkC] = null;
        if (STATE.combat.selectedPlans) {
          STATE.combat.selectedPlans = STATE.combat.selectedPlans.filter(p => !(p.r === row && p.c === checkC));
        }
        break;
      }
    }
  }

  STATE.combat.grid[row][col] = null;
  unit.row = undefined;
  unit.col = undefined;
  delete unit.stance; // Clear individual stance when returning to pool
  STATE.combat.pool.push(unit);
  if (STATE.combat.deployHistory) {
    STATE.combat.deployHistory = STATE.combat.deployHistory.filter(id => id !== unit.id);
  }
  sortPoolByPoints();
  checkAndAutoDeploy();
  notify('COMBAT_UPDATE');
}

function checkCombatEndConditions() {
  const activeEnemies = STATE.combat.waveMonsters.filter(m => m.alliance === 'enemy' || m.isCharmed || m.isConfused);
  const allGroupsDeployed = (!STATE.combat.pendingSpawnGroups || STATE.combat.pendingSpawnGroups.length === 0);

  const hasEnemyUnitsOnBoard = STATE.combat.grid.some(row =>
    row.some(cell => cell && (cell.alliance === 'enemy' || cell.isCharmed || cell.isConfused))
  );

  if ((activeEnemies.length === 0 || !hasEnemyUnitsOnBoard) && allGroupsDeployed) {
    endCombat(true);
  } else {
    const hasPlayerUnitsOnBoard = STATE.combat.grid.some(row =>
      row.some(cell => cell && cell.alliance === 'player')
    );
    if (STATE.combat.pool.length === 0 && !hasPlayerUnitsOnBoard) {
      endCombat(false);
    }
  }
}

export function endCombat(isVictory) {
  STATE.combat.active = false;
  STATE.combat.paused = true;
  clearInterval(combatTimer);
  combatTimer = null;

  if (isVictory) {
    const locId = STATE.combat.locationId;
    const coordKey = STATE.combat.entityCoordKey;
    const locState = STATE.locations[locId];
    if (locState) {
      if (STATE.combat.isWarHornBattle || STATE.combat.entityCoordKey === 'war_horn') {
        for (const tile of Object.values(locState.placedTiles)) {
          if (tile.entity && tile.entity.type === 'enemy_army') {
            tile.entity.isDefeated = true;
          }
        }
        for (const entity of Object.values(locState.preGeneratedEntities)) {
          if (entity && entity.type === 'enemy_army') {
            entity.isDefeated = true;
          }
        }
      } else {
        if (locState.placedTiles[coordKey]) {
          const tile = locState.placedTiles[coordKey];
          if (tile.entity && tile.entity.type === 'enemy_army') tile.entity.isDefeated = true;
        }
        if (locState.preGeneratedEntities[coordKey]) {
          const entity = locState.preGeneratedEntities[coordKey];
          if (entity && entity.type === 'enemy_army') entity.isDefeated = true;
        }
      }
    }

    const boardUnits = [];
    for (let r = 0; r < CFG.gridRows; r++)
      for (let c = 0; c < CFG.gridCols; c++) {
        const cell = STATE.combat.grid[r][c];
        if (cell && cell.alliance === 'player') boardUnits.push(cell);
      }

    for (const member of STATE.band) {
      const activeUnit = boardUnits.find(u => u.id === member.id) || STATE.combat.pool.find(u => u.id === member.id);
      if (activeUnit) member.hp = Math.min(member.maxHp, activeUnit.hp);
    }

    notify('COMBAT_VICTORY');
    // Hall of Fame: track combat wins for surviving soldiers
    for (const member of STATE.band) {
      updateSoldierStat(member.id, 'combatsWon', 1);
    }
  } else {
    // Hall of Fame: mark all remaining band members as dead
    for (const member of STATE.band) {
      markSoldierDead(member.id, 'Band wiped out in combat');
    }
    STATE.band = [];
    notify('COMBAT_DEFEAT');
  }
}

export function fleeCombat() {
  STATE.combat.active = false;
  STATE.combat.paused = true;
  clearInterval(combatTimer);
  combatTimer = null;

  const resTypes = ['gold', 'food', 'wood', 'sheep'];
  const stolen = {};
  for (const monster of STATE.combat.waveMonsters) {
    const rType = resTypes[Math.floor(Math.random() * resTypes.length)];
    adjustResource(rType, -CFG.enemyBreachDrain);
    stolen[rType] = (stolen[rType] || 0) + CFG.enemyBreachDrain;
  }

  const boardUnits = [];
  for (let r = 0; r < CFG.gridRows; r++)
    for (let c = 0; c < CFG.gridCols; c++) {
      const cell = STATE.combat.grid[r][c];
      if (cell && cell.alliance === 'player') boardUnits.push(cell);
    }

  for (const member of STATE.band) {
    const activeUnit = boardUnits.find(u => u.id === member.id) || STATE.combat.pool.find(u => u.id === member.id);
    if (activeUnit) member.hp = Math.min(member.maxHp, activeUnit.hp);
  }

  notify('COMBAT_FLEE', { stolen });
}


function getMonsterStats(mClass) {
  return CFG.monsters[mClass] || CFG.monsterFallback;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function checkAndAutoDeploy() {
  if (!STATE.combat.active) return;
  if (!STATE.combat.plannedLayout) {
    STATE.combat.plannedLayout = Array.from({ length: CFG.gridRows }, () => Array(CFG.gridCols).fill(null));
  }

  const grid = STATE.combat.grid;
  const sizeR = CFG.gridRows;

  for (let r = 0; r < sizeR; r++) {
    // 1. Gather desired planned counts for this lane r
    const desiredCounts = {};
    for (let c = 0; c < CFG.gridCols; c++) {
      const type = STATE.combat.plannedLayout[r][c];
      if (type) {
        desiredCounts[type] = (desiredCounts[type] || 0) + 1;
      }
    }

    if (Object.keys(desiredCounts).length === 0) continue;

    // 2. Count currently deployed player units of each type in lane r
    const deployedCounts = {};
    for (let c = 0; c < CFG.gridCols; c++) {
      const cell = grid[r][c];
      if (cell && cell.alliance === 'player' && !cell.isCharmed && !cell.isConfused && !cell.isUndead) {
        deployedCounts[cell.type] = (deployedCounts[cell.type] || 0) + 1;
      }
    }

    // 3. For each planned type T, see if we need to auto-deploy from pool
    for (const [type, reqCount] of Object.entries(desiredCounts)) {
      const currentCount = deployedCounts[type] || 0;
      let needed = reqCount - currentCount;
      if (needed <= 0) continue;

      while (needed > 0) {
        // Find matching unit in pool
        const poolIndex = STATE.combat.pool.findIndex(u => u.type === type);
        if (poolIndex === -1) {
          // No more available units of this type in pool
          break;
        }

        // Ranged units prefer column 0, melee units prefer column 1
        const isRanged = ['huntsman', 'runecaster'].includes(type);
        let targetCol = -1;
        if (isRanged) {
          if (!grid[r][0]) {
            targetCol = 0;
          } else if (!grid[r][1]) {
            targetCol = 1;
          }
        } else {
          if (!grid[r][1]) {
            targetCol = 1;
          } else if (!grid[r][0]) {
            targetCol = 0;
          }
        }

        if (targetCol === -1) {
          // No vacant deployable cell in this lane
          break;
        }

        // Deploy it!
        const unit = STATE.combat.pool[poolIndex];
        unit.row = r;
        unit.col = targetCol;
        grid[r][targetCol] = unit;

        // Set stance to hold if it matches the planned position at targetCol
        if (STATE.combat.plannedLayout[r][targetCol] === unit.type) {
          unit.stance = 'hold';
        }

        if (!STATE.combat.deployHistory) STATE.combat.deployHistory = [];
        STATE.combat.deployHistory.push(unit.id);
        STATE.combat.pool.splice(poolIndex, 1);

        needed--;
      }
    }
  }
}

