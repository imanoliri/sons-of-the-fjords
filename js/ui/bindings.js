/* ==========================================================================
   UI/BINDINGS.JS — Event Listeners and Tooltips
   ========================================================================== */

import { STATE, notify, setScreen, adjustResource } from '../state.js';
import { initCombatSelection } from './combat.js';
import { getAvailableMaps, setActiveMap, initializeWorld, getActiveMap } from '../world.js';
import { SOLDIERS_CONFIG } from '../config/soldiers.js';
import { GODS_CONFIG } from '../config/gods.js';
import { TOWN_CONFIG } from '../config/town.js';
import { LOCATION_CONFIG } from '../config/location.js';
import { togglePause, deployUnit, undeployUnit, fleeCombat, adjustCombatSpeed, checkAndAutoDeploy } from '../combat.js';
import { showToast, logWorld, logLocation } from './notifications.js';
import { showOverlay, hideOverlay, updateModalKeyboardNavigation } from './overlay.js';
import { renderPartyPanel, GOD_LORE } from './party.js';
import { triggerEnterCavePortal, triggerEncounterEvent, attemptLocalMove, useWarHorn } from './location.js';
import { movePartyOnWorld, tryEnterCurrentLocation } from './world.js';
import { getEffectiveStats } from '../state.js';
import { formatStat } from './dom.js';
import { buyRecruit, healWarriors } from '../state.js';
import { executePlunderMound, executeSacrificeSheep } from '../state.js';

import {
  elPartyModal, elConsoleModal, elConsoleTextarea, elModalEvent, elModalEventCloseBtn, elTabPartyBand, elTabPartyInventory,
  elPartyBandContent, elPartyInventoryContent, elModalGameOver, elModalAscension, elPromptPanel, elTooltip,
  MONSTER_EMOJIS, elModalRaidCleared, elModalSagaVictory
} from './dom.js';

// Bind simple click callback if element exists
function bindButton(id, callback) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', callback);
}

