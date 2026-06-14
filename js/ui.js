/* ==========================================================================
   UI MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE, setScreen, adjustResource, recruitSoldier, sacrificeRelic, adjustFavor, triggerStarvationDamage, notify, executePlunderMound, executeSacrificeSheep, buyFood, buyWood, sellSheepDynamic, sellWoodDynamic, buySheepDynamic, buyRecruit, getHealCost, healWarriors, getEffectiveStats } from './state.js';
import { getAdjacentCoords } from './world.js';
import { discoverTile, generateLocationMap } from './location.js';
import { togglePause, deployUnit, undeployUnit, startCombat, fleeCombat, adjustCombatSpeed, sortPoolByPoints } from './combat.js';
import { TOWN_CONFIG } from './config/town.js';
import { MOVEMENT_CONFIG } from './config/movement.js';
import { LOCATION_CONFIG } from './config/location.js';
import { WORLD_CONFIG } from './config/world.js';
import { GODS_CONFIG } from './config/gods.js';
import { SOLDIERS_CONFIG } from './config/soldiers.js';

function formatStat(statObj) {
  if (statObj.bonus === 0) {
    return `${statObj.base}`;
  }
  const sign = statObj.bonus > 0 ? '+' : '';
  return `${statObj.base} ${sign}${statObj.bonus}`;
}

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
const elLocThreat = document.getElementById('location-threat-display');
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
const elModalEventCloseBtn = document.getElementById('modal-event-close-btn');
const elModalEventTitle = document.getElementById('modal-event-title');
const elModalEventBody = document.getElementById('modal-event-body');
const elModalEventChoices = document.getElementById('modal-event-choices');

const elModalAscension = document.getElementById('modal-ascension');
const elModalAscensionText = document.getElementById('modal-ascension-text');

const elModalGameOver = document.getElementById('modal-gameover');
const elConsoleModal = document.getElementById('modal-console');
const elConsoleTextarea = document.getElementById('console-state-textarea');

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

  // Toggle Quest Screen
  document.getElementById('btn-toggle-quests').addEventListener('click', () => {
    if (STATE.activeScreen === 'combat') return;
    if (STATE.activeScreen === 'quests') {
      setScreen(STATE.questsReturnScreen || 'world');
    } else {
      STATE.questsReturnScreen = STATE.activeScreen;
      setScreen('quests');
    }
  });

  document.getElementById('btn-close-quests').addEventListener('click', () => {
    setScreen(STATE.questsReturnScreen || 'world');
  });

  // Toggle Party Screen
  bindButton('btn-toggle-party', () => {
    if (STATE.activeScreen === 'combat') return;
    renderPartyPanel();
    showOverlay(elPartyModal);
  });

  bindButton('btn-close-party', () => {
    hideOverlay(elPartyModal);
  });

  bindButton('btn-save-game', () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(now.getDate())}_${pad(now.getHours())}_${pad(now.getMinutes())}_${pad(now.getSeconds())}`;

    // Gods at milestone 5 in order of unlock
    const milestone5Order = STATE.milestone5Order || [];
    const activeMilestone5 = Object.keys(STATE.godQuests).filter(god => STATE.godQuests[god]?.[4] === true);
    const godsMilestone5 = [];
    for (const god of milestone5Order) {
      if (activeMilestone5.includes(god)) {
        godsMilestone5.push(god);
      }
    }
    for (const god of activeMilestone5) {
      if (!godsMilestone5.includes(god)) {
        godsMilestone5.push(god);
      }
    }
    const godsStr = godsMilestone5.length > 0 ? godsMilestone5.join('_') : 'atheist';

    // Composition of party
    const compCounts = {};
    for (const unit of STATE.band) {
      compCounts[unit.type] = (compCounts[unit.type] || 0) + 1;
    }
    const compStr = Object.entries(compCounts).map(([type, count]) => `${count}${type}`).join('_');
    const composition = compStr || 'crewless';

    // Filename
    const filename = `save_${godsStr}_${composition}_${timestamp}.json`;

    // Download state
    const stateStr = JSON.stringify(STATE, null, 2);
    const blob = new Blob([stateStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Game saved successfully!', '💾');
    logWorld(`Game saved as ${filename}`, 'gain-message');
  });

  bindButton('btn-toggle-console', () => {
    elConsoleTextarea.value = JSON.stringify(STATE, null, 2);
    showOverlay(elConsoleModal);
  });

  bindButton('btn-close-console', () => {
    hideOverlay(elConsoleModal);
  });

  bindButton('btn-console-refresh', () => {
    elConsoleTextarea.value = JSON.stringify(STATE, null, 2);
    showToast('State refreshed!', '🔄');
  });

  bindButton('btn-console-apply', () => {
    try {
      const parsed = JSON.parse(elConsoleTextarea.value);
      Object.assign(STATE, parsed);
      notify('STATE_UPDATED');
      hideOverlay(elConsoleModal);
      showToast('State updated successfully!', '🛠️');
      logWorld('Game state updated via Dev Console.', 'gain-message');
    } catch (e) {
      showToast('Invalid JSON: ' + e.message, '⚠️');
    }
  });

  bindButton('modal-event-close-btn', () => {
    hideOverlay(elModalEvent);
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

  // Trade actions are now handled dynamically in renderTownScreen() to support geographical pricing.

  // Recruiting action handlers
  bindButton('btn-recruit-shieldmaiden', () => {
    const cost = TOWN_CONFIG.recruitCosts.shieldmaiden;
    const res = buyRecruit('shieldmaiden', cost);
    logWorld(res.message, res.success ? 'gain-message' : 'warn-message');
  });

  bindButton('btn-recruit-berserker', () => {
    const cost = TOWN_CONFIG.recruitCosts.berserker;
    const res = buyRecruit('berserker', cost);
    logWorld(res.message, res.success ? 'gain-message' : 'warn-message');
  });

  bindButton('btn-recruit-huntsman', () => {
    const cost = TOWN_CONFIG.recruitCosts.huntsman;
    const res = buyRecruit('huntsman', cost);
    logWorld(res.message, res.success ? 'gain-message' : 'warn-message');
  });

  bindButton('btn-heal-warriors', () => {
    const res = healWarriors();
    logWorld(res.message, res.success ? 'gain-message' : 'warn-message');
    renderTownScreen();
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
    fleeCombat();
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

  const speedSlider = document.getElementById('slider-combat-speed');
  const speedLabel = document.getElementById('label-combat-speed');
  if (speedSlider && speedLabel) {
    speedSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      speedLabel.innerText = `${val}ms`;
      adjustCombatSpeed(val);
    });
  }

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
    if (document.activeElement && (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT')) {
      if (e.key === 'Escape') {
        if (!elConsoleModal.classList.contains('hidden')) {
          e.preventDefault();
          document.getElementById('btn-close-console')?.click();
        }
      }
      return;
    }

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
      if (!elModalEvent.classList.contains('hidden')) {
        if (elModalEventCloseBtn && elModalEventCloseBtn.style.display !== 'none') {
          e.preventDefault();
          elModalEventCloseBtn.click();
          return;
        }
      }
      if (!elConsoleModal.classList.contains('hidden')) {
        e.preventDefault();
        document.getElementById('btn-close-console')?.click();
        return;
      }
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
        .filter(btn => !btn.classList.contains('btn-close-x') && !btn.classList.contains('modal-close-btn') && !btn.classList.contains('btn-no-shortcut'));
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
        tryEnterCurrentLocation();
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
          const action = executePlunderMound(activePortalTarget.entity);
          showToast(action.toast, action.icon);
          notify('STATE_UPDATED');
        } else if (key === '2') {
          e.preventDefault();
          const action = executeSacrificeSheep(activePortalTarget.entity);
          if (action) {
            showToast(action.toast, action.icon);
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
      else if (key === 'h') {
        e.preventDefault();
        document.getElementById('btn-sell-wood')?.click();
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
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (STATE.combat.deployHistory && STATE.combat.deployHistory.length > 0) {
          const grid = STATE.combat.grid;
          for (let i = STATE.combat.deployHistory.length - 1; i >= 0; i--) {
            const unitId = STATE.combat.deployHistory[i];
            let unitFound = null;
            let unitR = -1;
            let unitC = -1;
            for (let r = 0; r < grid.length; r++) {
              for (let c = 0; c < grid[r].length; c++) {
                if (grid[r][c] && grid[r][c].id === unitId) {
                  unitFound = grid[r][c];
                  unitR = r;
                  unitC = c;
                  break;
                }
              }
              if (unitFound) break;
            }
            if (unitFound && unitFound.alliance === 'player' && !unitFound.isCharmed && !unitFound.isConfused && !unitFound.isUndead) {
              undeployUnit(unitR, unitC);
              break;
            }
          }
        }
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
      
      // 1. Select soldier from pool (1 to maxBandSize)
      const keyNum = parseInt(key);
      if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= SOLDIERS_CONFIG.maxBandSize) {
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
        
        const target = keyMap[key];
        const existingUnit = STATE.combat.grid[target.r][target.c];
        if (existingUnit && existingUnit.alliance === 'player' && !existingUnit.isCharmed && !existingUnit.isConfused && !existingUnit.isUndead) {
          undeployUnit(target.r, target.c);
        } else {
          let poolIdx = STATE.combat.selectedPoolIndex;
          if (poolIdx === null && STATE.combat.pool.length > 0) {
            poolIdx = 0; // Default to first soldier in queue
          }

          if (poolIdx !== null && poolIdx < STATE.combat.pool.length) {
            deployUnit(poolIdx, target.r, target.c);
          }
        }
      }
    }
  });

  // Start tooltip tracking
  initTooltipEvents();
}

// ── God lore for quest tooltips ──────────────────────────────────────────────
const GOD_LORE = GODS_CONFIG.lore;


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

  function getTownPrices(tx, ty) {
    tx = Number(tx);
    ty = Number(ty);
    
    let forestCount = 0;
    let waterCount = 0;
    let plainsCount = 0;
    let snowCount = 0;
    let mountainCount = 0;

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 3) {
          const nx = tx + dx;
          const ny = ty + dy;
          if (nx >= 0 && nx < 15 && ny >= 0 && ny < 15) {
            const terrain = STATE.worldMap.tiles[ny][nx];
            if (terrain === 'forest') forestCount++;
            else if (terrain === 'water' || terrain === 'river') waterCount++;
            else if (terrain === 'plains') plainsCount++;
            else if (terrain === 'snow') snowCount++;
            else if (terrain === 'mountain') mountainCount++;
          }
        }
      }
    }

    const dp = TOWN_CONFIG.dynamicPricing || {
      food: { baseCost: 2, minCost: 1, maxCost: 5, foodGained: 5 },
      woodBuy: { baseCost: 2, minCost: 1, maxCost: 5, woodGained: 2, scarceBonus: 2 },
      sheepBuy: { baseCost: 6, minCost: 3, maxCost: 10, sheepGained: 1 },
      sheepSell: { baseGain: 4, minGain: 1, maxGain: 8, sheepSold: 1, scarceBonus: 2 },
      woodSell: { baseGain: 4, minGain: 1, maxGain: 8, woodSold: 10, scarceBonus: 2 }
    };

    let foodCost = Math.max(dp.food.minCost, Math.min(dp.food.maxCost, dp.food.baseCost + Math.floor((snowCount + mountainCount) / 2) - Math.floor((waterCount + plainsCount) / 2)));
    let woodCost = Math.max(dp.woodBuy.minCost, Math.min(dp.woodBuy.maxCost, dp.woodBuy.baseCost + (forestCount === 0 ? dp.woodBuy.scarceBonus : 0) - Math.floor(forestCount / 3)));
    let sheepBuyCost = Math.max(dp.sheepBuy.minCost, Math.min(dp.sheepBuy.maxCost, dp.sheepBuy.baseCost - Math.floor(plainsCount / 2) + Math.floor((snowCount + mountainCount + waterCount) / 3)));

    if (STATE.godQuests.loki?.[3]) {
      const m4Config = GODS_CONFIG.modifiers.milestones.loki.find(m => m.index === 3);
      const reduction = m4Config?.priceReduction ?? 1;
      foodCost = Math.max(dp.food.minCost, foodCost - reduction);
      woodCost = Math.max(dp.woodBuy.minCost, woodCost - reduction);
      sheepBuyCost = Math.max(dp.sheepBuy.minCost, sheepBuyCost - reduction);
    }

    const sheepSellGain = Math.max(dp.sheepSell.minGain, Math.min(dp.sheepSell.maxGain, dp.sheepSell.baseGain + (plainsCount <= 1 ? dp.sheepSell.scarceBonus : 0) - Math.floor(plainsCount / 3)));
    const woodSellGain = Math.max(dp.woodSell.minGain, Math.min(dp.woodSell.maxGain, dp.woodSell.baseGain + (forestCount <= 1 ? dp.woodSell.scarceBonus : 0) - Math.floor(forestCount / 3)));

    return { foodCost, woodCost, sheepBuyCost, sheepSellGain, woodSellGain, dp };
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
      if (locationType === 'town') {
        const prices = getTownPrices(x, y);
        const foodMod = prices.foodCost - prices.dp.food.baseCost;
        const woodMod = prices.woodCost - prices.dp.woodBuy.baseCost;
        const sheepBuyMod = prices.sheepBuyCost - prices.dp.sheepBuy.baseCost;
        const sheepSellMod = prices.sheepSellGain - prices.dp.sheepSell.baseGain;
        const woodSellMod = prices.woodSellGain - prices.dp.woodSell.baseGain;

        const foodModText = foodMod !== 0 ? ` <span style="color:${foodMod > 0 ? 'var(--color-danger)' : 'var(--color-success)'}; font-size: 0.72rem; font-weight: bold;">(${foodMod > 0 ? '+' : ''}${foodMod})</span>` : '';
        const woodModText = woodMod !== 0 ? ` <span style="color:${woodMod > 0 ? 'var(--color-danger)' : 'var(--color-success)'}; font-size: 0.72rem; font-weight: bold;">(${woodMod > 0 ? '+' : ''}${woodMod})</span>` : '';
        const sheepBuyModText = sheepBuyMod !== 0 ? ` <span style="color:${sheepBuyMod > 0 ? 'var(--color-danger)' : 'var(--color-success)'}; font-size: 0.72rem; font-weight: bold;">(${sheepBuyMod > 0 ? '+' : ''}${sheepBuyMod})</span>` : '';
        const sheepSellModText = sheepSellMod !== 0 ? ` <span style="color:${sheepSellMod > 0 ? 'var(--color-success)' : 'var(--color-danger)'}; font-size: 0.72rem; font-weight: bold;">(${sheepSellMod > 0 ? '+' : ''}${sheepSellMod})</span>` : '';
        const woodSellModText = woodSellMod !== 0 ? ` <span style="color:${woodSellMod > 0 ? 'var(--color-success)' : 'var(--color-danger)'}; font-size: 0.72rem; font-weight: bold;">(${woodSellMod > 0 ? '+' : ''}${woodSellMod})</span>` : '';

        let priceLines = [];
        priceLines.push(`<span>🍖 Buy Food: buy ${prices.dp.food.foodGained} for <b>${prices.foodCost}g</b>${foodModText}</span>`);
        priceLines.push(`<span>🪵 Buy Wood: buy ${prices.dp.woodBuy.woodGained} for <b>${prices.woodCost}g</b>${woodModText}</span>`);
        priceLines.push(`<span>🐑 Buy Sheep: buy ${prices.dp.sheepBuy.sheepGained} for <b>${prices.sheepBuyCost}g</b>${sheepBuyModText}</span>`);
        priceLines.push(`<span>🐑 Sell Sheep: sell ${prices.dp.sheepSell.sheepSold} for <b>${prices.sheepSellGain}g</b>${sheepSellModText}</span>`);
        priceLines.push(`<span>🪵 Sell Wood: sell ${prices.dp.woodSell.woodSold} for <b>${prices.woodSellGain}g</b>${woodSellModText}</span>`);

        contents.push('<div style="margin-top: 5px; border-top: 1px dashed rgba(255,255,255,0.15); padding-top: 5px; font-size: 0.78rem; display: flex; flex-direction: column; gap: 2px;">' + priceLines.join('') + '</div>');
      }
      const danger = tile.dataset.dangerLevel;
      if (danger && locationType === 'raid') {
        contents.push(`💀 Danger Level: ${'💀'.repeat(danger)} (Level ${danger})`);
      }
    }
    
    if (contents.length === 0) {
      if (terrain === 'deep_water') {
        contents.push('🌊 Deep Water. Extremely dangerous, non-traversable.');
      } else if (terrain === 'water') {
        contents.push('Open water. Safe sailing, costs 1 Food per step (+1 Wood if available, else 3 Food).');
      } else if (terrain === 'river') {
        contents.push('River stream. Fast sailing, costs 1 Food per step (+1 Wood if available, else 3 Food).');
      } else {
        contents.push('Rugged land. Slow travel, costs 3 Food per step.');
      }
    }

    // Add concrete enemy description for any land/raid tiles on world map (excluding towns)
    if (locationType !== 'town' && (locationType === 'raid' || (terrain !== 'water' && terrain !== 'deep_water' && terrain !== 'river'))) {
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
      const section = godTarget.dataset.tooltipSection;
      if (section === 'identity') {
        // Deactivated: popup fulfills this function
        return;
      }

      const gKey = godTarget.dataset.godTooltip;
      const lore = GOD_LORE[gKey];
      if (!lore) return;

      let header = '';
      let content = '';

      if (section === 'milestone') {
        const idx = parseInt(godTarget.dataset.milestoneIdx);
        const achieved = STATE.godQuests[gKey][idx];
        
        // Define runeSets internally or retrieve rune
        const runeSets = {
          odin: ['ᚨ', 'ᛗ', 'ᚷ', 'ᚹ', 'ᛃ'],
          thor: ['ᚦ', 'ᚱ', 'ᛏ', 'ᛋ', 'ᚲ'],
          freya: ['ᚠ', 'ᛒ', 'ᛚ', 'ᛞ', 'ᚢ'],
          hel: ['ᚾ', 'ᛁ', 'ᚲ', 'ᛉ', 'ᛦ'],
          loki: ['ᛇ', 'ᚹ', 'ᚺ', 'ᛈ', 'ᛞ']
        };
        const runeNames = {
          'ᚨ': 'Ansuz', 'ᛗ': 'Mannaz', 'ᚷ': 'Gebo', 'ᚹ': 'Wunjo', 'ᛃ': 'Jera',
          'ᚦ': 'Thurisaz', 'ᚱ': 'Raido', 'ᛏ': 'Tiwaz', 'ᛋ': 'Sowilo', 'ᚲ': 'Kenaz',
          'ᚠ': 'Fehu', 'ᛒ': 'Berkana', 'ᛚ': 'Laguz', 'ᛞ': 'Dagaz', 'ᚢ': 'Uruz',
          'ᚾ': 'Nauthiz', 'ᛁ': 'Isa', 'ᛇ': 'Eihwaz', 'ᛉ': 'Algiz', 'ᛦ': 'Yr',
          'ᚺ': 'Hagalaz', 'ᛈ': 'Perthro'
        };
        const runeChar = runeSets[gKey] ? runeSets[gKey][idx] : '';
        const runeName = runeNames[runeChar] ? ` <span style="font-style:italic; font-size:0.75rem; color:var(--text-muted); font-weight:normal; margin-left:6px;">(${runeChar} ${runeNames[runeChar]})</span>` : '';

        header = `${lore.icon} Milestone ${['I', 'II', 'III', 'IV', 'V'][idx]}${runeName}`;
        
        let statusHtml = achieved 
          ? `<span style="color:var(--color-success)">✅ Completed</span>` 
          : `<span style="color:var(--text-muted)">🔒 Unlocked at Favor +${idx + 1}</span>`;
          
        let effectHtml = '';
        if (idx === 4) {
          effectHtml = `<b style="color:${lore.color}">Blessing: ${lore.buff}</b>`;
        } else {
          effectHtml = `<b style="color:${lore.color}">${lore.milestoneEffects[idx]}</b>`;
        }
        
        content = `${statusHtml}<br><div style="margin-top:4px;">${effectHtml}</div>`;
      } else if (section === 'champion') {
        header = `${lore.icon} Champion Buff`;
        content = `<b style="color:${lore.color}">${lore.buff}</b>`;
      } else if (section === 'champion_locked') {
        header = `${lore.icon} Champion Buff`;
        content = `<span style="color:var(--text-muted)">reach Milestone 5 to unlock:</span><br><b style="color:${lore.color}">${lore.buff}</b>`;
      } else if (section === 'curse') {
        header = `${lore.icon} Active Curse (${gKey.toUpperCase()})`;
        content = `<b style="color:var(--color-danger)">${lore.wrath}</b>`;
      }

      elTooltip.innerHTML = `
        <div class="game-tooltip-header">
          <span>${header}</span>
        </div>
        <div class="game-tooltip-contents">${content}</div>
      `;
      elTooltip.style.borderLeftColor = section === 'curse' ? 'var(--color-danger)' : lore.color;
      elTooltip.style.left = (e.clientX + 15) + 'px';
      elTooltip.style.top = (e.clientY + 15) + 'px';
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
          
           const contents = [
            `<b>HP:</b> ${unit.hp} / ${formatStat(stats.maxHp)}`,
            `<b>Damage:</b> ${formatStat(stats.dmg)}`,
            `<b>Range:</b> ${formatStat(stats.range)}`,
            `<b>Speed:</b> ${formatStat(stats.speed)}`
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
  
  let radius = 1;
  if (STATE.godQuests.odin?.[1]) {
    const m1Config = GODS_CONFIG.modifiers.milestones.odin.find(m => m.index === 1);
    radius = m1Config?.scoutRadius ?? 2; // Odin Milestone 2: Scouts reveal a 2-tile radius instead of 1
  }

  const neighbors = [];
  if (radius === 1) {
    neighbors.push(
      { x: px + 1, y: py },
      { x: px - 1, y: py },
      { x: px, y: py + 1 },
      { x: px, y: py - 1 }
    );
  } else {
    // If radius 2 (Manhattan distance <= 2)
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        if (Math.abs(dx) + Math.abs(dy) <= 2 && (dx !== 0 || dy !== 0)) {
          neighbors.push({ x: px + dx, y: py + dy });
        }
      }
    }
  }

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
          let isPassable = terrainType !== 'chasm' && terrainType !== 'mountain' && terrainType !== 'deep_water';
          if (isPassable && (nx !== targetX || ny !== targetY)) {
            const hasEnemy = tile.entity && tile.entity.type === 'enemy_army' && !tile.entity.isDefeated;
            if (hasEnemy) {
              isPassable = false;
            }
          }
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
    } else if (ent.type === 'sheep_source' && !ent.isLooted) {
      triggerEncounterEvent(coordKey, ent);
    } else if (ent.type === 'ore_deposit' && !ent.isLooted) {
      triggerEncounterEvent(coordKey, ent);
    } else if (ent.type === 'fishing_spot' && !ent.isLooted) {
      triggerEncounterEvent(coordKey, ent);
    } else if (ent.type === 'berry_bush' && !ent.isLooted) {
      triggerEncounterEvent(coordKey, ent);
    } else if (ent.type === 'dolmen' && !ent.isVisited) {
      triggerEncounterEvent(coordKey, ent);
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
  const tempBlessings = [];
  if (STATE.activeBlessing) {
    const lore = GOD_LORE[STATE.activeBlessing];
    tempBlessings.push(`<span data-god-tooltip="${STATE.activeBlessing}" data-tooltip-section="champion" style="color: var(--color-${STATE.activeBlessing}); cursor: pointer;">${lore.icon} ${STATE.activeBlessing.toUpperCase()}</span>`);
  }
  if (STATE.permanentlyActivatedBlessings && STATE.permanentlyActivatedBlessings.length > 0) {
    STATE.permanentlyActivatedBlessings.forEach(b => {
      if (b !== STATE.activeBlessing) {
        const lore = GOD_LORE[b];
        tempBlessings.push(`<span data-god-tooltip="${b}" data-tooltip-section="champion" style="color: var(--color-${b}); cursor: pointer;">${lore.icon} ${b.toUpperCase()} (Perm)</span>`);
      }
    });
  }

  if (tempBlessings.length > 0) {
    blessingHtml = `Buffs: ${tempBlessings.join(', ')}`;
  } else {
    blessingHtml = `<span>No Active Buff</span>`;
  }

  if (activeWraths.length > 0) {
    const wrathNames = activeWraths.map(g => {
      const lore = GOD_LORE[g];
      return `<span data-god-tooltip="${g}" data-tooltip-section="curse" style="color:var(--color-danger); font-weight:bold; cursor: pointer;">${g.toUpperCase()}'S WRATH ⚡</span>`;
    }).join(', ');
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
  const maxCap = (LOCATION_CONFIG.difficultyScaling && LOCATION_CONFIG.difficultyScaling.maxTimeFactorCap) !== undefined ? LOCATION_CONFIG.difficultyScaling.maxTimeFactorCap : 2.5;
  const dayValue = STATE.day || 1;
  const dayMulti = Math.min(maxCap, dayValue * timeFactor).toFixed(2);
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
          if (loc.type === 'town') {
            const marker = document.createElement('span');
            marker.innerText = '🏘️';
            marker.classList.add('town-marker');
            elCell.appendChild(marker);
          } else {
            const isStaticRaid = loc.id.startsWith('raid_');
            if (isStaticRaid) {
              const marker = document.createElement('span');
              const emojiMap = {
                forest: '🌲',
                mountain: '⛰️',
                burial_mound: '🪦',
                default: '⚔️'
              };
              marker.innerText = emojiMap[loc.locationType] || '⚔️';
              marker.classList.add('raid-marker');
              elCell.appendChild(marker);
            } else {
              elCell.classList.add('visited-wilderness');
            }
          }
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

      // Allow entering town/raid if clicked on player's current coordinate (and not water)
      if (x === STATE.party.worldX && y === STATE.party.worldY && tiles[y][x] !== 'water') {
        elCell.addEventListener('click', () => {
          tryEnterCurrentLocation();
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
  let cost = 3;
  let woodCost = 0;
  
  if (targetTerrain === 'water' || targetTerrain === 'river') {
    const thorWrath = GODS_CONFIG.modifiers.wrath.thor;
    const extraSeaWood = thorWrath?.extraSeaWoodCost ?? 1;
    let requiredWood = 1;
    if (targetTerrain === 'water' && STATE.godFavor.thor === -5) {
      requiredWood = 1 + extraSeaWood;
    }
    if (STATE.resources.wood >= requiredWood) {
      cost = 1;
      woodCost = requiredWood;
      if (targetTerrain === 'water' && STATE.godFavor.thor === -5) {
        logWorld("Thor's Wrath: Rough seas increase sea travel wood cost (+1 Wood).", 'warn-message');
      }
    } else {
      cost = 3;
      woodCost = 0;
    }
  } else {
    cost = 3;
  }

  // Thor's Wrath: Storms during land travel cost +1 extra Food per step (only at -5 favor)
  if (targetTerrain !== 'water' && targetTerrain !== 'river' && STATE.godFavor.thor === -5) {
    const extraLandFood = GODS_CONFIG.modifiers.wrath.thor?.extraLandFoodCost ?? 1;
    cost += extraLandFood;
    logWorld(`Thor's Wrath: Lightning storms increase land travel food cost (+${extraLandFood}).`, 'warn-message');
  }

  // Deduct food & wood
  if (STATE.resources.food >= cost) {
    adjustResource('food', -cost);
    if (woodCost > 0) {
      adjustResource('wood', -woodCost);
    }
    if (targetTerrain === 'water' || targetTerrain === 'river') {
      const modeText = targetTerrain === 'water' ? 'Sailed' : 'Rowed';
      if (woodCost > 0) {
        logWorld(`${modeText} 1 tile. Consumed 1 Food and 1 Wood (hull maintenance).`);
      } else {
        logWorld(`${modeText} 1 tile without wood. Consumed 3 Food (rowing exhaustion).`, 'warn-message');
      }
    } else {
      logWorld(`Traveled on ${targetTerrain}. Consumed ${cost} Food.`);
    }
  } else {
    // We don't have enough food for this movement step. Try consuming sheep first.
    if (STATE.resources.sheep > 0) {
      adjustResource('sheep', -1);
      const yieldAmt = MOVEMENT_CONFIG.sheepFoodYield || 15;
      adjustResource('food', yieldAmt);
      logWorld(`HUNGERING! Slaughtered 1 Sheep to harvest emergency rations (+${yieldAmt} Food).`, 'warn-message');
      adjustResource('food', -cost);
      if (woodCost > 0) {
        adjustResource('wood', -woodCost);
      }
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
    const odinWrath = GODS_CONFIG.modifiers.wrath.odin;
    const stepsTrigger = odinWrath?.stepsTrigger ?? 3;
    if (STATE.odinWrathSteps >= stepsTrigger) {
      STATE.odinWrathSteps = 0;
      if (STATE.band.length > 0) {
        const idx = Math.floor(Math.random() * STATE.band.length);
        const target = STATE.band[idx];
        const hpLoss = odinWrath?.hpLoss ?? 1;
        target.hp -= hpLoss;
        logWorld(`Odin's Wrath: Blizzard claimed ${hpLoss} HP from ${target.name}.`, 'warn-message');
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
    const lokiWrath = GODS_CONFIG.modifiers.wrath.loki;
    if (roll < 0.33) {
      const maxGold = lokiWrath?.maxGoldLoss ?? 3;
      const goldLoss = Math.min(STATE.resources.gold, maxGold);
      if (goldLoss > 0) {
        adjustResource('gold', -goldLoss);
        logWorld(`Loki's Wrath: Trickster sprites purloined ${goldLoss} Gold from your chest!`, 'warn-message');
      }
    } else if (roll < 0.66) {
      if (STATE.band.length > 0) {
        const idx = Math.floor(Math.random() * STATE.band.length);
        const target = STATE.band[idx];
        const maxDmg = lokiWrath?.maxInjuryDmg ?? 5;
        const dmg = Math.min(target.hp - 1, maxDmg);
        if (dmg > 0) {
          target.hp -= dmg;
          logWorld(`Loki's Wrath: Loki tripped ${target.name}, dealing ${dmg} injury damage.`, 'warn-message');
        }
      }
    } else {
      const maxFood = lokiWrath?.maxFoodLoss ?? 3;
      const foodLoss = Math.min(STATE.resources.food, maxFood);
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

// Helper to dynamically resolve and enter the player's current world location if not water
function tryEnterCurrentLocation() {
  const px = STATE.party.worldX;
  const py = STATE.party.worldY;
  const locKey = `${px},${py}`;
  let locData = STATE.worldMap.locations[locKey];
  const terrain = STATE.worldMap.tiles[py][px];

  if (terrain === 'water') {
    logWorld('Cannot enter the deep sea.');
    return;
  }

  if (!locData) {
    let locationType = 'default';
    if (terrain === 'mountain') locationType = 'mountain';
    else if (terrain === 'forest') locationType = 'forest';
    else if (terrain === 'snow') locationType = 'default';

    // Scale danger level based on distance from starting point (2,7)
    const startX = 2;
    const startY = 7;
    const distance = Math.abs(px - startX) + Math.abs(py - startY);
    const dangerLevel = Math.min(5, Math.max(1, Math.floor(distance / 3) + 1));

    locData = {
      id: `dynamic_raid_${px}_${py}`,
      name: `Wilderness ${terrain.charAt(0).toUpperCase() + terrain.slice(1)}`,
      type: 'raid',
      terrain: terrain,
      locationType: locationType,
      dangerLevel: dangerLevel
    };
    STATE.worldMap.locations[locKey] = locData;
  }
  enterLocation(locData);
}

// Enter Town or Dungeon
function enterLocation(locData) {
  if (locData.type === 'town') {
    STATE.party.currentLocationId = locData.id;
    let autoHealed = 0;
    for (const warrior of STATE.band) {
      const effStats = getEffectiveStats(warrior);
      if (warrior.hp < effStats.maxHp.total && warrior.hp >= effStats.maxHp.total * 0.8) {
        warrior.hp = effStats.maxHp.total;
        autoHealed++;
      }
    }
    setScreen('town');
    if (autoHealed > 0) {
      logWorld(`Entered town: ${locData.name}. ${autoHealed} warrior(s) at >=80% HP healed automatically.`, 'gain-message');
    } else {
      logWorld(`Entered town: ${locData.name}.`);
    }
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

  // Compute local trade rates based on 3x3 surrounding tiles
  let plainsCount = 0;
  let forestCount = 0;
  let waterCount = 0;
  let snowCount = 0;
  let mountainCount = 0;

  const locKey = Object.keys(WORLD_CONFIG.locations).find(k => WORLD_CONFIG.locations[k].id === locId);
  if (locKey) {
    const [tx, ty] = locKey.split(',').map(Number);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx >= 0 && nx < 15 && ny >= 0 && ny < 15) {
          const terrain = STATE.worldMap.tiles[ny][nx];
          if (terrain === 'forest') forestCount++;
          else if (terrain === 'water' || terrain === 'river') waterCount++;
          else if (terrain === 'plains') plainsCount++;
          else if (terrain === 'snow') snowCount++;
          else if (terrain === 'mountain') mountainCount++;
        }
      }
    }
  }

  const dp = TOWN_CONFIG.dynamicPricing || {
    food: { baseCost: 2, minCost: 1, maxCost: 5, foodGained: 5 },
    woodBuy: { baseCost: 2, minCost: 1, maxCost: 5, woodGained: 2, scarceBonus: 2 },
    sheepBuy: { baseCost: 6, minCost: 3, maxCost: 10, sheepGained: 1 },
    sheepSell: { baseGain: 4, minGain: 1, maxGain: 8, sheepSold: 1, scarceBonus: 2 },
    woodSell: { baseGain: 4, minGain: 1, maxGain: 8, woodSold: 10, scarceBonus: 2 }
  };

  let foodCost = Math.max(dp.food.minCost, Math.min(dp.food.maxCost, dp.food.baseCost + Math.floor((snowCount + mountainCount) / 2) - Math.floor((waterCount + plainsCount) / 2)));
  let woodCost = Math.max(dp.woodBuy.minCost, Math.min(dp.woodBuy.maxCost, dp.woodBuy.baseCost + (forestCount === 0 ? dp.woodBuy.scarceBonus : 0) - Math.floor(forestCount / 3)));
  let sheepBuyCost = Math.max(dp.sheepBuy.minCost, Math.min(dp.sheepBuy.maxCost, dp.sheepBuy.baseCost - Math.floor(plainsCount / 2) + Math.floor((snowCount + mountainCount + waterCount) / 3)));

  if (STATE.godQuests.loki?.[3]) {
    const m4Config = GODS_CONFIG.modifiers.milestones.loki.find(m => m.index === 3);
    const reduction = m4Config?.priceReduction ?? 1;
    foodCost = Math.max(dp.food.minCost, foodCost - reduction);
    woodCost = Math.max(dp.woodBuy.minCost, woodCost - reduction);
    sheepBuyCost = Math.max(dp.sheepBuy.minCost, sheepBuyCost - reduction);
  }

  const sheepSellGain = Math.max(dp.sheepSell.minGain, Math.min(dp.sheepSell.maxGain, dp.sheepSell.baseGain + (plainsCount <= 1 ? dp.sheepSell.scarceBonus : 0) - Math.floor(plainsCount / 3)));
  const woodSellGain = Math.max(dp.woodSell.minGain, Math.min(dp.woodSell.maxGain, dp.woodSell.baseGain + (forestCount <= 1 ? dp.woodSell.scarceBonus : 0) - Math.floor(forestCount / 3)));

  const marketList = document.getElementById('town-market-list');
  if (marketList) {
    marketList.innerHTML = '';
    const trades = [
      { id: 'btn-buy-food', label: `Buy ${dp.food.foodGained} Food (-${foodCost} Gold)`, btnText: 'Buy [F]', action: () => {
        const res = buyFood(foodCost, dp.food.foodGained);
        logWorld(res.message, res.success ? 'gain-message' : 'warn-message');
        renderTownScreen();
      }},
      { id: 'btn-buy-wood', label: `Buy ${dp.woodBuy.woodGained} Wood (-${woodCost} Gold)`, btnText: 'Buy [W]', action: () => {
        const res = buyWood(woodCost, dp.woodBuy.woodGained);
        logWorld(res.message, res.success ? 'gain-message' : 'warn-message');
        renderTownScreen();
      }},
      { id: 'btn-sell-sheep', label: `Sell ${dp.sheepSell.sheepSold} Sheep (+${sheepSellGain} Gold)`, btnText: 'Sell [G]', action: () => {
        const res = sellSheepDynamic(sheepSellGain, dp.sheepSell.sheepSold);
        logWorld(res.message, res.success ? 'gain-message' : 'warn-message');
        renderTownScreen();
      }},
      { id: 'btn-sell-wood', label: `Sell ${dp.woodSell.woodSold} Wood (+${woodSellGain} Gold)`, btnText: 'Sell [H]', action: () => {
        const res = sellWoodDynamic(woodSellGain, dp.woodSell.woodSold);
        logWorld(res.message, res.success ? 'gain-message' : 'warn-message');
        renderTownScreen();
      }},
      { id: 'btn-buy-sheep', label: `Buy ${dp.sheepBuy.sheepGained} Sheep (-${sheepBuyCost} Gold)`, btnText: 'Buy [S]', action: () => {
        const res = buySheepDynamic(sheepBuyCost, dp.sheepBuy.sheepGained);
        logWorld(res.message, res.success ? 'gain-message' : 'warn-message');
        renderTownScreen();
      }}
    ];

    trades.forEach(t => {
      const row = document.createElement('div');
      row.classList.add('trade-row');
      const span = document.createElement('span');
      span.innerText = t.label;
      const btn = document.createElement('button');
      btn.classList.add('btn', 'btn-sm');
      btn.id = t.id;
      btn.innerText = t.btnText;
      btn.addEventListener('click', t.action);
      row.appendChild(span);
      row.appendChild(btn);
      marketList.appendChild(row);
    });
  }

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
    relics.forEach(relic => {
      const god = GODS_CONFIG.relicToGod[relic] || 'odin';
      const mapName = god.charAt(0).toUpperCase() + god.slice(1);
      const row = document.createElement('div');
      row.classList.add('trade-row');
      
      const label = document.createElement('span');
      label.innerText = relic;
      
      const btn = document.createElement('button');
      btn.classList.add('btn', 'btn-sm', 'btn-primary');
      if (STATE.godFavor[god] >= 5) {
        btn.innerText = `Sacrifice (+5 Gold)`;
      } else {
        btn.innerText = `Appease ${mapName}`;
      }
      btn.addEventListener('click', () => {
        sacrificeRelic(relic, god);
        renderTownScreen();
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
      const isPermanent = STATE.permanentlyActivatedBlessings && STATE.permanentlyActivatedBlessings.includes(god);
      
      const row = document.createElement('div');
      row.classList.add('trade-row');
      
      const label = document.createElement('span');
      if (isPermanent) {
        label.innerHTML = `<b style="color:${lore.color}">${lore.icon} ${god.charAt(0).toUpperCase() + god.slice(1)}</b> <span style="color:var(--color-success);font-size:0.8em">✨ PERMANENT ACTIVE</span><br><i style="font-size:0.82em;opacity:0.75">${lore.buff}</i>`;
      } else if (isActive) {
        label.innerHTML = `<b style="color:${lore.color}">${lore.icon} ${god.charAt(0).toUpperCase() + god.slice(1)}</b> <span style="color:var(--text-muted);font-size:0.8em">● CURRENT PATRON</span><br><i style="font-size:0.82em;opacity:0.75">${lore.buff}</i>`;
      } else {
        label.innerHTML = `${lore.icon} ${god.charAt(0).toUpperCase() + god.slice(1)}<br><i style="font-size:0.82em;opacity:0.75">${lore.buff}</i>`;
      }

      const actions = document.createElement('div');
      actions.style.cssText = 'display: flex; gap: 0.5rem;';

      if (!isPermanent) {
        if (!isActive) {
          const switchBtn = document.createElement('button');
          switchBtn.classList.add('btn', 'btn-sm', 'btn-primary');
          const cost = GODS_CONFIG.patronSwitchCost || 5;
          switchBtn.innerText = `Switch (${cost}g)`;
          switchBtn.addEventListener('click', () => {
            if (STATE.resources.gold < cost) {
              showToast('Not enough Gold to switch Divine Patron.', '💰');
              return;
            }
            adjustResource('gold', -cost);
            STATE.activeBlessing = god;
            notify('STATE_UPDATED');
            showToast(`${lore.icon} ${god.charAt(0).toUpperCase() + god.slice(1)} is now your Divine Patron!`, lore.icon);
            renderTownScreen();
          });
          actions.appendChild(switchBtn);
        }

        const permBtn = document.createElement('button');
        permBtn.classList.add('btn', 'btn-sm', 'btn-warning');
        permBtn.innerText = 'Perm Unlock (100g)';
        permBtn.addEventListener('click', () => {
          if (STATE.resources.gold < 100) {
            showToast('Not enough Gold for permanent activation.', '💰');
            return;
          }
          adjustResource('gold', -100);
          if (!STATE.permanentlyActivatedBlessings) STATE.permanentlyActivatedBlessings = [];
          STATE.permanentlyActivatedBlessings.push(god);
          notify('STATE_UPDATED');
          showToast(`${lore.icon} ${god.charAt(0).toUpperCase() + god.slice(1)} Buff permanently activated!`, lore.icon, true);
          renderTownScreen();
        });
        actions.appendChild(permBtn);
      }

      row.appendChild(label);
      row.appendChild(actions);
      elPatronList.appendChild(row);
    });
  } else {
    elPatronCard.classList.add('hidden');
  }

  // Update Heal Warriors button and label dynamically
  const elHealLabel = document.getElementById('heal-warriors-label');
  const elHealBtn = document.getElementById('btn-heal-warriors');
  if (elHealLabel && elHealBtn) {
    const cost = getHealCost();
    const injuredCount = STATE.band.filter(w => w.hp < w.maxHp).length;
    if (injuredCount === 0) {
      elHealLabel.innerText = 'All warriors are fully healthy.';
      elHealBtn.disabled = true;
      elHealBtn.classList.add('btn-disabled');
    } else {
      elHealLabel.innerText = `Heal ${injuredCount} injured warrior${injuredCount > 1 ? 's' : ''} (-${cost} Gold)`;
      if (STATE.resources.gold < cost) {
        elHealBtn.disabled = true;
        elHealBtn.classList.add('btn-disabled');
      } else {
        elHealBtn.disabled = false;
        elHealBtn.classList.remove('btn-disabled');
      }
    }
  }

  // Render recruiting stats with modifiers
  ['shieldmaiden', 'berserker', 'huntsman'].forEach(t => {
    const el = document.getElementById(`recruit-stats-${t}`);
    if (el) {
      const dummy = { type: t, hp: 0, maxHp: 0, dmg: 0, speed: 0, range: 0 };
      const eff = getEffectiveStats(dummy);
      el.innerText = `HP: ${formatStat(eff.maxHp)} | ATK: ${formatStat(eff.dmg)} | SPD: ${formatStat(eff.speed)} | RNG: ${formatStat(eff.range)}`;
    }
  });

  // Great Hall recruitment labels
  const baseCosts = {
    shieldmaiden: { gold: 5, food: 10 },
    berserker: { gold: 7, sheep: 1 },
    huntsman: { gold: 6, wood: 3 }
  };
  ['shieldmaiden', 'berserker', 'huntsman'].forEach(t => {
    const labelEl = document.getElementById(`label-recruit-${t}`);
    if (labelEl) {
      let gCost = baseCosts[t].gold;
      const otherRes = Object.keys(baseCosts[t]).find(k => k !== 'gold');
      const otherAmt = baseCosts[t][otherRes];
      const otherLabel = otherRes.charAt(0).toUpperCase() + otherRes.slice(1);
      const capName = t.charAt(0).toUpperCase() + t.slice(1);
      labelEl.innerText = `Hire ${capName} (-${gCost} Gold, -${otherAmt} ${otherLabel})`;
    }
  });
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
  const diffValNum = locState.difficulty || 1.0;
  const diffVal = diffValNum.toFixed(2);

  elLocTitle.innerText = locName;
  
  let threatColor = 'var(--color-success)'; // green
  if (diffValNum >= 1.0 && diffValNum <= 1.5) {
    threatColor = 'var(--color-loki)'; // orange
  } else if (diffValNum > 1.5) {
    threatColor = 'var(--color-danger)'; // red
  }
  elLocThreat.innerHTML = `<span style="color:${threatColor}">(${diffVal}x Threat)</span>`;

  elLocDeckCount.innerText = locState.tileStack.length;

  const stars = '💀'.repeat(dangerVal);
  elLocationDifficultyStatus.innerHTML = `Danger: <span style="color:var(--color-danger)">${stars}</span>`;

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
        const action = executePlunderMound(ent);
        showToast(action.toast, action.icon);
        notify('STATE_UPDATED');
      });

      const btn2 = document.createElement('button');
      btn2.className = 'btn btn-sm btn-primary';
      btn2.style.marginRight = '0.5rem';
      btn2.innerText = '[2] Sacrifice';
      btn2.addEventListener('click', () => {
        const action = executeSacrificeSheep(ent);
        if (action) {
          showToast(action.toast, action.icon);
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
          else if (ent.type === 'sheep_source' && !ent.isLooted) entityDesc = '🐑 Lost Sheep (Rescue Sheep)';
          else if (ent.type === 'ore_deposit' && !ent.isLooted) entityDesc = '🪨 Ore Deposit (Mine Gold)';
          else if (ent.type === 'fishing_spot' && !ent.isLooted) entityDesc = '🎣 Fishing Spot (Catch Food)';
          else if (ent.type === 'berry_bush' && !ent.isLooted) entityDesc = '🍒 Berry Bush (Gather Berries)';
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
          else if (ent.type === 'sheep_source' && !ent.isLooted) {
            badge.innerText = '🐑';
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
          else if (ent.type === 'fishing_spot' && !ent.isLooted) {
            badge.innerText = '🎣';
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              if (x === px && y === py) triggerEncounterEvent(coordKey, ent);
              else attemptLocalPathMove(x, y);
            });
          }
          else if (ent.type === 'berry_bush' && !ent.isLooted) {
            badge.innerText = '🍒';
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
    let goldGained = entity.silver;
    let bonus = 0;
    if (STATE.godQuests.loki?.[0]) {
      const m1Config = GODS_CONFIG.modifiers.milestones.loki.find(m => m.index === 0);
      bonus = m1Config?.chestGoldBonus ?? 1;
      goldGained += bonus;
    }
    adjustResource('gold', goldGained);
    entity.isLooted = true;
    showToast(`Uncovered buried chest! Looted +${goldGained} Gold.${STATE.godQuests.loki?.[0] ? ` (Loki bonus +${bonus})` : ''}`, '🪙');
    notify('STATE_UPDATED');
  } 
  else if (entity.type === 'wood_source') {
    adjustResource('wood', entity.wood);
    entity.isLooted = true;
    showToast(`Harvested wood source! Gathered +${entity.wood} Wood.`, '🪵');
    notify('STATE_UPDATED');
  }
  else if (entity.type === 'sheep_source') {
    adjustResource('sheep', entity.sheep);
    entity.isLooted = true;
    showToast(`Rescued lost sheep! Added +${entity.sheep} Sheep to herd.`, '🐑');
    notify('STATE_UPDATED');
  }
  else if (entity.type === 'ore_deposit') {
    adjustResource('gold', entity.gold);
    entity.isLooted = true;
    showToast(`Mined ore deposit! Gained +${entity.gold} Gold.`, '🪨');
    notify('STATE_UPDATED');
  }
  else if (entity.type === 'fishing_spot') {
    adjustResource('food', entity.food);
    entity.isLooted = true;
    showToast(`Caught fresh fish! Added +${entity.food} Food.`, '🎣');
    notify('STATE_UPDATED');
  }
  else if (entity.type === 'berry_bush') {
    adjustResource('food', entity.food);
    entity.isLooted = true;
    showToast(`Gathered wild berries! Added +${entity.food} Food.`, '🍒');
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
    if (elModalEventCloseBtn) {
      elModalEventCloseBtn.style.display = 'none';
    }
    const box = elModalEvent.querySelector('.modal-box');
    if (box) {
      box.style.maxWidth = '';
    }
    showOverlay(elModalEvent);
    elModalEventChoices.innerHTML = '';

    if (entity.type === 'burial_mound') {
      elModalEventTitle.innerText = 'Burial Mound';
      elModalEventBody.innerText = `You uncover an ancient viking Barrow Grave. Deep markings suggest a warrior tomb. Defile the grave to look for relics, or perform a sacrifice of Sheep to please Hel?`;

      const choice1 = document.createElement('button');
      choice1.classList.add('btn', 'btn-warning');
      choice1.innerText = 'Plunder Mound (+10 Gold, pleases Loki, angers Thor)';
      choice1.addEventListener('click', () => {
        const action = executePlunderMound(entity);
        hideOverlay(elModalEvent);
        notify('STATE_UPDATED');
        showToast(action.toast, action.icon);
      });

      const choice2 = document.createElement('button');
      choice2.classList.add('btn', 'btn-primary');
      choice2.innerText = 'Sacrifice Sheep (-1 Sheep, pleases Hel)';
      choice2.addEventListener('click', () => {
        const action = executeSacrificeSheep(entity);
        if (action) {
          hideOverlay(elModalEvent);
          showToast(action.toast, action.icon);
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

function renderFormationElement() {
  const container = document.getElementById('formation-container');
  if (!container) return;
  container.innerHTML = '';

  const order = STATE.combat.formationOrder || ['berserker', 'shieldmaiden', 'huntsman'];
  const icons = { shieldmaiden: '🛡️', berserker: '🪓', huntsman: '🏹' };

  order.forEach((type, idx) => {
    // Separator arrow between icons
    if (idx > 0) {
      const arrow = document.createElement('span');
      arrow.textContent = '›';
      arrow.style.opacity = '0.4';
      arrow.style.fontSize = '1rem';
      container.appendChild(arrow);
    }

    const chip = document.createElement('span');
    chip.draggable = true;
    chip.title = `${type.charAt(0).toUpperCase() + type.slice(1)} (${3 - idx} pts) — drag to reorder`;
    chip.style.cssText = `
      font-size: 1.2rem;
      cursor: grab;
      padding: 2px 5px;
      border-radius: 4px;
      border: 1px solid transparent;
      transition: border-color 0.15s, background 0.15s;
      user-select: none;
    `;
    chip.textContent = icons[type] || '⚔️';
    chip.dataset.index = idx;

    chip.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', idx);
      e.dataTransfer.effectAllowed = 'move';
      chip.style.opacity = '0.4';
    });

    chip.addEventListener('dragend', () => {
      chip.style.opacity = '1';
    });

    chip.addEventListener('dragover', (e) => {
      e.preventDefault();
      chip.style.borderColor = 'var(--text-accent)';
      chip.style.background = 'rgba(0,240,255,0.1)';
    });

    chip.addEventListener('dragleave', () => {
      chip.style.borderColor = 'transparent';
      chip.style.background = 'transparent';
    });

    chip.addEventListener('drop', (e) => {
      e.preventDefault();
      chip.style.borderColor = 'transparent';
      chip.style.background = 'transparent';
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
      const toIdx = idx;
      if (!isNaN(fromIdx) && fromIdx !== toIdx) {
        const temp = order[fromIdx];
        order[fromIdx] = order[toIdx];
        order[toIdx] = temp;
        STATE.combat.formationOrder = order;
        sortPoolByPoints();
        notify('COMBAT_UPDATE');
      }
    });

    container.appendChild(chip);
  });
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
        const ratio = unit.hp / stats.maxHp.total;
        if (ratio >= 0.8) {
          hbFill.style.background = 'var(--color-success)';
        } else if (ratio >= 0.2) {
          hbFill.style.background = 'orange';
        } else {
          hbFill.style.background = 'var(--color-danger)';
        }

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
    const numHint = idx < SOLDIERS_CONFIG.maxBandSize ? `<span class="pool-number-hint">[${idx + 1}]</span> ` : '';
    const ratio = unit.hp / unit.maxHp;
    const hpPct = ratio * 100;
    let bgColor = 'var(--color-success)';
    if (ratio < 0.2) {
      bgColor = 'var(--color-danger)';
    } else if (ratio < 0.8) {
      bgColor = 'orange';
    }
    
    card.innerHTML = `
      <span>${numHint}${icons[unit.type]} ${unit.name}</span>
      <span style="font-size:0.75rem">${unit.type}</span>
      <div class="health-bar-container" style="position: absolute; bottom: 4px; left: 6px; right: 6px; height: 4px;">
        <div class="health-bar-fill" style="width: ${Math.max(0, hpPct)}%; background: ${bgColor}"></div>
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

  renderFormationElement();
}

function showGodLorePopup(gKey) {
  const lore = GOD_LORE[gKey];
  if (!lore) return;

  elModalEventTitle.innerText = lore.title;
  elModalEventTitle.style.color = lore.color;

  const track = STATE.godQuests[gKey];
  const milestoneList = lore.milestoneEffects.map((effect, idx) => {
    let desc = effect;
    if (!desc && idx === 4) {
      desc = `Unlocks Blessing: ${lore.buff}`;
    }
    const check = track[idx] ? '✅' : '🔒';
    const isLockedClass = track[idx] ? '' : ' locked';
    return `<li class="god-lore-milestone-item${isLockedClass}">${check} Milestone ${idx + 1}: ${desc || ''}</li>`;
  }).join('');

  const favorActionHtml = lore.favorAction || '';
  
  const opps = GODS_CONFIG.pentagramOpposites[gKey] || [];
  const oppositesHtml = opps.map(oppKey => {
    const oppLore = GOD_LORE[oppKey];
    return oppLore ? `<span style="color: ${oppLore.color}; font-weight: bold;">${oppLore.icon} ${oppLore.title.split(' — ')[0]}</span>` : '';
  }).join(' & ');

  elModalEventBody.innerHTML = `
    <div class="god-lore-popup-body">
      <div>
        <p class="god-lore-section-title" style="color: ${lore.color};">👑 Active Blessing (Champion Buff)</p>
        <p class="god-lore-section-content">${lore.buff}</p>
      </div>

      <div>
        <p class="god-lore-section-title">ᚱ Milestones Progression</p>
        <ul class="god-lore-milestones-list">
          ${milestoneList}
        </ul>
      </div>

      <div>
        <p class="god-lore-section-title god-lore-curse-title">⚠️ Active Curse (Wrath)</p>
        <p class="god-lore-section-content">${lore.wrath}</p>
      </div>

      <p><b>🏺 Relic:</b> ${lore.relic}</p>

      <div>
        <p class="god-lore-section-title">📋 How to gain Favor</p>
        <p class="god-lore-section-content">${favorActionHtml}</p>
      </div>

      <div>
        <p class="god-lore-section-title">⚖️ Opposes (Drains Favor)</p>
        <p class="god-lore-section-content">Pleasing this god drains favor from: ${oppositesHtml}</p>
      </div>
    </div>
  `;

  elModalEventChoices.innerHTML = '';
  if (elModalEventCloseBtn) {
    elModalEventCloseBtn.style.display = 'block';
  }

  const box = elModalEvent.querySelector('.modal-box');
  if (box) {
    box.style.maxWidth = '540px';
  }

  showOverlay(elModalEvent);
  updateModalKeyboardNavigation();
}

// Render Gods Progress screens
// Render Gods Progress screens
function renderQuestsScreen() {
  elQuestsList.innerHTML = '';

  // To map opposites exactly across the star, the gods must be arranged in the polar coordinate order:
  // odin, thor, freya, hel, loki. (Top starts at -90 degrees, increments by 72 deg).
  const gods = ['odin', 'thor', 'freya', 'hel', 'loki'];
  
  // Calculate polar coordinates dynamically
  // Center is (50, 50), Radius is 40
  const cx = 50;
  const cy = 50;
  const radius = 40;

  const points = gods.map((_, i) => {
    // Odin starts at top (-90 degrees / -PI/2 radians), incrementing by 72 degrees (2 * PI / 5)
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    return { x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(2)) };
  });

  const coordinates = {};
  gods.forEach((gKey, idx) => {
    coordinates[gKey] = {
      top: `${points[idx].y}%`,
      left: `${points[idx].x}%`
    };
  });

  // Star ordering traces vertices by skipping index by 2: 0 -> 2 -> 4 -> 1 -> 3
  const starIndices = [0, 2, 4, 1, 3];
  const starPointsStr = starIndices.map(idx => `${points[idx].x},${points[idx].y}`).join(' ');
  const pentagonPointsStr = points.map(p => `${p.x},${p.y}`).join(' ');

  // Re-append the SVG to make sure it is behind the elements
  const pentagramSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  pentagramSvg.setAttribute('class', 'pentagram-svg');
  pentagramSvg.setAttribute('viewBox', '0 0 100 100');
  pentagramSvg.innerHTML = `
    <circle cx="${cx}" cy="${cy}" r="${radius}" class="pentagram-outer-circle" />
    <polygon points="${pentagonPointsStr}" class="pentagram-pentagon" />
    <polygon points="${starPointsStr}" class="pentagram-star" />
  `;
  elQuestsList.appendChild(pentagramSvg);
  
  gods.forEach(gKey => {
    const lore = GOD_LORE[gKey];
    const node = document.createElement('div');
    node.classList.add('god-pentagram-node', `deity-${gKey}`);
    const isPermanent = STATE.permanentlyActivatedBlessings && STATE.permanentlyActivatedBlessings.includes(gKey);
    const isActive = STATE.activeBlessing === gKey;
    if (isPermanent || isActive) {
      node.classList.add('permanently-active');
    }
    node.style.top = coordinates[gKey].top;
    node.style.left = coordinates[gKey].left;
    
    // ── God Identity (hover = full god info tooltip) ──
    const idCol = document.createElement('div');
    idCol.classList.add('god-identity');
    idCol.dataset.godTooltip = gKey;
    idCol.dataset.tooltipSection = 'identity';
    idCol.style.cursor = 'pointer';
    idCol.addEventListener('click', () => {
      showGodLorePopup(gKey);
    });
    
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
    
    idCol.appendChild(name);
    idCol.appendChild(favorEl);
    node.appendChild(idCol);

    // ── Milestones track ──
    const trackCol = document.createElement('div');
    trackCol.classList.add('god-progress-bar');
    
    const track = STATE.godQuests[gKey];
    const runeSets = {
      odin: ['ᚨ', 'ᛗ', 'ᚷ', 'ᚹ', 'ᛃ'],
      thor: ['ᚦ', 'ᚱ', 'ᛏ', 'ᛋ', 'ᚲ'],
      freya: ['ᚠ', 'ᛒ', 'ᛚ', 'ᛞ', 'ᚢ'],
      hel: ['ᚾ', 'ᛁ', 'ᚲ', 'ᛉ', 'ᛦ'],
      loki: ['ᛇ', 'ᚹ', 'ᚺ', 'ᛈ', 'ᛞ']
    };
    const runes = runeSets[gKey] || ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ'];

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
    node.appendChild(trackCol);

    // ── Champion toggle button/label ──
    const toggleCol = document.createElement('div');
    toggleCol.classList.add('champion-selector-cell');
    
    const isChampion = track.every(x => x === true);
    if (isChampion) {
      const btn = document.createElement('button');
      btn.classList.add('btn', 'btn-sm');
      btn.dataset.godTooltip = gKey;
      btn.dataset.tooltipSection = 'champion';
      
      const isPermanent = STATE.permanentlyActivatedBlessings && STATE.permanentlyActivatedBlessings.includes(gKey);
      if (isPermanent) {
        btn.innerText = 'Always Active ✨';
        btn.classList.add('btn-primary', 'btn-always-active');
        btn.disabled = true;
      } else if (STATE.activeBlessing === gKey) {
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
      const locked = document.createElement('span');
      locked.style.cssText = 'font-size:0.75rem;color:var(--text-muted);cursor:help;';
      locked.innerText = '🔒 Locked';
      locked.dataset.godTooltip = gKey;
      locked.dataset.tooltipSection = 'champion_locked';
      toggleCol.appendChild(locked);
    }
    
    node.appendChild(toggleCol);
    elQuestsList.appendChild(node);
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
      
      const effStats = getEffectiveStats(unit);

      const name = document.createElement('span');
      const icons = { shieldmaiden: '🛡️', berserker: '🪓', huntsman: '🏹' };
      name.innerHTML = `<b>${icons[unit.type] || '⚔️'} ${unit.name}</b> (${unit.type.toUpperCase()})`;
      
      const stats = document.createElement('span');
      stats.style.fontSize = '0.75rem';
      stats.style.color = 'var(--text-muted)';
      stats.innerText = `ATK: ${formatStat(effStats.dmg)} | SPD: ${formatStat(effStats.speed)} | RNG: ${formatStat(effStats.range)}`;
      
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
      hpText.innerHTML = `HP: <b>${unit.hp}</b> / ${formatStat(effStats.maxHp)}`;

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
      hbFill.style.width = `${(unit.hp / effStats.maxHp.total) * 100}%`;
      const ratio = unit.hp / effStats.maxHp.total;
      if (ratio >= 0.8) {
        hbFill.style.background = 'var(--color-success)';
      } else if (ratio >= 0.2) {
        hbFill.style.background = 'orange';
      } else {
        hbFill.style.background = 'var(--color-danger)';
      }

      hbContainer.appendChild(hbFill);
      hpSection.appendChild(hpText);
      hpSection.appendChild(hbContainer);

      const disbandBtn = document.createElement('button');
      disbandBtn.className = 'btn btn-sm btn-danger btn-no-shortcut';
      disbandBtn.style.padding = '2px 8px';
      disbandBtn.style.marginLeft = '1rem';
      disbandBtn.innerText = 'Disband';
      disbandBtn.addEventListener('click', () => {
        const idx = STATE.band.findIndex(u => u.id === unit.id);
        if (idx !== -1) {
          STATE.band.splice(idx, 1);
          notify('RESOURCES_UPDATED');
          renderPartyPanel();
        }
      });

      row.appendChild(details);
      row.appendChild(hpSection);
      row.appendChild(disbandBtn);
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

let currentActiveScreen = '';
let lastWorldMsg = '';
let lastWorldCount = 1;
let lastWorldElement = null;

let lastLocMsg = '';
let lastLocCount = 1;
let lastLocElement = null;

function checkScreenReset() {
  if (STATE.activeScreen !== currentActiveScreen) {
    currentActiveScreen = STATE.activeScreen;
    lastWorldMsg = '';
    lastWorldCount = 1;
    lastWorldElement = null;
    lastLocMsg = '';
    lastLocCount = 1;
    lastLocElement = null;
  }
}

export function logWorld(msg, typeClass = 'system-message') {
  checkScreenReset();
  if (msg === lastWorldMsg && lastWorldElement) {
    lastWorldCount++;
    lastWorldElement.innerText = `${msg} (x${lastWorldCount})`;
  } else {
    lastWorldMsg = msg;
    lastWorldCount = 1;
    const p = document.createElement('p');
    p.classList.add(typeClass);
    p.innerText = msg;
    elWorldLog.appendChild(p);
    lastWorldElement = p;
  }
  elWorldLog.scrollTop = elWorldLog.scrollHeight;
}

export function logLocation(msg, typeClass = 'system-message') {
  checkScreenReset();
  if (msg === lastLocMsg && lastLocElement) {
    lastLocCount++;
    lastLocElement.innerText = `${msg} (x${lastLocCount})`;
  } else {
    lastLocMsg = msg;
    lastLocCount = 1;
    const p = document.createElement('p');
    p.classList.add(typeClass);
    p.innerText = msg;
    elLocLog.appendChild(p);
    lastLocElement = p;
  }
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
    .filter(btn => !btn.classList.contains('btn-close-x') && !btn.classList.contains('modal-close-btn') && !btn.classList.contains('btn-no-shortcut'));
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
  else if (event === 'COMBAT_EFFECT_TRIGGER') {
    if (data.effect === 'loki_miss') {
      logWorld(`🎭 Loki's Trick: Enemy missed their attack!`, 'warn-message');
      showToast(`Enemy missed (Loki)`, '🎭');
    } else if (data.effect === 'hel_miss') {
      logWorld(`💀 Hel's Chill: Enemy missed their attack!`, 'warn-message');
      showToast(`Enemy missed (Hel)`, '💀');
    } else if (data.effect === 'thor_double') {
      logWorld(`⚡ Thor's Wrath: Allied unit '${data.unit.name}' strikes twice!`, 'gain-message');
      showToast(`Double Strike!`, '⚡');
    } else if (data.effect === 'loki_charm') {
      logWorld(`🌀 Loki's Mirror: Spawning enemy '${data.unit.name}' is Charmed to fight for you!`, 'gain-message');
      showToast(`Charm: ${data.unit.name}!`, '🌀');
    } else if (data.effect === 'loki_confuse') {
      logWorld(`😵 Loki's Chaos: Spawning enemy '${data.unit.name}' is Confused!`, 'warn-message');
      showToast(`Confused: ${data.unit.name}`, '😵');
    } else if (data.effect === 'loki_charm_wearoff') {
      logWorld(`🎭 Loki's Charm faded: Charmed unit '${data.unit.name}' broke free!`, 'warn-message');
      showToast(`Charm wore off`, '🎭');
    } else if (data.effect === 'hel_undead') {
      logWorld(`💀 Hel's Necromancy: Hurt enemy '${data.unit.name}' converted into an allied Undead Draugr!`, 'gain-message');
      showToast(`Draugr Rises!`, '💀');
    }
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
  else if (event === 'COMBAT_FLEE') {
    const stolenParts = Object.entries(data.stolen)
      .filter(([res, amt]) => amt > 0)
      .map(([res, amt]) => `${amt} ${res}`)
      .join(', ');
    const msg = stolenParts ? `Fled combat! Stolen resources during retreat: ${stolenParts}.` : 'Fled combat safely!';
    logWorld(msg, 'warn-message');
    showToast('You fled from combat!', '🏃', true);

    delete STATE.party.pendingLocalX;
    delete STATE.party.pendingLocalY;

    const locId = STATE.party.currentLocationId;
    if (!locId) {
      setScreen('world');
    } else {
      const locData = Object.values(STATE.worldMap.locations).find(l => l.id === locId);
      setScreen((locData && locData.type === 'town') ? 'world' : 'location');
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
  else if (event === 'RELIC_SACRICES_GOLD' || event === 'RELIC_SACRIFICED_GOLD') {
    logWorld(`Sacrificed a ${data.relicId} relic to maxed god ${data.godName.toUpperCase()}. Gained +5 Gold!`, 'gain-message');
    showToast(`Gained +5 Gold from sacrifice!`, '🪙');
  }
  else if (event === 'FAVOR_GAIN_ACTION') {
    logWorld(`Action Pleased the Gods: Gained 1 Favor with ${data.god.toUpperCase()} by ${data.reason}!`, 'gain-message');
    showToast(`Gained +1 Favor with ${data.god.toUpperCase()}!`, '✨');
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
