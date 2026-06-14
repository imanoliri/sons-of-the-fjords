/* ==========================================================================
   COMBAT MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE, notify, adjustResource, recordMonsterKill, getEffectiveStats } from './state.js';
import { COMBAT_CONFIG as CFG } from './config/combat.js';
import { SOLDIERS_CONFIG } from './config/soldiers.js';
import { GODS_CONFIG as GC } from './config/gods.js';

let combatTimer = null;

export function sortPoolByPoints() {
  const order = STATE.combat.formationOrder || ['shieldmaiden', 'berserker', 'huntsman', 'huskarl'];
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

  // 1. Initialize grid
  const grid = [];
  for (let r = 0; r < CFG.gridRows; r++) {
    const row = [];
    for (let c = 0; c < CFG.gridCols; c++) row.push(null);
    grid.push(row);
  }
  STATE.combat.grid = grid;

  // 2. Clone active band into deployment pool
  STATE.combat.pool = STATE.band.map(u => ({ ...u, maxHp: u.maxHp, hp: u.hp, currentHp: u.hp, alliance: 'player' }));
  sortPoolByPoints();

  // 3. Populate wave monsters on the far right
  const monsters = [];
  const startLanes = Array.from({ length: CFG.gridRows }, (_, i) => i);
  shuffleArray(startLanes);

  const activeBlessings = new Set();
  if (STATE.activeBlessing) activeBlessings.add(STATE.activeBlessing);
  if (STATE.permanentlyActivatedBlessings) {
    STATE.permanentlyActivatedBlessings.forEach(b => activeBlessings.add(b));
  }
  const hasLokiBlessing = activeBlessings.has('loki');

  const totalMonstersCount = enemyData.monsters.reduce((sum, m) => sum + m.count, 0);

  let confusedIndex = -1;
  const lokiM3 = GC.modifiers.milestones.loki.find(m => m.index === 2);
  const confuseChance = lokiM3?.confuseChance ?? 0.25;
  if (STATE.godQuests.loki?.[2] && Math.random() < confuseChance) {
    if (totalMonstersCount > 0) {
      confusedIndex = Math.floor(Math.random() * totalMonstersCount);
    }
  }

  // Loki Champion blessing: 25% chance overall to charm exactly one spawned monster in the combat wave
  let charmedIndex = -1;
  const lokiBlessing = GC.modifiers.blessings.loki;
  const charmChance = lokiBlessing?.charmChance ?? 0.25;
  if (hasLokiBlessing && Math.random() < charmChance) {
    if (totalMonstersCount > 0) {
      charmedIndex = Math.floor(Math.random() * totalMonstersCount);
    }
  }

  let spawnIndex = 0;
  let spawnedCount = 0;
  let charmedMonsterData = null;

  for (const m of enemyData.monsters) {
    for (let i = 0; i < m.count; i++) {
      const isCharmed = spawnedCount === charmedIndex;
      const isConfused = !isCharmed && spawnedCount === confusedIndex;
      const stats = getMonsterStats(m.monsterClass);

      if (isCharmed) {
        // Delay placement of the charmed unit until we place the non-charmed enemies
        charmedMonsterData = {
          mClass: m.monsterClass,
          stats: stats,
          spawnedCount: spawnedCount
        };
        spawnedCount++;
        continue;
      }

      const lane = startLanes[spawnIndex % CFG.gridRows];
      spawnIndex++;

      let spawnCol = isConfused ? CFG.gridCols - 2 : CFG.gridCols - 1;
      if (isConfused) {
        for (let c = CFG.gridCols - 2; c >= 0; c--) {
          if (!grid[lane][c]) {
            spawnCol = c;
            break;
          }
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
        row: lane,
        col: spawnCol
      };
      monsters.push(mUnit);
      grid[lane][spawnCol] = mUnit;
      spawnedCount++;
    }
  }

  // Position and spawn the charmed unit in front of a random enemy
  if (charmedMonsterData) {
    notify('COMBAT_EFFECT_TRIGGER', { effect: 'loki_charm', unit: { name: charmedMonsterData.mClass } });

    const enemies = monsters.filter(m => m.alliance === 'enemy');
    let targetEnemy = null;
    if (enemies.length > 0) {
      targetEnemy = enemies[Math.floor(Math.random() * enemies.length)];
    }

    let spawnLane = startLanes[spawnIndex % CFG.gridRows];
    spawnIndex++;
    let spawnCol = CFG.gridCols - 2;

    if (targetEnemy) {
      spawnLane = targetEnemy.row;
      let checkCol = targetEnemy.col - 1;
      let found = false;
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
          break;
        }
      }
    }

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
    monsters.push(mUnit);
    grid[spawnLane][spawnCol] = mUnit;
  }

  STATE.combat.waveMonsters = monsters;
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
      target.hp = Math.max(0, target.hp - dot.dmgPerTick);
      notify('COMBAT_DAMAGE', { attacker: { name: 'Odin Rune' }, defender: target });
      if (target.hp <= 0) {
        if (grid[target.row] && grid[target.row][target.col] === target) {
          grid[target.row][target.col] = null;
          removeUnitFromRegistry(target);
          if (target.alliance === 'enemy') recordMonsterKill(target.type);
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
          const healAmount = GC.modifiers.blessings.freya?.healAmount ?? 2;
          unit.hp = Math.min(effStats.maxHp.total, unit.hp + healAmount);
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
      if (!unit.runesCast) unit.runesCast = {};

      // Gather available runes (god milestone 5 unlocked + not yet cast this battle)
      const godNames = ['odin', 'thor', 'hel', 'loki', 'freya'];
      const availableRunes = godNames.filter(g =>
        STATE.godQuests[g]?.[4] === true && !unit.runesCast[g]
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
            // Include ALL player units (including the runecaster itself) for healing targets
            const allPlayerUnits = [];
            for (let r = 0; r < sizeR; r++) {
              for (let c = 0; c < sizeC; c++) {
                const cell = grid[r][c];
                if (cell && cell.alliance === 'player' && cell.hp > 0) {
                  allPlayerUnits.push(cell);
                }
              }
            }

            let bestHeal = null, bestHealScore = 0;
            for (const ally of allPlayerUnits) {
              const neighbors = getRadius1Cells(ally.row, ally.col);
              const healSum = neighbors.reduce((sum, n) => {
                const cell = grid[n.r]?.[n.c];
                if (cell && cell.alliance === 'player') {
                  const m = getEffectiveStats(cell).maxHp.total - cell.hp;
                  return sum + Math.max(0, m);
                }
                return sum;
              }, 0);
              
              // Only trigger if at least one ally in this cluster is in danger (below 80% HP)
              const hasCriticalAlly = neighbors.some(n => {
                const cell = grid[n.r]?.[n.c];
                return cell && cell.alliance === 'player' && cell.hp < getEffectiveStats(cell).maxHp.total * 0.8;
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
        unit.runesCast[bestRune.name] = true;
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
              notify('COMBAT_DAMAGE', { attacker: { name: '⚡ Odin Rune' }, defender: cell });
              if (!STATE.combat.activeDoTs) STATE.combat.activeDoTs = [];
              STATE.combat.activeDoTs.push({ unit: cell, dmgPerTick: 5, ticksLeft: 3 });
              if (cell.hp <= 0) {
                if (grid[cell.row]?.[cell.col] === cell) { grid[cell.row][cell.col] = null; removeUnitFromRegistry(cell); if (cell.alliance === 'enemy') recordMonsterKill(cell.type); notify('COMBAT_DEATH', cell); }
              }
            }
          });
        } else if (rnName === 'thor') {
          // 50 direct + 10 splash + 2-tick stun
          rt.hp = Math.max(0, rt.hp - 50);
          notify('COMBAT_DAMAGE', { attacker: { name: '🔨 Thor Rune' }, defender: rt });
          getRadius1Cells(rt.row, rt.col).forEach(n => {
            const cell = grid[n.r]?.[n.c];
            if (cell && cell.alliance === 'enemy' && cell.hp > 0 && cell.id !== rt.id) {
              cell.hp = Math.max(0, cell.hp - 10);
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
              if (cell.alliance === 'enemy') recordMonsterKill(cell.type); notify('COMBAT_DEATH', cell);
            }
          });
        } else if (rnName === 'hel') {
          // Halve current HP
          rt.hp = Math.ceil(rt.hp / 2);
          notify('COMBAT_DAMAGE', { attacker: { name: '💀 Hel Rune' }, defender: rt });
          if (rt.hp <= 0 && grid[rt.row]?.[rt.col] === rt) {
            grid[rt.row][rt.col] = null; removeUnitFromRegistry(rt);
            if (rt.alliance === 'enemy') recordMonsterKill(rt.type); notify('COMBAT_DEATH', rt);
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
          // Heal all allies in radius 1 to full HP
          getRadius1Cells(rt.row, rt.col).forEach(n => {
            const cell = grid[n.r]?.[n.c];
            if (cell && cell.alliance === 'player' && cell.hp > 0) {
              const effMax = getEffectiveStats(cell).maxHp.total;
              cell.hp = effMax;
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
      }
      const attackCount = isDoubleAttack ? 2 : 1;

      for (let i = 0; i < attackCount; i++) {
        const currentTarget = (i === 0) ? target : (unit.isFleeing ? null : findTargetInLane(unit, gridSnapshot));
        if (!currentTarget || currentTarget.hp <= 0) break;

        let dmgTaken = getEffectiveStats(unit).dmg.total;

        // Heavy armor: reduces incoming damage by 1
        if (currentTarget.type === 'huskarl') {
          dmgTaken = Math.max(0, dmgTaken - 1);
        }

        // Freya Milestone 4: Shieldmaidens block 1 DMG per hit
        if (currentTarget.alliance === 'player' && currentTarget.type === 'shieldmaiden' && STATE.godQuests.freya?.[3]) {
          const m4Config = GC.modifiers.milestones.freya.find(m => m.index === 3);
          const blockAmount = m4Config?.blockAmount ?? 1;
          dmgTaken = Math.max(0, dmgTaken - blockAmount);
        }

        let nextHp = currentTarget.hp - dmgTaken;

        // Hel Milestone 2: Player units survive lethal hits once with 1 HP (once per battle)
        if (nextHp <= 0 && currentTarget.alliance === 'player' && STATE.godQuests.hel?.[1] && !currentTarget.hasSurvivedLethal) {
          const helM2 = GC.modifiers.milestones.hel.find(m => m.index === 1);
          if (helM2?.surviveLethal ?? true) {
            currentTarget.hasSurvivedLethal = true;
            nextHp = 1;
          }
        }

        currentTarget.hp = nextHp;
        notify('COMBAT_DAMAGE', { attacker: unit, defender: currentTarget });
        unit.isAttacking = true;
        setTimeout(() => { unit.isAttacking = false; }, 200);

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
        const stance = STATE.combat.stance || 'attack';
        if (stance === 'attack') dir = 1;
        else if (stance === 'retreat' || stance === 'defend') dir = -1;
        else shouldMove = false;
      }

      if (shouldMove) {
        const effectiveLeap = getEffectiveStats(unit).leap?.total || 0;
        const fullLeapVal = 1 + effectiveLeap;
        let leapVal = 1; // Default normal movement

        const isRetreatingOrFleeing = unit.isFleeing || (unit.alliance === 'player' && STATE.combat.stance === 'retreat');

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
          unit.col = lastValidCol;
          grid[unit.row][lastValidCol] = unit;
        }

        if (reachedBoundary) {
          const boundaryCol = unit.col + dir; // The column that crossed the boundary
          if (unit.alliance === 'player' && STATE.combat.stance === 'defend' && boundaryCol < 0) {
            // Hold at col 0
          } else {
            grid[unit.row][unit.col] = null;
            if (unit.alliance === 'player' && (unit.isFleeing || STATE.combat.stance === 'retreat') && boundaryCol < 0) {
              const poolUnit = { ...unit, hp: unit.hp, row: undefined, col: undefined, isFleeing: false };
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

function removeUnitFromRegistry(unit) {
  if (unit.alliance === 'player' && !unit.isCharmed && !unit.isUndead && !unit.isConfused) {
    const idx = STATE.band.findIndex(u => u.id === unit.id);
    if (idx !== -1) STATE.band.splice(idx, 1);
  } else {
    const idx = STATE.combat.waveMonsters.findIndex(m => m.id === unit.id);
    if (idx !== -1) STATE.combat.waveMonsters.splice(idx, 1);
  }
}

function handleUnitReachEnd(unit) {
  if (unit.alliance === 'player') {
    if (unit.isCharmed) {
      const idx = STATE.combat.waveMonsters.findIndex(m => m.id === unit.id);
      if (idx !== -1) STATE.combat.waveMonsters.splice(idx, 1);
      notify('COMBAT_UPDATE');
      checkCombatEndConditions();
      return;
    }
    if (unit.isUndead || unit.isConfused) {
      notify('COMBAT_UPDATE');
      return;
    }
    const reward = CFG.playerCrossReward;
    Object.entries(reward).forEach(([res, amt]) => adjustResource(res, amt));
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
      if (idx !== -1) STATE.combat.waveMonsters.splice(idx, 1);
    }
  }
}

export function togglePause() {
  STATE.combat.paused = !STATE.combat.paused;
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
  if (!STATE.combat.deployHistory) STATE.combat.deployHistory = [];
  STATE.combat.deployHistory.push(unit.id);
  STATE.combat.pool.splice(poolIndex, 1);
  STATE.combat.selectedPoolIndex = null;
  notify('COMBAT_UPDATE');
}

export function undeployUnit(row, col) {
  row = Number(row);
  col = Number(col);
  const unit = STATE.combat.grid[row][col];
  if (!unit || unit.alliance !== 'player' || unit.isCharmed || unit.isConfused || unit.isUndead) return;
  STATE.combat.grid[row][col] = null;
  unit.row = undefined;
  unit.col = undefined;
  STATE.combat.pool.push(unit);
  if (STATE.combat.deployHistory) {
    STATE.combat.deployHistory = STATE.combat.deployHistory.filter(id => id !== unit.id);
  }
  sortPoolByPoints();
  notify('COMBAT_UPDATE');
}

function checkCombatEndConditions() {
  const activeEnemies = STATE.combat.waveMonsters.filter(m => m.alliance === 'enemy' || m.isCharmed || m.isConfused);
  if (activeEnemies.length === 0) {
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
    if (locState && locState.placedTiles[coordKey]) {
      const tile = locState.placedTiles[coordKey];
      if (tile.entity && tile.entity.type === 'enemy_army') tile.entity.isDefeated = true;
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
  } else {
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