// Initialize UI binding event listeners
export function initUIBindings() {

  // ── Map Selection ──────────────────────────────────────────────────────────
  const maps = getAvailableMaps();
  let selectedMapIndex = 0;

  const elMapContainer = document.getElementById('map-cards-container');
  const elDots = document.getElementById('map-carousel-dots');

  const TERRAIN_ICONS = {
    plains:   '🌿',
    forest:   '🌲',
    water:    '🌊',
    snow:     '❄️',
    mountain: '⛰️',
    river:    '💧',
    cave:     '🕳️'
  };

  const DIFFICULTY_COLORS = {
    1: '#4ade80',  // green
    2: '#facc15',  // yellow
    3: '#f97316',  // orange
    4: '#ef4444'   // red
  };

  function renderDifficultyStars(level) {
    const color = DIFFICULTY_COLORS[level] || '#888';
    return Array.from({ length: 4 }, (_, i) =>
      `<span style="color:${i < level ? color : 'rgba(255,255,255,0.2)'};">◆</span>`
    ).join('');
  }

  function getPossibleEnemiesForMap(map) {
    const pool = new Set([
      ...(LOCATION_CONFIG.enemyArmy?.monsterPool || []),
      ...(LOCATION_CONFIG.difficultyScaling?.bosses || [])
    ]);

    const overrides = map.monsterPoolOverrides;
    if (!overrides) return Array.from(pool);

    if (overrides.global?.remove) {
      overrides.global.remove.forEach(m => pool.delete(m));
    }
    if (overrides.global?.add) {
      overrides.global.add.forEach(m => pool.add(m));
    }
    if (overrides.byBiomeType) {
      for (const b in overrides.byBiomeType) {
        if (overrides.byBiomeType[b].add) {
          overrides.byBiomeType[b].add.forEach(m => pool.add(m));
        }
      }
    }
    if (overrides.byRaidType) {
      for (const r in overrides.byRaidType) {
        if (overrides.byRaidType[r].add) {
          overrides.byRaidType[r].add.forEach(m => pool.add(m));
        }
      }
    }
    if (overrides.byLocationId) {
      for (const loc in overrides.byLocationId) {
        if (overrides.byLocationId[loc].add) {
          overrides.byLocationId[loc].add.forEach(m => pool.add(m));
        }
      }
    }
    return Array.from(pool);
  }

  function getTerrainFrequencies(map) {
    const size = map.gridSize || 15;
    const counts = {};
    const conditions = map.terrainZones.map(zone => {
      if (zone.condition === 'default') {
        return { label: zone.label, test: () => true };
      }
      try {
        const fn = new Function('x', 'y', `return (${zone.condition});`);
        return { label: zone.label, test: fn };
      } catch (e) {
        return { label: zone.label, test: () => false };
      }
    });

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let terrain = 'plains';
        for (const cond of conditions) {
          if (cond.test(x, y)) {
            terrain = cond.label;
            break;
          }
        }
        counts[terrain] = (counts[terrain] || 0) + 1;
      }
    }
    return counts;
  }

  function renderMapCards() {
    elMapContainer.innerHTML = '';
    elDots.innerHTML = '';

    maps.forEach((map, i) => {
      // ── Card ────────────────────────────────────────────────────────────────
      const card = document.createElement('div');
      card.className = 'map-card' + (i === selectedMapIndex ? ' map-card--selected' : '');
      card.dataset.mapIndex = i;

      const freqs = getTerrainFrequencies(map);
      const uniqueTerrains = Object.keys(freqs).sort((a, b) => freqs[b] - freqs[a]);
      const terrainBadges = uniqueTerrains
        .map(t => `<span class="terrain-badge">${TERRAIN_ICONS[t] || '🗺️'} ${t}</span>`)
        .join('');

      const worldEnemies = getPossibleEnemiesForMap(map);
      const enemyBadges = worldEnemies
        .map(e => `<span class="enemy-badge" title="${e}">${MONSTER_EMOJIS[e] || '👿'}</span>`)
        .join('');

      const raidCount  = Object.values(map.locations).filter(l => l.type === 'raid').length;
      const townCount  = Object.values(map.locations).filter(l => l.type === 'town').length;

      card.innerHTML = `
        <div class="map-card-header">
          <span class="map-card-emoji">${map.emoji}</span>
          <div class="map-card-titles">
            <div class="map-card-name">${map.name}</div>
            <div class="map-card-subtitle">${map.subtitle}</div>
          </div>
        </div>
        <p class="map-card-desc">${map.description}</p>
        <div class="map-card-meta">
          <div class="map-card-difficulty">
            <span class="meta-label">Difficulty</span>
            <span class="difficulty-stars">${renderDifficultyStars(map.difficulty)}</span>
            <span class="difficulty-label" style="color:${DIFFICULTY_COLORS[map.difficulty]}">${map.difficultyLabel}</span>
          </div>
          <div class="map-card-stats">
            <span class="meta-stat">🏰 ${townCount} Towns</span>
            <span class="meta-stat">⚔️ ${raidCount} Raids</span>
            <span class="meta-stat">📐 ${map.gridSize}×${map.gridSize}</span>
          </div>
        </div>
        <div class="terrain-badges">${terrainBadges}</div>
        ${enemyBadges ? `<div class="enemy-badges-container"><div class="enemy-badges">${enemyBadges}</div></div>` : ''}
        <div class="map-card-select-indicator">
          ${i === selectedMapIndex 
            ? `<button class="btn btn-primary btn-start-card-voyage" style="width: 100%; font-family: var(--font-logo); font-size: 0.78rem; padding: 0.35rem 0.5rem; margin: 0; line-height: 1.2;">⚓ Start Adventure</button>`
            : 'Click to Select'
          }
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-start-card-voyage')) {
          setActiveMap(maps[selectedMapIndex].id);
          initializeWorld();   // Rebuild the grid for the chosen map
          setScreen('world');
          return;
        }
        selectedMapIndex = i;
        renderMapCards();
      });

      elMapContainer.appendChild(card);

      // ── Dot ─────────────────────────────────────────────────────────────────
      const dot = document.createElement('button');
      dot.className = 'map-dot' + (i === selectedMapIndex ? ' map-dot--active' : '');
      dot.title = map.name;
      dot.addEventListener('click', () => {
        selectedMapIndex = i;
        renderMapCards();
        // Scroll the selected card into view
        const cards = elMapContainer.querySelectorAll('.map-card');
        if (cards[i]) cards[i].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      });
      elDots.appendChild(dot);
    });
  }

  renderMapCards();

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

    // Gold amount
    const goldStr = `${STATE.resources.gold}_gold`;

    const worldName = STATE.worldMap && STATE.worldMap.name ? STATE.worldMap.name.toLowerCase().replace(/\s+/g, '_') : 'world';

    // Filename: save__[world]__[timestamp]__[gods]__[goldStr].json
    const filename = `save__${worldName}__${timestamp}__${godsStr}__${goldStr}.json`;

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

  bindButton('btn-load-game', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          if (parsed && typeof parsed === 'object') {
            Object.assign(STATE, parsed);
            if (STATE.worldMap && STATE.worldMap.id) {
              setActiveMap(STATE.worldMap.id);
            }
            notify('STATE_UPDATED');
            showToast('Game loaded successfully!', '📂');
            logWorld('Game loaded from save file.', 'gain-message');

            import('../location.js').then(({ isLocationCleared }) => {
              if (STATE.worldMap && STATE.worldMap.locations) {
                let allCleared = true;
                const totalRaids = Object.values(STATE.worldMap.locations).filter(l => l.type === 'raid' && l.id.startsWith('raid_'));
                for (const l of totalRaids) {
                  if (isLocationCleared(l.id)) {
                    l.isCleared = true;
                    if (STATE.locations[l.id]) {
                      STATE.locations[l.id].isCleared = true;
                    }
                  } else {
                    allCleared = false;
                  }
                }
                if (totalRaids.length > 0 && allCleared) {
                  STATE.campaignWon = true;
                  import('../ui.js').then(({ notify: uiNotify }) => {
                    uiNotify('SAGA_VICTORY_ACHIEVED');
                  });
                }
              }
            });
          } else {
            showToast('Invalid save file format.', '⚠️');
          }
        } catch (err) {
          showToast('Failed to parse save file: ' + err.message, '⚠️');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });

  bindButton('btn-menu-load-game', () => {
    document.getElementById('btn-load-game')?.click();
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
      if (STATE.worldMap && STATE.worldMap.id) {
        setActiveMap(STATE.worldMap.id);
      }
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

  bindButton('btn-recruit-huskarl', () => {
    const cost = TOWN_CONFIG.recruitCosts.huskarl;
    const res = buyRecruit('huskarl', cost);
    logWorld(res.message, res.success ? 'gain-message' : 'warn-message');
  });

  bindButton('btn-recruit-runecaster', () => {
    const cost = TOWN_CONFIG.recruitCosts.runecaster;
    const res = buyRecruit('runecaster', cost);
    logWorld(res.message, res.success ? 'gain-message' : 'warn-message');
  });

  bindButton('btn-heal-warriors', () => {
    const res = healWarriors();
    logWorld(res.message, res.success ? 'gain-message' : 'warn-message');
    notify('STATE_UPDATED');
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

  // Sound War Horn button in location sidebar
  bindButton('btn-use-warhorn-sidebar', () => {
    useWarHorn();
  });

  // Combat controls
  bindButton('btn-combat-pause', () => {
    togglePause();
  });

  bindButton('btn-combat-flee', () => {
    fleeCombat();
  });

  function applyStance(stance) {
    const selectedUnits = [];
    if (STATE.combat.grid) {
      for (let r = 0; r < STATE.combat.grid.length; r++) {
        for (let c = 0; c < STATE.combat.grid[r].length; c++) {
          const cell = STATE.combat.grid[r][c];
          if (cell && cell.alliance === 'player' && cell.selected) {
            selectedUnits.push(cell);
          }
        }
      }
    }

    const unitsToChange = selectedUnits.length > 0 ? [...selectedUnits] : [];

    if (selectedUnits.length > 0) {
      selectedUnits.forEach(u => {
        u.stance = stance;
      });
    } else {
      STATE.combat.stance = stance;
      if (STATE.combat.grid) {
        for (let r = 0; r < STATE.combat.grid.length; r++) {
          for (let c = 0; c < STATE.combat.grid[r].length; c++) {
            const cell = STATE.combat.grid[r][c];
            if (cell && cell.alliance === 'player') {
              delete cell.stance;
              unitsToChange.push(cell);
            }
          }
        }
      }
    }

    // Automatically remove plans/orders related to the units whose stance changed
    if (STATE.combat.plannedLayout && unitsToChange.length > 0) {
      unitsToChange.forEach(u => {
        if (u.row !== undefined) {
          const row = u.row;
          for (let checkC = 0; checkC < 10; checkC++) {
            if (STATE.combat.plannedLayout[row][checkC] === u.type) {
              STATE.combat.plannedLayout[row][checkC] = null;
              break;
            }
          }
        }
      });
    }

    checkAndAutoDeploy();
    notify('COMBAT_UPDATE');
  }

  bindButton('btn-stance-retreat', () => {
    applyStance('retreat');
  });

  bindButton('btn-stance-defend', () => {
    applyStance('defend');
  });

  bindButton('btn-stance-hold', () => {
    applyStance('hold');
  });

  bindButton('btn-stance-attack', () => {
    applyStance('attack');
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
    if (STATE.combat.active) {
      STATE.combat.paused = false;
      notify('COMBAT_UPDATE');
    }

    // If all gods completed and we just closed a single-god champion popup
    const allGodsCompleted = Object.values(STATE.godQuests).every(t => t.every(x => x === true));
    if (allGodsCompleted && activeVictoryGod !== 'odin') {
      setTimeout(() => {
        notify('ASCENSION_TRIGGERED', activeVictoryGod);
      }, 500);
    }
  });

  bindButton('btn-raid-cleared-continue', () => {
    hideOverlay(elModalRaidCleared);
    if (STATE.combat.isWarHornBattle || STATE.combat.entityCoordKey === 'war_horn') {
      import('./location.js').then(({ gatherAndAnimateLoot }) => {
        gatherAndAnimateLoot();
      });
    }
  });

  bindButton('btn-saga-victory-restart', () => {
    hideOverlay(elModalSagaVictory);
    location.reload();
  });

  bindButton('btn-saga-victory-continue', () => {
    hideOverlay(elModalSagaVictory);
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

    // Menu Screen Saga Select Keyboard Navigation
    if (STATE.activeScreen === 'menu') {
      const cols = window.getComputedStyle(elMapContainer).getPropertyValue('grid-template-columns').split(' ').length || 1;
      
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        selectedMapIndex = (selectedMapIndex + 1) % maps.length;
        renderMapCards();
        const cards = elMapContainer.querySelectorAll('.map-card');
        if (cards[selectedMapIndex]) {
          cards[selectedMapIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        selectedMapIndex = (selectedMapIndex - 1 + maps.length) % maps.length;
        renderMapCards();
        const cards = elMapContainer.querySelectorAll('.map-card');
        if (cards[selectedMapIndex]) {
          cards[selectedMapIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        let newIdx = selectedMapIndex + cols;
        if (newIdx >= maps.length) {
          newIdx = selectedMapIndex % cols;
        }
        selectedMapIndex = newIdx;
        renderMapCards();
        const cards = elMapContainer.querySelectorAll('.map-card');
        if (cards[selectedMapIndex]) {
          cards[selectedMapIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        let newIdx = selectedMapIndex - cols;
        if (newIdx < 0) {
          const lastRowStart = Math.floor((maps.length - 1) / cols) * cols;
          newIdx = lastRowStart + (selectedMapIndex % cols);
          if (newIdx >= maps.length) {
            newIdx = maps.length - 1;
          }
        }
        selectedMapIndex = newIdx;
        renderMapCards();
        const cards = elMapContainer.querySelectorAll('.map-card');
        if (cards[selectedMapIndex]) {
          cards[selectedMapIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        setActiveMap(maps[selectedMapIndex].id);
        initializeWorld();   // Rebuild the grid for the chosen map
        setScreen('world');
        return;
      }
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
          import('./overlay.js').then(({ activeModalFocusIndex, setModalFocusIndex, updateModalKeyboardNavigation }) => {
            setModalFocusIndex((activeModalFocusIndex + 1) % buttons.length);
            updateModalKeyboardNavigation();
          });
          return;
        }
        else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          import('./overlay.js').then(({ activeModalFocusIndex, setModalFocusIndex, updateModalKeyboardNavigation }) => {
            setModalFocusIndex((activeModalFocusIndex - 1 + buttons.length) % buttons.length);
            updateModalKeyboardNavigation();
          });
          return;
        }

        // Enter to confirm selected option
        if (e.key === 'Enter') {
          e.preventDefault();
          import('./overlay.js').then(({ activeModalFocusIndex }) => {
             buttons[activeModalFocusIndex].click();
          });
          return;
        }
      }
      return; // Block other navigation while modal is active
    }

    // Check if player wants to load game on World Map or Menu screen
    if (e.key === 'l' || e.key === 'L') {
      if (STATE.activeScreen === 'world' || STATE.activeScreen === 'menu') {
        e.preventDefault();
        document.getElementById('btn-load-game')?.click();
        return;
      }
    }

    // Check if player is on World Map screen
    if (STATE.activeScreen === 'world') {
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        document.getElementById('btn-save-game')?.click();
        return;
      }

      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') dy = -1;
      else if (e.key === 'ArrowDown') dy = 1;
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') dx = -1;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dx = 1;
      else if (e.key === 'Enter') {
        tryEnterCurrentLocation();
        return;
      }

      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        import('../world.js').then(({getAdjacentCoords}) => {
          const targetX = STATE.party.worldX + dx;
          const targetY = STATE.party.worldY + dy;
          const adjacents = getAdjacentCoords(STATE.party.worldX, STATE.party.worldY);
          const isValidMove = adjacents.some(a => a.x === targetX && a.y === targetY);
          if (isValidMove) {
            movePartyOnWorld(targetX, targetY);
          }
        });
      }
    }
    // Check if player is on Location map screen
    else if (STATE.activeScreen === 'location') {
      if (STATE.lootGatheringInProgress) {
        e.preventDefault();
        return;
      }
      if (e.key === 'w' || e.key === 'W') {
        const warhornBtn = document.getElementById('btn-use-warhorn-sidebar');
        if (warhornBtn && !warhornBtn.classList.contains('hidden')) {
          e.preventDefault();
          warhornBtn.click();
          return;
        }
      }

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
        // Find if activePortalTarget exists
        // Wait activePortalTarget isn't exported directly from location.js, but the enter button can just be clicked
        const enterBtn = document.getElementById('btn-use-portal');
        if (enterBtn && !elPromptPanel.classList.contains('hidden')) {
          e.preventDefault();
          enterBtn.click();
        } else {
            // Also handle burial mound explore button
            const promptBtns = elPromptPanel.querySelectorAll('.btn-primary');
            if (!elPromptPanel.classList.contains('hidden') && promptBtns.length > 0) {
              e.preventDefault();
              promptBtns[0].click();
            }
        }
        return;
      } else {
        const key = e.key;
        if (!elPromptPanel.classList.contains('hidden')) {
            const btns = elPromptPanel.querySelectorAll('.btn');
            if (key === '1') {
                e.preventDefault();
                for(let b of btns) if(b.innerText.includes('[1]')) b.click();
            } else if (key === '2') {
                e.preventDefault();
                for(let b of btns) if(b.innerText.includes('[2]')) b.click();
            } else if (key === '3') {
                e.preventDefault();
                for(let b of btns) if(b.innerText.includes('[3]')) b.click();
            }
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
      else if (key === 'o') {
        e.preventDefault();
        document.getElementById('btn-buy-warhorn')?.click();
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
      else if (key === '4') {
        e.preventDefault();
        document.getElementById('btn-recruit-huskarl')?.click();
      }
      else if (key === '5') {
        e.preventDefault();
        document.getElementById('btn-recruit-runecaster')?.click();
      }
    }
    // Check if player is on Combat screen
    else if (STATE.activeScreen === 'combat') {
      if (e.key === 'Delete') {
        e.preventDefault();
        // 1. Delete selected player units
        const grid = STATE.combat.grid;
        if (grid) {
          for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
              const u = grid[r][c];
              if (u && u.alliance === 'player' && u.selected) {
                undeployUnit(r, c);
              }
            }
          }
        }
        // 2. Delete selected planned locations
        if (STATE.combat.selectedPlans && STATE.combat.selectedPlans.length > 0) {
          STATE.combat.selectedPlans.forEach(p => {
            if (STATE.combat.plannedLayout) {
              STATE.combat.plannedLayout[p.r][p.c] = null;
            }
            if (STATE.combat.plansDefinedThisTick) {
              delete STATE.combat.plansDefinedThisTick[`${p.r},${p.c}`];
            }
          });
          STATE.combat.selectedPlans = [];
          checkAndAutoDeploy();
          notify('COMBAT_UPDATE');
        }
        return;
      }
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

      if (key === 'm') {
        e.preventDefault();
        const btnMove = document.getElementById('btn-move-plans');
        if (btnMove && !btnMove.classList.contains('hidden')) {
          btnMove.click();
        }
        return;
      }

      if (key === 'n') {
        e.preventDefault();
        const btnPlan = document.getElementById('btn-plan-title');
        const btnWizardStep = document.getElementById('btn-plan-wizard-step');
        if (btnPlan && !btnPlan.classList.contains('hidden')) {
          btnPlan.click();
        } else if (btnWizardStep && !btnWizardStep.classList.contains('hidden')) {
          btnWizardStep.click();
        }
        return;
      }

      if (key === 'y') {
        e.preventDefault();
        applyStance('retreat');
        return;
      }
      if (key === 'x') {
        e.preventDefault();
        applyStance('defend');
        return;
      }
      if (key === 'c') {
        e.preventDefault();
        applyStance('hold');
        return;
      }
      if (key === 'v') {
        e.preventDefault();
        applyStance('attack');
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
  initCombatSelection();
}

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

    let headerText = `${terrain ? terrain.charAt(0).toUpperCase() + terrain.slice(1) : 'Tile'}`;
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

    const locationId = tile.dataset.locationId;
    const raidType = tile.dataset.raidType;

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
      const biomePools = {
        forest: ['Fenrir Pack Wolf', 'Brood Spider'],
        mountain: ['Cave Troll', 'Fenrir Pack Wolf'],
        cave: ['Cave Troll', 'Fenrir Pack Wolf'],
        burial_mound: ['Draugr Warrior'],
        snow: ['Frost Giant (Jotunn)', 'Fenrir Pack Wolf'],
        water: ['Brood Spider'],
        default: ['Brood Spider', 'Fenrir Pack Wolf']
      };

      let pool = [...(biomePools[biome] || biomePools.default)];
      const activeMap = getActiveMap();
      if (activeMap && activeMap.monsterPoolOverrides) {
        const overrides = activeMap.monsterPoolOverrides;
        const preventSet = new Set();
        
        function applyOverrideTier(p, tier) {
          if (!tier) return p;
          if (tier.prevent?.length) tier.prevent.forEach(m => preventSet.add(m));
          if (tier.remove?.length)  p = p.filter(m => !tier.remove.includes(m));
          if (tier.add?.length)     p = [...p, ...tier.add];
          return p;
        }

        pool = applyOverrideTier(pool, overrides.global);
        pool = applyOverrideTier(pool, overrides.byBiomeType?.[biome]);
        if (raidType) {
          pool = applyOverrideTier(pool, overrides.byRaidType?.[raidType]);
        }
        if (locationId) {
          pool = applyOverrideTier(pool, overrides.byLocationId?.[locationId]);
        }
        pool = [...new Set(pool)];
        if (preventSet.size) {
          pool = pool.filter(m => !preventSet.has(m));
        }
      }

      if (pool.length > 0) {
        const list = pool.map(enemy => {
          if (enemy.endsWith('s') || enemy.toLowerCase().endsWith('shaman') || enemy.includes('(')) return enemy;
          if (enemy.endsWith('Wolf')) return enemy.replace('Wolf', 'Wolves');
          return enemy + 's';
        }).join(', ');
        contents.push(`⚔️ Spawns: <span style="color:var(--color-danger); font-weight:600;">${list}</span>`);
      }
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

        let effectHtml = `<b style="color:${lore.color}">${lore.milestoneEffects[idx]}</b>`;
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
      headerText = `Combat Grid Lane ${r + 1}`;
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
          
          if (unit.type === 'runecaster') {
            contents.push(`<hr style="margin: 4px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.15);">`);
            contents.push(`<b>🔮 Runecaster Divine Runes:</b>`);
            const godNames = ['odin', 'thor', 'hel', 'loki', 'freya'];
            godNames.forEach(g => {
              const unlocked = STATE.godQuests[g]?.[4] === true;
              const cooldown = unit.runeCooldowns && unit.runeCooldowns[g] ? unit.runeCooldowns[g] : 0;
              
              let statusSymbol = '🔒';
              let statusText = 'Locked';
              let statusColor = 'var(--text-muted)';
              
              if (unlocked) {
                if (cooldown > 0) {
                  statusSymbol = '⏳';
                  statusText = `${cooldown} ticks`;
                  statusColor = 'var(--text-muted)';
                } else {
                  statusSymbol = '✅';
                  statusText = 'Ready';
                  statusColor = `var(--color-${g})`;
                }
              }
              
              const nameCapitalized = g.charAt(0).toUpperCase() + g.slice(1);
              contents.push(`<span style="font-size: 0.75rem; color: ${statusColor}">${statusSymbol} Rune of ${nameCapitalized} (${statusText})</span>`);
            });
            borderAccent = 'var(--color-hel)';
          }

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
