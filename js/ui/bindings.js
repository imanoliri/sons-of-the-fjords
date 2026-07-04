/* ==========================================================================
   UI/BINDINGS.JS — Event Listeners and Tooltips
   ========================================================================== */

import { STATE, notify, setScreen } from '../state.js';
import { initCombatSelection } from './combat.js';
import { togglePause, deployUnit, checkAndAutoDeploy } from '../combat.js';
import { setupMapSelection } from './bindings_map_selection.js';
import { initTooltipEvents } from './bindings_tooltips.js';
import { setupModals } from './bindings_modals.js';
import { setupTownBindings } from './bindings_town.js';
import { setupHotkeys } from './bindings_hotkeys.js';

export { setupMapSelection } from './bindings_map_selection.js';
export { initTooltipEvents } from './bindings_tooltips.js';
export { setupModals } from './bindings_modals.js';
export { setupTownBindings } from './bindings_town.js';
export { setupHotkeys } from './bindings_hotkeys.js';

export function initUIBindings() {
  const mapSelectionController = setupMapSelection();

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

  setupModals();
  setupTownBindings();
  setupHotkeys(mapSelectionController);

  initTooltipEvents();
  initCombatSelection();
}
