/* ==========================================================================
   COMBAT ABILITIES MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { notify } from './state.js';

export const ABILITY_REGISTRY = {
  freeze_aura: (unit, ab, { grid, sizeR, sizeC }) => {
    // Passive freeze aura check (runs every tick)
    for (let r = 0; r < sizeR; r++) {
      for (let c = 0; c < sizeC; c++) {
        const cell = grid[r][c];
        if (cell && cell.alliance === 'player' && cell.hp > 0) {
          // Manhattan distance
          const dist = Math.abs(unit.row - r) + Math.abs(unit.col - c);
          if (dist <= ab.radius) {
            cell.frozenSlowLeft = 2;
            cell.frozenAttackSkipProbability = ab.attackSkipProbability !== undefined ? ab.attackSkipProbability : 1.0;
          }
        }
      }
    }
    return false; // Passive, doesn't consume turn
  },

  web_spit: (unit, ab, { gridSnapshot, findTargetInLane }) => {
    const target = findTargetInLane(unit, gridSnapshot);
    if (target && target.hp > 0 && Math.abs(target.col - unit.col) >= 2) {
      // Spit web
      target.rootedTicksLeft = ab.durationTicks;
      unit.abilityCooldowns[ab.type] = ab.cooldownTicks;
      notify('COMBAT_EFFECT_TRIGGER', { effect: 'monster_web_spit', unit: unit, target: target });
      return true; // Consumed action
    }
    return false;
  },

  lane_hop: (unit, ab, { grid, sizeR, sizeC }) => {
    const dir = unit.alliance === 'enemy' ? -1 : 1;
    const nextCol = unit.col + dir;
    if (nextCol >= 0 && nextCol < sizeC) {
      const blocker = grid[unit.row][nextCol];
      if (blocker && blocker.alliance !== unit.alliance) {
        // Lane is blocked! Choose adjacent lane with fewest player units
        const potentialRows = [unit.row - 1, unit.row + 1].filter(r => r >= 0 && r < sizeR);
        let bestRow = -1;
        let minCount = Infinity;

        potentialRows.forEach(r => {
          // Count player units in this lane
          let count = 0;
          for (let c = 0; c < sizeC; c++) {
            const cell = grid[r][c];
            if (cell && cell.alliance === 'player') {
              count++;
            }
          }
          if (count < minCount && !grid[r][unit.col]) {
            minCount = count;
            bestRow = r;
          }
        });

        if (bestRow !== -1) {
          grid[unit.row][unit.col] = null;
          const oldRow = unit.row;
          unit.row = bestRow;
          grid[bestRow][unit.col] = unit;
          unit.abilityCooldowns[ab.type] = ab.cooldownTicks;
          notify('COMBAT_EFFECT_TRIGGER', { effect: 'monster_lane_hop', unit: unit, oldRow: oldRow });
          return true;
        }
      }
    }
    return false;
  },

  ground_slam: (unit, ab, { grid, gridSnapshot, sizeR, findTargetInLane, removeUnitFromRegistry }) => {
    const target = findTargetInLane(unit, gridSnapshot);
    if (target && target.hp > 0) {
      const splashTargetRowMin = Math.max(0, unit.row - ab.splashRows);
      const splashTargetRowMax = Math.min(sizeR - 1, unit.row + ab.splashRows);
      const hitTargets = [];

      for (let r = splashTargetRowMin; r <= splashTargetRowMax; r++) {
        const cell = grid[r][target.col];
        if (cell && cell.alliance === 'player' && cell.hp > 0) {
          const slamDmg = Math.max(1, Math.floor(unit.dmg * ab.dmgMultiplier));
          cell.hp = Math.max(0, cell.hp - slamDmg);
          hitTargets.push({ row: cell.row, col: cell.col, unitName: cell.name });

          if (cell.hp <= 0) {
            grid[cell.row][cell.col] = null;
            removeUnitFromRegistry(cell);
            notify('COMBAT_DEATH', cell);
          }
        }
      }

      unit.abilityCooldowns[ab.type] = ab.cooldownTicks;
      notify('COMBAT_EFFECT_TRIGGER', { effect: 'monster_ground_slam', unit: unit, targets: hitTargets });
      return true;
    }
    return false;
  },

  acid_spit: () => {
    // Handled in combat loop hit hook
    return false;
  }
};
