/* ==========================================================================
   UI MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE, setScreen, adjustResource, recruitSoldier, sacrificeRelic, adjustFavor, triggerStarvationDamage, notify } from './state.js';
import { getAdjacentCoords } from './world.js';
import { discoverTile, generateLocationMap } from './location.js';
import { togglePause, deployUnit, undeployUnit, startCombat } from './combat.js';

// DOM Selectors
const elHeader = document.getElementById('game-header');
const elGold = document.getElementById('res-gold').querySelector('.val');
const elFood = document.getElementById('res-food').querySelector('.val');
const elWood = document.getElementById('res-wood').querySelector('.val');
const elSheep = document.getElementById('res-sheep').querySelector('.val');
const elBand = document.getElementById('res-band').querySelector('.val');
const elBlessing = document.getElementById('active-blessing-display');
const elTooltip = document.getElementById('game-tooltip');

// Screens
const screens = {
  menu: document.getElementById('screen-menu'),
  world: document.getElementById('screen-world'),
  town: document.getElementById('screen-town'),
  location: document.getElementById('screen-location'),
  combat: document.getElementById('screen-combat'),
  quests: document.getElementById('screen-quests')
};

// World elements
const elWorldMap = document.getElementById('world-map');
const elWorldCoords = document.getElementById('world-coordinates');
const elWorldLog = document.getElementById('world-event-log');

// Town elements
const elTownName = document.getElementById('town-name');
const elShrineList = document.getElementById('shrine-inventory-list');
const elShrineEmpty = document.getElementById('shrine-empty-message');

// Location elements
const elLocMap = document.getElementById('location-map');
const elLocTitle = document.getElementById('location-title');
const elLocDeckCount = document.getElementById('location-deck-count');
const elLocLog = document.getElementById('location-event-log');

// Combat elements
const elCombatGrid = document.getElementById('combat-grid');
const elCombatPoolList = document.getElementById('deploy-pool-list');
const elCombatPauseBtn = document.getElementById('btn-combat-pause');
const elCombatFleeBtn = document.getElementById('btn-combat-flee');

// Quests elements
const elQuestsList = document.getElementById('gods-tracks-list');

// Modals
const elModalEvent = document.getElementById('modal-event');
const elModalEventTitle = document.getElementById('modal-event-title');
const elModalEventBody = document.getElementById('modal-event-body');
const elModalEventChoices = document.getElementById('modal-event-choices');

const elModalAscension = document.getElementById('modal-ascension');
const elModalAscensionText = document.getElementById('modal-ascension-text');

const elModalGameOver = document.getElementById('modal-gameover');

// Initialize UI binding event listeners
export function initUIBindings() {
  
  // Screen Router Events
  document.getElementById('btn-start-game').addEventListener('click', () => {
    setScreen('world');
  });

  // Helper: figure out where to return after a quest/overlay — towns go to world, raids go to location
  function screenAfterOverlay() {
    const locId = STATE.party.currentLocationId;
    if (!locId) return 'world';
    const locData = Object.values(STATE.worldMap.locations).find(l => l.id === locId);
    return (locData && locData.type === 'town') ? 'world' : 'location';
  }

  // Toggle Quest Screen
  document.getElementById('btn-toggle-quests').addEventListener('click', () => {
    if (STATE.activeScreen === 'quests') {
      setScreen(screenAfterOverlay());
    } else {
      setScreen('quests');
    }
  });

  document.getElementById('btn-close-quests').addEventListener('click', () => {
    setScreen(screenAfterOverlay());
  });

  // Town leave button
  document.getElementById('btn-leave-town').addEventListener('click', () => {
    STATE.party.currentLocationId = null;
    setScreen('world');
  });

  // Trade actions
  bindButton('btn-buy-food', () => {
    if (STATE.resources.gold >= 2) {
      adjustResource('gold', -2);
      adjustResource('food', 5);
      logWorld('Bought 5 food supplies.', 'gain-message');
    } else {
      logWorld('Not enough gold to trade food!', 'warn-message');
    }
  });

  bindButton('btn-buy-wood', () => {
    if (STATE.resources.gold >= 2) {
      adjustResource('gold', -2);
      adjustResource('wood', 2);
      logWorld('Bought 2 wood planks.', 'gain-message');
    } else {
      logWorld('Not enough gold to buy wood!', 'warn-message');
    }
  });

  bindButton('btn-sell-sheep', () => {
    if (STATE.resources.sheep >= 1) {
      adjustResource('sheep', -1);
      adjustResource('gold', 4);
      logWorld('Sold 1 livestock sheep.', 'gain-message');
    } else {
      logWorld('No sheep available to trade!', 'warn-message');
    }
  });

  bindButton('btn-buy-sheep', () => {
    if (STATE.resources.gold >= 6) {
      adjustResource('gold', -6);
      adjustResource('sheep', 1);
      logWorld('Bought 1 sheep.', 'gain-message');
    } else {
      logWorld('Not enough gold to purchase sheep!', 'warn-message');
    }
  });

  // Recruiting action handlers
  bindButton('btn-recruit-shieldmaiden', () => {
    if (STATE.resources.gold >= 5 && STATE.band.length < 8) {
      adjustResource('gold', -5);
      recruitSoldier('shieldmaiden');
      logWorld('Enrolled a Shieldmaiden to your band!', 'gain-message');
    } else if (STATE.band.length >= 8) {
      logWorld('Your Drakkar deck is full (max 8 soldiers)!', 'warn-message');
    } else {
      logWorld('Not enough gold to hire recruit!', 'warn-message');
    }
  });

  bindButton('btn-recruit-berserker', () => {
    if (STATE.resources.gold >= 7 && STATE.band.length < 8) {
      adjustResource('gold', -7);
      recruitSoldier('berserker');
      logWorld('Enrolled a Berserker to your band!', 'gain-message');
    } else if (STATE.band.length >= 8) {
      logWorld('Your Drakkar deck is full!', 'warn-message');
    } else {
      logWorld('Not enough gold!', 'warn-message');
    }
  });

  bindButton('btn-recruit-huntsman', () => {
    if (STATE.resources.gold >= 6 && STATE.band.length < 8) {
      adjustResource('gold', -6);
      recruitSoldier('huntsman');
      logWorld('Enrolled a Huntsman to your band!', 'gain-message');
    } else if (STATE.band.length >= 8) {
      logWorld('Your Drakkar is full!', 'warn-message');
    } else {
      logWorld('Not enough gold!', 'warn-message');
    }
  });

  // Repair Drakkar
  bindButton('btn-repair-ship', () => {
    if (STATE.resources.wood >= 3) {
      adjustResource('wood', -3);
      logWorld('Drakkar ship hull reinforced and repaired.', 'gain-message');
    } else {
      logWorld('Not enough timber logs to repair!', 'warn-message');
    }
  });

  // Carcassonne escape button
  bindButton('btn-leave-location', () => {
    STATE.party.currentLocationId = null;
    setScreen('world');
    logWorld('Escaped from raid site back to the open sea.');
  });

  // Combat controls
  bindButton('btn-combat-pause', () => {
    togglePause();
  });

  bindButton('btn-combat-flee', () => {
    STATE.combat.fleeMode = !STATE.combat.fleeMode;
    if (STATE.combat.fleeMode) {
      STATE.combat.selectedPoolIndex = null;
    }
    notify('COMBAT_UPDATE');
  });

  bindButton('btn-stance-retreat', () => {
    STATE.combat.stance = 'retreat';
    notify('COMBAT_UPDATE');
  });

  bindButton('btn-stance-defend', () => {
    STATE.combat.stance = 'defend';
    notify('COMBAT_UPDATE');
  });

  bindButton('btn-stance-hold', () => {
    STATE.combat.stance = 'hold';
    notify('COMBAT_UPDATE');
  });

  bindButton('btn-stance-attack', () => {
    STATE.combat.stance = 'attack';
    notify('COMBAT_UPDATE');
  });

  // Game over restart
  bindButton('btn-restart-game', () => {
    hideOverlay(elModalGameOver);
    STATE.activeScreen = 'world';
    notify('RESET_GAME');
  });

  // Ascension Choice wins
  bindButton('btn-ascend-victory', () => {
    hideOverlay(elModalAscension);
    showToast('Congratulations! You have ascended to Valhalla. The sagas will sing of your name!', '👑');
    setTimeout(() => { location.reload(); }, 4000);
  });

  bindButton('btn-ascend-continue', () => {
    hideOverlay(elModalAscension);
    // Deactivate debuffs from the champion god
    const activeVictoryGod = elModalAscension.dataset.god;
    if (activeVictoryGod) {
      STATE.godFavor[activeVictoryGod] = 5;
    }
  });

  // Keyboard Arrow Movement
  window.addEventListener('keydown', (e) => {
    // 0. Handle Escape key to leave Location (Raid or Town)
    if (e.key === 'Escape') {
      if (STATE.activeScreen === 'location') {
        e.preventDefault();
        document.getElementById('btn-leave-location')?.click();
        return;
      } else if (STATE.activeScreen === 'town') {
        e.preventDefault();
        document.getElementById('btn-leave-town')?.click();
        return;
      }
    }

    // 1. Handle modal overlay shortcuts if an overlay is open
    const visibleOverlay = document.querySelector('.modal-overlay:not(.hidden)');
    if (visibleOverlay) {
      const buttons = Array.from(visibleOverlay.querySelectorAll('button, .btn'));
      if (buttons.length > 0) {
        // Number keys (1 to buttons.length)
        const keyNum = parseInt(e.key);
        if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= buttons.length) {
          e.preventDefault();
          buttons[keyNum - 1].click();
          return;
        }

        // Arrow keys to navigate options
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          e.preventDefault();
          activeModalFocusIndex = (activeModalFocusIndex + 1) % buttons.length;
          updateModalKeyboardNavigation();
          return;
        }
        else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          activeModalFocusIndex = (activeModalFocusIndex - 1 + buttons.length) % buttons.length;
          updateModalKeyboardNavigation();
          return;
        }

        // Enter to confirm selected option
        if (e.key === 'Enter') {
          e.preventDefault();
          buttons[activeModalFocusIndex].click();
          return;
        }
      }
      return; // Block other navigation while modal is active
    }

    // Check if player is on World Map screen
    if (STATE.activeScreen === 'world') {
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') dy = -1;
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') dy = 1;
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') dx = -1;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dx = 1;
      else if (e.key === 'Enter') {
        const hasLocation = STATE.worldMap.locations[`${STATE.party.worldX},${STATE.party.worldY}`];
        if (hasLocation) {
          enterLocation(hasLocation);
        }
        return;
      }
      
      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        const targetX = STATE.party.worldX + dx;
        const targetY = STATE.party.worldY + dy;
        const adjacents = getAdjacentCoords(STATE.party.worldX, STATE.party.worldY);
        const isValidMove = adjacents.some(a => a.x === targetX && a.y === targetY);
        if (isValidMove) {
          movePartyOnWorld(targetX, targetY);
        }
      }
    } 
    // Check if player is on Location map screen
    else if (STATE.activeScreen === 'location') {
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') dy = -1;
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') dy = 1;
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') dx = -1;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dx = 1;
      
      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        const targetX = STATE.party.localX + dx;
        const targetY = STATE.party.localY + dy;
        attemptLocalMove(targetX, targetY);
      }
    }
    // Check if player is on Town screen
    else if (STATE.activeScreen === 'town') {
      const key = e.key.toLowerCase();
      
      // Resources shortcuts: f (food), g (gold from selling sheep), w (wood), s (sheep)
      if (key === 'f') {
        e.preventDefault();
        document.getElementById('btn-buy-food')?.click();
      }
      else if (key === 'g') {
        e.preventDefault();
        document.getElementById('btn-sell-sheep')?.click();
      }
      else if (key === 'w') {
        e.preventDefault();
        document.getElementById('btn-buy-wood')?.click();
      }
      else if (key === 's') {
        e.preventDefault();
        document.getElementById('btn-buy-sheep')?.click();
      }
      
      // Soldiers recruitment shortcuts: 1 (Shieldmaiden), 2 (Berserker), 3 (Huntsman)
      else if (key === '1') {
        e.preventDefault();
        document.getElementById('btn-recruit-shieldmaiden')?.click();
      }
      else if (key === '2') {
        e.preventDefault();
        document.getElementById('btn-recruit-berserker')?.click();
      }
      else if (key === '3') {
        e.preventDefault();
        document.getElementById('btn-recruit-huntsman')?.click();
      }
    }
    // Check if player is on Combat screen
    else if (STATE.activeScreen === 'combat') {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (STATE.combat.paused) {
          togglePause();
        }
        return;
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePause();
        return;
      }

      const key = e.key.toLowerCase();

      if (key === 'y') {
        e.preventDefault();
        STATE.combat.stance = 'retreat';
        notify('COMBAT_UPDATE');
        return;
      }
      if (key === 'x') {
        e.preventDefault();
        STATE.combat.stance = 'defend';
        notify('COMBAT_UPDATE');
        return;
      }
      if (key === 'c') {
        e.preventDefault();
        STATE.combat.stance = 'hold';
        notify('COMBAT_UPDATE');
        return;
      }
      if (key === 'v') {
        e.preventDefault();
        STATE.combat.stance = 'attack';
        notify('COMBAT_UPDATE');
        return;
      }
      
      // 1. Select soldier from pool (1 to 8)
      const keyNum = parseInt(key);
      if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= 8) {
        e.preventDefault();
        if (keyNum - 1 < STATE.combat.pool.length) {
          STATE.combat.selectedPoolIndex = keyNum - 1;
          notify('COMBAT_UPDATE');
        }
        return;
      }

      // 2. Deploy on lanes (qweruiop for col 0, asdfjklö for col 1)
      const keyMap = {
        'q': { r: 0, c: 0 },
        'w': { r: 1, c: 0 },
        'e': { r: 2, c: 0 },
        'r': { r: 3, c: 0 },
        'u': { r: 4, c: 0 },
        'i': { r: 5, c: 0 },
        'o': { r: 6, c: 0 },
        'p': { r: 7, c: 0 },
        'a': { r: 0, c: 1 },
        's': { r: 1, c: 1 },
        'd': { r: 2, c: 1 },
        'f': { r: 3, c: 1 },
        'j': { r: 4, c: 1 },
        'k': { r: 5, c: 1 },
        'l': { r: 6, c: 1 },
        'ö': { r: 7, c: 1 },
        ';': { r: 7, c: 1 }, // Fallbacks for non-Nordic layouts
        ':': { r: 7, c: 1 }
      };

      if (keyMap[key]) {
        e.preventDefault();
        if (!STATE.combat.paused) {
          togglePause(); // Ensure paused for deploying
        }
        
        let poolIdx = STATE.combat.selectedPoolIndex;
        if (poolIdx === null && STATE.combat.pool.length > 0) {
          poolIdx = 0; // Default to first soldier in queue
        }

        if (poolIdx !== null && poolIdx < STATE.combat.pool.length) {
          const target = keyMap[key];
          deployUnit(poolIdx, target.r, target.c);
        }
      }
    }
  });

  // Start tooltip tracking
  initTooltipEvents();
}

// ── God lore for quest tooltips ──────────────────────────────────────────────
const GOD_LORE = {
  odin: {
    title: 'Odin — The Allfather',
    icon: '🔮',
    color: 'var(--color-odin)',
    relic: 'Shard of Gungnir',
    favorSteps: [
      '1. Explore Raid Sites on the world map',
      '2. Find a 🏆 Dolmen shrine tile — walk onto it to auto-collect the <b>Shard of Gungnir</b>',
      '3. Sail to any 🏘️ Town on the world map',
      '4. Open the Town screen → Temple section → click <b>Appease Odin</b>',
      '5. Repeat: each sacrifice grants +1 Favor toward the next milestone'
    ],
    opposites: ['Freya', 'Hel'],
    buff: 'Champion Buff: All Huntsmen gain +2 Attack Range & +1 DMG per turn.',
    wrath: 'Wrath (favor < 0): Random unit loses 1 HP every 3 world steps.',
    milestones: [
      'Favor 1 — Odin watches. Fog of war reveals 1 extra tile on each move.',
      'Favor 2 — Odin blesses sight. Your scouts reveal 2-tile radius instead of 1.',
      'Favor 3 — Odin sharpens minds. All Huntsmen gain +1 Attack Range.',
      'Favor 4 — Wisdom of the Runes. Berserkers gain +1 DMG per combat tick.',
      'Favor 5 — ASCENSION. Odin’s eternal champion. Select buff to activate.'
    ]
  },
  thor: {
    title: 'Thor — The Thunderer',
    icon: '⚡',
    color: 'var(--color-thor)',
    relic: "Mjolnir's Core",
    favorSteps: [
      '1. Explore Raid Sites on the world map',
      '2. Find a 🏆 Dolmen shrine tile — walk onto it to auto-collect <b>Mjolnir\'s Core</b>',
      '3. Sail to any 🏘️ Town on the world map',
      '4. Open the Town screen → Temple section → click <b>Appease Thor</b>',
      '5. Repeat: each sacrifice grants +1 Favor toward the next milestone'
    ],
    opposites: ['Hel', 'Loki'],
    buff: 'Champion Buff: All Berserkers gain +3 DMG and +1 Speed.',
    wrath: 'Wrath (favor < 0): Storms during land travel cost +1 extra Food per step.',
    milestones: [
      'Favor 1 — Thor stirs. Berserkers gain +1 DMG in combat.',
      'Favor 2 — Thunder in veins. Berserkers move +1 Speed per tick.',
      'Favor 3 — War drums. Enemy spawn rate slowed by 10%.',
      'Favor 4 — Storm Caller. All units gain +1 max HP.',
      'Favor 5 — ASCENSION. Thor’s eternal champion. Select buff to activate.'
    ]
  },
  freya: {
    title: 'Freya — Goddess of Love & Life',
    icon: '🌸',
    color: 'var(--color-freya)',
    relic: "Freya's Amber Tear",
    favorSteps: [
      '1. Explore Raid Sites on the world map',
      '2. Find a 🏆 Dolmen shrine tile — walk onto it to auto-collect <b>Freya\'s Amber Tear</b>',
      '3. Sail to any 🏘️ Town on the world map',
      '4. Open the Town screen → Temple section → click <b>Appease Freya</b>',
      '5. Repeat: each sacrifice grants +1 Favor toward the next milestone'
    ],
    opposites: ['Loki', 'Odin'],
    buff: 'Champion Buff: Shieldmaidens heal 2 HP per combat tick when not in melee.',
    wrath: 'Wrath (favor < 0): Recruited units start with -10 max HP.',
    milestones: [
      'Favor 1 — Freya smiles. Shieldmaidens gain +5 max HP.',
      'Favor 2 — Life aura. Any unit below 25% HP heals 1 HP/tick.',
      'Favor 3 — Seiðr magic. Shieldmaidens gain +2 DMG.',
      'Favor 4 — Shield of Asgard. Shieldmaidens block 1 DMG per hit.',
      'Favor 5 — ASCENSION. Freya’s eternal champion. Select buff to activate.'
    ]
  },
  hel: {
    title: 'Hel — Goddess of the Underworld',
    icon: '💀',
    color: 'var(--color-hel)',
    relic: "Hel's Urn of Ash",
    favorSteps: [
      '1a. <b>Dolmen path:</b> Find a 🏆 Dolmen shrine in a Raid Site → auto-collect <b>Hel\'s Urn of Ash</b>',
      '1b. <b>Burial path:</b> Find a 🪦 Burial Mound in a Raid Site → choose <b>Sacrifice Sheep</b> (costs 1 🐑)',
      '2. Sail to any 🏘️ Town on the world map',
      '3. Open the Town screen → Temple section → click <b>Appease Hel</b>',
      '4. Repeat: each sacrifice grants +1 Favor toward the next milestone'
    ],
    opposites: ['Odin', 'Thor'],
    buff: 'Champion Buff: Fallen enemies have a 20% chance to rise as allied undead for 3 ticks.',
    wrath: 'Wrath (favor < 0): Dead band members cannot be replaced for 5 turns.',
    milestones: [
      'Favor 1 — Hel stirs. Enemies deal -1 DMG.',
      'Favor 2 — Veil of death. Player units survive lethal hits once with 1 HP (once per battle).',
      'Favor 3 — Reaper’s mark. Slain enemies drop +1 extra Gold.',
      'Favor 4 — Death bargain. Gold cost to recruit is reduced by 1.',
      'Favor 5 — ASCENSION. Hel’s eternal champion. Select buff to activate.'
    ]
  },
  loki: {
    title: 'Loki — The Trickster',
    icon: '🎭',
    color: 'var(--color-loki)',
    relic: "Loki's Trickster Coin",
    favorSteps: [
      '1a. <b>Dolmen path:</b> Find a 🏆 Dolmen shrine in a Raid Site → auto-collect <b>Loki\'s Trickster Coin</b>',
      '1b. <b>Plunder path:</b> Find a 🪦 Burial Mound in a Raid Site → choose <b>Plunder Mound</b> (+10 Gold, also pleases Loki)',
      '2. Sail to any 🏘️ Town on the world map',
      '3. Open the Town screen → Temple section → click <b>Appease Loki</b>',
      '4. Repeat: each sacrifice grants +1 Favor toward the next milestone'
    ],
    opposites: ['Thor', 'Freya'],
    buff: 'Champion Buff: Once per battle, your weakest unit swaps position with a random enemy.',
    wrath: 'Wrath (favor < 0): Random event triggers each world move (ambush, resource loss, or unit injury).',
    milestones: [
      'Favor 1 — Loki watches. Chest loot gives +1 extra Gold.',
      'Favor 2 — Mischief afoot. Enemy attack speed reduced by 10%.',
      'Favor 3 — Shapeshifter. One enemy per wave spawns confused (fights allies for 2 ticks).',
      'Favor 4 — Silver tongue. Town prices reduced by 1 Gold each.',
      'Favor 5 — ASCENSION. Loki’s eternal champion. Select buff to activate.'
    ]
  }
};

// Global tooltip delegation
function initTooltipEvents() {
  // ── God quest / .has-tooltip elements ──
  document.body.addEventListener('mouseover', (e) => {
    const godTarget = e.target.closest('[data-god-tooltip]');
    if (godTarget) {
      const gKey = godTarget.dataset.godTooltip;
      const section = godTarget.dataset.tooltipSection;
      const lore = GOD_LORE[gKey];
      if (!lore) return;

      let header = '';
      let content = '';

      if (section === 'identity') {
        const favor = STATE.godFavor[gKey];
        const favorBar = favor >= 0
          ? `<span style="color:${lore.color}">+${favor} ▲</span>`
          : `<span style="color:var(--color-danger)">${favor} ▼</span>`;
        const isChampion = STATE.godQuests[gKey].every(x => x === true);
        header = `${lore.icon} ${lore.title}`;
        const stepsHtml = lore.favorSteps.map(s => `<li style="margin:2px 0">${s}</li>`).join('');
        content = [
          `<b style="color:${lore.color}">Current Favor:</b> ${favorBar}`,
          `<hr style="border-color:rgba(255,255,255,0.08);margin:4px 0">`,
          `<b style="color:var(--text-accent)">📋 How to gain Favor:</b>`,
          `<ol style="margin:4px 0 4px 16px;padding:0">${stepsHtml}</ol>`,
          `<hr style="border-color:rgba(255,255,255,0.08);margin:4px 0">`,
          `<b>Opposes:</b> ${lore.opposites.join(' & ')} — pleasing ${lore.icon} drains their favor`,
          `<b style="color:var(--color-success)">✨ ${lore.buff}</b>`,
          `<b style="color:var(--color-danger)">⚠️ ${lore.wrath}</b>`,
          isChampion ? `<b style="color:${lore.color}">✅ Champion unlocked! Open buff selector.</b>` : `<i>Reach 5/5 milestones to ascend.</i>`
        ].join('<br>');
      } else if (section === 'milestone') {
        const idx = parseInt(godTarget.dataset.milestoneIdx);
        const achieved = STATE.godQuests[gKey][idx];
        header = `${lore.icon} Milestone ${idx + 1}/5`;
        content = [
          `<b style="color:${lore.color}">${lore.milestones[idx]}</b>`,
          achieved
            ? `<span style="color:var(--color-success)">✅ Completed!</span>`
            : `<span style="color:var(--text-muted)">🔒 Not yet reached. Sacrifice <b>${lore.relic}</b> at a Town temple to gain favor.</span>`
        ].join('<br>');
      } else if (section === 'champion') {
        header = `${lore.icon} Champion Buff`;
        content = [
          `<b style="color:${lore.color}">${lore.buff}</b>`,
          `Activate by clicking <b>Select Buff</b> in the Quest Log.`,
          `Only one god's buff can be active at a time.`
        ].join('<br>');
      }

      elTooltip.innerHTML = `
        <div class="game-tooltip-header">
          <span>${header}</span>
        </div>
        <div class="game-tooltip-contents">${content}</div>
      `;
      elTooltip.style.borderLeftColor = lore.color;
      elTooltip.style.display = 'flex';
      return;
    }
  });

  document.body.addEventListener('mouseover', (e) => {
    const tile = e.target.closest('.world-tile, .location-tile, .combat-cell');
    if (!tile) {
      // Only hide if not hovering a god tooltip target
      if (!e.target.closest('[data-god-tooltip]')) {
        elTooltip.style.display = 'none';
      }
      return;
    }
    
    if (tile.classList.contains('fog')) {
      elTooltip.style.display = 'none';
      return;
    }

    let headerText = '';
    let coordsText = '';
    let contentsText = '';
    let borderAccent = 'var(--text-accent)';

    if (tile.classList.contains('world-tile')) {
      const x = tile.dataset.x;
      const y = tile.dataset.y;
      const terrain = tile.dataset.terrain;
      const locationName = tile.dataset.locationName;
      const locationType = tile.dataset.locationType;
      const hasPlayer = tile.dataset.hasPlayer === 'true';

      headerText = `${terrain ? terrain.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Terrain'}`;
      coordsText = `X: ${x}, Y: ${y}`;
      
      let contents = [];
      if (hasPlayer) {
        contents.push('🚢 Drakkar Longship');
      }
      if (locationName) {
        const typeLabel = locationType === 'town' ? 'Town' : 'Raid Site';
        contents.push(`🏘️ ${locationName} (${typeLabel})`);
      }
      
      if (contents.length === 0) {
        if (terrain === 'deep_water') {
          contents.push('🌊 Deep Water. Extremely dangerous, non-traversable.');
        } else if (terrain === 'water') {
          contents.push('Open water. Safe sailing, costs 1 Food per step.');
        } else if (terrain === 'river') {
          contents.push('River stream. Fast sailing, costs 1 Food per step.');
        } else {
          contents.push('Rugged land. Slow travel, costs 3 Food per step. Dangerous creature attacks!');
        }
      }
      contentsText = contents.join('<br>');

      if (terrain === 'water') borderAccent = 'var(--tile-water)';
      else if (terrain === 'deep_water') borderAccent = 'var(--tile-deep-water)';
      else if (terrain === 'river') borderAccent = 'var(--tile-river)';
      else if (terrain === 'plains') borderAccent = 'var(--tile-plains)';
      else if (terrain === 'forest') borderAccent = 'var(--tile-forest)';
      else if (terrain === 'snow') borderAccent = 'var(--tile-snow)';
      else if (terrain === 'mountain') borderAccent = 'var(--tile-mountain)';

    } else if (tile.classList.contains('location-tile')) {
      const x = tile.dataset.x;
      const y = tile.dataset.y;
      const terrain = tile.dataset.terrain;
      const hasPlayer = tile.dataset.hasPlayer === 'true';
      const entityType = tile.dataset.entityType;
      const entityState = tile.dataset.entityState;

      headerText = `${terrain ? terrain.charAt(0).toUpperCase() + terrain.slice(1) : 'Tile'}`;
      coordsText = `X: ${x}, Y: ${y}`;

      let contents = [];
      if (hasPlayer) {
        contents.push('⚔️ Viking Expedition Band');
      }
      if (entityState) {
        contents.push(entityState);
      }

      if (contents.length === 0) {
        if (tile.classList.contains('discovery-edge')) {
          headerText = 'Unexplored Boundary';
          contents.push('Step here to draw and discover a new tile from the deck.');
        } else if (terrain === 'deep_water' || terrain === 'chasm' || terrain === 'mountain') {
          contents.push(`Rough ${terrain === 'deep_water' ? 'deep water' : terrain}. Impassable obstacle!`);
        } else {
          contents.push('Empty ground. Safe to cross.');
        }
      }
      contentsText = contents.join('<br>');
    } else if (tile.classList.contains('combat-cell')) {
      const r = tile.dataset.row;
      const c = tile.dataset.col;
      headerText = `Combat Grid Lane ${Number(r)+1}`;
      coordsText = `Col: ${c}`;
      
      const unitEl = tile.querySelector('.combat-unit');
      if (unitEl) {
        contentsText = unitEl.title || 'Combat unit/monster.';
      } else {
        contentsText = c <= 1 ? 'Deployable Zone' : 'Empty lane battlefield.';
      }
    }

    if (!headerText) {
      elTooltip.style.display = 'none';
      return;
    }

    elTooltip.innerHTML = `
      <div class="game-tooltip-header">
        <span>${headerText}</span>
        <span class="game-tooltip-coords">${coordsText}</span>
      </div>
      <div class="game-tooltip-contents">${contentsText}</div>
    `;
    elTooltip.style.borderLeftColor = borderAccent;
    elTooltip.style.display = 'flex';
  });

  document.body.addEventListener('mousemove', (e) => {
    if (elTooltip.style.display === 'flex') {
      elTooltip.style.left = (e.clientX + 15) + 'px';
      elTooltip.style.top = (e.clientY + 15) + 'px';
    }
  });

  document.body.addEventListener('mouseout', (e) => {
    const tile = e.target.closest('.world-tile, .location-tile, .combat-cell');
    const godTarget = e.target.closest('[data-god-tooltip]');
    if (tile && !e.relatedTarget?.closest('.world-tile, .location-tile, .combat-cell')) {
      elTooltip.style.display = 'none';
    }
    if (godTarget && !e.relatedTarget?.closest('[data-god-tooltip]')) {
      elTooltip.style.display = 'none';
    }
  });
}

// Automatically discover/draw tiles in 4 cardinal directions from player
function autoDiscoverAdjacent(locId) {
  const locState = STATE.locations[locId];
  if (!locState) return;

  const px = STATE.party.localX;
  const py = STATE.party.localY;
  
  const neighbors = [
    { x: px + 1, y: py },
    { x: px - 1, y: py },
    { x: px, y: py + 1 },
    { x: px, y: py - 1 }
  ];

  neighbors.forEach(n => {
    if (n.x >= 0 && n.x < 10 && n.y >= 0 && n.y < 10) {
      const coordKey = `${n.x},${n.y}`;
      if (!locState.placedTiles[coordKey]) {
        discoverTile(locId, n.x, n.y);
      }
    }
  });
}

// Attempt to move player locally, auto-discovering tiles and gathering contents or triggering combat
function attemptLocalMove(targetX, targetY) {
  const locId = STATE.party.currentLocationId;
  const locState = STATE.locations[locId];
  if (!locState) return;

  const coordKey = `${targetX},${targetY}`;
  let tile = locState.placedTiles[coordKey];

  // If tile is unplaced but adjacent, auto-discover it
  if (!tile) {
    const isAdjacent = Math.abs(targetX - STATE.party.localX) + Math.abs(targetY - STATE.party.localY) === 1;
    const adjacentUnplaced = getAdjacentUnplacedSlots(locState.placedTiles);
    if (isAdjacent && adjacentUnplaced.includes(coordKey)) {
      discoverTile(locId, targetX, targetY);
      tile = locState.placedTiles[coordKey];
    }
  }

  if (!tile) return;

  // Impassable terrain block
  if (tile.terrainType === 'chasm' || tile.terrainType === 'mountain' || tile.terrainType === 'deep_water') {
    logLocation(`The rugged ${tile.terrainType === 'deep_water' ? 'deep water' : tile.terrainType} is impassable!`, 'warn-message');
    return;
  }

  // Check tile entities
  if (tile.entity) {
    const ent = tile.entity;
    
    if (ent.type === 'enemy_army' && !ent.isDefeated) {
      // Set pending coordinates, trigger combat, but do NOT move yet
      STATE.party.pendingLocalX = targetX;
      STATE.party.pendingLocalY = targetY;
      triggerCombatTransition(coordKey, ent);
      return;
    }

    // Move player first for non-combat entities
    STATE.party.localX = targetX;
    STATE.party.localY = targetY;
    autoDiscoverAdjacent(locId);
    notify('STATE_UPDATED');

    // Automatically trigger interactions
    if (ent.type === 'treasure' && !ent.isLooted) {
      triggerEncounterEvent(coordKey, ent);
    } else if (ent.type === 'burial_mound' && !ent.isExplored) {
      triggerEncounterEvent(coordKey, ent);
    } else if (ent.type === 'dolmen' && !ent.isVisited) {
      triggerEncounterEvent(coordKey, ent);
    } else if (ent.type === 'cave_entrance') {
      triggerEnterCavePortal(coordKey, ent);
    }
  } else {
    // Normal empty tile movement
    STATE.party.localX = targetX;
    STATE.party.localY = targetY;
    autoDiscoverAdjacent(locId);
    notify('STATE_UPDATED');
  }
}

// Bind simple click callback if element exists
function bindButton(id, callback) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', callback);
}

// Global render router
export function render() {
  // Toggle screens panels
  for (const sName in screens) {
    if (sName === STATE.activeScreen) {
      screens[sName].classList.remove('hidden');
    } else {
      screens[sName].classList.add('hidden');
    }
  }

  // Display/Hide header bar
  if (STATE.activeScreen === 'menu') {
    elHeader.classList.add('hidden');
  } else {
    elHeader.classList.remove('hidden');
  }

  // Render sub sections
  renderResourceBar();

  if (STATE.activeScreen === 'world') {
    renderWorldMap();
  } else if (STATE.activeScreen === 'town') {
    renderTownScreen();
  } else if (STATE.activeScreen === 'location') {
    renderLocationMap();
  } else if (STATE.activeScreen === 'combat') {
    renderCombatGrid();
  } else if (STATE.activeScreen === 'quests') {
    renderQuestsScreen();
  }
}

// Update resource counts and active blessing details
function renderResourceBar() {
  elGold.innerText = STATE.resources.gold;
  elFood.innerText = STATE.resources.food;
  elWood.innerText = STATE.resources.wood;
  elSheep.innerText = STATE.resources.sheep;
  elBand.innerText = STATE.band.length;

  if (STATE.activeBlessing) {
    elBlessing.innerHTML = `<span class="icon">✨</span> <span style="color: var(--color-${STATE.activeBlessing})">${STATE.activeBlessing.toUpperCase()}'S BLESSING</span>`;
  } else {
    elBlessing.innerHTML = `<span>No Active Buff</span>`;
  }
}

// Render 15x15 World Grid Layout
function renderWorldMap() {
  elWorldMap.innerHTML = '';
  elWorldCoords.innerText = `Longship Pos - X: ${STATE.party.worldX}, Y: ${STATE.party.worldY}`;

  const tiles = STATE.worldMap.tiles;
  const revealed = STATE.worldMap.revealed;
  const locations = STATE.worldMap.locations;

  const adjacents = getAdjacentCoords(STATE.party.worldX, STATE.party.worldY);

  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      const elCell = document.createElement('div');
      elCell.classList.add('world-tile');
      elCell.dataset.x = x;
      elCell.dataset.y = y;
      
      const isFog = revealed[y][x];
      const hasLocation = locations[`${x},${y}`];
      
      if (isFog) {
        elCell.classList.add('fog');
      } else {
        const terrain = tiles[y][x];
        elCell.classList.add(`terrain-${terrain}`);
        elCell.dataset.terrain = terrain;
        if (hasLocation) {
          elCell.dataset.locationName = hasLocation.name;
          elCell.dataset.locationType = hasLocation.type;
        }

        if (hasLocation) {
          const loc = hasLocation;
          const marker = document.createElement('span');
          if (loc.type === 'town') {
            marker.innerText = '🏘️';
            marker.classList.add('town-marker');
          } else {
            marker.innerText = '⚔️';
            marker.classList.add('raid-marker');
          }
          elCell.appendChild(marker);
        }
      }

      // Draw player longship position
      if (x === STATE.party.worldX && y === STATE.party.worldY) {
        const drakkar = document.createElement('div');
        drakkar.classList.add('player-marker');
        drakkar.innerText = '🚢';
        elCell.dataset.hasPlayer = 'true';
        elCell.appendChild(drakkar);
      }

      // Navigation handler for adjacent cells
      const isAdjacent = adjacents.some(a => a.x === x && a.y === y);
      if (isAdjacent) {
        elCell.classList.add('tile-border-highlight');
        elCell.addEventListener('click', () => {
          movePartyOnWorld(x, y);
        });
      }

      // Allow entering town/raid if clicked on player's current coordinate
      if (x === STATE.party.worldX && y === STATE.party.worldY && hasLocation) {
        elCell.addEventListener('click', () => {
          enterLocation(locations[`${x},${y}`]);
        });
      }

      elWorldMap.appendChild(elCell);
    }
  }

  // Center player scroll view — blur first so browser doesn't auto-scrollIntoView the last focused tile
  setTimeout(() => {
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
    const playerMarker = elWorldMap.querySelector('.player-marker');
    if (playerMarker) {
      const wrapper = elWorldMap.parentElement;
      if (wrapper) {
        const scrollX = playerMarker.offsetLeft - (wrapper.clientWidth / 2) + (playerMarker.clientWidth / 2);
        const scrollY = playerMarker.offsetTop - (wrapper.clientHeight / 2) + (playerMarker.clientHeight / 2);
        wrapper.scrollTo({ left: scrollX, top: scrollY });
      }
    }
  }, 50);
}

// World Move State Processing
function movePartyOnWorld(x, y) {
  x = Number(x);
  y = Number(y);
  
  const previousTerrain = STATE.worldMap.tiles[STATE.party.worldY][STATE.party.worldX];
  const targetTerrain = STATE.worldMap.tiles[y][x];

  // Verify costs
  let cost = 1; // Sea/River cost
  if (targetTerrain !== 'water' && targetTerrain !== 'river') {
    cost = 3; // Land cost
  }

  // Deduct food
  if (STATE.resources.food > 0) {
    adjustResource('food', -cost);
  } else {
    // Starving: moving kills a random soldier
    triggerStarvationDamage();
    logWorld('STARVING! Starvation claimed a member of your band.', 'warn-message');
  }

  // Set position
  STATE.party.worldX = x;
  STATE.party.worldY = y;

  // Reveal fog in a 2-tile radius around player
  revealWorldFog(x, y);

  notify('STATE_UPDATED');
}

// Reveal Fog surrounding coords
function revealWorldFog(px, py) {
  const size = 15;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.abs(x - px) + Math.abs(y - py);
      if (dist <= 2) {
        STATE.worldMap.revealed[y][x] = false; // Reveal fog
      }
    }
  }
}

// Enter Town or Dungeon
function enterLocation(locData) {
  if (locData.type === 'town') {
    STATE.party.currentLocationId = locData.id;
    setScreen('town');
    logWorld(`Entered town: ${locData.name}.`);
  } else {
    // Generate/Load Location Sub-Grid
    STATE.party.currentLocationId = locData.id;
    
    generateLocationMap(locData.id, locData.terrain);
    
    // Start player at local coordinates 5,5 (start tile)
    STATE.party.localX = 5;
    STATE.party.localY = 5;
    
    autoDiscoverAdjacent(locData.id);
    
    setScreen('location');
    logWorld(`Entering raid coordinates: ${locData.name}.`);
  }
}

// Render Town Options
function renderTownScreen() {
  const locId = STATE.party.currentLocationId;
  const locData = Object.values(STATE.worldMap.locations).find(l => l.id === locId);
  elTownName.innerText = locData ? locData.name : 'Viking Kaufang';

  // Build relic lists for temple offerings
  elShrineList.innerHTML = '';
  const relics = STATE.inventory.filter(i => 
    i.includes('Shard of Gungnir') || 
    i.includes('Mjolnir\'s Core') || 
    i.includes('Amber Tear') || 
    i.includes('Urn of Ash') || 
    i.includes('Trickster Coin')
  );

  if (relics.length > 0) {
    elShrineEmpty.classList.add('hidden');
    
    // Map objects mappings
    const godMappings = {
      'Shard of Gungnir': { name: 'Odin', text: 'Sacrifice Shard of Gungnir to Odin' },
      'Mjolnir\'s Core': { name: 'Thor', text: 'Sacrifice Mjolnir\'s Core to Thor' },
      'Freya\'s Amber Tear': { name: 'Freya', text: 'Sacrifice Amber Tear to Freya' },
      'Hel\'s Urn of Ash': { name: 'Hel', text: 'Sacrifice Urn of Ash to Hel' },
      'Loki\'s Trickster Coin': { name: 'Loki', text: 'Sacrifice Trickster Coin to Loki' }
    };

    relics.forEach(relic => {
      const map = godMappings[relic] || { name: 'odin', text: `Sacrifice ${relic}` };
      const row = document.createElement('div');
      row.classList.add('trade-row');
      
      const label = document.createElement('span');
      label.innerText = relic;
      
      const btn = document.createElement('button');
      btn.classList.add('btn', 'btn-sm', 'btn-primary');
      btn.innerText = `Appease ${map.name}`;
      btn.addEventListener('click', () => {
        sacrificeRelic(relic, map.name.toLowerCase());
      });

      row.appendChild(label);
      row.appendChild(btn);
      elShrineList.appendChild(row);
    });
  } else {
    elShrineEmpty.classList.remove('hidden');
  }
}

// Render 10x10 Dungeon Discovery View (Carcassonne)
function renderLocationMap() {
  elLocMap.innerHTML = '';
  
  const locId = STATE.party.currentLocationId;
  const locState = STATE.locations[locId];
  if (!locState) return;

  elLocTitle.innerText = `Exploring Site`;
  elLocDeckCount.innerText = locState.tileStack.length;

  const placed = locState.placedTiles;
  const px = STATE.party.localX;
  const py = STATE.party.localY;

  // We gather adjacent tiles to verify discovery slots
  const adjacentUnplaced = getAdjacentUnplacedSlots(placed);

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const elCell = document.createElement('div');
      elCell.classList.add('location-tile');
      elCell.dataset.x = x;
      elCell.dataset.y = y;
      
      const coordKey = `${x},${y}`;
      const tile = placed[coordKey];

      if (tile) {
        // Render terrain
        elCell.classList.add(`terrain-${tile.terrainType}`);
        elCell.dataset.terrain = tile.terrainType;
        
        let entityDesc = '';
        if (tile.entity) {
          const ent = tile.entity;
          if (ent.type === 'treasure' && !ent.isLooted) entityDesc = '🪙 Treasure Chest (Loot Gold)';
          else if (ent.type === 'enemy_army' && !ent.isDefeated) entityDesc = `👹 Monster Nest (${ent.monsters[0].monsterClass})`;
          else if (ent.type === 'burial_mound' && !ent.isExplored) entityDesc = '🪦 Ancient Burial Mound';
          else if (ent.type === 'dolmen' && !ent.isVisited) entityDesc = `🏆 Sacred Dolmen Stone (Appease ${ent.godName.toUpperCase()})`;
          else if (ent.type === 'cave_entrance') entityDesc = '🕳️ Cave Sub-Dungeon Portal';
          
          if (entityDesc) {
            elCell.dataset.entityType = ent.type;
            elCell.dataset.entityState = entityDesc;
          }
        }
        
        // Show interactive entity if present
        if (tile.entity) {
          const ent = tile.entity;
          const badge = document.createElement('span');
          badge.classList.add('location-entity');

          if (ent.type === 'treasure' && !ent.isLooted) {
            badge.innerText = '🪙';
            badge.addEventListener('click', () => triggerEncounterEvent(coordKey, ent));
          } 
          else if (ent.type === 'enemy_army' && !ent.isDefeated) {
            badge.innerText = '👹';
            badge.addEventListener('click', () => triggerCombatTransition(coordKey, ent));
          } 
          else if (ent.type === 'burial_mound' && !ent.isExplored) {
            badge.innerText = '🪦';
            badge.addEventListener('click', () => triggerEncounterEvent(coordKey, ent));
          } 
          else if (ent.type === 'dolmen' && !ent.isVisited) {
            badge.innerText = '🏆';
            badge.addEventListener('click', () => triggerEncounterEvent(coordKey, ent));
          }
          else if (ent.type === 'cave_entrance') {
            badge.innerText = '🕳️';
            badge.addEventListener('click', () => triggerEnterCavePortal(coordKey, ent));
          }

          elCell.appendChild(badge);
        }

        // Draw player band local marker
        if (x === px && y === py) {
          const marker = document.createElement('div');
          marker.classList.add('player-marker');
          marker.innerText = '⚔️';
          elCell.dataset.hasPlayer = 'true';
          elCell.appendChild(marker);
        }

        // Click to move player locally to adjacent placed tiles
        const isNeighbor = Math.abs(x - px) + Math.abs(y - py) === 1;
        if (isNeighbor) {
          elCell.classList.add('tile-border-highlight');
          elCell.addEventListener('click', () => {
            attemptLocalMove(x, y);
          });
        }

      } 
      // If cell is unplaced but adjacent to a placed tile, make it a discovery edge
      else if (adjacentUnplaced.includes(coordKey)) {
        const isNeighborToPlayer = Math.abs(x - px) + Math.abs(y - py) === 1;
        if (isNeighborToPlayer) {
          elCell.classList.add('discovery-edge');
          elCell.addEventListener('click', () => {
            attemptLocalMove(x, y);
          });
        } else {
          elCell.classList.add('fog');
        }
      } 
      else {
        elCell.classList.add('fog');
      }

      elLocMap.appendChild(elCell);
    }
  }

  // Center player scroll view — blur first so browser doesn't auto-scrollIntoView the last focused tile
  setTimeout(() => {
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
    const playerMarker = elLocMap.querySelector('.player-marker');
    if (playerMarker) {
      const wrapper = elLocMap.parentElement;
      if (wrapper) {
        const scrollX = playerMarker.offsetLeft - (wrapper.clientWidth / 2) + (playerMarker.clientWidth / 2);
        const scrollY = playerMarker.offsetTop - (wrapper.clientHeight / 2) + (playerMarker.clientHeight / 2);
        wrapper.scrollTo({ left: scrollX, top: scrollY });
      }
    }
  }, 50);
}

// Find unplaced tiles sharing an edge with any placed tile
function getAdjacentUnplacedSlots(placed) {
  const keys = Object.keys(placed);
  const slots = new Set();
  
  keys.forEach(k => {
    const [x, y] = k.split(',').map(Number);
    const neighbors = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 }
    ];

    neighbors.forEach(n => {
      if (n.x >= 0 && n.x < 10 && n.y >= 0 && n.y < 10) {
        const nKey = `${n.x},${n.y}`;
        if (!placed[nKey]) {
          slots.add(nKey);
        }
      }
    });
  });

  return Array.from(slots);
}

// Enter Cave Sub-Dungeon Portal
function triggerEnterCavePortal(coordKey, entity) {
  STATE.party.currentLocationId = entity.targetLocationId;
  generateLocationMap(entity.targetLocationId, 'mountain');
  STATE.party.localX = 5;
  STATE.party.localY = 5;
  notify('STATE_UPDATED');
  logLocation('Stepped down into the deep Jotunn Crag Cave chambers.');
}

// Renders choice dialogs for location interactions
function triggerEncounterEvent(coordKey, entity) {
  if (entity.type === 'treasure') {
    adjustResource('gold', entity.silver);
    entity.isLooted = true;
    showToast(`Uncovered buried chest! Looted +${entity.silver} Gold.`, '🪙');
    notify('STATE_UPDATED');
  } 
  else if (entity.type === 'dolmen') {
    STATE.inventory.push(entity.magicObjectId);
    entity.isVisited = true;
    showToast(`Retrieved ${entity.magicObjectId} relic from Druid Dolmen!`, '🏆');
    notify('STATE_UPDATED');
  }
  else {
    // Show overlay modal for entities with real choices
    showOverlay(elModalEvent);
    elModalEventChoices.innerHTML = '';

    if (entity.type === 'burial_mound') {
      elModalEventTitle.innerText = 'Burial Mound';
      elModalEventBody.innerText = `You uncover an ancient viking Barrow Grave. Deep markings suggest a warrior tomb. Defile the grave to look for relics, or perform a sacrifice of Sheep to please Hel?`;

      const choice1 = document.createElement('button');
      choice1.classList.add('btn', 'btn-danger');
      choice1.innerText = 'Plunder Mound (+10 Gold, pleases Loki, angers Thor)';
      choice1.addEventListener('click', () => {
        adjustResource('gold', 10);
        entity.isExplored = true;
        adjustFavor('loki', 1);
        hideOverlay(elModalEvent);
        notify('STATE_UPDATED');
        showToast('Plundered Burial Mound! Gained +10 Gold (Thor displeased, Loki pleased).', '🪦');
      });

      const choice2 = document.createElement('button');
      choice2.classList.add('btn', 'btn-primary');
      choice2.innerText = 'Sacrifice Sheep (-1 Sheep, pleases Hel)';
      choice2.addEventListener('click', () => {
        if (STATE.resources.sheep >= 1) {
          adjustResource('sheep', -1);
          entity.isExplored = true;
          adjustFavor('hel', 1);
          hideOverlay(elModalEvent);
          showToast('Sacrificed a sheep to appease Hel.', '🐑');
        } else {
          showToast('You have no sheep to sacrifice!', '⚠️');
        }
        notify('STATE_UPDATED');
      });

      const choice3 = document.createElement('button');
      choice3.classList.add('btn');
      choice3.innerText = 'Leave Grave untouched';
      choice3.addEventListener('click', () => {
        hideOverlay(elModalEvent);
      });

      elModalEventChoices.appendChild(choice1);
      elModalEventChoices.appendChild(choice2);
      elModalEventChoices.appendChild(choice3);
    }
    updateModalKeyboardNavigation();
  }
}

// Trigger screen transition for combat map
function triggerCombatTransition(coordKey, entity) {
  setScreen('combat');
  startCombat(STATE.party.currentLocationId, coordKey, entity);
}

// Render 10x8 Combat lanes grid
function renderCombatGrid() {
  elCombatGrid.innerHTML = '';
  
  const grid = STATE.combat.grid;
  if (!grid || grid.length === 0) return;

  // Build grid layout cells
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 10; c++) {
      const elCell = document.createElement('div');
      elCell.classList.add('combat-cell');
      elCell.dataset.row = r;
      elCell.dataset.col = c;

      // Make columns 0 and 1 highlighted deploy zones when paused
      if (STATE.combat.paused && c <= 1 && !grid[r][c]) {
        if (STATE.combat.selectedPoolIndex !== null) {
          elCell.classList.add('deployable-zone');
          elCell.addEventListener('click', () => {
            deployUnit(STATE.combat.selectedPoolIndex, r, c);
          });
        }
        
        // Render keyboard shortcut key hint in the cell (qweruiop for col 0, asdfjklö for col 1)
        const hints = {
          '0,0': 'Q', '1,0': 'W', '2,0': 'E', '3,0': 'R', '4,0': 'U', '5,0': 'I', '6,0': 'O', '7,0': 'P',
          '0,1': 'A', '1,1': 'S', '2,1': 'D', '3,1': 'F', '4,1': 'J', '5,1': 'K', '6,1': 'L', '7,1': 'Ö'
        };
        const hintKey = `${r},${c}`;
        if (hints[hintKey]) {
          const elHint = document.createElement('span');
          elHint.className = 'cell-key-hint';
          elHint.innerText = hints[hintKey];
          elCell.appendChild(elHint);
        }
      }

      // Check for unit placed in cell
      const unit = grid[r][c];
      if (unit) {
        const elUnit = document.createElement('div');
        elUnit.classList.add('combat-unit', `alliance-${unit.alliance}`);
        
        // Attack dynamic animations
        if (unit.isAttacking) {
          elUnit.classList.add('attacking');
        }

        // Allow removing unit from deployment grid if paused, OR fleeing if fleeMode is active
        if (unit.alliance === 'player') {
          if (STATE.combat.fleeMode) {
            elUnit.classList.add('fleeing-target');
            elUnit.addEventListener('click', (e) => {
              e.stopPropagation();
              unit.isFleeing = true;
              notify('COMBAT_UPDATE');
            });
          } else if (STATE.combat.paused) {
            elUnit.classList.add('removable-unit');
            elUnit.addEventListener('click', (e) => {
              e.stopPropagation();
              undeployUnit(r, c);
            });
          }
        }

        // Emoji display based on soldier/monster class type or fleeing state
        if (unit.isFleeing) {
          elUnit.classList.add('fleeing');
          elUnit.innerText = '🏃‍♂️';
        } else {
          const avatars = {
            shieldmaiden: '🛡️',
            berserker: '🪓',
            huntsman: '🏹',
            'Giant Brood-Spider': '🕷️',
            'Fenrir Pack Wolf': '🐺',
            'Draugr Warrior': '🧟',
            'Cave Troll': '👹',
            'Frost Giant (Jotunn)': '❄️',
            'Lindwurm': '🐉'
          };
          elUnit.innerText = avatars[unit.type] || '👾';
        }
        elUnit.title = `${unit.name} (${unit.hp}/${unit.maxHp} HP)`;

        // Healthbar rendering
        const hbContainer = document.createElement('div');
        hbContainer.classList.add('health-bar-container');
        if (unit.alliance === 'enemy') hbContainer.classList.add('enemy-hb');

        const hbFill = document.createElement('div');
        hbFill.classList.add('health-bar-fill');
        const hpPct = (unit.hp / unit.maxHp) * 100;
        hbFill.style.width = `${Math.max(0, hpPct)}%`;

        hbContainer.appendChild(hbFill);
        elUnit.appendChild(hbContainer);
        elCell.appendChild(elUnit);
      }

      elCombatGrid.appendChild(elCell);
    }
  }

  // Toggle paused labels
  if (STATE.combat.paused) {
    elCombatPauseBtn.innerText = 'Start Battle [Enter]';
    elCombatPauseBtn.classList.remove('btn-warning');
    elCombatPauseBtn.classList.add('btn-primary');
    elCombatGrid.classList.add('paused-deploying');
  } else {
    elCombatPauseBtn.innerText = 'Pause / Place [Space]';
    elCombatPauseBtn.classList.remove('btn-primary');
    elCombatPauseBtn.classList.add('btn-warning');
    elCombatGrid.classList.remove('paused-deploying');
  }

  // Toggle Flee button label
  if (elCombatFleeBtn) {
    if (STATE.combat.fleeMode) {
      elCombatFleeBtn.innerText = 'Flee Mode: ON';
      elCombatFleeBtn.classList.remove('btn-danger');
      elCombatFleeBtn.classList.add('btn-primary');
    } else {
      elCombatFleeBtn.innerText = 'Flee Mode: OFF';
      elCombatFleeBtn.classList.remove('btn-primary');
      elCombatFleeBtn.classList.add('btn-danger');
    }
  }

  // Update active stance class on buttons
  const btnRetreat = document.getElementById('btn-stance-retreat');
  const btnDefend = document.getElementById('btn-stance-defend');
  const btnHold = document.getElementById('btn-stance-hold');
  const btnAttack = document.getElementById('btn-stance-attack');
  if (btnRetreat && btnDefend && btnHold && btnAttack) {
    const stance = STATE.combat.stance || 'attack';
    btnRetreat.classList.toggle('active-stance', stance === 'retreat');
    btnDefend.classList.toggle('active-stance', stance === 'defend');
    btnHold.classList.toggle('active-stance', stance === 'hold');
    btnAttack.classList.toggle('active-stance', stance === 'attack');
  }

  // Render Deployment Pool Hand cards
  elCombatPoolList.innerHTML = '';
  STATE.combat.pool.forEach((unit, idx) => {
    const card = document.createElement('div');
    card.classList.add('pool-card');
    if (STATE.combat.selectedPoolIndex === idx) {
      card.classList.add('selected');
    }

    const icons = { shieldmaiden: '🛡️', berserker: '🪓', huntsman: '🏹' };
    const numHint = idx < 8 ? `<span class="pool-number-hint">[${idx + 1}]</span> ` : '';
    const hpPct = (unit.hp / unit.maxHp) * 100;
    
    card.innerHTML = `
      <span>${numHint}${icons[unit.type]} ${unit.name}</span>
      <span style="font-size:0.75rem">${unit.type}</span>
      <div class="health-bar-container" style="position: absolute; bottom: 4px; left: 6px; right: 6px; height: 4px;">
        <div class="health-bar-fill" style="width: ${Math.max(0, hpPct)}%"></div>
      </div>
    `;
    // Enable Drag and Drop to reorder pool cards
    card.draggable = true;
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', idx);
      card.classList.add('dragging');
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const draggedIdx = parseInt(e.dataTransfer.getData('text/plain'));
      if (!isNaN(draggedIdx) && draggedIdx !== idx) {
        const selectedUnit = STATE.combat.selectedPoolIndex !== null ? STATE.combat.pool[STATE.combat.selectedPoolIndex] : null;

        const [moved] = STATE.combat.pool.splice(draggedIdx, 1);
        STATE.combat.pool.splice(idx, 0, moved);

        if (selectedUnit) {
          STATE.combat.selectedPoolIndex = STATE.combat.pool.indexOf(selectedUnit);
        }

        notify('COMBAT_UPDATE');
      }
    });

    card.addEventListener('click', () => {
      if (!STATE.combat.paused) {
        togglePause(); // Force pause to allow placements
      }
      STATE.combat.selectedPoolIndex = idx;
      notify('STATE_UPDATED');
    });

    elCombatPoolList.appendChild(card);
  });
}

// Render Gods Progress screens
function renderQuestsScreen() {
  elQuestsList.innerHTML = '';

  const gods = ['odin', 'thor', 'freya', 'hel', 'loki'];
  
  gods.forEach(gKey => {
    const lore = GOD_LORE[gKey];
    const row = document.createElement('div');
    row.classList.add('god-row');
    
    // ── God Identity column (hover = full god info tooltip) ──
    const idCol = document.createElement('div');
    idCol.classList.add('god-identity');
    idCol.dataset.godTooltip = gKey;
    idCol.dataset.tooltipSection = 'identity';
    idCol.style.cursor = 'help';
    
    const favor = STATE.godFavor[gKey];
    const favorColor = favor > 0 ? 'var(--color-success)' : favor < 0 ? 'var(--color-danger)' : 'var(--text-muted)';
    const favorSign = favor > 0 ? '+' : '';

    const name = document.createElement('span');
    name.classList.add('god-name');
    name.innerHTML = `${lore.icon} ${lore.title.split('—')[0].trim()}`;
    name.style.color = `var(--color-${gKey})`;
    
    const favorEl = document.createElement('span');
    favorEl.classList.add('god-favor-score');
    favorEl.innerHTML = `Favor: <b style="color:${favorColor}">${favorSign}${favor}</b> / 5`;

    // Relic hint under the name
    const relicHint = document.createElement('span');
    relicHint.style.cssText = 'font-size:0.7rem;color:var(--text-muted);margin-top:2px;';
    relicHint.innerHTML = `🏺 ${lore.relic}`;
    
    idCol.appendChild(name);
    idCol.appendChild(favorEl);
    idCol.appendChild(relicHint);
    row.appendChild(idCol);

    // ── Milestones track column (each rune = tooltip for that milestone) ──
    const trackCol = document.createElement('div');
    trackCol.classList.add('god-progress-bar', `deity-${gKey}`);
    
    const track = STATE.godQuests[gKey];
    const runes = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ'];
    for (let i = 0; i < 5; i++) {
      const step = document.createElement('div');
      step.classList.add('milestone-step');
      step.innerText = runes[i];
      step.dataset.godTooltip = gKey;
      step.dataset.tooltipSection = 'milestone';
      step.dataset.milestoneIdx = i;
      step.style.cursor = 'help';
      if (track[i]) {
        step.classList.add('achieved');
      }
      trackCol.appendChild(step);
    }
    row.appendChild(trackCol);

    // ── Champion toggle column (hover = buff tooltip) ──
    const toggleCol = document.createElement('div');
    toggleCol.classList.add('champion-selector-cell');
    
    const isChampion = track.every(x => x === true);
    if (isChampion) {
      const btn = document.createElement('button');
      btn.classList.add('btn', 'btn-sm');
      btn.dataset.godTooltip = gKey;
      btn.dataset.tooltipSection = 'champion';
      
      if (STATE.activeBlessing === gKey) {
        btn.innerText = 'Active ✨';
        btn.classList.add('btn-primary');
      } else {
        btn.innerText = 'Select Buff';
        btn.addEventListener('click', () => {
          STATE.activeBlessing = gKey;
          notify('STATE_UPDATED');
        });
      }
      toggleCol.appendChild(btn);
    } else {
      // Show a locked hint that also has a tooltip explaining how to unlock
      const locked = document.createElement('span');
      locked.style.cssText = 'font-size:0.8rem;color:var(--text-muted);cursor:help;';
      locked.innerText = '🔒 Locked';
      locked.dataset.godTooltip = gKey;
      locked.dataset.tooltipSection = 'champion';
      toggleCol.appendChild(locked);
    }
    
    row.appendChild(toggleCol);
    elQuestsList.appendChild(row);
  });
}

/* --- Logging & Overlays helpers --- */

