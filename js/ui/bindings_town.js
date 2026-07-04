/* ==========================================================================
   UI BINDINGS TOWN MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE, adjustResource, setScreen, buyRecruit, healWarriors } from '../state.js';
import { checkAndAutoDeploy } from '../combat.js';
import { TOWN_CONFIG } from '../config/town.js';
import { logWorld } from './notifications.js';

export function setupTownBindings() {
  const bindButton = (id, callback) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', callback);
  };

  document.getElementById('btn-leave-town').addEventListener('click', () => {
    STATE.party.currentLocationId = null;
    setScreen('world');
  });

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
  });

  bindButton('btn-repair-ship', () => {
    const cost = Math.abs(TOWN_CONFIG.repairHullCost.wood);
    if (STATE.resources.wood >= cost) {
      adjustResource('wood', -cost);
      logWorld('Drakkar ship hull reinforced and repaired.', 'gain-message');
    } else {
      logWorld('Not enough timber logs to repair!', 'warn-message');
    }
  });

  bindButton('btn-leave-location', () => {
    STATE.party.currentLocationId = null;
    setScreen('world');
    logWorld('Escaped from raid site back to the open sea.');
  });

  bindButton('btn-use-warhorn-sidebar', () => {
    import('./location.js').then(({ useWarHorn }) => {
      useWarHorn();
    });
  });
}
