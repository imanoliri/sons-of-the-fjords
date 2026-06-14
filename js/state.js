/* ==========================================================================
   STATE MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { SOLDIERS_CONFIG as SC } from './config/soldiers.js';
import { GODS_CONFIG as GC } from './config/gods.js';
import { WORLD_CONFIG as WC } from './config/world.js';
import { COMBAT_CONFIG as CC } from './config/combat.js';

// Event emitter subscription list
const listeners = [];

// Helper: build clean godFavor/godQuests objects from config
function makeGodFavor() {
  return Object.fromEntries(Object.keys(GC.lore).map(g => [g, 0]));
}
function makeGodQuests() {
  return Object.fromEntries(Object.keys(GC.lore).map(g => [g, [false, false, false, false, false]]));
}
// Helper: deep-clone starting band from config
function makeStartingBand() {
  return SC.startingBand.map(u => ({ ...u }));
}

export const STATE = {
  activeScreen: 'menu', // 'menu' | 'world' | 'town' | 'location' | 'combat'

  resources: { ...SC.startingResources },

  band: makeStartingBand(),

  inventory: [], // Collected items and magic objects

  // World Map State
  worldMap: {
    tiles: [],
    revealed: [],
    locations: {}
  },

  // Location Map States (Keyed by locationId)
  locations: {},

  // Active coordinates
  party: {
    worldX: WC.partyStart.x,
    worldY: WC.partyStart.y,
    currentLocationId: null,
    localX: 0,
    localY: 0
  },

  // Deity Favor (favorMin to favorMax)
  godFavor: makeGodFavor(),

  // Deity Quest Milestones (5 steps per god)
  godQuests: makeGodQuests(),

  // Order in which gods reached milestone 5
  milestone5Order: [],

  // Counters for alternate favor gains
  odinWolvesKilled: 0,
  odinGiantsKilled: 0,
  thorDraugrsKilled: 0,
  thorLindwurmsKilled: 0,
  freyaSheepSold: 0,
  freyaWoodSold: 0,

  // Current global game day
  day: 1,

  // Active Champion Buff
  activeBlessing: null,
  permanentlyActivatedBlessings: [],

  // Combat details
  combat: {
    active: false,
    grid: [],
    pool: [],
    paused: true,
    ticker: null,
    selectedPoolIndex: null,
    spawnTimer: 0,
    locationId: null,
    entityCoordKey: null,
    waveMonsters: [],
    stance: 'attack',
    combatIntervalMs: 600,
    formationOrder: ['shieldmaiden', 'berserker', 'huntsman', 'huskarl']
  }
};

/* --- State Methods --- */

export function subscribe(fn) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export function notify(event, data = null) {
  for (const listener of listeners) listener(event, data);
}

// Modify screen state
export function setScreen(screenName) {
  STATE.activeScreen = screenName;
  notify('SCREEN_CHANGE', screenName);
}

// Check for resource additions/deductions
export function adjustResource(type, amt) {
  if (STATE.resources[type] !== undefined) {
    STATE.resources[type] = Math.max(0, STATE.resources[type] + amt);
    notify('RESOURCES_UPDATED');
    if (STATE.band.length === 0 && STATE.resources.gold === 0 && !STATE.combat.active) {
      notify('GAME_OVER');
    }
  }
}

// Recruitment Helper
export function recruitSoldier(type) {
  const namePool = SC.recruitNames[type] || [];
  const rName = namePool[Math.floor(Math.random() * namePool.length)] || type;
  const id = Date.now() + Math.floor(Math.random() * 100);
  const base = SC.recruitStats[type] || {};
  let maxHp = base.maxHp;
  let hp = base.hp;
  if (STATE.godFavor.freya === -5) {
    const penalty = Math.abs(GC.modifiers.wrath.freya.maxHpPenalty || -10);
    maxHp = Math.max(10, maxHp - penalty);
    hp = Math.max(10, hp - penalty);
  }
  STATE.band.push({ id, name: rName, type, ...base, maxHp, hp });
  notify('RESOURCES_UPDATED');
}

// Sacrifice Magic Objects
export function sacrificeRelic(relicId, godName) {
  const idx = STATE.inventory.indexOf(relicId);
  if (idx !== -1) {
    STATE.inventory.splice(idx, 1);
    if (STATE.godFavor[godName] >= 5) {
      adjustResource('gold', 5);
      notify('RELIC_SACRIFICED_GOLD', { relicId, godName, goldGained: 5 });
    } else {
      adjustFavor(godName, 1);
      notify('RELIC_SACRIFICED', { relicId, godName });
    }
  }
}

