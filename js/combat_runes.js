/* ==========================================================================
   COMBAT RUNES MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE, notify, adjustResource, updateSoldierStat, recordSoldierRuneCast, recordSoldierKill } from './state.js';
import { getEffectiveStats } from './state.js';

export function runDivineRuneAI(unit, grid, sizeR, sizeC, runeTargetedCells, findTargetInLane, removeUnitFromRegistry, recordMonsterKill) {
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
        let bestCluster = null, bestCount = 0;
        for (const e of allEnemies) {
          const neighbors = getRadius1Cells(e.row, e.col);
          const count = neighbors.filter(n => grid[n.r]?.[n.c]?.alliance === 'enemy').length;
          if (count > bestCount) { bestCount = count; bestCluster = e; }
        }
        if (bestCluster) {
          const alreadyTargeted = getRadius1Cells(bestCluster.row, bestCluster.col)
            .some(n => runeTargetedCells.has(cellKey(n.r, n.c)));
          if (!alreadyTargeted) {
            score = bestCount * (25 + 15);
            runeTarget = bestCluster;
          }
        }
      }

      if (rune === 'thor') {
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
        let bestLoki = null, bestLokiScore = 0;
        for (const e of allEnemies) {
          const proximityScore = (sizeC - e.col) * 5;
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
          
          const enemyCount = allEnemies.filter(e => !e.isCharmed && !e.isConfused && !e.isUndead).length;
          const allyCount = allPlayerUnits.length;
          const ratioThreshold = enemyCount > allyCount ? 0.5 : 0.8;

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
    adjustResource('gold', -1);
    unit.runeCooldowns[bestRune.name] = 10;
    if (unit.alliance === 'player') {
      recordSoldierRuneCast(unit.id, bestRune.name);
    }
    const rt = bestRune.target;
    const rnName = bestRune.name;

    getRadius1Cells(rt.row, rt.col).forEach(n => runeTargetedCells.add(cellKey(n.r, n.c)));
    runeTargetedCells.add(cellKey(rt.row, rt.col));

    notify('COMBAT_EFFECT_TRIGGER', { effect: `rune_${rnName}`, unit: unit, target: rt });

    if (rnName === 'odin') {
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
            if (grid[cell.row]?.[cell.col] === cell) { 
              grid[cell.row][cell.col] = null; 
              removeUnitFromRegistry(cell); 
              if (cell.alliance === 'enemy') recordMonsterKill(cell.type); 
              if (unit.alliance === 'player') { recordSoldierKill(unit.id, cell.type); updateSoldierStat(unit.id, 'runeKills', 1); } 
              notify('COMBAT_DEATH', cell); 
            }
          }
        }
      });
    } else if (rnName === 'thor') {
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
      getRadius1Cells(rt.row, rt.col).forEach(n => {
        const cell = grid[n.r]?.[n.c];
        if (cell && cell.alliance === 'enemy' && cell.hp > 0) {
          cell.stunnedTicksLeft = 2;
        }
      });
      if (rt.hp > 0) rt.stunnedTicksLeft = 2;
      [rt, ...getRadius1Cells(rt.row, rt.col).map(n => grid[n.r]?.[n.c]).filter(Boolean)].forEach(cell => {
        if (cell && cell.hp <= 0 && grid[cell.row]?.[cell.col] === cell) {
          grid[cell.row][cell.col] = null; removeUnitFromRegistry(cell);
          if (cell.alliance === 'enemy') recordMonsterKill(cell.type); if (unit.alliance === 'player') { recordSoldierKill(unit.id, cell.type); updateSoldierStat(unit.id, 'runeKills', 1); } notify('COMBAT_DEATH', cell);
        }
      });
    } else if (rnName === 'hel') {
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
      if (grid[rt.row]?.[rt.col] === rt) {
        grid[rt.row][rt.col] = null;
        let placed = false;
        for (let c = sizeC - 1; c >= sizeC - 3; c--) {
          if (!grid[rt.row][c]) { rt.col = c; grid[rt.row][c] = rt; placed = true; break; }
        }
        if (!placed) { rt.col = sizeC - 1; grid[rt.row][sizeC - 1] = rt; }
      }
      notify('COMBAT_EFFECT_TRIGGER', { effect: 'loki_rune_teleport', unit: rt });
    } else if (rnName === 'freya') {
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
    return true; // Performed rune cast
  }

  return false;
}
