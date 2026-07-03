/* ==========================================================================
   COMBAT LIFECYCLE MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE, notify, adjustResource, markSoldierDead, updateSoldierStat } from './state.js';
import { COMBAT_CONFIG as CFG } from './config/combat.js';
import { GODS_CONFIG as GC } from './config/gods.js';
import { sortPoolByPoints, checkAndAutoDeploy } from './combat_deployment.js';
import { spawnMonsterGroup } from './combat_spawner.js';
import { combatTick } from './combat.js';

let combatTimer = null;

export function getCombatTimer() {
  return combatTimer;
}

export function setCombatTimer(timer) {
  combatTimer = timer;
}

export function startCombat(locationId, coordKey, enemyData, combatTickCallback = combatTick) {
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

  const grid = [];
  for (let r = 0; r < CFG.gridRows; r++) {
    const row = [];
    for (let c = 0; c < CFG.gridCols; c++) row.push(null);
    grid.push(row);
  }
  STATE.combat.grid = grid;

  STATE.combat.pool = STATE.band.map(u => ({ ...u, maxHp: u.maxHp, hp: u.hp, currentHp: u.hp, alliance: 'player', selected: false }));
  sortPoolByPoints();

  STATE.combat.pool.forEach(u => {
    updateSoldierStat(u.id, 'combatsParticipated', 1);
  });

  const groups = enemyData.monsterGroups || [enemyData.monsters];
  STATE.combat.pendingSpawnGroups = [...groups];
  STATE.combat.spawnedCount = 0;
  STATE.combat.waveMonsters = [];

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

  if (STATE.combat.pendingSpawnGroups.length > 0) {
    const firstGroup = STATE.combat.pendingSpawnGroups.shift();
    spawnMonsterGroup(firstGroup, 0);
  }

  checkAndAutoDeploy();
  notify('COMBAT_START');
  combatTimer = setInterval(combatTickCallback, STATE.combat.combatIntervalMs || CFG.tickIntervalMs);
}

export function adjustCombatSpeed(newSpeedMs, combatTickCallback = combatTick) {
  STATE.combat.combatIntervalMs = newSpeedMs;
  if (STATE.combat.active && combatTimer) {
    clearInterval(combatTimer);
    combatTimer = setInterval(combatTickCallback, newSpeedMs);
  }
}

export function checkCombatEndConditions() {
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
  if (combatTimer) {
    clearInterval(combatTimer);
    combatTimer = null;
  }

  const coordKey = STATE.combat.entityCoordKey;
  const locId = STATE.combat.locationId;

  if (coordKey && coordKey.startsWith('roaming_')) {
    const bandId = coordKey.replace('roaming_', '');
    if (STATE.worldMap.roamingBands) {
      const band = STATE.worldMap.roamingBands.find(b => b.id === bandId);
      if (band) {
        if (isVictory) {
          band.isDefeated = true;
        } else {
          band.cooldownTicks = 3;
        }
      }
    }
  }

  if (isVictory) {
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
    for (const member of STATE.band) {
      updateSoldierStat(member.id, 'combatsWon', 1);
    }
  } else {
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
  if (combatTimer) {
    clearInterval(combatTimer);
    combatTimer = null;
  }

  const coordKey = STATE.combat.entityCoordKey;
  if (coordKey && coordKey.startsWith('roaming_')) {
    const bandId = coordKey.replace('roaming_', '');
    if (STATE.worldMap.roamingBands) {
      const band = STATE.worldMap.roamingBands.find(b => b.id === bandId);
      if (band) {
        band.cooldownTicks = 3;
      }
    }
  }

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