// Pentagram dynamic shifting favor logic
export function adjustFavor(godName, amt) {
  // If this god's quest line is fully complete, we don't gain more favor or trigger opponents' drain
  if (amt > 0 && STATE.godQuests[godName] && STATE.godQuests[godName].every(x => x === true)) {
    return;
  }

  const opposites = GC.pentagramOpposites;
  const current = STATE.godFavor[godName];

  const nextFavor = Math.min(GC.favorMax, Math.max(GC.favorMin, current + amt));
  STATE.godFavor[godName] = nextFavor;

  if (amt > 0) {
    const track = STATE.godQuests[godName];
    let emptyIndex = track.indexOf(false);
    while (emptyIndex !== -1 && emptyIndex < nextFavor) {
      track[emptyIndex] = true;
      notify('QUEST_MILESTONE', { god: godName, index: emptyIndex });
      emptyIndex = track.indexOf(false);
    }
    if (track.every(x => x === true)) {
      if (!STATE.milestone5Order) STATE.milestone5Order = [];
      if (!STATE.milestone5Order.includes(godName)) {
        STATE.milestone5Order.push(godName);
      }
      notify('GOD_QUESTS_COMPLETE', godName);
      const allGodsCompleted = Object.values(STATE.godQuests).every(t => t.every(x => x === true));
      if (allGodsCompleted) {
        notify('ASCENSION_TRIGGERED', godName);
      }
    }
  }

  if (amt > 0 && nextFavor > current) {
    const oppList = opposites[godName] || [];
    for (const opp of oppList) {
      const oppTrack = STATE.godQuests[opp];
      if (!oppTrack.every(x => x === true)) {
        STATE.godFavor[opp] = Math.max(GC.favorMin, STATE.godFavor[opp] - 1);
      }
    }
  }

  notify('FAVOR_UPDATED');
}

// Record monster kills to award alternative favor
export function recordMonsterKill(monsterType) {
  const nameLower = monsterType.toLowerCase();
  const targets = GC.alternativeFavor;

  if (nameLower.includes('wolf')) {
    STATE.odinWolvesKilled = (STATE.odinWolvesKilled || 0) + 1;
    if (STATE.odinWolvesKilled >= targets.odin.wolvesTarget) {
      STATE.odinWolvesKilled = 0;
      adjustFavor('odin', 1);
      notify('FAVOR_GAIN_ACTION', { god: 'odin', reason: `slaying ${targets.odin.wolvesTarget} wolves` });
    }
  } else if (nameLower.includes('frost giant') || nameLower.includes('jotunn')) {
    STATE.odinGiantsKilled = (STATE.odinGiantsKilled || 0) + 1;
    if (STATE.odinGiantsKilled >= targets.odin.giantsTarget) {
      STATE.odinGiantsKilled = 0;
      adjustFavor('odin', 1);
      notify('FAVOR_GAIN_ACTION', { god: 'odin', reason: 'slaying a giant' });
    }
  }

  if (nameLower.includes('draugr')) {
    STATE.thorDraugrsKilled = (STATE.thorDraugrsKilled || 0) + 1;
    if (STATE.thorDraugrsKilled >= targets.thor.draugrsTarget) {
      STATE.thorDraugrsKilled = 0;
      adjustFavor('thor', 1);
      notify('FAVOR_GAIN_ACTION', { god: 'thor', reason: `slaying ${targets.thor.draugrsTarget} draugrs` });
    }
  } else if (nameLower.includes('lindwurm')) {
    STATE.thorLindwurmsKilled = (STATE.thorLindwurmsKilled || 0) + 1;
    if (STATE.thorLindwurmsKilled >= targets.thor.lindwurmsTarget) {
      STATE.thorLindwurmsKilled = 0;
      adjustFavor('thor', 1);
      notify('FAVOR_GAIN_ACTION', { god: 'thor', reason: 'slaying a Lindwurm' });
    }
  }
}

// Sell sheep and update Freya favor
export function sellSheep() {
  const targets = GC.alternativeFavor.freya;
  if (STATE.resources.sheep >= 1) {
    adjustResource('sheep', -1);
    adjustResource('gold', 4);

    STATE.freyaSheepSold = (STATE.freyaSheepSold || 0) + 1;
    if (STATE.freyaSheepSold >= targets.sheepTarget) {
      STATE.freyaSheepSold = 0;
      adjustFavor('freya', 1);
      notify('FAVOR_GAIN_ACTION', { god: 'freya', reason: `selling ${targets.sheepTarget} sheep` });
    }
    return true;
  }
  return false;
}

