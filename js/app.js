/* ==========================================================================
   APPLICATION ENTRY - SONS OF THE FJORDS
   ========================================================================== */

import { STATE, subscribe, resetGame, initHallOfFame } from './state.js';
import { initializeWorld, setActiveMap } from './world.js';
import { initUIBindings, render, handleStateNotification, logWorld } from './ui.js';

// Setup application boots
function initApp() {
  
  // 1. Setup World Layout Coordinates
  initializeWorld();

  // 2. Initialize UI Bindings
  initUIBindings();

  // 3. Listen to State alerts
  subscribe(handleStateNotification);
  
  // Custom State listener to trigger renders on modifications
  subscribe((event, data) => {
    if (event === 'STATE_UPDATED') {
      render();
    } else if (event === 'RESET_GAME') {
      resetGame();
      initializeWorld();
      render();
      logWorld('A new saga begins. Sail safe, chieftain.');
    }
  });

  // 4. Mount render
  render();

  // 5. Initialize Hall of Fame with starting band
  initHallOfFame();
}

// Fire loading
window.addEventListener('DOMContentLoaded', () => {
  initApp();
});
