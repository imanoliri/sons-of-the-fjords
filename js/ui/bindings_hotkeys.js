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
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        import('./world.js').then(({ movePartyOnWorld }) => movePartyOnWorld(STATE.party.worldX, STATE.party.worldY - 1));
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
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
    } else if (STATE.activeScreen === 'location') {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        import('./location.js').then(({ attemptLocalMove }) => attemptLocalMove(0, -1));
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        import('./location.js').then(({ attemptLocalMove }) => attemptLocalMove(0, 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        import('./location.js').then(({ attemptLocalMove }) => attemptLocalMove(-1, 0));
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        import('./location.js').then(({ attemptLocalMove }) => attemptLocalMove(1, 0));
      }
    } else if (STATE.activeScreen === 'combat') {
      if (e.key === ' ') {
        e.preventDefault();
        togglePause();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        togglePause();
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
          if (STATE.combat.grid[target.r][target.c]) return;

          let poolIdx = STATE.combat.selectedPoolIndex;
          if (poolIdx === null && STATE.combat.pool.length > 0) {
            poolIdx = 0;
          }

          if (poolIdx !== null && poolIdx < STATE.combat.pool.length) {
            deployUnit(poolIdx, target.r, target.c);
          }
        }
      }
    }
  });
}
