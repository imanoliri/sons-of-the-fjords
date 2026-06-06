/* ==========================================================================
   STATE MODULE - SONS OF THE FJORDS
   ========================================================================== */

// Event emitter subscription list
const listeners = [];

export const STATE = {
  activeScreen: 'world', // 'menu' | 'world' | 'town' | 'location' | 'combat'
  
  resources: {
    gold: 15,
    food: 30,
    wood: 5,
    sheep: 2
  },
  
  band: [
    { id: 1, name: 'Sigrid', type: 'shieldmaiden', hp: 60, maxHp: 60, dmg: 4, speed: 2, range: 1 },
    { id: 2, name: 'Halvar', type: 'berserker', hp: 45, maxHp: 45, dmg: 8, speed: 3, range: 1 },
    { id: 3, name: 'Aslaug', type: 'huntsman', hp: 35, maxHp: 35, dmg: 6, speed: 2, range: 4 }
  ],
  
  inventory: [], // Collected items and magic objects

  // World Map State (15x15)
  worldMap: {
    tiles: [], // 15x15 terrain matrix
    revealed: [], // 15x15 fog matrix
    locations: {} // Keyed by coordinates "x,y" -> { name, type: 'town'|'raid', terrain, id }
  },

  // Location Map States (Keyed by locationId -> 10x10 Carcassonne discovery state)
  locations: {},

  // Active coordinates
  party: {
    worldX: 7,
    worldY: 7,
    currentLocationId: null,
    localX: 0,
    localY: 0
  },

  // Deity Favor (-5 to +5)
  godFavor: {
    odin: 0,
    thor: 0,
    freya: 0,
    hel: 0,
    loki: 0
  },

  // Deity Quest Milestones (5 steps)
  godQuests: {
    odin: [false, false, false, false, false],
    thor: [false, false, false, false, false],
    freya: [false, false, false, false, false],
    hel: [false, false, false, false, false],
    loki: [false, false, false, false, false]
  },

  // Active Champion Buff
  activeBlessing: null,

  // Combat details
  combat: {
    active: false,
    grid: [], // 10x8 grid cells
    pool: [], // Copy of units deployable
    paused: true,
    ticker: null,
    selectedPoolIndex: null,
    spawnTimer: 0,
    locationId: null,
    entityCoordKey: null,
    waveMonsters: [], // Monsters currently active on map
    stance: 'attack' // Default combat stance: 'attack', 'defend', or 'retreat'
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
  for (const listener of listeners) {
    listener(event, data);
  }
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
    
    // Check for game over (no soldiers and no gold)
    if (STATE.band.length === 0 && STATE.resources.gold === 0 && !STATE.combat.active) {
      notify('GAME_OVER');
    }
  }
}

// Recruitment Helper
export function recruitSoldier(type) {
  const names = {
    shieldmaiden: ['Brynhild', 'Hervor', 'Gerd', 'Signy'],
    berserker: ['Gunnar', 'Torstein', 'Ragnar', 'Bjorn'],
    huntsman: ['Egil', 'Ullr', 'Solveig', 'Kari']
  };
  const list = names[type];
  const rName = list[Math.floor(Math.random() * list.length)];
  const id = Date.now() + Math.floor(Math.random() * 100);

  let stats = {};
  if (type === 'shieldmaiden') {
    stats = { id, name: rName, type, hp: 60, maxHp: 60, dmg: 4, speed: 2, range: 1 };
  } else if (type === 'berserker') {
    stats = { id, name: rName, type, hp: 45, maxHp: 45, dmg: 8, speed: 3, range: 1 };
  } else if (type === 'huntsman') {
    stats = { id, name: rName, type, hp: 35, maxHp: 35, dmg: 6, speed: 2, range: 4 };
  }

  STATE.band.push(stats);
  notify('RESOURCES_UPDATED');
}

