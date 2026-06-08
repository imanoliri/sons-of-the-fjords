/* ==========================================================================
   COMBAT MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE, notify, adjustResource, recordMonsterKill } from './state.js';
import { COMBAT_CONFIG as CFG } from './config/combat.js';
import { SOLDIERS_CONFIG } from './config/soldiers.js';
import { GODS_CONFIG as GC } from './config/gods.js';

let combatTimer = null;

export function sortPoolByPoints() {
  const pts = CFG.poolSortPoints;
  STATE.combat.pool.sort((a, b) => {
    const pA = (pts[a.type] || 1) * (a.hp / a.maxHp);
    const pB = (pts[b.type] || 1) * (b.hp / b.maxHp);
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
  if (STATE.godQuests.loki?.[2] && Math.random() < 0.25) {
    if (totalMonstersCount > 0) {
      confusedIndex = Math.floor(Math.random() * totalMonstersCount);
    }
  }

  // Loki Champion blessing: 25% chance overall to charm exactly one spawned monster in the combat wave
  let charmedIndex = -1;
  if (hasLokiBlessing && Math.random() < 0.25) {
    if (totalMonstersCount > 0) {
      charmedIndex = Math.floor(Math.random() * totalMonstersCount);
    }
  }

  let spawnIndex = 0;
  let spawnedCount = 0;
  for (const m of enemyData.monsters) {
    for (let i = 0; i < m.count; i++) {
      const lane = startLanes[spawnIndex % CFG.gridRows];
      spawnIndex++;
      const stats = getMonsterStats(m.monsterClass);

      const isCharmed = spawnedCount === charmedIndex;
      const isConfused = !isCharmed && spawnedCount === confusedIndex;
      spawnedCount++;

      let spawnCol = isCharmed ? CFG.gridCols - 2 : (isConfused ? CFG.gridCols - 2 : CFG.gridCols - 1);
      if (isCharmed || isConfused) {
        // Find first unoccupied column from the right side start
        for (let c = CFG.gridCols - 2; c >= 0; c--) {
          if (!grid[lane][c]) {
            spawnCol = c;
            break;
          }
        }
      }

      if (isCharmed) {
        notify('COMBAT_EFFECT_TRIGGER', { effect: 'loki_charm', unit: { name: m.monsterClass } });
      } else if (isConfused) {
        notify('COMBAT_EFFECT_TRIGGER', { effect: 'loki_confuse', unit: { name: m.monsterClass } });
      }

      const mUnit = {
        id: Date.now() + "_" + spawnedCount + "_" + Math.floor(Math.random() * 1000),
        name: m.monsterClass + (isCharmed ? ' 🌀' : (isConfused ? ' 😵' : '')),
        type: m.monsterClass,
        hp: stats.hp,
        maxHp: stats.hp,
        dmg: stats.dmg,
        speed: stats.speed,
        range: stats.range,
        alliance: (isCharmed || isConfused) ? 'player' : 'enemy',
        isCharmed: isCharmed,
        charmedTicksLeft: isCharmed ? 2 : 0,
        isConfused: isConfused,
        confusedTicksLeft: isConfused ? 2 : 0,
        row: lane,
        col: spawnCol
      };
      monsters.push(mUnit);
      grid[lane][spawnCol] = mUnit;
    }
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

// Tick execution: updates units movement, attacks, and bounds
function combatTick() {
  if (STATE.combat.paused || !STATE.combat.active) return;

  const grid = STATE.combat.grid;
  const sizeR = CFG.gridRows;
  const sizeC = CFG.gridCols;

  const boardUnits = [];
  for (let r = 0; r < sizeR; r++)
    for (let c = 0; c < sizeC; c++)
      if (grid[r][c]) boardUnits.push(grid[r][c]);

  for (const unit of boardUnits) {
    if (unit.hp <= 0) continue;

    // Freya Milestone 2: Any unit below 25% HP heals 1 HP/tick
    if (unit.alliance === 'player' && STATE.godQuests.freya?.[1]) {
      const effStats = getEffectiveStats(unit);
      if (unit.hp < effStats.maxHp.total * 0.25) {
        unit.hp = Math.min(effStats.maxHp.total, unit.hp + 1);
      }
    }

    // Freya Champion Blessing: Shieldmaidens heal 2 HP per tick when not in melee
    if (unit.alliance === 'player' && unit.type === 'shieldmaiden') {
      const isFreyaActive = STATE.activeBlessing === 'freya' || (STATE.permanentlyActivatedBlessings && STATE.permanentlyActivatedBlessings.includes('freya'));
      if (isFreyaActive) {
        const currentTarget = findTargetInLane(unit);
        // "not in melee": target is null or distance to target is greater than 1
        const inMelee = currentTarget && Math.abs(currentTarget.col - unit.col) <= 1;
        if (!inMelee) {
          const effStats = getEffectiveStats(unit);
          unit.hp = Math.min(effStats.maxHp.total, unit.hp + 2);
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

    const target = unit.isFleeing ? null : findTargetInLane(unit);
    if (target) {
      // Loki Milestone 2: Enemy attack speed reduced by 10% (10% miss chance)
      if (unit.alliance === 'enemy' && STATE.godQuests.loki?.[1] && Math.random() < 0.10) {
        notify('COMBAT_EFFECT_TRIGGER', { effect: 'loki_miss', unit: unit });
        continue; // Skip attack this tick
      }
      // Hel Milestone 4: Enemy attack speed reduced by 10% (10% miss chance)
      if (unit.alliance === 'enemy' && STATE.godQuests.hel?.[3] && Math.random() < 0.10) {
        notify('COMBAT_EFFECT_TRIGGER', { effect: 'hel_miss', unit: unit });
        continue; // Skip attack this tick
      }

      // Thor Milestone 3: Player units attack speed increased by 10% (10% chance to attack again)
      const isPlayer = unit.alliance === 'player';
      const hasThorAttackSpeed = isPlayer && STATE.godQuests.thor?.[2];
      const isDoubleAttack = hasThorAttackSpeed && Math.random() < 0.10;
      if (isDoubleAttack) {
        notify('COMBAT_EFFECT_TRIGGER', { effect: 'thor_double', unit: unit });
      }
      const attackCount = isDoubleAttack ? 2 : 1;

      for (let i = 0; i < attackCount; i++) {
        const currentTarget = (i === 0) ? target : (unit.isFleeing ? null : findTargetInLane(unit));
        if (!currentTarget) break;

        let dmgTaken = getEffectiveStats(unit).dmg.total;

        // Freya Milestone 4: Shieldmaidens block 1 DMG per hit
        if (currentTarget.alliance === 'player' && currentTarget.type === 'shieldmaiden' && STATE.godQuests.freya?.[3]) {
          dmgTaken = Math.max(0, dmgTaken - 1);
        }

        let nextHp = currentTarget.hp - dmgTaken;

        // Hel Milestone 2: Player units survive lethal hits once with 1 HP (once per battle)
        if (nextHp <= 0 && currentTarget.alliance === 'player' && STATE.godQuests.hel?.[1] && !currentTarget.hasSurvivedLethal) {
          currentTarget.hasSurvivedLethal = true;
          nextHp = 1;
        }

        currentTarget.hp = nextHp;
        notify('COMBAT_DAMAGE', { attacker: unit, defender: currentTarget });
        unit.isAttacking = true;
        setTimeout(() => { unit.isAttacking = false; }, 200);
        if (currentTarget.hp <= 0) {
          grid[currentTarget.row][currentTarget.col] = null;
          removeUnitFromRegistry(currentTarget);
          if (currentTarget.alliance === 'enemy') {
            recordMonsterKill(currentTarget.type);

            // Hel Milestone 3: Slain enemies drop +1 extra Gold
            if (STATE.godQuests.hel?.[2]) {
              adjustResource('gold', 1);
            }

            const activeBlessings = new Set();
            if (STATE.activeBlessing) activeBlessings.add(STATE.activeBlessing);
            if (STATE.permanentlyActivatedBlessings) {
              STATE.permanentlyActivatedBlessings.forEach(b => activeBlessings.add(b));
            }
            if (activeBlessings.has('hel') && Math.random() < 0.5) {
              const undead = {
                id: Date.now() + Math.floor(Math.random() * 1000),
                name: 'Draugr (Undead) 💀',
                type: 'Draugr Warrior',
                hp: 15,
                maxHp: 15,
                dmg: 4,
                speed: 1,
                range: 1,
                alliance: 'player',
                isUndead: true,
                undeadTicksLeft: 3,
                row: currentTarget.row,
                col: currentTarget.col
              };
              grid[currentTarget.row][currentTarget.col] = undead;
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
        if (STATE.godQuests.hel?.[3] && Math.random() < 0.10) {
          shouldMove = false;
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
                  const cell = grid[r][testCol];
                  if (cell && cell.alliance !== unit.alliance) {
                    // If the enemy has no target in range, they will move 1 step forward (moving)
                    const isMoving = !findTargetInLane(cell);
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
                const engaged = findTargetInLane(cell);
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
              const engaged = findTargetInLane(obstacle);
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

function findTargetInLane(unit) {
  const grid = STATE.combat.grid;
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
            const manhattan = colDist + Math.abs(unit.row - rToCheck);
            const priorityDist = (rToCheck === unit.row) ? (manhattan - 1) : manhattan;

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
    if (bestTarget) return bestTarget;
  } else {
    for (let r = 1; r <= range; r++) {
      const checkCol = unit.col + (r * dir);
      if (checkCol >= 0 && checkCol < CFG.gridCols) {
        const cell = grid[unit.row][checkCol];
        if (cell && cell.alliance !== unit.alliance) return cell;
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
  STATE.combat.pool.splice(poolIndex, 1);
  STATE.combat.selectedPoolIndex = null;
  notify('COMBAT_UPDATE');
}

export function undeployUnit(row, col) {
  row = Number(row);
  col = Number(col);
  const unit = STATE.combat.grid[row][col];
  if (!unit || unit.alliance !== 'player') return;
  STATE.combat.grid[row][col] = null;
  unit.row = undefined;
  unit.col = undefined;
  STATE.combat.pool.push(unit);
  sortPoolByPoints();
  notify('COMBAT_UPDATE');
}

function checkCombatEndConditions() {
  if (STATE.combat.waveMonsters.length === 0) {
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

export function getEffectiveStats(unit) {
  const isPlayer = unit.alliance === 'player' || ['shieldmaiden', 'berserker', 'huntsman'].includes(unit.type);
  let baseMaxHp = unit.maxHp;
  let baseDmg = unit.dmg;
  let baseSpeed = unit.speed;
  let baseRange = unit.range;

  if (isPlayer) {
    const base = SOLDIERS_CONFIG.recruitStats[unit.type];
    if (base) {
      baseMaxHp = base.maxHp;
      baseDmg = base.dmg;
      baseSpeed = base.speed;
      baseRange = base.range;
    }
  } else {
    const base = CFG.monsters[unit.type] || CFG.monsterFallback;
    if (base) {
      baseMaxHp = base.hp;
      baseDmg = base.dmg;
      baseSpeed = base.speed;
      baseRange = base.range;
    }
  }

  let bonusMaxHp = 0;
  let bonusDmg = 0;
  let bonusSpeed = 0;
  let bonusRange = 0;
  let bonusLeap = 0;

  if (isPlayer) {
    // Apply Active and Permanently Activated Blessing modifiers
    const activeBlessings = new Set();
    if (STATE.activeBlessing) {
      activeBlessings.add(STATE.activeBlessing);
    }
    if (STATE.permanentlyActivatedBlessings) {
      STATE.permanentlyActivatedBlessings.forEach(b => activeBlessings.add(b));
    }

    for (const blessing of activeBlessings) {
      if (GC.modifiers.blessings[blessing]) {
        const bMod = GC.modifiers.blessings[blessing];
        if (bMod.targetType === 'all' || bMod.targetType === unit.type) {
          if (bMod.maxHp) bonusMaxHp += bMod.maxHp;
          if (bMod.dmg) bonusDmg += bMod.dmg;
          if (bMod.speed) bonusSpeed += bMod.speed;
          if (bMod.range) bonusRange += bMod.range;
          if (bMod.leap) bonusLeap += bMod.leap;
        }
      }
    }

    // Apply Quest Milestone modifiers
    for (const godName of Object.keys(STATE.godQuests)) {
      const track = STATE.godQuests[godName];
      const godMiles = GC.modifiers.milestones[godName];
      if (godMiles) {
        for (const mMod of godMiles) {
          if (track[mMod.index]) {
            if (mMod.targetType === 'all' || mMod.targetType === unit.type) {
              if (mMod.maxHp) bonusMaxHp += mMod.maxHp;
              if (mMod.dmg) bonusDmg += mMod.dmg;
              if (mMod.speed) bonusSpeed += mMod.speed;
              if (mMod.range) bonusRange += mMod.range;
              if (mMod.leap) bonusLeap += mMod.leap;
            }
          }
        }
      }
    }
  } else {
    // Enemy units
    // Hel milestone 1: Enemies deal -1 DMG
    if (STATE.godQuests.hel?.[0]) {
      bonusDmg -= 1;
    }
  }

  return {
    hp: unit.hp,
    maxHp: { base: baseMaxHp, bonus: bonusMaxHp, total: Math.max(1, baseMaxHp + bonusMaxHp) },
    dmg: { base: baseDmg, bonus: bonusDmg, total: Math.max(0, baseDmg + bonusDmg) },
    speed: { base: baseSpeed, bonus: bonusSpeed, total: Math.max(0, baseSpeed + bonusSpeed) },
    range: { base: baseRange, bonus: bonusRange, total: Math.max(1, baseRange + bonusRange) },
    leap: { base: 0, bonus: bonusLeap, total: Math.max(0, 0 + bonusLeap) }
  };
}
