/* ==========================================================================
   COMBAT MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE, notify, adjustResource, getEffectiveStats, updateSoldierStat, recordSoldierKill, recordSoldierRuneCast, markSoldierDead, addSoldierEvent } from './state.js';
import { COMBAT_CONFIG as CFG } from './config/combat.js';
import { SOLDIERS_CONFIG } from './config/soldiers.js';
import { GODS_CONFIG as GC } from './config/gods.js';
import { ABILITY_REGISTRY } from './combat_abilities.js';
import { runDivineRuneAI } from './combat_runes.js';
import { sortPoolByPoints, checkAndAutoDeploy } from './combat_deployment.js';
import { spawnMonsterGroup, removeUnitFromRegistry, checkGroupDefeated, handleUnitReachEnd } from './combat_spawner.js';
import { checkCombatEndConditions, getCombatTimer, setCombatTimer } from './combat_lifecycle.js';

// Re-export lifecycles and deployments to keep public APIs intact for ui/bindings.js
export { deployUnit, undeployUnit, checkAndAutoDeploy, sortPoolByPoints } from './combat_deployment.js';
export { startCombat, adjustCombatSpeed, endCombat, fleeCombat, togglePause } from './combat_lifecycle.js';

function getMonsterStats(mClass) {
  return CFG.monsters[mClass] || CFG.monsterFallback;
}

function processMonsterAbilities(unit, grid, gridSnapshot, sizeR, sizeC) {
  const stats = getMonsterStats(unit.type);
  if (!stats || !stats.abilities) return false;

  let consumedAction = false;
  const context = { 
    grid, 
    gridSnapshot, 
    sizeR, 
    sizeC,
    findTargetInLane,
    removeUnitFromRegistry
  };

  for (const ab of stats.abilities) {
    const handler = ABILITY_REGISTRY[ab.type];
    if (!handler) continue;

    // Run passive effects immediately
    if (ab.type === 'freeze_aura') {
      handler(unit, ab, context);
      continue;
    }

    // Cooldown management
    if (unit.abilityCooldowns[ab.type] === undefined) {
      unit.abilityCooldowns[ab.type] = 0;
    }
    if (unit.abilityCooldowns[ab.type] > 0) {
      unit.abilityCooldowns[ab.type]--;
      continue;
    }

    // Dispatch to registered handler strategy
    const fired = handler(unit, ab, context);
    if (fired) {
      consumedAction = true;
      break; 
    }
  }

  return consumedAction;
}

export function combatTick() {
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

    if (unit.alliance === 'enemy') {
      const consumedTurn = processMonsterAbilities(unit, grid, gridSnapshot, sizeR, sizeC);
      if (consumedTurn) continue;
    }

    const target = unit.isFleeing ? null : findTargetInLane(unit, gridSnapshot);

    // ---- RUNECASTER: Divine Rune AI ----
    if (unit.type === 'runecaster' && unit.alliance === 'player' && !unit.isFleeing) {
      const cast = runDivineRuneAI(
        unit,
        grid,
        sizeR,
        sizeC,
        runeTargetedCells,
        findTargetInLane,
        removeUnitFromRegistry,
        recordMonsterKill
      );
      if (cast) {
        continue; 
      }
    }

    if (target && target.hp > 0) {
      if (unit.frozenSlowLeft > 0) {
        unit.frozenSlowLeft--;
        unit.frozenSkipThisTick = !unit.frozenSkipThisTick;
        if (unit.frozenSkipThisTick) {
          const skipProb = unit.frozenAttackSkipProbability !== undefined ? unit.frozenAttackSkipProbability : 1.0;
          if (Math.random() < skipProb) {
            notify('COMBAT_EFFECT_TRIGGER', { effect: 'monster_freeze_aura_slowed', unit: unit });
            continue; 
          }
        }
      }

      if (unit.alliance === 'enemy' && STATE.godQuests.loki?.[1]) {
        const lokiM2 = GC.modifiers.milestones.loki.find(m => m.index === 1);
        const missChance = lokiM2?.enemyMissChance ?? 0.10;
        if (Math.random() < missChance) {
          notify('COMBAT_EFFECT_TRIGGER', { effect: 'loki_miss', unit: unit });
          continue; 
        }
      }
      if (unit.alliance === 'enemy' && STATE.godQuests.hel?.[3]) {
        const helM4 = GC.modifiers.milestones.hel.find(m => m.index === 3);
        const missChance = helM4?.enemyMissChance ?? 0.10;
        if (Math.random() < missChance) {
          notify('COMBAT_EFFECT_TRIGGER', { effect: 'hel_miss', unit: unit });
          continue; 
        }
      }

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

        const acidDebuff = currentTarget.armorDebuff || 0;
        const acidMultiplier = currentTarget.acidDmgIncreasePerStack !== undefined ? currentTarget.acidDmgIncreasePerStack : 1;
        dmgTaken = dmgTaken + (acidDebuff * acidMultiplier);

        if (currentTarget.type === 'huskarl') {
          dmgTaken = Math.max(0, dmgTaken - 1);
          notify('COMBAT_EFFECT_TRIGGER', { effect: 'huskarl_armor', unit: currentTarget });
          if (currentTarget.alliance === 'player') {
            updateSoldierStat(currentTarget.id, 'blockedHits', 1);
            updateSoldierStat(currentTarget.id, 'damageBlocked', 1);
          }
        }

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

        if (unit.alliance === 'enemy') {
          const attackerStats = getMonsterStats(unit.type);
          const acidAbility = attackerStats.abilities?.find(a => a.type === 'acid_spit');
          if (acidAbility) {
            const currentStacks = currentTarget.armorDebuff || 0;
            if (currentStacks < acidAbility.maxStacks) {
              currentTarget.armorDebuff = currentStacks + 1;
              currentTarget.acidDmgIncreasePerStack = acidAbility.dmgIncreasePerStack !== undefined ? acidAbility.dmgIncreasePerStack : 1;
              notify('COMBAT_EFFECT_TRIGGER', { effect: 'monster_acid_spit', unit: currentTarget, attacker: unit, stacks: currentTarget.armorDebuff });
            }
          }
        }

        let nextHp = currentTarget.hp - dmgTaken;

        if (nextHp <= 0 && currentTarget.alliance === 'player' && STATE.godQuests.hel?.[1] && !currentTarget.hasSurvivedLethal) {
          const helM2 = GC.modifiers.milestones.hel.find(m => m.index === 1);
          if (helM2?.surviveLethal ?? true) {
            currentTarget.hasSurvivedLethal = true;
            nextHp = 1;
            notify('COMBAT_EFFECT_TRIGGER', { effect: 'hel_survive', unit: currentTarget });
          }
        }

        currentTarget.hp = nextHp;
        if (currentTarget.alliance === 'player') {
          updateSoldierStat(currentTarget.id, 'damageReceived', dmgTaken);
        }
        if (unit.alliance === 'enemy' && currentTarget.alliance === 'player') {
          currentTarget._lastAttackerName = unit.type || unit.name;
        }
        notify('COMBAT_DAMAGE', { attacker: unit, defender: currentTarget });
        unit.isAttacking = true;
        setTimeout(() => { unit.isAttacking = false; }, 200);
        if (unit.alliance === 'player') {
          updateSoldierStat(unit.id, 'attacksMade', 1);
          updateSoldierStat(unit.id, 'damageDealt', dmgTaken);
        }

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
            if (unit.alliance === 'player') {
              recordSoldierKill(unit.id, currentTarget.type);
            }
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

      if (unit.rootedTicksLeft > 0) {
        unit.rootedTicksLeft--;
        shouldMove = false;
      }

      if (shouldMove) {
        const effectiveLeap = getEffectiveStats(unit).leap?.total || 0;
        const fullLeapVal = 1 + effectiveLeap;
        let leapVal = 1; 

        const isRetreatingOrFleeing = unit.isFleeing || (unit.alliance === 'player' && stance === 'retreat');

        if (!isRetreatingOrFleeing && effectiveLeap > 0) {
          let canLeap = false;

          if (unit.alliance === 'player' && dir === 1 && unit.col + fullLeapVal >= sizeC) {
            canLeap = true;
          } else if (unit.alliance === 'enemy' && dir === -1 && unit.col - fullLeapVal < 0) {
            canLeap = true;
          }

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
            
            if (leapVal === 1) {
              break;
            }
            
            if (unit.type === 'berserker' && !berserkerPushedAlly) {
              const engaged = findTargetInLane(obstacle, gridSnapshot);
              if (engaged) {
                const pushDir = -dir;
                let pushChain = [];
                let currentPushCol = obstacle.col;
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
                      pushChain.push(other);
                      break;
                    } else {
                      pushChain.push(other);
                      currentPushCol = checkCol;
                    }
                  } else {
                    break;
                  }
                }

                if (pushPossible) {
                  const fullChain = [obstacle, ...pushChain];
                  const selfIndex = fullChain.findIndex(u => u.id === unit.id);
                  const pushList = selfIndex !== -1 ? fullChain.slice(0, selfIndex) : fullChain;

                  pushList.forEach(u => {
                    grid[u.row][u.col] = null;
                  });
                  pushList.forEach(u => {
                    u.col = u.col + pushDir;
                    grid[u.row][u.col] = u;
                  });

                  lastValidCol = testCol;
                  berserkerPushedAlly = true;
                  break;
                }
              }
            }
            continue;
          }
          lastValidCol = testCol;
        }

        if (lastValidCol !== unit.col) {
          if (grid[unit.row][unit.col] === unit) {
            grid[unit.row][unit.col] = null;
          }
          const isLeaping = leapVal > 1;
          const oldCol = unit.col;
          unit.col = lastValidCol;
          grid[unit.row][lastValidCol] = unit;

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

          if (unit.alliance === 'player' && !unit.isCharmed && !unit.isConfused && !unit.isUndead) {
            const r = unit.row;
            const c = unit.col;
            if (c < 10 && STATE.combat.plannedLayout && STATE.combat.plannedLayout[r]?.[c] === unit.type) {
              unit.stance = 'hold';
            }
          }
        }

        if (reachedBoundary) {
          const boundaryCol = unit.col + dir; 
          const stance = unit.stance || STATE.combat.stance || 'attack';
          if (unit.alliance === 'player' && stance === 'defend' && boundaryCol < 0) {
            // Keep defending
          } else {
            grid[unit.row][unit.col] = null;
            if (unit.alliance === 'player' && (unit.isFleeing || stance === 'retreat') && boundaryCol < 0) {
              const poolUnit = { ...unit, hp: unit.hp, row: undefined, col: undefined, isFleeing: false };
              delete poolUnit.stance;
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

export function findTargetInLane(unit, grid = STATE.combat.grid) {
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
      return bestTarget;
    }
  } else {
    for (let r = 1; r <= range; r++) {
      const checkCol = unit.col + (r * dir);
      if (checkCol >= 0 && checkCol < CFG.gridCols) {
        const cell = grid[unit.row][checkCol];
        if (cell && cell.alliance !== unit.alliance) {
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
