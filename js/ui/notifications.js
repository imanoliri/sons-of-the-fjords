/* ==========================================================================
   UI/NOTIFICATIONS.JS — Event log helpers and toast notifications
   ========================================================================== */

import { STATE } from '../state.js';
import { elWorldLog, elLocLog } from './dom.js';

/* --- Logging helpers --- */

let currentActiveScreen = '';
let lastWorldMsg = '';
let lastWorldCount = 1;
let lastWorldElement = null;

let lastLocMsg = '';
let lastLocCount = 1;
let lastLocElement = null;

export function checkScreenReset() {
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

/* --- Toast notifications --- */

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