// Sell wood and update Freya favor
export function sellWood() {
  const targets = GC.alternativeFavor.freya;
  if (STATE.resources.wood >= targets.woodTarget) {
    adjustResource('wood', -targets.woodTarget);
    adjustResource('gold', 4);

    STATE.freyaWoodSold = (STATE.freyaWoodSold || 0) + targets.woodTarget;
    if (STATE.freyaWoodSold >= targets.woodTarget) {
      const favorGained = Math.floor(STATE.freyaWoodSold / targets.woodTarget);
      STATE.freyaWoodSold = STATE.freyaWoodSold % targets.woodTarget;
      adjustFavor('freya', favorGained);
      notify('FAVOR_GAIN_ACTION', { god: 'freya', reason: `selling ${targets.woodTarget} wood` });
    }
    return true;
  }
  return false;
}

// Starvation damage
export function triggerStarvationDamage() {
  if (STATE.band.length > 0) {
    const targetIdx = Math.floor(Math.random() * STATE.band.length);
    const deadUnit = STATE.band[targetIdx];
    STATE.band.splice(targetIdx, 1);
    notify('STARVATION_DEATH', deadUnit);
    if (STATE.band.length === 0 && STATE.resources.gold === 0) {
      notify('GAME_OVER');
    }
  }
}

// Reset entire State for new game
export function resetGame() {
  STATE.activeScreen = 'menu';
  STATE.resources = { ...SC.startingResources };
  STATE.band = makeStartingBand();
  STATE.inventory = [];
  STATE.locations = {};
  STATE.party = { worldX: WC.partyStart.x, worldY: WC.partyStart.y, currentLocationId: null, localX: 0, localY: 0 };
  STATE.godFavor = makeGodFavor();
  STATE.godQuests = makeGodQuests();
  STATE.milestone5Order = [];
  STATE.odinWolvesKilled = 0;
  STATE.odinGiantsKilled = 0;
  STATE.thorDraugrsKilled = 0;
  STATE.thorLindwurmsKilled = 0;
  STATE.freyaSheepSold = 0;
  STATE.freyaWoodSold = 0;
  STATE.day = 1;
  STATE.activeBlessing = null;
  STATE.permanentlyActivatedBlessings = [];
  STATE.combat = {
    active: false, grid: [], pool: [], paused: true,
    ticker: null, selectedPoolIndex: null, spawnTimer: 0,
    locationId: null, entityCoordKey: null, waveMonsters: [],
    formationOrder: ['shieldmaiden', 'berserker', 'huntsman', 'huskarl']
  };
}

// Execute plundering a burial mound
export function executePlunderMound(entity) {
  const action = GC.encounterActions.plunderMound;
  adjustResource('gold', action.gain.gold);
  entity.isExplored = true;
  Object.entries(action.favorChanges).forEach(([god, amt]) => adjustFavor(god, amt));
  return action;
}

// Execute sacrifice sheep to Hel
export function executeSacrificeSheep(entity) {
  const action = GC.encounterActions.sacrificeSheep;
  const sheepCost = Math.abs(action.cost.sheep);
  if (STATE.resources.sheep >= sheepCost) {
    adjustResource('sheep', -sheepCost);
    entity.isExplored = true;
    Object.entries(action.favorChanges).forEach(([god, amt]) => adjustFavor(god, amt));
    return action;
  }
  return null;
}

/* --- Town Transaction state methods --- */

export function buyFood(cost, amount) {
  if (STATE.resources.gold >= cost) {
    adjustResource('gold', -cost);
    adjustResource('food', amount);
    return { success: true, message: `Bought ${amount} food supplies for ${cost} gold.` };
  }
  return { success: false, message: 'Not enough gold to trade food!' };
}

export function buyWood(cost, amount) {
  if (STATE.resources.gold >= cost) {
    adjustResource('gold', -cost);
    adjustResource('wood', amount);
    return { success: true, message: `Bought ${amount} wood planks for ${cost} gold.` };
  }
  return { success: false, message: 'Not enough gold to buy wood!' };
}

export function sellSheepDynamic(gain, amount = 1) {
  if (STATE.resources.sheep >= amount) {
    adjustResource('sheep', -amount);
    adjustResource('gold', gain);
    const targets = GC.alternativeFavor.freya;
    STATE.freyaSheepSold = (STATE.freyaSheepSold || 0) + amount;
    if (STATE.freyaSheepSold >= targets.sheepTarget) {
      STATE.freyaSheepSold = 0;
      adjustFavor('freya', 1);
      notify('FAVOR_GAIN_ACTION', { god: 'freya', reason: `selling ${targets.sheepTarget} sheep` });
    }
    return { success: true, message: `Sold ${amount} livestock sheep for ${gain} gold.` };
  }
  return { success: false, message: 'No sheep available to trade!' };
}

