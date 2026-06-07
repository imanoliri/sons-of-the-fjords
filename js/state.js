/* ==========================================================================
   STATE MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { SOLDIERS_CONFIG as SC } from './config/soldiers.js';
import { GODS_CONFIG as GC } from './config/gods.js';
import { WORLD_CONFIG as WC } from './config/world.js';

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

  // Active Champion Buff
  activeBlessing: null,

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
    stance: 'attack'
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
  STATE.band.push({ id, name: rName, type, ...base });
  notify('RESOURCES_UPDATED');
}

// Sacrifice Magic Objects
export function sacrificeRelic(relicId, godName) {
  const idx = STATE.inventory.indexOf(relicId);
  if (idx !== -1) {
    STATE.inventory.splice(idx, 1);
    adjustFavor(godName, 1);
    notify('RELIC_SACRIFICED', { relicId, godName });
  }
}

// Pentagram dynamic shifting favor logic
export function adjustFavor(godName, amt) {
  const opposites = GC.pentagramOpposites;
  const current = STATE.godFavor[godName];
  if (current >= GC.favorMax) return;

  const nextFavor = Math.min(GC.favorMax, Math.max(GC.favorMin, current + amt));
  STATE.godFavor[godName] = nextFavor;

  if (amt > 0) {
    const track = STATE.godQuests[godName];
    const emptyIndex = track.indexOf(false);
    if (emptyIndex !== -1 && emptyIndex < nextFavor) {
      track[emptyIndex] = true;
      notify('QUEST_MILESTONE', { god: godName, index: emptyIndex });
      if (track.every(x => x === true)) {
        notify('ASCENSION_TRIGGERED', godName);
      }
    }
  }

  if (amt > 0) {
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
  STATE.activeBlessing = null;
  STATE.combat = {
    active: false, grid: [], pool: [], paused: true,
    ticker: null, selectedPoolIndex: null, spawnTimer: 0,
    locationId: null, entityCoordKey: null, waveMonsters: []
  };
}
