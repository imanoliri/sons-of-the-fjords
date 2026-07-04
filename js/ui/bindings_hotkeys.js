/* ==========================================================================
   UI BINDINGS HOTKEYS MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE, setScreen } from '../state.js';
import { checkAndAutoDeploy, deployUnit, togglePause } from '../combat.js';
import {
  elConsoleModal, elPartyModal, elModalEvent, elModalEventCloseBtn
} from './dom.js';

export function setupHotkeys(mapSelectionController) {
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

    if (STATE.activeScreen === 'menu' && mapSelectionController) {
      const elMapContainer = document.getElementById('map-cards-container');
      const cols = elMapContainer ? window.getComputedStyle(elMapContainer).getPropertyValue('grid-template-columns').split(' ').length || 1 : 1;
      let selectedMapIndex = mapSelectionController.getSelectedIndex();
      const maps = mapSelectionController.maps;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        selectedMapIndex = (selectedMapIndex + 1) % maps.length;
        mapSelectionController.setSelectedIndex(selectedMapIndex);
        mapSelectionController.renderMapCards();
        const cards = elMapContainer?.querySelectorAll('.map-card');
        if (cards && cards[selectedMapIndex]) {
          cards[selectedMapIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        selectedMapIndex = (selectedMapIndex - 1 + maps.length) % maps.length;
        mapSelectionController.setSelectedIndex(selectedMapIndex);
        mapSelectionController.renderMapCards();
        const cards = elMapContainer?.querySelectorAll('.map-card');
        if (cards && cards[selectedMapIndex]) {
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
        mapSelectionController.setSelectedIndex(selectedMapIndex);
        mapSelectionController.renderMapCards();
        const cards = elMapContainer?.querySelectorAll('.map-card');
        if (cards && cards[selectedMapIndex]) {
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
        mapSelectionController.setSelectedIndex(selectedMapIndex);
        mapSelectionController.renderMapCards();
        const cards = elMapContainer?.querySelectorAll('.map-card');
        if (cards && cards[selectedMapIndex]) {
          cards[selectedMapIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        import('../world.js').then(({ setActiveMap, initializeWorld }) => {
          setActiveMap(maps[selectedMapIndex].id);
          initializeWorld();
          setScreen('world');
        });
        return;
      }
    }

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

    // Modal overlay shortcut selection (1-9)
    const visibleOverlay = document.querySelector('.modal-overlay:not(.hidden)');
    if (visibleOverlay) {
      if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        const buttons = Array.from(visibleOverlay.querySelectorAll('button, .btn'))
          .filter(btn => !btn.classList.contains('btn-close-x') && !btn.classList.contains('modal-close-btn') && !btn.classList.contains('btn-no-shortcut'));
        if (buttons[index] && !buttons[index].disabled) {
          e.preventDefault();
          buttons[index].click();
          return;
        }
      }
    }

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
      }
      if (STATE.activeScreen === 'town') {
        e.preventDefault();
        document.getElementById('btn-leave-town')?.click();
        return;
      }
    }

    if (STATE.activeScreen === 'world') {
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        document.getElementById('btn-save-game')?.click();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        document.getElementById('btn-load-game')?.click();
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        import('./world.js').then(({ movePartyOnWorld }) => movePartyOnWorld(STATE.party.worldX, STATE.party.worldY - 1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        import('./world.js').then(({ movePartyOnWorld }) => movePartyOnWorld(STATE.party.worldX, STATE.party.worldY + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        import('./world.js').then(({ movePartyOnWorld }) => movePartyOnWorld(STATE.party.worldX - 1, STATE.party.worldY));
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        import('./world.js').then(({ movePartyOnWorld }) => movePartyOnWorld(STATE.party.worldX + 1, STATE.party.worldY));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        import('./world.js').then(({ tryEnterCurrentLocation }) => tryEnterCurrentLocation());
      }
    } else if (STATE.activeScreen === 'town') {
      const townKeys = {
        '1': 'btn-recruit-shieldmaiden',
        '2': 'btn-recruit-berserker',
        '3': 'btn-recruit-huntsman',
        '4': 'btn-recruit-huskarl',
        '5': 'btn-recruit-runecaster',
        'f': 'btn-buy-food', 'F': 'btn-buy-food',
        'w': 'btn-buy-wood', 'W': 'btn-buy-wood',
        'h': 'btn-sell-wood', 'H': 'btn-sell-wood',
        's': 'btn-buy-sheep', 'S': 'btn-buy-sheep',
        'g': 'btn-sell-sheep', 'G': 'btn-sell-sheep',
        'o': 'btn-buy-warhorn', 'O': 'btn-buy-warhorn'
      };
      const btnId = townKeys[e.key];
      if (btnId) {
        e.preventDefault();
        document.getElementById(btnId)?.click();
      }
    } else if (STATE.activeScreen === 'location') {
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
        import('./location.js').then(({ attemptLocalMove }) => attemptLocalMove(targetX, targetY));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const btnPortal = document.getElementById('btn-use-portal');
        if (btnPortal && !btnPortal.disabled) {
          btnPortal.click();
        } else {
          // If burial mound explore btn has "[enter]" text
          const buttons = Array.from(document.querySelectorAll('#portal-prompt-panel button'));
          const enterBtn = buttons.find(b => b.textContent.includes('[enter]'));
          if (enterBtn) {
            enterBtn.click();
          }
        }
      } else {
        const key = e.key;
        const promptPanel = document.getElementById('portal-prompt-panel');
        if (promptPanel && !promptPanel.classList.contains('hidden')) {
          const btns = promptPanel.querySelectorAll('.btn');
          if (key === '1') {
            e.preventDefault();
            for (let b of btns) if (b.innerText.includes('[1]')) b.click();
          } else if (key === '2') {
            e.preventDefault();
            for (let b of btns) if (b.innerText.includes('[2]')) b.click();
          } else if (key === '3') {
            e.preventDefault();
            for (let b of btns) if (b.innerText.includes('[3]')) b.click();
          }
        }
      }
    } else if (STATE.activeScreen === 'combat') {
      if (e.key === ' ') {
        e.preventDefault();
        togglePause();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        togglePause();
      }

      if (e.key === 'Delete') {
        e.preventDefault();
        const grid = STATE.combat.grid;
        if (grid) {
          for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
              const u = grid[r][c];
              if (u && u.alliance === 'player' && u.selected) {
                import('../combat.js').then(({ undeployUnit }) => undeployUnit(r, c));
              }
            }
          }
        }
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

      if (e.key === 'Backspace') {
        e.preventDefault();
        if (STATE.combat.deployHistory && STATE.combat.deployHistory.length > 0) {
          const grid = STATE.combat.grid;
          for (let i = STATE.combat.deployHistory.length - 1; i >= 0; i--) {
            const unitId = STATE.combat.deployHistory[i];
            let unitR = -1;
            let unitC = -1;
            let found = false;
            for (let r = 0; r < grid.length; r++) {
              for (let c = 0; c < grid[r].length; c++) {
                if (grid[r][c] && grid[r][c].id === unitId) {
                  unitR = r;
                  unitC = c;
                  found = true;
                  break;
                }
              }
              if (found) break;
            }
            if (found) {
              import('../combat.js').then(({ undeployUnit }) => undeployUnit(unitR, unitC));
              break;
            }
          }
        }
        return;
      }

      const key = e.key.toLowerCase();

      if (key === 'm') {
        e.preventDefault();
        document.getElementById('btn-move-plans')?.click();
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

      if (STATE.combat.paused) {
        const layoutKeys = {
          'q': { r: 0, c: 0 }, 'w': { r: 1, c: 0 }, 'e': { r: 2, c: 0 }, 'r': { r: 3, c: 0 },
          'u': { r: 4, c: 0 }, 'i': { r: 5, c: 0 }, 'o': { r: 6, c: 0 }, 'p': { r: 7, c: 0 },
          'a': { r: 0, c: 1 }, 's': { r: 1, c: 1 }, 'd': { r: 2, c: 1 }, 'f': { r: 3, c: 1 },
          'j': { r: 4, c: 1 }, 'k': { r: 5, c: 1 }, 'l': { r: 6, c: 1 }, 'ö': { r: 7, c: 1 },
          'Q': { r: 0, c: 0 }, 'W': { r: 1, c: 0 }, 'E': { r: 2, c: 0 }, 'R': { r: 3, c: 0 },
          'U': { r: 4, c: 0 }, 'I': { r: 5, c: 0 }, 'O': { r: 6, c: 0 }, 'P': { r: 7, c: 0 },
          'A': { r: 0, c: 1 }, 'S': { r: 1, c: 1 }, 'D': { r: 2, c: 1 }, 'F': { r: 3, c: 1 },
          'J': { r: 4, c: 1 }, 'K': { r: 5, c: 1 }, 'L': { r: 6, c: 1 }, 'Ö': { r: 7, c: 1 }
        };

        const target = layoutKeys[e.key];
        if (target) {
          e.preventDefault();
          if (STATE.combat.grid[target.r][target.c]) {
            import('../combat.js').then(({ undeployUnit }) => {
              undeployUnit(target.r, target.c);
            });
            return;
          }

          let poolIdx = STATE.combat.selectedPoolIndex;
          if (poolIdx === null && STATE.combat.pool.length > 0) {
            poolIdx = 0;
          }

          if (poolIdx !== null && poolIdx < STATE.combat.pool.length) {
            deployUnit(poolIdx, target.r, target.c);
          }
        }
      }

      // Stance shortcuts: y = retreat, x = defend, c = hold, v = attack
      const stanceKeys = {
        'y': 'btn-stance-retreat', 'Y': 'btn-stance-retreat',
        'z': 'btn-stance-retreat', 'Z': 'btn-stance-retreat', // support QWERTZ
        'x': 'btn-stance-defend',  'X': 'btn-stance-defend',
        'c': 'btn-stance-hold',    'C': 'btn-stance-hold',
        'v': 'btn-stance-attack',  'V': 'btn-stance-attack'
      };
      const btnId = stanceKeys[e.key];
      if (btnId) {
        e.preventDefault();
        document.getElementById(btnId)?.click();
      }
    }
  });
}
