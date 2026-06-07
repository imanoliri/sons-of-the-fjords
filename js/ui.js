/* ==========================================================================
   UI MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE, setScreen, adjustResource, recruitSoldier, sacrificeRelic, adjustFavor, triggerStarvationDamage, notify } from './state.js';
import { getAdjacentCoords } from './world.js';
import { discoverTile, generateLocationMap } from './location.js';
import { togglePause, deployUnit, undeployUnit, startCombat, getEffectiveStats } from './combat.js';
import { TOWN_CONFIG } from './config/town.js';
import { MOVEMENT_CONFIG } from './config/movement.js';
import { LOCATION_CONFIG } from './config/location.js';
import { WORLD_CONFIG } from './config/world.js';
import { GODS_CONFIG } from './config/gods.js';

// DOM Selectors
const elHeader = document.getElementById('game-header');
const elGold = document.getElementById('res-gold').querySelector('.val');
const elFood = document.getElementById('res-food').querySelector('.val');
const elWood = document.getElementById('res-wood').querySelector('.val');
const elSheep = document.getElementById('res-sheep').querySelector('.val');
const elBand = document.getElementById('res-band').querySelector('.val');
const elBlessing = document.getElementById('active-blessing-display');
const elTooltip = document.getElementById('game-tooltip');
const elDay = document.getElementById('res-day').querySelector('.val');
const elWorldDifficultyStatus = document.getElementById('world-difficulty-status');
const elLocationDifficultyStatus = document.getElementById('location-difficulty-status');

// Party Panel Modals
const elPartyModal = document.getElementById('modal-party');
const elPartyBandContent = document.getElementById('party-band-content');
const elPartyInventoryContent = document.getElementById('party-inventory-content');
const elTabPartyBand = document.getElementById('tab-party-band');
const elTabPartyInventory = document.getElementById('tab-party-inventory');

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
const elPromptPanel = document.getElementById('portal-prompt-panel');
const elPromptText = document.getElementById('portal-prompt-text');
const elPromptBtn = document.getElementById('btn-use-portal');

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

const elPatronCard = document.getElementById('town-patron-card');
const elPatronList = document.getElementById('town-patron-list');

const MONSTER_EMOJIS = {
  'Giant Brood-Spider': '🕷️',
  'Fenrir Pack Wolf': '🐺',
  'Draugr Warrior': '🧟',
  'Cave Troll': '👹',
  'Frost Giant (Jotunn)': '❄️',
  'Lindwurm': '🐉'
};

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

  // Toggle Party Screen
  bindButton('btn-toggle-party', () => {
    renderPartyPanel();
    showOverlay(elPartyModal);
  });

  bindButton('btn-close-party', () => {
    hideOverlay(elPartyModal);
  });

  bindButton('tab-party-band', () => {
    elTabPartyBand.classList.add('btn-primary');
    elTabPartyInventory.classList.remove('btn-primary');
    elPartyBandContent.classList.remove('hidden');
    elPartyInventoryContent.classList.add('hidden');
  });

  bindButton('tab-party-inventory', () => {
    elTabPartyInventory.classList.add('btn-primary');
    elTabPartyBand.classList.remove('btn-primary');
    elPartyInventoryContent.classList.remove('hidden');
    elPartyBandContent.classList.add('hidden');
  });

  // Town leave button
  document.getElementById('btn-leave-town').addEventListener('click', () => {
    STATE.party.currentLocationId = null;
    setScreen('world');
  });

  // Trade actions
  bindButton('btn-buy-food', () => {
    const t = TOWN_CONFIG.trades.find(x => x.id === 'buy-food');
    const goldCost = Math.abs(t.cost.gold);
    if (STATE.resources.gold >= goldCost) {
      Object.entries(t.cost).forEach(([r, d]) => adjustResource(r, d));
      Object.entries(t.gain).forEach(([r, d]) => adjustResource(r, d));
      logWorld(`Bought ${t.gain.food} food supplies.`, 'gain-message');
    } else { logWorld('Not enough gold to trade food!', 'warn-message'); }
  });

  bindButton('btn-buy-wood', () => {
    const t = TOWN_CONFIG.trades.find(x => x.id === 'buy-wood');
    const goldCost = Math.abs(t.cost.gold);
    if (STATE.resources.gold >= goldCost) {
      Object.entries(t.cost).forEach(([r, d]) => adjustResource(r, d));
      Object.entries(t.gain).forEach(([r, d]) => adjustResource(r, d));
      logWorld(`Bought ${t.gain.wood} wood planks.`, 'gain-message');
    } else { logWorld('Not enough gold to buy wood!', 'warn-message'); }
  });

  bindButton('btn-sell-sheep', () => {
    const t = TOWN_CONFIG.trades.find(x => x.id === 'sell-sheep');
    if (STATE.resources.sheep >= 1) {
      Object.entries(t.cost).forEach(([r, d]) => adjustResource(r, d));
      Object.entries(t.gain).forEach(([r, d]) => adjustResource(r, d));
      logWorld('Sold 1 livestock sheep.', 'gain-message');
    } else { logWorld('No sheep available to trade!', 'warn-message'); }
  });

  bindButton('btn-buy-sheep', () => {
    const t = TOWN_CONFIG.trades.find(x => x.id === 'buy-sheep');
    const goldCost = Math.abs(t.cost.gold);
    if (STATE.resources.gold >= goldCost) {
      Object.entries(t.cost).forEach(([r, d]) => adjustResource(r, d));
      Object.entries(t.gain).forEach(([r, d]) => adjustResource(r, d));
      logWorld('Bought 1 sheep.', 'gain-message');
    } else { logWorld('Not enough gold to purchase sheep!', 'warn-message'); }
  });

  // Recruiting action handlers
  bindButton('btn-recruit-shieldmaiden', () => {
    if (STATE.godFavor.hel === -5) {
      logWorld("Hel's Wrath: Dead band members cannot be replaced!", 'warn-message');
      return;
    }
    const cost = TOWN_CONFIG.recruitCosts.shieldmaiden;
    if (STATE.resources.gold >= cost && STATE.band.length < 8) {
      adjustResource('gold', -cost); recruitSoldier('shieldmaiden');
      logWorld('Enrolled a Shieldmaiden to your band!', 'gain-message');
    } else if (STATE.band.length >= 8) { logWorld('Your Drakkar deck is full (max 8 soldiers)!', 'warn-message');
    } else { logWorld('Not enough gold to hire recruit!', 'warn-message'); }
  });

  bindButton('btn-recruit-berserker', () => {
    if (STATE.godFavor.hel === -5) {
      logWorld("Hel's Wrath: Dead band members cannot be replaced!", 'warn-message');
      return;
    }
    const cost = TOWN_CONFIG.recruitCosts.berserker;
    if (STATE.resources.gold >= cost && STATE.band.length < 8) {
      adjustResource('gold', -cost); recruitSoldier('berserker');
      logWorld('Enrolled a Berserker to your band!', 'gain-message');
    } else if (STATE.band.length >= 8) { logWorld('Your Drakkar deck is full!', 'warn-message');
    } else { logWorld('Not enough gold!', 'warn-message'); }
  });

  bindButton('btn-recruit-huntsman', () => {
    if (STATE.godFavor.hel === -5) {
      logWorld("Hel's Wrath: Dead band members cannot be replaced!", 'warn-message');
      return;
    }
    const cost = TOWN_CONFIG.recruitCosts.huntsman;
    if (STATE.resources.gold >= cost && STATE.band.length < 8) {
      adjustResource('gold', -cost); recruitSoldier('huntsman');
      logWorld('Enrolled a Huntsman to your band!', 'gain-message');
    } else if (STATE.band.length >= 8) { logWorld('Your Drakkar is full!', 'warn-message');
    } else { logWorld('Not enough gold!', 'warn-message'); }
  });

  // Repair Drakkar
  bindButton('btn-repair-ship', () => {
    const cost = Math.abs(TOWN_CONFIG.repairHullCost.wood);
    if (STATE.resources.wood >= cost) {
      adjustResource('wood', -cost);
      logWorld('Drakkar ship hull reinforced and repaired.', 'gain-message');
    } else { logWorld('Not enough timber logs to repair!', 'warn-message'); }
  });

  // Carcassonne escape button
  bindButton('btn-leave-location', () => {
    STATE.party.currentLocationId = null;
    setScreen('world');
    logWorld('Escaped from raid site back to the open sea.');
  });

  // Use portal or explore button
  bindButton('btn-use-portal', () => {
    if (activePortalTarget) {
      if (activePortalTarget.entity.type === 'cave_entrance') {
        triggerEnterCavePortal(activePortalTarget.coordKey, activePortalTarget.entity);
      } else if (activePortalTarget.entity.type === 'burial_mound') {
        triggerEncounterEvent(activePortalTarget.coordKey, activePortalTarget.entity);
      }
    }
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
    // Handle B to toggle Band, Q to toggle Quests (only if not in combat screen)
    if (STATE.activeScreen !== 'combat') {
      if (e.key === 'b' || e.key === 'B') {
        const visibleOverlay = document.querySelector('.modal-overlay:not(.hidden)');
        if (!visibleOverlay || visibleOverlay === elPartyModal) {
          e.preventDefault();
          if (!elPartyModal.classList.contains('hidden')) {
            document.getElementById('btn-close-party')?.click();
          } else {
            document.getElementById('btn-toggle-party')?.click();
          }
          return;
        }
      }
      if (e.key === 'q' || e.key === 'Q') {
        const visibleOverlay = document.querySelector('.modal-overlay:not(.hidden)');
        if (!visibleOverlay || visibleOverlay === elPartyModal) {
          e.preventDefault();
          if (!elPartyModal.classList.contains('hidden')) {
            document.getElementById('btn-close-party')?.click();
          }
          document.getElementById('btn-toggle-quests')?.click();
          return;
        }
      }
    }

    // 0. Handle Escape key to leave Location (Raid or Town) or close panels
    if (e.key === 'Escape') {
      if (!elPartyModal.classList.contains('hidden')) {
        e.preventDefault();
        document.getElementById('btn-close-party')?.click();
        return;
      }
      if (STATE.activeScreen === 'quests') {
        e.preventDefault();
        document.getElementById('btn-close-quests')?.click();
        return;
      }
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

    // 1. Handle modal overlay shortcuts if an overlay is open (excluding close buttons)
    const visibleOverlay = document.querySelector('.modal-overlay:not(.hidden)');
    if (visibleOverlay) {
      const buttons = Array.from(visibleOverlay.querySelectorAll('button, .btn'))
        .filter(btn => !btn.classList.contains('btn-close-x'));
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
      } else if (e.key === 'Enter') {
        if (activePortalTarget) {
          e.preventDefault();
          if (activePortalTarget.entity.type === 'cave_entrance') {
            triggerEnterCavePortal(activePortalTarget.coordKey, activePortalTarget.entity);
          } else if (activePortalTarget.entity.type === 'burial_mound') {
            triggerEncounterEvent(activePortalTarget.coordKey, activePortalTarget.entity);
          }
        }
        return;
      } else if (activePortalTarget && activePortalTarget.entity.type === 'burial_mound') {
        const key = e.key;
        if (key === '1') {
          e.preventDefault();
          adjustResource('gold', 10);
          activePortalTarget.entity.isExplored = true;
          adjustFavor('loki', 1);
          showToast('Plundered Burial Mound! Gained +10 Gold (Thor displeased, Loki pleased).', '🪦');
          notify('STATE_UPDATED');
        } else if (key === '2') {
          e.preventDefault();
          if (STATE.resources.sheep >= 1) {
            adjustResource('sheep', -1);
            activePortalTarget.entity.isExplored = true;
            adjustFavor('hel', 1);
            showToast('Sacrificed a sheep to appease Hel.', '🐑');
          } else {
            showToast('You have no sheep to sacrifice!', '⚠️');
          }
          notify('STATE_UPDATED');
        } else if (key === '3') {
          e.preventDefault();
          elPromptPanel.classList.add('hidden');
          activePortalTarget = null;
          notify('STATE_UPDATED');
        }
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
    buff: 'Huntsmen gain +2 Attack Range & +1 DMG per turn.',
    wrath: 'Wrath: Random unit loses 1 HP every 3 world steps.',
    milestoneEffects: [
      'Fog of war reveals 1 extra tile on each move.',
      'Scouts reveal a 2-tile radius instead of 1.',
      'All Huntsmen gain +1 Attack Range.',
      'Berserkers gain +1 DMG per combat tick.',
      null // Ascension — handled specially
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
    buff: 'Berserkers gain +3 DMG and +1 Speed.',
    wrath: 'Wrath: Storms during land travel cost +1 extra Food per step.',
    milestoneEffects: [
      'Berserkers gain +1 DMG in combat.',
      'Berserkers move +1 Speed per tick.',
      'Enemy spawn rate slowed by 10%.',
      'All units gain +1 max HP.',
      null
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
    buff: 'Shieldmaidens heal 2 HP per combat tick when not in melee.',
    wrath: 'Wrath: Recruited units start with -10 max HP.',
    milestoneEffects: [
      'Shieldmaidens gain +5 max HP.',
      'Any unit below 25% HP heals 1 HP/tick.',
      'Shieldmaidens gain +2 DMG.',
      'Shieldmaidens block 1 DMG per hit.',
      null
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
    buff: 'Fallen enemies have a 20% chance to rise as allied undead for 3 ticks.',
    wrath: 'Wrath: Dead band members cannot be replaced for 5 turns.',
    milestoneEffects: [
      'Enemies deal -1 DMG.',
      'Player units survive lethal hits once with 1 HP (once per battle).',
      'Slain enemies drop +1 extra Gold.',
      'Gold cost to recruit is reduced by 1.',
      null
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
    buff: 'Once per battle, your weakest unit swaps position with a random enemy.',
    wrath: 'Wrath: Random event triggers each world move (ambush, resource loss, or unit injury).',
    milestoneEffects: [
      'Chest loot gives +1 extra Gold.',
      'Enemy attack speed reduced by 10%.',
      'One enemy per wave spawns confused (fights allies for 2 ticks).',
      'Town prices reduced by 1 Gold each.',
      null
    ]
  }
};


function initTooltipEvents() {
  let hoverTimeout = null;
  let lastClientX = 0;
  let lastClientY = 0;

  function showLocationTileTooltip(tile, clientX, clientY) {
    const x = tile.dataset.x;
    const y = tile.dataset.y;
    const terrain = tile.dataset.terrain;
    const hasPlayer = tile.dataset.hasPlayer === 'true';
    const entityType = tile.dataset.entityType;
    const entityState = tile.dataset.entityState;

    const headerText = `${terrain ? terrain.charAt(0).toUpperCase() + terrain.slice(1) : 'Tile'}`;
    const coordsText = `X: ${x}, Y: ${y}`;

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
    const contentsText = contents.join('<br>');

    elTooltip.innerHTML = `
      <div class="game-tooltip-header">
        <span>${headerText}</span>
        <span class="game-tooltip-coords">${coordsText}</span>
      </div>
      <div class="game-tooltip-contents">${contentsText}</div>
    `;
    elTooltip.style.borderLeftColor = 'var(--text-accent)';
    elTooltip.style.display = 'flex';
    elTooltip.style.left = (clientX + 15) + 'px';
    elTooltip.style.top = (clientY + 15) + 'px';
  }

  function showWorldTileTooltip(tile, clientX, clientY) {
    const x = tile.dataset.x;
    const y = tile.dataset.y;
    const terrain = tile.dataset.terrain;
    const locationName = tile.dataset.locationName;
    const locationType = tile.dataset.locationType;
    const locationBiome = tile.dataset.locationBiome;
    const hasPlayer = tile.dataset.hasPlayer === 'true';

    const headerText = `${terrain ? terrain.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Terrain'}`;
    const coordsText = `X: ${x}, Y: ${y}`;
    
    let borderAccent = 'var(--text-accent)';
    if (terrain === 'water') borderAccent = 'var(--tile-water)';
    else if (terrain === 'deep_water') borderAccent = 'var(--tile-deep-water)';
    else if (terrain === 'river') borderAccent = 'var(--tile-river)';
    else if (terrain === 'plains') borderAccent = 'var(--tile-plains)';
    else if (terrain === 'forest') borderAccent = 'var(--tile-forest)';
    else if (terrain === 'snow') borderAccent = 'var(--tile-snow)';
    else if (terrain === 'mountain') borderAccent = 'var(--tile-mountain)';

    let contents = [];
    if (hasPlayer) {
      contents.push('🚢 Drakkar Longship');
    }
    if (locationName) {
      const typeLabel = locationType === 'town' ? 'Town' : 'Raid Site';
      contents.push(`🏘️ ${locationName} (${typeLabel})`);
      const danger = tile.dataset.dangerLevel;
      if (danger && locationType === 'raid') {
        contents.push(`💀 Danger Level: ${'💀'.repeat(danger)} (Level ${danger})`);
      }
    }
    
    if (contents.length === 0) {
      if (terrain === 'deep_water') {
        contents.push('🌊 Deep Water. Extremely dangerous, non-traversable.');
      } else if (terrain === 'water') {
        contents.push('Open water. Safe sailing, costs 1 Food per step.');
      } else if (terrain === 'river') {
        contents.push('River stream. Fast sailing, costs 1 Food per step.');
      } else {
        contents.push('Rugged land. Slow travel, costs 3 Food per step.');
      }
    }

    // Add concrete enemy description for any land/raid tiles on world map
    if (locationType === 'raid' || (terrain !== 'water' && terrain !== 'deep_water' && terrain !== 'river')) {
      const biome = locationType === 'raid' ? (locationBiome || 'default') : terrain;
      const poolMap = {
        forest: 'spiders and wolves',
        mountain: 'wolves and trolls',
        snow: 'spiders and trolls',
        plains: 'spiders and wolves',
        burial_mound: 'draugr warriors',
        default: 'spiders and wolves'
      };
      const list = poolMap[biome] || poolMap.default;
      contents.push(`You will find ${list} here.`);
    }

    const contentsText = contents.join('<br>');

    elTooltip.innerHTML = `
      <div class="game-tooltip-header">
        <span>${headerText}</span>
        <span class="game-tooltip-coords">${coordsText}</span>
      </div>
      ${contentsText ? `<div class="game-tooltip-contents">${contentsText}</div>` : ''}
    `;
    elTooltip.style.borderLeftColor = borderAccent;
    elTooltip.style.display = 'flex';
    elTooltip.style.left = (clientX + 15) + 'px';
    elTooltip.style.top = (clientY + 15) + 'px';
  }

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
        header = '';
        const stepsHtml = lore.favorSteps.map(s => `<div style="margin:2px 0">${s}</div>`).join('');
        content = [
          `<b style="color:var(--text-accent)">📋 How to gain Favor:</b>`,
          `<div style="margin:4px 0 0 0">${stepsHtml}</div>`,
          `<b>Opposes:</b> ${lore.opposites.join(' & ')} — pleasing ${lore.icon} drains their favor`,
          `<b style="color:var(--color-danger)">⚠️ ${lore.wrath}</b>`
        ].join('<br>');
      } else if (section === 'milestone') {
        const idx = parseInt(godTarget.dataset.milestoneIdx);
        const achieved = STATE.godQuests[gKey][idx];
        header = `${lore.icon} Milestone ${['I', 'II', 'III', 'IV', 'V'][idx]}`;
        
        let statusHtml = achieved 
          ? `<span style="color:var(--color-success)">✅ Completed</span>` 
          : `<span style="color:var(--text-muted)">🔒 Unlocked at Favor +${idx + 1}</span>`;
          
        let effectHtml = '';
        if (idx === 4) {
          effectHtml = `<span style="color:var(--text-muted)">🔒 Unlocks this god's secret Blessing!</span>`;
        } else {
          effectHtml = `<b style="color:${lore.color}">${lore.milestoneEffects[idx]}</b>`;
        }
        
        content = `${statusHtml}<br><div style="margin-top:4px;">${effectHtml}</div>`;
      } else if (section === 'champion') {
        header = `${lore.icon} Champion Buff`;
        content = `<b style="color:${lore.color}">${lore.buff}</b>`;
      } else if (section === 'champion_locked') {
        header = `${lore.icon} Champion Buff`;
        content = `<span style="color:var(--text-muted)">reach Milestone 5 to unlock the champion buff of this god</span>`;
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

  // World, location, and combat tooltips
  document.body.addEventListener('mouseover', (e) => {
    const tile = e.target.closest('.world-tile, .location-tile, .combat-cell');
    if (!tile) {
      if (!e.target.closest('[data-god-tooltip]')) {
        elTooltip.style.display = 'none';
      }
      return;
    }
    
    if (tile.classList.contains('fog')) {
      elTooltip.style.display = 'none';
      return;
    }

    if (tile.classList.contains('world-tile')) {
      if (hoverTimeout) clearTimeout(hoverTimeout);
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      hoverTimeout = setTimeout(() => {
        showWorldTileTooltip(tile, lastClientX, lastClientY);
      }, 800);
      return;
    }

    if (tile.classList.contains('location-tile')) {
      if (hoverTimeout) clearTimeout(hoverTimeout);
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      const entityType = tile.dataset.entityType;
      if (entityType === 'burial_mound') {
        hoverTimeout = setTimeout(() => {
          showLocationTileTooltip(tile, lastClientX, lastClientY);
        }, 800);
      } else {
        showLocationTileTooltip(tile, lastClientX, lastClientY);
      }
      return;
    }

    let headerText = '';
    let coordsText = '';
    let contentsText = '';
    let borderAccent = 'var(--text-accent)';

    if (tile.classList.contains('combat-cell')) {
      const r = Number(tile.dataset.row);
      const c = Number(tile.dataset.col);
      headerText = `Combat Grid Lane ${r+1}`;
      coordsText = `Col: ${c}`;
      
      const unitEl = tile.querySelector('.combat-unit');
      if (unitEl) {
        const unit = STATE.combat.grid[r] ? STATE.combat.grid[r][c] : null;
        if (unit) {
          const stats = getEffectiveStats(unit);
          const allianceText = unit.alliance === 'player' ? 'Viking Soldier' : 'Monster';
          headerText = `${unit.name} (${allianceText})`;
          
          const formatVal = (statObj) => {
            if (statObj.bonus !== 0) {
              const sign = statObj.bonus > 0 ? ' + ' : ' - ';
              const absBonus = Math.abs(statObj.bonus);
              return `${statObj.base}${sign}${absBonus} (Total: ${statObj.total})`;
            }
            return `${statObj.base}`;
          };

          const contents = [
            `<b>HP:</b> ${unit.hp} / ${formatVal(stats.maxHp)}`,
            `<b>Damage:</b> ${formatVal(stats.dmg)}`,
            `<b>Range:</b> ${formatVal(stats.range)}`,
            `<b>Speed:</b> ${formatVal(stats.speed)}`
          ];
          contentsText = contents.join('<br>');
        } else {
          contentsText = unitEl.title || 'Combat unit/monster.';
        }
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
    const tile = e.target.closest('.world-tile, .location-tile');
    if (tile) {
      lastClientX = e.clientX;
      lastClientY = e.clientY;
    }
  });

  document.body.addEventListener('mouseout', (e) => {
    const tile = e.target.closest('.world-tile, .location-tile, .combat-cell');
    const godTarget = e.target.closest('[data-god-tooltip]');
    
    if (tile && (tile.classList.contains('world-tile') || tile.dataset.entityType === 'burial_mound')) {
      const enteringTile = e.relatedTarget?.closest('.world-tile, .location-tile');
      if (enteringTile !== tile) {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        elTooltip.style.display = 'none';
      }
    } else if (tile && !e.relatedTarget?.closest('.world-tile, .location-tile, .combat-cell')) {
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

function findLocalPath(startX, startY, targetX, targetY, locState) {
  if (startX === targetX && startY === targetY) return [];

  const queue = [{ x: startX, y: startY, path: [] }];
  const visited = new Set();
  visited.add(`${startX},${startY}`);

  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 }
  ];

  while (queue.length > 0) {
    const current = queue.shift();

    if (current.x === targetX && current.y === targetY) {
      return current.path;
    }

    for (const dir of directions) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const nKey = `${nx},${ny}`;

      if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10 && !visited.has(nKey)) {
        const tile = locState.placedTiles[nKey];
        if (tile) {
          const terrainType = locState.preGeneratedGrid[nKey];
          const isPassable = terrainType !== 'chasm' && terrainType !== 'mountain' && terrainType !== 'deep_water';
          if (isPassable) {
            visited.add(nKey);
            queue.push({
              x: nx,
              y: ny,
              path: [...current.path, { x: nx, y: ny }]
            });
          }
        }
      }
    }
  }

  return null;
}

function attemptLocalPathMove(targetX, targetY) {
  const locId = STATE.party.currentLocationId;
  const locState = STATE.locations[locId];
  if (!locState) return;

  if (localPathMovementTimeout) {
    clearTimeout(localPathMovementTimeout);
    localPathMovementTimeout = null;
  }

  const path = findLocalPath(STATE.party.localX, STATE.party.localY, targetX, targetY, locState);
  if (!path || path.length === 0) {
    return;
  }

  let stepIndex = 0;
  function nextStep() {
    if (STATE.activeScreen !== 'location') return;
    if (document.querySelector('.modal-overlay:not(.hidden)')) return;

    const step = path[stepIndex];
    attemptLocalMove(step.x, step.y);

    if (STATE.party.localX === step.x && STATE.party.localY === step.y && !document.querySelector('.modal-overlay:not(.hidden)')) {
      stepIndex++;
      if (stepIndex < path.length) {
        localPathMovementTimeout = setTimeout(nextStep, 150);
      }
    }
  }

  nextStep();
}

// Attempt to move player locally, auto-discovering tiles and gathering contents or triggering combat
function attemptLocalMove(targetX, targetY) {
  const locId = STATE.party.currentLocationId;
  const locState = STATE.locations[locId];
  if (!locState) return;

  // Bounds check
  if (targetX < 0 || targetX >= 10 || targetY < 0 || targetY >= 10) return;

  // Check if it's adjacent to the current player position
  const isAdjacent = Math.abs(targetX - STATE.party.localX) + Math.abs(targetY - STATE.party.localY) === 1;
  if (!isAdjacent) return;

  const coordKey = `${targetX},${targetY}`;
  const terrainType = locState.preGeneratedGrid[coordKey];

  // Impassable terrain block
  const isImpassable = terrainType === 'chasm' || terrainType === 'mountain' || terrainType === 'deep_water';
  if (isImpassable) {
    logLocation(`The rugged ${terrainType === 'deep_water' ? 'deep water' : terrainType} is impassable!`, 'warn-message');
    return;
  }

  // If tile is unplaced, reveal it
  let tile = locState.placedTiles[coordKey];
  if (!tile) {
    discoverTile(locId, targetX, targetY);
    tile = locState.placedTiles[coordKey];
  }

  if (!tile) return;

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
    } else if (ent.type === 'wood_source' && !ent.isLooted) {
      triggerEncounterEvent(coordKey, ent);
    } else if (ent.type === 'ore_deposit' && !ent.isLooted) {
      triggerEncounterEvent(coordKey, ent);
    } else if (ent.type === 'dolmen' && !ent.isVisited) {
      triggerEncounterEvent(coordKey, ent);
    } else if (ent.type === 'cave_entrance') {
      promptEnterCavePortal(coordKey, ent);
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
  elDay.innerText = STATE.day || 1;

  const activeWraths = Object.keys(STATE.godFavor).filter(g => STATE.godFavor[g] <= -4);
  let blessingHtml = '';
  if (STATE.activeBlessing) {
    const lore = GOD_LORE[STATE.activeBlessing];
    blessingHtml = `<span class="icon">${lore.icon}</span> <span style="color: var(--color-${STATE.activeBlessing})">${STATE.activeBlessing.toUpperCase()}'S BLESSING</span>`;
  } else {
    blessingHtml = `<span>No Active Buff</span>`;
  }

  if (activeWraths.length > 0) {
    const wrathNames = activeWraths.map(g => `<span style="color:var(--color-danger); font-weight:bold;">${g.toUpperCase()}'S WRATH ⚡</span>`).join(', ');
    elBlessing.innerHTML = `${blessingHtml} | <span style="font-size:0.85em;">Active Curses: ${wrathNames}</span>`;
  } else {
    elBlessing.innerHTML = blessingHtml;
  }
}

// Render 15x15 World Grid Layout
function renderWorldMap() {
  elWorldMap.innerHTML = '';
  elWorldCoords.innerText = `Longship Pos - X: ${STATE.party.worldX}, Y: ${STATE.party.worldY}`;

  const timeFactor = (LOCATION_CONFIG.difficultyScaling && LOCATION_CONFIG.difficultyScaling.timeFactor) || 0.02;
  const dayValue = STATE.day || 1;
  const dayMulti = (dayValue * timeFactor).toFixed(2);
  elWorldDifficultyStatus.innerText = `Day Multiplier: +${dayMulti}x (Day ${dayValue})`;

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
          elCell.dataset.locationBiome = hasLocation.locationType || '';
          elCell.dataset.dangerLevel = hasLocation.dangerLevel || '';
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
    // Thor's Wrath: Storms during land travel cost +1 extra Food per step (only at -5 favor)
    if (STATE.godFavor.thor === -5) {
      cost += 1;
      logWorld("Thor's Wrath: Lightning storms increase land travel food cost (+1).", 'warn-message');
    }
  }

  // Deduct food
  if (STATE.resources.food >= cost) {
    adjustResource('food', -cost);
  } else {
    // We don't have enough food for this movement step. Try consuming sheep first.
    if (STATE.resources.sheep > 0) {
      adjustResource('sheep', -1);
      const yieldAmt = MOVEMENT_CONFIG.sheepFoodYield || 15;
      adjustResource('food', yieldAmt);
      logWorld(`HUNGERING! Slaughtered 1 Sheep to harvest emergency rations (+${yieldAmt} Food).`, 'warn-message');
      adjustResource('food', -cost);
    } else {
      // Starving: units lose 3 hp per movement
      const dmg = MOVEMENT_CONFIG.starvationHpDamage || 3;
      let deadUnits = [];
      for (let i = STATE.band.length - 1; i >= 0; i--) {
        const u = STATE.band[i];
        u.hp -= dmg;
        if (u.hp <= 0) {
          deadUnits.push(u.name);
          STATE.band.splice(i, 1);
        }
      }
      logWorld(`STARVING! No sheep left. Your units lost ${dmg} HP from hunger.`, 'warn-message');
      if (deadUnits.length > 0) {
        logWorld(`Starvation claimed: ${deadUnits.join(', ')}.`, 'warn-message');
      }
      if (STATE.band.length === 0 && STATE.resources.gold === 0) {
        notify('GAME_OVER');
      }
    }
  }

  // Set position
  STATE.party.worldX = x;
  STATE.party.worldY = y;
  STATE.day = (STATE.day || 1) + 1;
  renderResourceBar();

  // Reveal fog in a 2-tile radius around player
  revealWorldFog(x, y);

  // Odin's Wrath: Random unit loses 1 HP every 3 world steps (only at -5 favor)
  if (STATE.godFavor.odin === -5) {
    if (STATE.odinWrathSteps === undefined) STATE.odinWrathSteps = 0;
    STATE.odinWrathSteps++;
    if (STATE.odinWrathSteps >= 3) {
      STATE.odinWrathSteps = 0;
      if (STATE.band.length > 0) {
        const idx = Math.floor(Math.random() * STATE.band.length);
        const target = STATE.band[idx];
        target.hp -= 1;
        logWorld(`Odin's Wrath: Blizzard claimed 1 HP from ${target.name}.`, 'warn-message');
        if (target.hp <= 0) {
          STATE.band.splice(idx, 1);
          logWorld(`Odin's Wrath: ${target.name} perished in the tundra.`, 'warn-message');
          if (STATE.band.length === 0 && STATE.resources.gold === 0) {
            notify('GAME_OVER');
          }
        }
      }
    }
  } else {
    STATE.odinWrathSteps = 0;
  }

  // Loki's Wrath: Random event triggers each world move (only at -5 favor)
  if (STATE.godFavor.loki === -5) {
    const roll = Math.random();
    if (roll < 0.33) {
      const goldLoss = Math.min(STATE.resources.gold, 3);
      if (goldLoss > 0) {
        adjustResource('gold', -goldLoss);
        logWorld(`Loki's Wrath: Trickster sprites purloined ${goldLoss} Gold from your chest!`, 'warn-message');
      }
    } else if (roll < 0.66) {
      if (STATE.band.length > 0) {
        const idx = Math.floor(Math.random() * STATE.band.length);
        const target = STATE.band[idx];
        const dmg = Math.min(target.hp - 1, 5);
        if (dmg > 0) {
          target.hp -= dmg;
          logWorld(`Loki's Wrath: Loki tripped ${target.name}, dealing ${dmg} injury damage.`, 'warn-message');
        }
      }
    } else {
      const foodLoss = Math.min(STATE.resources.food, 3);
      if (foodLoss > 0) {
        adjustResource('food', -foodLoss);
        logWorld(`Loki's Wrath: Ravens ruined ${foodLoss} Food rations!`, 'warn-message');
      }
    }
  }

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
  // ── Divine Patron card ──────────────────────────────────────────────────────
  // Find all gods where all 5 milestones are complete (ascended)
  const ascendedGods = Object.keys(STATE.godQuests).filter(g => STATE.godQuests[g].every(x => x === true));
  if (ascendedGods.length > 0) {
    elPatronCard.classList.remove('hidden');
    elPatronList.innerHTML = '';
    ascendedGods.forEach(god => {
      const lore = GOD_LORE[god];
      const isActive = STATE.activeBlessing === god;
      const row = document.createElement('div');
      row.classList.add('trade-row');
      const label = document.createElement('span');
      label.innerHTML = isActive
        ? `<b style="color:${lore.color}">${lore.icon} ${god.charAt(0).toUpperCase() + god.slice(1)}</b> <span style="color:var(--color-success);font-size:0.8em">● ACTIVE</span><br><i style="font-size:0.82em;opacity:0.75">${lore.buff}</i>`
        : `${lore.icon} ${god.charAt(0).toUpperCase() + god.slice(1)}<br><i style="font-size:0.82em;opacity:0.75">${lore.buff}</i>`;
      const btn = document.createElement('button');
      btn.classList.add('btn', 'btn-sm');
      if (isActive) {
        btn.innerText = 'Active';
        btn.disabled = true;
      } else {
        btn.classList.add('btn-primary');
        btn.innerText = 'Switch (5 Gold)';
        btn.addEventListener('click', () => {
          if (STATE.resources.gold < 5) {
            showToast('Not enough Gold to switch Divine Patron.', '💰');
            return;
          }
          adjustResource('gold', -5);
          STATE.activeBlessing = god;
          notify('STATE_UPDATED');
          showToast(`${lore.icon} ${god.charAt(0).toUpperCase() + god.slice(1)} is now your Divine Patron!`, lore.icon);
          renderTownScreen();
        });
      }
      row.appendChild(label);
      row.appendChild(btn);
      elPatronList.appendChild(row);
    });
  } else {
    elPatronCard.classList.add('hidden');
  }
}

// Render 10x10 Dungeon Discovery View (Carcassonne)
function renderLocationMap() {
  elLocMap.innerHTML = '';
  
  const locId = STATE.party.currentLocationId;
  const locState = STATE.locations[locId];
  if (!locState) return;

  const locData = Object.values(STATE.worldMap.locations).find(l => l.id === locId);
  const locName = locData ? locData.name : (locState.isSubCave ? 'Sub-Cave Chamber' : 'Exploring Site');
  const dangerVal = locState.dangerLevel || 3;
  const diffVal = (locState.difficulty || 1.0).toFixed(2);

  elLocTitle.innerText = `${locName} (${diffVal}x Threat)`;
  elLocDeckCount.innerText = locState.tileStack.length;

  const stars = '💀'.repeat(dangerVal) + '⬜'.repeat(Math.max(0, 5 - dangerVal));
  elLocationDifficultyStatus.innerHTML = `Danger: <span style="color:var(--color-danger)">${stars}</span> (Multiplier: ${diffVal}x)`;

  const placed = locState.placedTiles;
  const px = STATE.party.localX;
  const py = STATE.party.localY;

  // Check if player is standing on a cave entrance/exit or burial mound
  const currentTile = placed[`${px},${py}`];
  if (currentTile && currentTile.entity && (currentTile.entity.type === 'cave_entrance' || (currentTile.entity.type === 'burial_mound' && !currentTile.entity.isExplored))) {
    const ent = currentTile.entity;
    elPromptPanel.classList.remove('hidden');
    elPromptPanel.innerHTML = '';

    const textSpan = document.createElement('span');
    textSpan.id = 'portal-prompt-text';
    elPromptPanel.appendChild(textSpan);

    if (ent.type === 'cave_entrance') {
      if (ent.isExit) {
        textSpan.innerText = '🪜 Ladder to upper level ';
      } else {
        textSpan.innerText = '🕳️ Entrance to cave ';
      }

      const btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-primary';
      btn.id = 'btn-use-portal';
      btn.innerText = '[enter]';
      btn.addEventListener('click', () => {
        triggerEnterCavePortal(`${px},${py}`, ent);
      });
      elPromptPanel.appendChild(btn);

    } else if (ent.type === 'burial_mound') {
      textSpan.innerText = '🪦 Burial Mound: ';

      const btnExplore = document.createElement('button');
      btnExplore.className = 'btn btn-sm btn-primary';
      btnExplore.style.marginRight = '0.5rem';
      btnExplore.innerText = '[enter]';
      btnExplore.addEventListener('click', () => {
        triggerEncounterEvent(`${px},${py}`, ent);
      });

      const btn1 = document.createElement('button');
      btn1.className = 'btn btn-sm btn-warning';
      btn1.style.marginRight = '0.5rem';
      btn1.innerText = '[1] Plunder';
      btn1.addEventListener('click', () => {
        adjustResource('gold', 10);
        ent.isExplored = true;
        adjustFavor('loki', 1);
        showToast('Plundered Burial Mound! Gained +10 Gold (Thor displeased, Loki pleased).', '🪦');
        notify('STATE_UPDATED');
      });

      const btn2 = document.createElement('button');
      btn2.className = 'btn btn-sm btn-primary';
      btn2.style.marginRight = '0.5rem';
      btn2.innerText = '[2] Sacrifice';
      btn2.addEventListener('click', () => {
        if (STATE.resources.sheep >= 1) {
          adjustResource('sheep', -1);
          ent.isExplored = true;
          adjustFavor('hel', 1);
          showToast('Sacrificed a sheep to appease Hel.', '🐑');
        } else {
          showToast('You have no sheep to sacrifice!', '⚠️');
        }
        notify('STATE_UPDATED');
      });

      const btn3 = document.createElement('button');
      btn3.className = 'btn btn-sm';
      btn3.innerText = '[3] Leave';
      btn3.addEventListener('click', () => {
        elPromptPanel.classList.add('hidden');
        activePortalTarget = null;
        notify('STATE_UPDATED');
      });

      elPromptPanel.appendChild(btnExplore);
      elPromptPanel.appendChild(btn1);
      elPromptPanel.appendChild(btn2);
      elPromptPanel.appendChild(btn3);
    }

    activePortalTarget = { coordKey: `${px},${py}`, entity: ent };
  } else {
    elPromptPanel.classList.add('hidden');
    activePortalTarget = null;
  }

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const elCell = document.createElement('div');
      elCell.classList.add('location-tile');
      elCell.dataset.x = x;
      elCell.dataset.y = y;
      
      const coordKey = `${x},${y}`;
      const tile = placed[coordKey];
      const isNeighbor = Math.abs(x - px) + Math.abs(y - py) === 1;

      if (tile) {
        // Render terrain
        elCell.classList.add(`terrain-${tile.terrainType}`);
        elCell.dataset.terrain = tile.terrainType;
        
        let entityDesc = '';
        if (tile.entity) {
          const ent = tile.entity;
          if (ent.type === 'treasure' && !ent.isLooted) entityDesc = '🪙 Treasure Chest (Loot Gold)';
          else if (ent.type === 'wood_source' && !ent.isLooted) entityDesc = '🪵 Wood Source (Harvest Wood)';
          else if (ent.type === 'ore_deposit' && !ent.isLooted) entityDesc = '🪨 Ore Deposit (Mine Gold)';
          else if (ent.type === 'enemy_army' && !ent.isDefeated) entityDesc = `👹 Monster Nest (${ent.monsters[0].monsterClass})`;
          else if (ent.type === 'burial_mound' && !ent.isExplored) entityDesc = '🪦 Ancient Burial Mound';
          else if (ent.type === 'dolmen' && !ent.isVisited) entityDesc = `🏆 Sacred Dolmen Stone (Appease ${ent.godName.toUpperCase()})`;
          else if (ent.type === 'cave_entrance') {
            if (ent.isExit) {
              entityDesc = '🪜 Cave Exit Portal (Return to surface)';
            } else if (ent.visited) {
              entityDesc = '🕳️ Active Cave Entrance (Visited)';
            } else {
              entityDesc = '🕳️ Cave Sub-Dungeon Portal';
            }
          }
          
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
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              if (x === px && y === py) triggerEncounterEvent(coordKey, ent);
              else attemptLocalPathMove(x, y);
            });
          } 
          else if (ent.type === 'wood_source' && !ent.isLooted) {
            badge.innerText = '🪵';
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              if (x === px && y === py) triggerEncounterEvent(coordKey, ent);
              else attemptLocalPathMove(x, y);
            });
          }
          else if (ent.type === 'ore_deposit' && !ent.isLooted) {
            badge.innerText = '🪨';
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              if (x === px && y === py) triggerEncounterEvent(coordKey, ent);
              else attemptLocalPathMove(x, y);
            });
          }
          else if (ent.type === 'enemy_army' && !ent.isDefeated) {
            const firstMonster = ent.monsters && ent.monsters[0] ? ent.monsters[0].monsterClass : '';
            badge.innerText = MONSTER_EMOJIS[firstMonster] || '👹';
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              attemptLocalPathMove(x, y);
            });
          } 
          else if (ent.type === 'burial_mound' && !ent.isExplored) {
            badge.innerText = '🪦';
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              if (x === px && y === py) {
                triggerEncounterEvent(coordKey, ent);
              } else {
                attemptLocalPathMove(x, y);
              }
            });
          } 
          else if (ent.type === 'dolmen' && !ent.isVisited) {
            badge.innerText = '🏆';
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              if (x === px && y === py) triggerEncounterEvent(coordKey, ent);
              else attemptLocalPathMove(x, y);
            });
          }
          else if (ent.type === 'cave_entrance') {
            if (ent.isExit) {
              badge.innerText = '🪜';
              badge.classList.add('exit-portal');
            } else {
              badge.innerText = '🕳️';
              if (ent.visited) {
                badge.classList.add('visited-portal');
              }
            }
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              if (x === px && y === py) {
                triggerEnterCavePortal(coordKey, ent);
              } else {
                attemptLocalPathMove(x, y);
              }
            });
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

        // Click to move player locally to any visible placed tiles
        elCell.style.cursor = 'pointer';
        elCell.addEventListener('click', () => {
          attemptLocalPathMove(x, y);
        });

        if (isNeighbor) {
          elCell.classList.add('tile-border-highlight');
        }

      } else {
        // Render fog of war
        elCell.classList.add('fog');
        
        // Adjacent tiles are clickable to move/discover
        if (isNeighbor) {
          elCell.classList.add('tile-border-highlight');
          elCell.addEventListener('click', () => {
            attemptLocalMove(x, y);
          });
        }
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


// Enter Cave Sub-Dungeon Portal
function triggerEnterCavePortal(coordKey, entity) {
  if (entity.isExit) {
    // Going back to parent location
    STATE.party.currentLocationId = entity.targetLocationId;
    const [px, py] = entity.targetCoords.split(',').map(Number);
    STATE.party.localX = px;
    STATE.party.localY = py;

    // Mark the parent cave entrance as visited (if it exists)
    const parentLoc = STATE.locations[entity.targetLocationId];
    if (parentLoc) {
      const parentTile = parentLoc.placedTiles[entity.targetCoords];
      if (parentTile && parentTile.entity) {
        parentTile.entity.visited = true;
      }
    }

    autoDiscoverAdjacent(entity.targetLocationId);
    notify('STATE_UPDATED');
    logLocation('Climbed back up from the damp cave chambers.');
  } else {
    // Going down to sub-cave
    const parentLocationId = STATE.party.currentLocationId;
    const parentCoords = coordKey;

    entity.visited = true; // Mark entrance in parent as visited

    STATE.party.currentLocationId = entity.targetLocationId;
    generateLocationMap(entity.targetLocationId, 'cave', parentLocationId, parentCoords);
    STATE.party.localX = 5;
    STATE.party.localY = 5;

    autoDiscoverAdjacent(entity.targetLocationId);
    notify('STATE_UPDATED');
    logLocation('Stepped down into the deep Jotunn Crag Cave chambers.');
  }
}

// Renders choice dialogs for location interactions
function triggerEncounterEvent(coordKey, entity) {
  if (entity.type === 'treasure') {
    adjustResource('gold', entity.silver);
    entity.isLooted = true;
    showToast(`Uncovered buried chest! Looted +${entity.silver} Gold.`, '🪙');
    notify('STATE_UPDATED');
  } 
  else if (entity.type === 'wood_source') {
    adjustResource('wood', entity.wood);
    entity.isLooted = true;
    showToast(`Harvested wood source! Gathered +${entity.wood} Wood.`, '🪵');
    notify('STATE_UPDATED');
  }
  else if (entity.type === 'ore_deposit') {
    adjustResource('gold', entity.gold);
    entity.isLooted = true;
    showToast(`Mined ore deposit! Gained +${entity.gold} Gold.`, '🪨');
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
      choice1.classList.add('btn', 'btn-warning');
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
        const stats = getEffectiveStats(unit);
        elUnit.title = `${unit.name} (${unit.hp}/${stats.maxHp.total} HP)`;

        // Healthbar rendering
        const hbContainer = document.createElement('div');
        hbContainer.classList.add('health-bar-container');
        if (unit.alliance === 'enemy') hbContainer.classList.add('enemy-hb');

        const hbFill = document.createElement('div');
        hbFill.classList.add('health-bar-fill');
        const hpPct = (unit.hp / stats.maxHp.total) * 100;
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
        btn.innerText = 'Activate Buff';
        btn.addEventListener('click', () => {
          STATE.activeBlessing = gKey;
          notify('STATE_UPDATED');
          showToast(`${GOD_LORE[gKey].icon} ${gKey.charAt(0).toUpperCase() + gKey.slice(1)} Buff activated!`, GOD_LORE[gKey].icon, true);
        });
      }
      toggleCol.appendChild(btn);
    } else {
      // Show a locked hint — hovering shows locked info
      const locked = document.createElement('span');
      locked.style.cssText = 'font-size:0.8rem;color:var(--text-muted);cursor:help;';
      locked.innerText = '🔒 Locked';
      locked.dataset.godTooltip = gKey;
      locked.dataset.tooltipSection = 'champion_locked';
      toggleCol.appendChild(locked);
    }
    
    row.appendChild(toggleCol);
    elQuestsList.appendChild(row);
  });
}

// Render the active band roster and inventory items in the party panel
function renderPartyPanel() {
  // 1. Render Band Warriors
  elPartyBandContent.innerHTML = '';
  if (STATE.band.length === 0) {
    elPartyBandContent.innerHTML = '<p style="color:var(--text-muted);">Your band has no warriors recruited.</p>';
  } else {
    STATE.band.forEach(unit => {
      const row = document.createElement('div');
      row.className = 'trade-row';
      row.style.alignItems = 'center';
      row.style.padding = '0.5rem 0';
      row.style.maxWidth = '450px';
      row.style.margin = '0 auto';
      
      const details = document.createElement('div');
      details.style.display = 'flex';
      details.style.flexDirection = 'column';
      details.style.gap = '2px';
      
      const name = document.createElement('span');
      const icons = { shieldmaiden: '🛡️', berserker: '🪓', huntsman: '🏹' };
      name.innerHTML = `<b>${icons[unit.type] || '⚔️'} ${unit.name}</b> (${unit.type.toUpperCase()})`;
      
      const stats = document.createElement('span');
      stats.style.fontSize = '0.75rem';
      stats.style.color = 'var(--text-muted)';
      stats.innerText = `ATK: ${unit.dmg} | SPD: ${unit.speed} | RNG: ${unit.range}`;
      
      details.appendChild(name);
      details.appendChild(stats);

      const hpSection = document.createElement('div');
      hpSection.style.display = 'flex';
      hpSection.style.flexDirection = 'column';
      hpSection.style.alignItems = 'flex-end';
      hpSection.style.gap = '4px';
      hpSection.style.width = '120px';

      const hpText = document.createElement('span');
      hpText.style.fontSize = '0.8rem';
      hpText.innerHTML = `HP: <b>${unit.hp}</b> / ${unit.maxHp}`;

      const hbContainer = document.createElement('div');
      hbContainer.className = 'health-bar-container';
      hbContainer.style.position = 'relative';
      hbContainer.style.width = '100%';
      hbContainer.style.height = '6px';
      hbContainer.style.background = '#222';
      hbContainer.style.borderRadius = '3px';
      hbContainer.style.overflow = 'hidden';

      const hbFill = document.createElement('div');
      hbFill.className = 'health-bar-fill';
      hbFill.style.height = '100%';
      hbFill.style.width = `${(unit.hp / unit.maxHp) * 100}%`;
      hbFill.style.background = 'var(--color-success)';

      hbContainer.appendChild(hbFill);
      hpSection.appendChild(hpText);
      hpSection.appendChild(hbContainer);

      row.appendChild(details);
      row.appendChild(hpSection);
      elPartyBandContent.appendChild(row);
    });
  }

  // 2. Render Inventory
  elPartyInventoryContent.innerHTML = '';
  if (STATE.inventory.length === 0) {
    elPartyInventoryContent.innerHTML = '<p style="color:var(--text-muted);">Your cargo holds no items.</p>';
  } else {
    const counts = {};
    STATE.inventory.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });

    Object.entries(counts).forEach(([item, count]) => {
      const row = document.createElement('div');
      row.className = 'trade-row';
      row.style.padding = '0.5rem 0';
      row.style.maxWidth = '450px';
      row.style.margin = '0 auto';
      
      const label = document.createElement('span');
      label.innerHTML = `💎 <b>${item}</b>`;
      
      const qty = document.createElement('span');
      qty.style.fontWeight = 'bold';
      qty.innerText = `x${count}`;
      
      row.appendChild(label);
      row.appendChild(qty);
      elPartyInventoryContent.appendChild(row);
    });
  }
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

  // Enforce a maximum of 3 active toast notifications at once
  while (container.children.length >= 3) {
    container.children[0].remove();
  }

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
let activePortalTarget = null;
let localPathMovementTimeout = null;

function updateModalKeyboardNavigation() {
  const visibleOverlay = document.querySelector('.modal-overlay:not(.hidden)');
  if (!visibleOverlay) {
    activeModalFocusIndex = 0;
    return;
  }

  const buttons = Array.from(visibleOverlay.querySelectorAll('button, .btn'))
    .filter(btn => !btn.classList.contains('btn-close-x'));
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
      if (!locId) {
        setScreen('world');
      } else {
        const locData = Object.values(STATE.worldMap.locations).find(l => l.id === locId);
        setScreen((locData && locData.type === 'town') ? 'world' : 'location');
      }
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
  else if (event === 'GOD_QUESTS_COMPLETE') {
    const godName = data;
    const lore = GOD_LORE[godName];
    elModalAscension.dataset.god = godName;
    elModalAscension.querySelector('.modal-box').className = `modal-box glass-panel animate-glow deity-${godName}`;
    elModalAscension.querySelector('.logo-text').innerText = `⚡ ${godName.toUpperCase()} CHAMPION ⚡`;
    elModalAscensionText.innerHTML = `You have completed all Milestones for <b>${lore.title}</b>!<br><br><b>Patron Buff unlocked:</b><br><i style="color: var(--color-${godName})">${lore.buff}</i>`;
    
    // Hide final ascension button
    document.getElementById('btn-ascend-victory').classList.add('hidden');
    document.getElementById('btn-ascend-continue').innerText = 'Continue';

    // Remove any previously injected buff button
    const prevBuff = document.getElementById('btn-ascend-buff');
    if (prevBuff) prevBuff.remove();

    // Inject active buff button
    const btnBuff = document.createElement('button');
    btnBuff.id = 'btn-ascend-buff';
    btnBuff.className = 'btn btn-primary';
    btnBuff.innerText = `Activate ${godName.charAt(0).toUpperCase() + godName.slice(1)}'s Blessing`;
    btnBuff.addEventListener('click', () => {
      STATE.activeBlessing = godName;
      notify('STATE_UPDATED');
      showToast(`${lore.icon} ${godName.charAt(0).toUpperCase() + godName.slice(1)}'s Blessing activated!`, lore.icon, true);
      hideOverlay(elModalAscension);
    });

    const btnContinue = document.getElementById('btn-ascend-continue');
    btnContinue.parentNode.insertBefore(btnBuff, btnContinue);

    showOverlay(elModalAscension);
  }
  else if (event === 'ASCENSION_TRIGGERED') {
    elModalAscension.dataset.god = 'odin';
    elModalAscension.querySelector('.modal-box').className = `modal-box glass-panel animate-glow deity-odin`;
    elModalAscension.querySelector('.logo-text').innerText = 'A S C E N S I O N';
    elModalAscensionText.innerHTML = `You have completed all milestones for <b>ALL 5 GODS</b>!<br><br>The gates of Valhalla are open. You have achieved final ascension!`;
    
    // Unhide final ascension button
    document.getElementById('btn-ascend-victory').classList.remove('hidden');
    document.getElementById('btn-ascend-continue').innerText = 'Stay in Midgard';

    // Remove any previously injected buff button
    const prevBuff = document.getElementById('btn-ascend-buff');
    if (prevBuff) prevBuff.remove();
    
    showOverlay(elModalAscension);
  }
  else if (event === 'GAME_OVER') {
    showOverlay(elModalGameOver);
  }
}