export function sellWoodDynamic(gain, amount = 10) {
  if (STATE.resources.wood >= amount) {
    adjustResource('wood', -amount);
    adjustResource('gold', gain);
    const targets = GC.alternativeFavor.freya;
    STATE.freyaWoodSold = (STATE.freyaWoodSold || 0) + amount;
    if (STATE.freyaWoodSold >= targets.woodTarget) {
      const favorGained = Math.floor(STATE.freyaWoodSold / targets.woodTarget);
      STATE.freyaWoodSold = STATE.freyaWoodSold % targets.woodTarget;
      adjustFavor('freya', favorGained);
      notify('FAVOR_GAIN_ACTION', { god: 'freya', reason: `selling ${targets.woodTarget} wood` });
    }
    return { success: true, message: `Sold ${amount} wood planks for ${gain} gold.` };
  }
  return { success: false, message: `Not enough wood to sell (requires ${amount} wood)!` };
}

export function buySheepDynamic(cost, amount = 1) {
  if (STATE.resources.gold >= cost) {
    adjustResource('gold', -cost);
    adjustResource('sheep', amount);
    return { success: true, message: `Bought ${amount} sheep for ${cost} gold.` };
  }
  return { success: false, message: 'Not enough gold to purchase sheep!' };
}

export function buyRecruit(type, cost) {
  if (STATE.godFavor.hel === -5) {
    if (GC.modifiers.wrath.hel?.blockRecruitment ?? true) {
      return { success: false, message: "Hel's Wrath: Dead band members cannot be replaced!" };
    }
  }
  if (STATE.band.length >= SC.maxBandSize) {
    return { success: false, message: `Your Drakkar deck is full (max ${SC.maxBandSize} soldiers)!` };
  }
  
  let finalCost = { ...cost };
  
  // Check all resource requirements
  for (const [res, amt] of Object.entries(finalCost)) {
    if ((STATE.resources[res] || 0) < amt) {
      const resLabel = res.charAt(0).toUpperCase() + res.slice(1);
      return { success: false, message: `Not enough ${resLabel} to hire recruit!` };
    }
  }

  // Deduct resources
  for (const [res, amt] of Object.entries(finalCost)) {
    adjustResource(res, -amt);
  }

  recruitSoldier(type);
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  return { success: true, message: `Enrolled a ${label} to your band!` };
}

export function getHealCost() {
  let totalCost = 0;
  for (const warrior of STATE.band) {
    const effStats = getEffectiveStats(warrior);
    if (warrior.hp < effStats.maxHp.total) {
      if (warrior.hp < effStats.maxHp.total * 0.2) {
        totalCost += 4;
      } else if (warrior.hp < effStats.maxHp.total * 0.8) {
        totalCost += 2;
      } else {
        totalCost += 0;
      }
    }
  }
  return totalCost;
}

export function healWarriors() {
  const cost = getHealCost();
  if (STATE.resources.gold >= cost) {
    let healedCount = 0;
    for (const warrior of STATE.band) {
      const effStats = getEffectiveStats(warrior);
      if (warrior.hp < effStats.maxHp.total) {
        warrior.hp = effStats.maxHp.total;
        healedCount++;
      }
    }
    adjustResource('gold', -cost);
    notify('STATE_UPDATED');
    return { success: true, message: `Healed ${healedCount} warriors for ${cost} gold.` };
  }
  return { success: false, message: `Not enough gold! Need ${cost} gold.` };
}

export function getEffectiveStats(unit) {
  const isPlayer = unit.alliance === 'player' || ['shieldmaiden', 'berserker', 'huntsman', 'huskarl'].includes(unit.type);
  let baseMaxHp = unit.maxHp;
  let baseDmg = unit.dmg;
  let baseSpeed = unit.speed;
  let baseRange = unit.range;

  if (isPlayer) {
    const base = SC.recruitStats[unit.type];
    if (base) {
      baseMaxHp = base.maxHp;
      baseDmg = base.dmg;
      baseSpeed = base.speed;
      baseRange = base.range;
    }
  } else {
    const base = CC.monsters[unit.type] || CC.monsterFallback;
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
      const m1Config = GC.modifiers.milestones.hel.find(m => m.index === 0);
      bonusDmg += m1Config?.enemyDmgModifier ?? -1;
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

