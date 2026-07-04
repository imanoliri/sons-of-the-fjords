/* ==========================================================================
   UI BINDINGS MODALS MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE, notify, setScreen } from '../state.js';
import { setActiveMap } from '../world.js';
import { showOverlay, hideOverlay } from './overlay.js';
import { renderPartyPanel, renderHallOfFame } from './party.js';
import { showToast, logWorld } from './notifications.js';
import {
  elPartyModal, elConsoleModal, elConsoleTextarea, elModalEvent, elTabPartyBand, elTabPartyInventory,
  elPartyBandContent, elPartyInventoryContent, elTabPartyHallOfFame, elPartyHallOfFameContent,
  elModalGameOver, elModalAscension, elModalRaidCleared, elModalSagaVictory
} from './dom.js';

export function setupModals() {
  const bindButton = (id, callback) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', callback);
  };

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
    const goldStr = `${STATE.resources.gold}_gold`;
    const worldName = STATE.worldMap && STATE.worldMap.name ? STATE.worldMap.name.toLowerCase().replace(/\s+/g, '_') : 'world';

    const filename = `save__${worldName}__${timestamp}__${godsStr}__${goldStr}.json`;

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
    elTabPartyHallOfFame.classList.remove('btn-primary');
    elPartyBandContent.classList.remove('hidden');
    elPartyInventoryContent.classList.add('hidden');
    elPartyHallOfFameContent.classList.add('hidden');
  });

  bindButton('tab-party-inventory', () => {
    elTabPartyInventory.classList.add('btn-primary');
    elTabPartyBand.classList.remove('btn-primary');
    elTabPartyHallOfFame.classList.remove('btn-primary');
    elPartyInventoryContent.classList.remove('hidden');
    elPartyBandContent.classList.add('hidden');
    elPartyHallOfFameContent.classList.add('hidden');
  });

  bindButton('tab-party-hall-of-fame', () => {
    elTabPartyHallOfFame.classList.add('btn-primary');
    elTabPartyBand.classList.remove('btn-primary');
    elTabPartyInventory.classList.remove('btn-primary');
    elPartyHallOfFameContent.classList.remove('hidden');
    elPartyBandContent.classList.add('hidden');
    elPartyInventoryContent.classList.add('hidden');
    renderHallOfFame();
  });

  bindButton('btn-restart-game', () => {
    hideOverlay(elModalGameOver);
    STATE.activeScreen = 'world';
    notify('RESET_GAME');
  });

  bindButton('btn-ascend-victory', () => {
    hideOverlay(elModalAscension);
    showToast('Congratulations! You have ascended to Valhalla. The sagas will sing of your name!', '👑');
    setTimeout(() => { location.reload(); }, 4000);
  });

  bindButton('btn-ascend-continue', () => {
    hideOverlay(elModalAscension);
    const activeVictoryGod = elModalAscension.dataset.god;
    if (activeVictoryGod) {
      STATE.godFavor[activeVictoryGod] = 5;
    }
    if (STATE.combat.active) {
      STATE.combat.paused = false;
      notify('COMBAT_UPDATE');
    }

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
}
