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
      target.hp -= getEffectiveStats(unit).dmg.total;
      notify('COMBAT_DAMAGE', { attacker: unit, defender: target });
      unit.isAttacking = true;
      setTimeout(() => { unit.isAttacking = false; }, 200);
      if (target.hp <= 0) {
        grid[target.row][target.col] = null;
        removeUnitFromRegistry(target);
        if (target.alliance === 'enemy') {
          recordMonsterKill(target.type);
        }
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
  for (let r = 1; r <= getEffectiveStats(unit).range.total; r++) {
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

export function getEffectiveStats(unit) {
  const isPlayer = unit.alliance === 'player';
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
    range: { base: baseRange, bonus: bonusRange, total: Math.max(1, baseRange + bonusRange) }
  };
}