// Sacrifice Magic Objects
export function sacrificeRelic(relicId, godName) {
  // Remove from inventory
  const idx = STATE.inventory.indexOf(relicId);
  if (idx !== -1) {
    STATE.inventory.splice(idx, 1);
    
    // Increase god favor
    adjustFavor(godName, 1);
    notify('RELIC_SACRIFICED', { relicId, godName });
  }
}

// Pentagram dynamic shifting favor logic
export function adjustFavor(godName, amt) {
  const pentagramOpposites = {
    odin: ['freya', 'hel'],
    thor: ['hel', 'loki'],
    freya: ['loki', 'odin'],
    hel: ['odin', 'thor'],
    loki: ['thor', 'freya']
  };

  // Adjust target god
  const current = STATE.godFavor[godName];
  if (current >= 5) return; // Locked at max champion favor

  const nextFavor = Math.min(5, Math.max(-5, current + amt));
  STATE.godFavor[godName] = nextFavor;

  // Advance milestone quest tracks if positive favor increases
  if (amt > 0) {
    const track = STATE.godQuests[godName];
    // Find first incomplete milestone
    const emptyIndex = track.indexOf(false);
    if (emptyIndex !== -1 && emptyIndex < nextFavor) {
      track[emptyIndex] = true;
      notify('QUEST_MILESTONE', { god: godName, index: emptyIndex });
      
      // Check for Victory / Ascension trigger (5/5 Milestones)
      if (track.every(x => x === true)) {
        notify('ASCENSION_TRIGGERED', godName);
      }
    }
  }

  // Antagonize opposites if favor is increased (subtracting favor from opposites)
  if (amt > 0) {
    const opposites = pentagramOpposites[godName];
    for (const opp of opposites) {
      // If opposite god is not locked at 5/5, decrease favor
      const oppTrack = STATE.godQuests[opp];
      const oppIsChampion = oppTrack.every(x => x === true);
      if (!oppIsChampion) {
        STATE.godFavor[opp] = Math.max(-5, STATE.godFavor[opp] - 1);
      }
    }
  }

  notify('FAVOR_UPDATED');
}

// Starvation moves processing
export function triggerStarvationDamage() {
  if (STATE.band.length > 0) {
    const targetIdx = Math.floor(Math.random() * STATE.band.length);
    const deadUnit = STATE.band[targetIdx];
    STATE.band.splice(targetIdx, 1);
    notify('STARVATION_DEATH', deadUnit);
    
    // Check Game Over
    if (STATE.band.length === 0 && STATE.resources.gold === 0) {
      notify('GAME_OVER');
    }
  }
}

// Reset entire State for new game
export function resetGame() {
  STATE.resources = { gold: 15, food: 30, wood: 5, sheep: 2 };
  STATE.band = [
    { id: 1, name: 'Sigrid', type: 'shieldmaiden', hp: 60, maxHp: 60, dmg: 4, speed: 2, range: 1 },
    { id: 2, name: 'Halvar', type: 'berserker', hp: 45, maxHp: 45, dmg: 8, speed: 3, range: 1 },
    { id: 3, name: 'Aslaug', type: 'huntsman', hp: 35, maxHp: 35, dmg: 6, speed: 2, range: 4 }
  ];
  STATE.inventory = [];
  STATE.locations = {};
  STATE.party = { worldX: 7, worldY: 7, currentLocationId: null, localX: 0, localY: 0 };
  STATE.godFavor = { odin: 0, thor: 0, freya: 0, hel: 0, loki: 0 };
  STATE.godQuests = {
    odin: [false, false, false, false, false],
    thor: [false, false, false, false, false],
    freya: [false, false, false, false, false],
    hel: [false, false, false, false, false],
    loki: [false, false, false, false, false]
  };
  STATE.activeBlessing = null;
  STATE.combat = {
    active: false,
    grid: [],
    pool: [],
    paused: true,
    ticker: null,
    selectedPoolIndex: null,
    spawnTimer: 0,
    locationId: null,
    entityCoordKey: null,
    waveMonsters: []
  };
}
