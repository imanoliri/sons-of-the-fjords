/* ==========================================================================
   UI/DOM.JS — Shared DOM Selectors, Constants, and Pure Utilities
   ========================================================================== */

import { COMBAT_CONFIG } from '../config/combat.js';

// ── Pure utility ────────────────────────────────────────────────────────────
export function formatStat(statObj) {
  if (statObj.bonus === 0) {
    return `${statObj.base}`;
  }
  const sign = statObj.bonus > 0 ? '+' : '';
  return `${statObj.base} ${sign}${statObj.bonus}`;
}

// ── DOM Selectors ───────────────────────────────────────────────────────────
export const elHeader = document.getElementById('game-header');
export const elGold = document.getElementById('res-gold').querySelector('.val');
export const elFood = document.getElementById('res-food').querySelector('.val');
export const elWood = document.getElementById('res-wood').querySelector('.val');
export const elSheep = document.getElementById('res-sheep').querySelector('.val');
export const elBand = document.getElementById('res-band').querySelector('.val');
export const elBlessing = document.getElementById('active-blessing-display');
export const elTooltip = document.getElementById('game-tooltip');
export const elDay = document.getElementById('res-day').querySelector('.val');
export const elWorldDifficultyStatus = document.getElementById('world-difficulty-status');
export const elLocationDifficultyStatus = document.getElementById('location-difficulty-status');

// Party Panel Modals
export const elPartyModal = document.getElementById('modal-party');
export const elPartyBandContent = document.getElementById('party-band-content');
export const elPartyInventoryContent = document.getElementById('party-inventory-content');
export const elTabPartyBand = document.getElementById('tab-party-band');
export const elTabPartyInventory = document.getElementById('tab-party-inventory');

// Screens
export const screens = {
  menu: document.getElementById('screen-menu'),
  world: document.getElementById('screen-world'),
  town: document.getElementById('screen-town'),
  location: document.getElementById('screen-location'),
  combat: document.getElementById('screen-combat'),
  quests: document.getElementById('screen-quests')
};

// World elements
export const elWorldMap = document.getElementById('world-map');
export const elWorldCoords = document.getElementById('world-coordinates');
export const elWorldLog = document.getElementById('world-event-log');

// Town elements
export const elTownName = document.getElementById('town-name');
export const elShrineList = document.getElementById('shrine-inventory-list');
export const elShrineEmpty = document.getElementById('shrine-empty-message');

// Location elements
export const elLocMap = document.getElementById('location-map');
export const elLocTitle = document.getElementById('location-title');
export const elLocThreat = document.getElementById('location-threat-display');
export const elLocDeckCount = document.getElementById('location-deck-count');
export const elLocLog = document.getElementById('location-event-log');
export const elPromptPanel = document.getElementById('portal-prompt-panel');
export const elPromptText = document.getElementById('portal-prompt-text');
export const elPromptBtn = document.getElementById('btn-use-portal');
export const elUseWarHornSidebar = document.getElementById('btn-use-warhorn-sidebar');

// Combat elements
export const elCombatGrid = document.getElementById('combat-grid');
export const elCombatPoolList = document.getElementById('deploy-pool-list');
export const elCombatPauseBtn = document.getElementById('btn-combat-pause');
export const elCombatFleeBtn = document.getElementById('btn-combat-flee');

// Quests elements
export const elQuestsList = document.getElementById('gods-tracks-list');

// Modals
export const elModalEvent = document.getElementById('modal-event');
export const elModalEventCloseBtn = document.getElementById('modal-event-close-btn');
export const elModalEventTitle = document.getElementById('modal-event-title');
export const elModalEventBody = document.getElementById('modal-event-body');
export const elModalEventChoices = document.getElementById('modal-event-choices');

export const elModalAscension = document.getElementById('modal-ascension');
export const elModalAscensionText = document.getElementById('modal-ascension-text');

export const elModalRaidCleared = document.getElementById('modal-raid-cleared');
export const elModalRaidClearedText = document.getElementById('modal-raid-cleared-text');
export const elModalSagaVictory = document.getElementById('modal-saga-victory');
export const elModalSagaVictoryText = document.getElementById('modal-saga-victory-text');

export const elModalGameOver = document.getElementById('modal-gameover');
export const elConsoleModal = document.getElementById('modal-console');
export const elConsoleTextarea = document.getElementById('console-state-textarea');

export const elPatronCard = document.getElementById('town-patron-card');
export const elPatronList = document.getElementById('town-patron-list');

// ── Constants ────────────────────────────────────────────────────────────────
export const MONSTER_EMOJIS = Object.entries(COMBAT_CONFIG.monsters).reduce((acc, [name, cfg]) => {
  if (cfg.emoji) acc[name] = cfg.emoji;
  return acc;
}, {});
