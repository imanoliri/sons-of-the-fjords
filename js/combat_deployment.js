/* ==========================================================================
   COMBAT DEPLOYMENT MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE, notify, updateSoldierStat } from './state.js';
import { COMBAT_CONFIG as CFG } from './config/combat.js';

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

export function checkAndAutoDeploy() {
  if (!STATE.combat.active) return;
  if (!STATE.combat.plannedLayout) {
    STATE.combat.plannedLayout = Array.from({ length: CFG.gridRows }, () => Array(CFG.gridCols).fill(null));
  }

  const grid = STATE.combat.grid;
  const sizeR = CFG.gridRows;

  for (let r = 0; r < sizeR; r++) {
    const desiredCounts = {};
    for (let c = 0; c < CFG.gridCols; c++) {
      const type = STATE.combat.plannedLayout[r][c];
      if (type) {
        desiredCounts[type] = (desiredCounts[type] || 0) + 1;
      }
    }

    if (Object.keys(desiredCounts).length === 0) continue;

    const deployedCounts = {};
    for (let c = 0; c < CFG.gridCols; c++) {
      const cell = grid[r][c];
      if (cell && cell.alliance === 'player' && !cell.isCharmed && !cell.isConfused && !cell.isUndead) {
        deployedCounts[cell.type] = (deployedCounts[cell.type] || 0) + 1;
      }
    }

    for (const [type, reqCount] of Object.entries(desiredCounts)) {
      const currentCount = deployedCounts[type] || 0;
      let needed = reqCount - currentCount;
      if (needed <= 0) continue;

      while (needed > 0) {
        const poolIndex = STATE.combat.pool.findIndex(u => u.type === type);
        if (poolIndex === -1) break;

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

        if (targetCol === -1) break;

        const unit = STATE.combat.pool[poolIndex];
        unit.row = r;
        unit.col = targetCol;
        grid[r][targetCol] = unit;

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
