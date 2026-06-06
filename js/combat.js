/* ==========================================================================
   COMBAT MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE, notify, adjustResource } from './state.js';

let combatTimer = null;

export function sortPoolByPoints() {
  const basePoints = {
    berserker: 3,
    shieldmaiden: 2,
    huntsman: 1
  };
  STATE.combat.pool.sort((a, b) => {
    const pointsA = (basePoints[a.type] || 1) * (a.hp / a.maxHp);
    const pointsB = (basePoints[b.type] || 1) * (b.hp / b.maxHp);
    return pointsB - pointsA;
  });
}

// Initialize combat map grid & pool
// Initialize combat map grid & pool
export function startCombat(locationId, coordKey, enemyData) {
  STATE.combat.active = true;
  STATE.combat.paused = true; // Start paused to let player deploy
  STATE.combat.locationId = locationId;
  STATE.combat.entityCoordKey = coordKey;
  STATE.combat.fleeMode = false;
  STATE.combat.stance = 'attack';
  
  // 1. Initialize 10x8 Grid of cells
  const grid = [];
  for (let r = 0; r < 8; r++) {
    const row = [];
    for (let c = 0; c < 10; c++) {
      row.push(null); // No unit in cell
    }
    grid.push(row);
  }
  STATE.combat.grid = grid;

  // 2. Clone active band into Deployment Pool
  // We make shallow copies to keep track of HP changes
  STATE.combat.pool = STATE.band.map(u => ({
    ...u,
    maxHp: u.maxHp,
    hp: u.hp,
    currentHp: u.hp,
    alliance: 'player'
  }));
  sortPoolByPoints();

  // 3. Populate wave monsters on the far right
  const monsters = [];
  const startLanes = [0, 1, 2, 3, 4, 5, 6, 7];
  
  // Shuffle lanes to randomize spawn lanes
  shuffleArray(startLanes);

  let spawnIndex = 0;
  for (const m of enemyData.monsters) {
    for (let i = 0; i < m.count; i++) {
      const lane = startLanes[spawnIndex % 8];
      spawnIndex++;
      
      const stats = getMonsterStats(m.monsterClass);
      const mUnit = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: m.monsterClass,
        type: m.monsterClass,
        hp: stats.hp,
        maxHp: stats.hp,
        dmg: stats.dmg,
        speed: stats.speed,
        range: stats.range,
        alliance: 'enemy',
        row: lane,
        col: 9
      };
      
      monsters.push(mUnit);
      grid[lane][9] = mUnit;
    }
  }

  STATE.combat.waveMonsters = monsters;

  // Trigger UI mount
  notify('COMBAT_START');
  
  // Set up tick loop (runs every 600ms)
  combatTimer = setInterval(combatTick, 600);
}

// Tick execution: updates units movement, attacks, and bounds
function combatTick() {
  if (STATE.combat.paused || !STATE.combat.active) return;

  const grid = STATE.combat.grid;
  const sizeR = 8;
  const sizeC = 10;

  // We gather active units on board to evaluate actions
  const boardUnits = [];
  for (let r = 0; r < sizeR; r++) {
    for (let c = 0; c < sizeC; c++) {
      if (grid[r][c]) {
        boardUnits.push(grid[r][c]);
      }
    }
  }

  // Evaluate collisions and attacks first
  for (const unit of boardUnits) {
    // Check if unit is still alive (could have died earlier in the tick)
    if (unit.hp <= 0) continue;

    // Scan the unit's lane for opposing targets (only if not fleeing)
    const target = unit.isFleeing ? null : findTargetInLane(unit);
    if (target) {
      // Deal damage
      target.hp -= unit.dmg;
      notify('COMBAT_DAMAGE', { attacker: unit, defender: target });

      // Attack flash triggers
      unit.isAttacking = true;
      setTimeout(() => { unit.isAttacking = false; }, 200);

      // Check if target died
      if (target.hp <= 0) {
        grid[target.row][target.col] = null;
        removeUnitFromRegistry(target);
        notify('COMBAT_DEATH', target);
      }
    } else {
      // No target: Move based on stance
      let dir = 0;
      let shouldMove = true;
      if (unit.alliance === 'enemy') {
        dir = -1;
      } else if (unit.isFleeing) {
        dir = -1;
      } else {
        const stance = STATE.combat.stance || 'attack';
        if (stance === 'attack') {
          dir = 1;
        } else if (stance === 'retreat' || stance === 'defend') {
          dir = -1;
        } else {
          shouldMove = false; // Hold: stay in place
        }
      }

      if (shouldMove) {
        const nextCol = unit.col + dir;

        // Check if next column is within bounds
        if (nextCol >= 0 && nextCol < 10) {
          // Only move if space is empty
          if (!grid[unit.row][nextCol]) {
            grid[unit.row][unit.col] = null;
            unit.col = nextCol;
            grid[unit.row][nextCol] = unit;
          }
        } else {
          // Reached the end
          if (unit.alliance === 'player' && STATE.combat.stance === 'defend' && nextCol < 0) {
            // Defend stance: stop at column 0, do not exit
            // Do nothing
          } else {
            grid[unit.row][unit.col] = null;
            if (unit.alliance === 'player' && (unit.isFleeing || STATE.combat.stance === 'retreat') && nextCol < 0) {
              // Return to deployment pool
              const poolUnit = {
                ...unit,
                hp: unit.hp,
                row: undefined,
                col: undefined,
                isFleeing: false
              };
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

// Find target in current lane based on range
function findTargetInLane(unit) {
  const grid = STATE.combat.grid;
  const dir = unit.alliance === 'player' ? 1 : -1;
  
  // Scan forward in the lane up to the unit's range
  for (let r = 1; r <= unit.range; r++) {
    const checkCol = unit.col + (r * dir);
    if (checkCol >= 0 && checkCol < 10) {
      const cell = grid[unit.row][checkCol];
      if (cell && cell.alliance !== unit.alliance) {
        return cell;
      }
    }
  }
  
  // Fallback: check if there's any immediate blocker blockading lane
  const nextCol = unit.col + dir;
  if (nextCol >= 0 && nextCol < 10) {
    const nextCell = grid[unit.row][nextCol];
    if (nextCell && nextCell.alliance !== unit.alliance) {
      return nextCell;
    }
  }
  
  return null;
}

// Remove unit from band (player) or monsters wave (enemy)
function removeUnitFromRegistry(unit) {
  if (unit.alliance === 'player') {
    // Permanent death! Find and remove from the core band
    const idx = STATE.band.findIndex(u => u.id === unit.id);
    if (idx !== -1) {
      STATE.band.splice(idx, 1);
    }
  } else {
    // Remove from active wave monsters list
    const idx = STATE.combat.waveMonsters.findIndex(m => m.id === unit.id);
    if (idx !== -1) {
      STATE.combat.waveMonsters.splice(idx, 1);
    }
  }
}

// Handle what happens when a unit makes it across
function handleUnitReachEnd(unit) {
  if (unit.alliance === 'player') {
    // Player Unit Success
    adjustResource('gold', 1);
    
    // Return unit to deployment pool (resetting HP)
    const poolUnit = {
      ...unit,
      hp: unit.maxHp,
      row: undefined,
      col: undefined
    };
    STATE.combat.pool.push(poolUnit);
    sortPoolByPoints();
    notify('COMBAT_SUCCESS_REPLACE', unit);
  } else {
    // Enemy Breach: Drain random resource
    const resTypes = ['gold', 'food', 'wood', 'sheep'];
    const rType = resTypes[Math.floor(Math.random() * resTypes.length)];
    adjustResource(rType, -2);
    
    // Remove from wave list
    const idx = STATE.combat.waveMonsters.findIndex(m => m.id === unit.id);
    if (idx !== -1) {
      STATE.combat.waveMonsters.splice(idx, 1);
    }
    notify('COMBAT_BREACH', { unit, stolen: rType });
  }
}

// Pause combat to allow deployment selection
export function togglePause() {
  STATE.combat.paused = !STATE.combat.paused;
  notify('COMBAT_PAUSED');
}

// Place selected pool unit onto grid
export function deployUnit(poolIndex, row, col) {
  poolIndex = Number(poolIndex);
  row = Number(row);
  col = Number(col);

  if (col > 1) return; // Can only deploy on player home rows (col 0 and 1)
  if (STATE.combat.grid[row][col]) return; // Cell occupied

  const unit = STATE.combat.pool[poolIndex];
  if (!unit) return;

  // Assign position
  unit.row = row;
  unit.col = col;

  // Add to board grid
  STATE.combat.grid[row][col] = unit;
  
  // Remove from pool
  STATE.combat.pool.splice(poolIndex, 1);
  STATE.combat.selectedPoolIndex = null;

  notify('COMBAT_UPDATE');
}

// Return unit from grid back to deployment pool
export function undeployUnit(row, col) {
  row = Number(row);
  col = Number(col);

  const unit = STATE.combat.grid[row][col];
  if (!unit || unit.alliance !== 'player') return;

  // Clear cell
  STATE.combat.grid[row][col] = null;
  unit.row = undefined;
  unit.col = undefined;

  // Push back into pool
  STATE.combat.pool.push(unit);
  sortPoolByPoints();
  notify('COMBAT_UPDATE');
}

// End-game/win checks
function checkCombatEndConditions() {
  // 1. Victory Check: Wave empty and no enemies on board
  if (STATE.combat.waveMonsters.length === 0) {
    endCombat(true);
  }
  // 2. Defeat Check: Pool empty, and no player units remaining on board
  else {
    const hasPlayerUnitsOnBoard = STATE.combat.grid.some(row => 
      row.some(cell => cell && cell.alliance === 'player')
    );
    
    if (STATE.combat.pool.length === 0 && !hasPlayerUnitsOnBoard) {
      endCombat(false);
    }
  }
}

// Close and cleanup combat
export function endCombat(isVictory) {
  STATE.combat.active = false;
  STATE.combat.paused = true;
  clearInterval(combatTimer);
  combatTimer = null;

  if (isVictory) {
    // Update dungeon state: mark current coordinates node as defeated
    const locId = STATE.combat.locationId;
    const coordKey = STATE.combat.entityCoordKey;
    const locState = STATE.locations[locId];
    if (locState && locState.placedTiles[coordKey]) {
      const tile = locState.placedTiles[coordKey];
      if (tile.entity && tile.entity.type === 'enemy_army') {
        tile.entity.isDefeated = true;
      }
    }
    
    // Synchronize band HPs back to normal
    // If a unit survived combat, preserve its HP in the band
    const boardUnits = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 10; c++) {
        const cell = STATE.combat.grid[r][c];
        if (cell && cell.alliance === 'player') {
          boardUnits.push(cell);
        }
      }
    }
    
    // Match up remaining pool and board unit HPs to the core STATE.band
    for (const member of STATE.band) {
      const activeUnit = boardUnits.find(u => u.id === member.id) || STATE.combat.pool.find(u => u.id === member.id);
      if (activeUnit) {
        member.hp = Math.min(member.maxHp, activeUnit.hp);
      }
    }

    notify('COMBAT_VICTORY');
  } else {
    // Defeat: Clear active roster band (they all died)
    STATE.band = [];
    notify('COMBAT_DEFEAT');
  }
}

// Get Monster stats dictionary
function getMonsterStats(mClass) {
  const stats = {
    'Giant Brood-Spider': { hp: 20, dmg: 3, speed: 2, range: 2 },
    'Fenrir Pack Wolf': { hp: 25, dmg: 4, speed: 3, range: 1 },
    'Draugr Warrior': { hp: 35, dmg: 5, speed: 1, range: 1 },
    'Cave Troll': { hp: 70, dmg: 8, speed: 1, range: 1 },
    'Frost Giant (Jotunn)': { hp: 120, dmg: 10, speed: 1, range: 1 },
    'Lindwurm': { hp: 50, dmg: 6, speed: 2, range: 1 }
  };
  return stats[mClass] || { hp: 30, dmg: 4, speed: 2, range: 1 };
}

// Shuffling helper
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