export function logWorld(msg, typeClass = 'system-message') {
  const p = document.createElement('p');
  p.classList.add(typeClass);
  p.innerText = msg;
  elWorldLog.appendChild(p);
  elWorldLog.scrollTop = elWorldLog.scrollHeight;
}

export function logLocation(msg, typeClass = 'system-message') {
  const p = document.createElement('p');
  p.classList.add(typeClass);
  p.innerText = msg;
  elLocLog.appendChild(p);
  elLocLog.scrollTop = elLocLog.scrollHeight;
}

// Display a discrete Norse-themed toast notification
export function showToast(msg, icon = '✨', isImportant = false) {
  const containerId = isImportant ? 'toast-container-important' : 'toast-container';
  const container = document.getElementById(containerId);
  if (!container) return;

  const card = document.createElement('div');
  card.className = `toast-card glass-panel ${isImportant ? 'important-toast' : ''}`;
  
  card.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${msg}</span>
  `;

  // Click to dismiss immediately
  card.addEventListener('click', () => {
    card.remove();
  });

  // Remove element after animation ends
  card.addEventListener('animationend', (e) => {
    if (e.animationName === 'toastFadeOut') {
      card.remove();
    }
  });

  container.appendChild(card);
}

let activeModalFocusIndex = 0;

function updateModalKeyboardNavigation() {
  const visibleOverlay = document.querySelector('.modal-overlay:not(.hidden)');
  if (!visibleOverlay) {
    activeModalFocusIndex = 0;
    return;
  }

  const buttons = Array.from(visibleOverlay.querySelectorAll('button, .btn'));
  if (buttons.length === 0) return;

  if (activeModalFocusIndex >= buttons.length) {
    activeModalFocusIndex = 0;
  }

  buttons.forEach((btn, idx) => {
    let cleanText = btn.dataset.cleanText || btn.innerText;
    if (!btn.dataset.cleanText) {
      btn.dataset.cleanText = cleanText;
    }
    
    // Set HTML with a nice stylized key-badge
    btn.innerHTML = `<span class="key-badge">${idx + 1}</span> ${btn.dataset.cleanText}`;

    // Apply focus indicator
    if (idx === activeModalFocusIndex) {
      btn.classList.add('focused-option');
    } else {
      btn.classList.remove('focused-option');
    }
  });
}

function showOverlay(el) {
  el.classList.remove('hidden');
  activeModalFocusIndex = 0;
  updateModalKeyboardNavigation();
}

function hideOverlay(el) {
  el.classList.add('hidden');
  updateModalKeyboardNavigation();
}

// Listen to key actions triggered by state
export function handleStateNotification(event, data) {
  if (event === 'SCREEN_CHANGE') {
    render();
  } 
  else if (event === 'FAVOR_UPDATED' || event === 'RESOURCES_UPDATED') {
    renderResourceBar();
    if (STATE.activeScreen === 'quests') renderQuestsScreen();
    if (STATE.activeScreen === 'town') renderTownScreen();
  }
  else if (event === 'COMBAT_START') {
    render();
  }
  else if (event === 'COMBAT_UPDATE' || event === 'COMBAT_PAUSED') {
    if (STATE.activeScreen === 'combat') renderCombatGrid();
  }
  else if (event === 'COMBAT_DAMAGE') {
    if (STATE.activeScreen === 'combat') renderCombatGrid();
  }
  else if (event === 'COMBAT_DEATH') {
    logWorld(`Dead: Unit '${data.name}' was slain on the lanes.`, 'combat-message');
  }
  else if (event === 'COMBAT_BREACH') {
    logWorld(`Line breached! Monster '${data.unit.name}' reached base and stole 2 ${data.stolen}!`, 'warn-message');
  }
  else if (event === 'COMBAT_SUCCESS_REPLACE') {
    logWorld(`Success! '${data.name}' reached Asgard boundary, earning 1 Gold and returning to pool.`, 'gain-message');
  }
  else if (event === 'COMBAT_VICTORY') {
    logWorld('VICTORY! The lane has been cleared of monsters.', 'gain-message');
    showToast('Victory! You cleared the monsters.', '⚔️', true);
    
    // Auto-resolve pending move on victory
    if (STATE.party.pendingLocalX !== undefined && STATE.party.pendingLocalY !== undefined) {
      STATE.party.localX = STATE.party.pendingLocalX;
      STATE.party.localY = STATE.party.pendingLocalY;
      
      const locId = STATE.party.currentLocationId;
      autoDiscoverAdjacent(locId);
      
      const locState = STATE.locations[locId];
      if (locState) {
        const coordKey = `${STATE.party.localX},${STATE.party.localY}`;
        const tile = locState.placedTiles[coordKey];
        if (tile && tile.entity && tile.entity.type === 'enemy_army') {
          tile.entity.isDefeated = true;
        }
      }
      delete STATE.party.pendingLocalX;
      delete STATE.party.pendingLocalY;
    }
    
    {
      const locId = STATE.party.currentLocationId;
      const locData = locId ? Object.values(STATE.worldMap.locations).find(l => l.id === locId) : null;
      setScreen(locData && locData.type !== 'town' ? 'location' : 'world');
    }
  }
  else if (event === 'COMBAT_DEFEAT') {
    logWorld('DEFEAT! All your Viking soldiers perished on the battlefield.', 'combat-message');
    showToast('Your band was wiped out!', '💀', true);
    // If gold is also 0, trigger Game Over modal, else force them to world map so they recruit
    if (STATE.resources.gold === 0) {
      showOverlay(elModalGameOver);
    } else {
      setScreen('world');
    }
  }
  else if (event === 'RELIC_SACRIFICED') {
    logWorld(`You sacrificed a ${data.relicId} relic to appease ${data.godName.toUpperCase()}.`, 'gain-message');
  }
  else if (event === 'QUEST_MILESTONE') {
    showToast(`Quest Milestone ${data.index + 1} reached for ${data.god.toUpperCase()}!`, '✨', true);
  }
  else if (event === 'ASCENSION_TRIGGERED') {
    elModalAscension.dataset.god = data;
    elModalAscensionText.innerText = `You have completed all 5 milestones for ${data.toUpperCase()}! You are worthy to ascend to the halls of Asgard. Do you choose to ascend now, or remain as Midgard's eternal champion?`;
    showOverlay(elModalAscension);
  }
  else if (event === 'GAME_OVER') {
    showOverlay(elModalGameOver);
  }
}
