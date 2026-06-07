/* ==========================================================================
   COMBAT MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE, notify, adjustResource } from './state.js';
import { COMBAT_CONFIG as CFG } from './config/combat.js';

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

  let spawnIndex = 0;
  for (const m of enemyData.monsters) {
    for (let i = 0; i < m.count; i++) {
      const lane = startLanes[spawnIndex % CFG.gridRows];
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
        col: CFG.gridCols - 1
      };
      monsters.push(mUnit);
      grid[lane][CFG.gridCols - 1] = mUnit;
    }
  }

  STATE.combat.waveMonsters = monsters;
  notify('COMBAT_START');
  combatTimer = setInterval(combatTick, CFG.tickIntervalMs);
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

    const target = unit.isFleeing ? null : findTargetInLane(unit);
    if (target) {
      target.hp -= unit.dmg;
      notify('COMBAT_DAMAGE', { attacker: unit, defender: target });
      unit.isAttacking = true;
      setTimeout(() => { unit.isAttacking = false; }, 200);
      if (target.hp <= 0) {
        grid[target.row][target.col] = null;
        removeUnitFromRegistry(target);
        notify('COMBAT_DEATH', target);
      }
    } else {
      let dir = 0;
      let shouldMove = true;
      if (unit.alliance === 'enemy') {
        dir = -1;
      } else if (unit.isFleeing) {
        dir = -1;
      } else {
        const stance = STATE.combat.stance || 'attack';
        if (stance === 'attack') dir = 1;
        else if (stance === 'retreat' || stance === 'defend') dir = -1;
        else shouldMove = false;
      }

      if (shouldMove) {
        const nextCol = unit.col + dir;
        if (nextCol >= 0 && nextCol < sizeC) {
          if (!grid[unit.row][nextCol]) {
            grid[unit.row][unit.col] = null;
            unit.col = nextCol;
            grid[unit.row][nextCol] = unit;
          }
        } else {
          if (unit.alliance === 'player' && STATE.combat.stance === 'defend' && nextCol < 0) {
            // Hold at col 0
          } else {
            grid[unit.row][unit.col] = null;
            if (unit.alliance === 'player' && (unit.isFleeing || STATE.combat.stance === 'retreat') && nextCol < 0) {
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
  for (let r = 1; r <= unit.range; r++) {
    const checkCol = unit.col + (r * dir);
    if (checkCol >= 0 && checkCol < CFG.gridCols) {
      const cell = grid[unit.row][checkCol];
      if (cell && cell.alliance !== unit.alliance) return cell;
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
  if (unit.alliance === 'player') {
    const idx = STATE.band.findIndex(u => u.id === unit.id);
    if (idx !== -1) STATE.band.splice(idx, 1);
  } else {
    const idx = STATE.combat.waveMonsters.findIndex(m => m.id === unit.id);
    if (idx !== -1) STATE.combat.waveMonsters.splice(idx, 1);
  }
}

function handleUnitReachEnd(unit) {
  if (unit.alliance === 'player') {
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
    const idx = STATE.combat.waveMonsters.findIndex(m => m.id === unit.id);
    if (idx !== -1) STATE.combat.waveMonsters.splice(idx, 1);
    notify('COMBAT_BREACH', { unit, stolen: rType });
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

function getMonsterStats(mClass) {
  return CFG.monsters[mClass] || CFG.monsterFallback;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
