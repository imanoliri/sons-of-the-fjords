/* ==========================================================================
   UI COMBAT SPAWNER MODULE - SONS OF THE FJORDS
   ========================================================================== */

export function getCellEl(r, c) {
  const combatGrid = document.getElementById('combat-grid');
  if (!combatGrid) return null;
  return combatGrid.querySelector(`.combat-cell[data-row="${r}"][data-col="${c}"]`);
}

export function getCellPosition(row, col) {
  const cell = getCellEl(row, col);
  if (!cell) return null;
  const grid = document.getElementById('combat-grid');
  if (!grid) return null;
  const gridRect = grid.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();
  return {
    left: cellRect.left - gridRect.left,
    top: cellRect.top - gridRect.top,
    width: cellRect.width,
    height: cellRect.height
  };
}

export function spawnFloatyText(row, col, text, color = '#fff') {
  const pos = getCellPosition(row, col);
  if (!pos) return;
  const overlayContainer = document.getElementById('combat-effects-overlay');
  if (!overlayContainer) return;

  const floaty = document.createElement('div');
  floaty.className = 'floaty-text-fx';
  floaty.style.color = color;
  floaty.style.position = 'absolute';
  floaty.style.left = `${pos.left + pos.width / 2}px`;
  floaty.style.top = `${pos.top + pos.height / 2}px`;
  floaty.innerText = text;

  overlayContainer.appendChild(floaty);
  setTimeout(() => floaty.remove(), 1000);
}

export function spawnCombatParticle(row, col, className) {
  const pos = getCellPosition(row, col);
  if (!pos) return;
  const overlayContainer = document.getElementById('combat-effects-overlay');
  if (!overlayContainer) return;

  const particle = document.createElement('div');
  particle.className = `combat-particle-overlay ${className}`;
  particle.style.position = 'absolute';
  particle.style.left = `${pos.left}px`;
  particle.style.top = `${pos.top}px`;
  particle.style.width = `${pos.width}px`;
  particle.style.height = `${pos.height}px`;

  overlayContainer.appendChild(particle);
  setTimeout(() => particle.remove(), 800);
}

export function spawnHuntsmanProjectile(attackerRow, attackerCol, defenderRow, defenderCol) {
  const overlayContainer = document.getElementById('combat-effects-overlay');
  if (!overlayContainer) return;

  const attackerPos = getCellPosition(attackerRow, attackerCol);
  const defenderPos = getCellPosition(defenderRow, defenderCol);
  if (!attackerPos || !defenderPos) return;

  const arrow = document.createElement('div');
  arrow.className = 'huntsman-arrow-projectile';
  arrow.innerText = '→';
  arrow.style.position = 'absolute';
  
  const startX = attackerPos.left + attackerPos.width / 2;
  const startY = attackerPos.top + attackerPos.height / 2;
  const endX = defenderPos.left + defenderPos.width / 2;
  const endY = defenderPos.top + defenderPos.height / 2;

  arrow.style.left = `${startX}px`;
  arrow.style.top = `${startY}px`;
  arrow.style.zIndex = '100';

  const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
  arrow.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;

  overlayContainer.appendChild(arrow);

  requestAnimationFrame(() => {
    arrow.style.transition = 'all 0.25s linear';
    arrow.style.left = `${endX}px`;
    arrow.style.top = `${endY}px`;
  });

  setTimeout(() => {
    arrow.remove();
  }, 250);
}

const RUNE_ICONS = {
  odin:  '⚡',
  thor:  '🔨',
  hel:   '💀',
  loki:  '🌀',
  freya: '🌸'
};

export function flashRuneOnCells(row, col, runeName, aoe = false, runecasterRow = null, runecasterCol = null) {
  const overlayContainer = document.getElementById('combat-effects-overlay');
  if (!overlayContainer) return;

  const addAndClean = (el, pos) => {
    el.style.position = 'absolute';
    el.style.left = `${pos.left}px`;
    el.style.top = `${pos.top}px`;
    el.style.width = `${pos.width}px`;
    el.style.height = `${pos.height}px`;
    overlayContainer.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };

  const centerPos = getCellPosition(row, col);
  if (centerPos) {
    const strike = document.createElement('div');
    strike.className = `rune-strike rune-${runeName}`;
    addAndClean(strike, centerPos);

    const icon = document.createElement('span');
    icon.className = 'rune-icon';
    icon.innerText = RUNE_ICONS[runeName] || '✨';
    icon.style.position = 'absolute';
    icon.style.left = `${centerPos.left + centerPos.width / 2}px`;
    icon.style.top = `${centerPos.top + centerPos.height / 2}px`;
    icon.style.transform = 'translate(-50%, -50%)';
    overlayContainer.appendChild(icon);
    icon.addEventListener('animationend', () => icon.remove(), { once: true });
  }

  if (runecasterRow !== null) {
    const rcPos = getCellPosition(runecasterRow, runecasterCol);
    if (rcPos) {
      const label = document.createElement('span');
      label.className = `rune-cast-label rune-${runeName}`;
      label.innerText = `${RUNE_ICONS[runeName]} ${runeName.toUpperCase()} RUNE`;
      label.style.position = 'absolute';
      label.style.left = `${rcPos.left + rcPos.width / 2}px`;
      label.style.top = `${rcPos.top}`;
      overlayContainer.appendChild(label);
      label.addEventListener('animationend', () => label.remove(), { once: true });
    }
  }

  if (aoe) {
    setTimeout(() => {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const adjPos = getCellPosition(row + dr, col + dc);
          if (!adjPos) continue;
          const wave = document.createElement('div');
          wave.className = `rune-wave rune-${runeName}`;
          wave.style.animationDelay = `${(Math.abs(dr) + Math.abs(dc)) * 30}ms`;
          addAndClean(wave, adjPos);
        }
      }
    }, 160);
  }
}

export function markRunecasterCasting(unit) {
  if (!unit) return;
  unit.isCastingRune = true;
  setTimeout(() => { unit.isCastingRune = false; }, 600);
}
