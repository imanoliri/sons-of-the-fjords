/* ==========================================================================
   UI/OVERLAY.JS — Modal Overlay helpers and keyboard navigation
   ========================================================================== */

export let activeModalFocusIndex = 0;

export function updateModalKeyboardNavigation() {
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

export function setModalFocusIndex(val) {
  activeModalFocusIndex = val;
}

export function showOverlay(el) {
  el.classList.remove('hidden');
  activeModalFocusIndex = 0;
  updateModalKeyboardNavigation();
}

export function hideOverlay(el) {
  el.classList.add('hidden');
  updateModalKeyboardNavigation();
}
