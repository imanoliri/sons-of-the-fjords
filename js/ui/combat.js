/* ==========================================================================
   UI/COMBAT.JS — Combat grid rendering and visual effects
   ========================================================================== */

import { STATE, notify, getEffectiveStats } from '../state.js';
import { togglePause, deployUnit, undeployUnit, sortPoolByPoints } from '../combat.js';
import { SOLDIERS_CONFIG, SOLDIER_EMOJIS } from '../config/soldiers.js';
import {
  elCombatGrid, elCombatPoolList, elCombatPauseBtn,
  elTooltip, MONSTER_EMOJIS
} from './dom.js';
import { formatStat } from './dom.js';

export function renderFormationElement() {
  const container = document.getElementById('formation-container');
  if (!container) return;
  container.innerHTML = '';

  let order = [...(STATE.combat.formationOrder || ['shieldmaiden', 'huntsman', 'berserker', 'huskarl', 'runecaster'])];
  // Ensure all 5 soldier types are present in case order is loaded from an old save file
  const requiredTypes = ['berserker', 'shieldmaiden', 'huntsman', 'huskarl', 'runecaster'];
  requiredTypes.forEach(t => {
    if (!order.includes(t)) {
      order.push(t);
    }
  });
  STATE.combat.formationOrder = order;

  const icons = SOLDIER_EMOJIS;

  order.forEach((type, idx) => {
    // Separator arrow between icons
    if (idx > 0) {
      const arrow = document.createElement('span');
      arrow.textContent = '›';
      arrow.style.opacity = '0.4';
      arrow.style.fontSize = '1rem';
      container.appendChild(arrow);
    }

    const chip = document.createElement('span');
    chip.draggable = true;
    chip.title = `${type.charAt(0).toUpperCase() + type.slice(1)} (${3 - idx} pts) — drag to reorder`;
    chip.style.cssText = `
      font-size: 1.15rem;
      cursor: grab;
      padding: 1px 3px;
      border-radius: 4px;
      border: 1px solid transparent;
      transition: border-color 0.15s, background 0.15s;
      user-select: none;
    `;
    chip.textContent = icons[type] || '⚔️';
    chip.dataset.index = idx;

    chip.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', idx);
      e.dataTransfer.effectAllowed = 'move';
      chip.style.opacity = '0.4';
    });

    chip.addEventListener('dragend', () => {
      chip.style.opacity = '1';
    });

    chip.addEventListener('dragover', (e) => {
      e.preventDefault();
      chip.style.borderColor = 'var(--text-accent)';
      chip.style.background = 'rgba(0,240,255,0.1)';
    });

    chip.addEventListener('dragleave', () => {
      chip.style.borderColor = 'transparent';
      chip.style.background = 'transparent';
    });

    chip.addEventListener('drop', (e) => {
      e.preventDefault();
      chip.style.borderColor = 'transparent';
      chip.style.background = 'transparent';
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
      const toIdx = idx;
      if (!isNaN(fromIdx) && fromIdx !== toIdx) {
        const temp = order[fromIdx];
        order[fromIdx] = order[toIdx];
        order[toIdx] = temp;
        STATE.combat.formationOrder = order;
        sortPoolByPoints();
        notify('COMBAT_UPDATE');
      }
    });

    container.appendChild(chip);
  });
}

// Render 10x8 Combat lanes grid
export function renderCombatGrid() {
  elCombatGrid.innerHTML = '';

  const grid = STATE.combat.grid;
  if (!grid || grid.length === 0) return;

  // Build grid layout cells
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 10; c++) {
      const elCell = document.createElement('div');
      elCell.classList.add('combat-cell');
      elCell.dataset.row = r;
      elCell.dataset.col = c;

      // Make columns 0 and 1 highlighted deploy zones when paused
      if (STATE.combat.paused && c <= 1 && !grid[r][c]) {
        if (STATE.combat.selectedPoolIndex !== null) {
          elCell.classList.add('deployable-zone');
          elCell.addEventListener('click', () => {
            deployUnit(STATE.combat.selectedPoolIndex, r, c);
          });
        }

        // Render keyboard shortcut key hint in the cell (qweruiop for col 0, asdfjklö for col 1)
        const hints = {
          '0,0': 'Q', '1,0': 'W', '2,0': 'E', '3,0': 'R', '4,0': 'U', '5,0': 'I', '6,0': 'O', '7,0': 'P',
          '0,1': 'A', '1,1': 'S', '2,1': 'D', '3,1': 'F', '4,1': 'J', '5,1': 'K', '6,1': 'L', '7,1': 'Ö'
        };
        const hintKey = `${r},${c}`;
        if (hints[hintKey]) {
          const elHint = document.createElement('span');
          elHint.className = 'cell-key-hint';
          elHint.innerText = hints[hintKey];
          elCell.appendChild(elHint);
        }
      }

      // Check for unit placed in cell
      const unit = grid[r][c];
      if (unit) {
        const elUnit = document.createElement('div');
        elUnit.classList.add('combat-unit', `alliance-${unit.alliance}`);

        // Emoji display based on soldier/monster class type or fleeing state
        if (unit.isFleeing) {
          elUnit.classList.add('fleeing');
          elUnit.innerText = '🏃‍♂️';
        } else {
          elUnit.innerText = SOLDIER_EMOJIS[unit.type] || MONSTER_EMOJIS[unit.type] || '👾';
        }

        // Undead, Charmed, or Confused states visual style hooks
        if (unit.isUndead) {
          elUnit.classList.add('undead-risen');
          const badge = document.createElement('span');
          badge.className = 'undead-skull-overlay';
          badge.innerText = '💀';
          elUnit.appendChild(badge);
        }
        if (unit.isCharmed) {
          elUnit.classList.add('charmed-state');
          const badge = document.createElement('span');
          badge.className = 'charm-heart-orbit';
          badge.innerText = '💖';
          elUnit.appendChild(badge);
        }
        if (unit.isConfused) {
          elUnit.classList.add('confused-state');
          const badge = document.createElement('span');
          badge.className = 'confuse-question-orbit';
          badge.innerText = '🌀';
          elUnit.appendChild(badge);
        }

        // Apply active player stances visual style classes to player units
        if (unit.alliance === 'player') {
          const stance = STATE.combat.stance || 'attack';
          elUnit.classList.add(`stance-${stance}`);
          if (stance !== 'attack') {
            const stanceBadge = document.createElement('span');
            stanceBadge.className = 'stance-icon-badge';
            stanceBadge.innerText = stance === 'defend' ? '🛡️' : stance === 'hold' ? '⚓' : '🏃';
            elUnit.appendChild(stanceBadge);
          }
        }

        // Attack dynamic animations
        if (unit.isAttacking) {
          elUnit.classList.add('attacking');
        }

        // Runecaster casting glow (set externally)
        if (unit.isCastingRune) {
          elUnit.classList.add('casting-rune');
        }

        // Stunned visual badge + orbit stars
        if (unit.stunnedTicksLeft > 0) {
          elUnit.classList.add('stunned');
          // Orbiting star row
          const orbit = document.createElement('span');
          orbit.className = 'stun-orbit';
          orbit.innerText = '★★★';
          elUnit.appendChild(orbit);
          // Tick-count badge
          const stunBadge = document.createElement('span');
          stunBadge.className = 'stun-badge';
          stunBadge.title = `Stunned (${unit.stunnedTicksLeft} ticks left)`;
          stunBadge.innerText = unit.stunnedTicksLeft;
          elUnit.appendChild(stunBadge);
        }

        // DoT shimmer + fire icon — burning from Odin rune
        if (STATE.combat.activeDoTs?.some(d => d.unit?.id === unit.id && d.ticksLeft > 0)) {
          elUnit.classList.add('burning');
          const burnIcon = document.createElement('span');
          burnIcon.className = 'burn-icon';
          burnIcon.innerText = '🔥';
          elUnit.appendChild(burnIcon);
        }

        // Allow removing unit from deployment grid if paused, OR fleeing if fleeMode is active
        if (unit.alliance === 'player') {
          if (STATE.combat.fleeMode) {
            elUnit.classList.add('fleeing-target');
            elUnit.addEventListener('click', (e) => {
              e.stopPropagation();
              unit.isFleeing = true;
              notify('COMBAT_UPDATE');
            });
          } else if (STATE.combat.paused) {
            elUnit.classList.add('removable-unit');
            elUnit.addEventListener('click', (e) => {
              e.stopPropagation();
              undeployUnit(r, c);
            });
          }
        }

        const stats = getEffectiveStats(unit);
        elUnit.title = `${unit.name} (${unit.hp}/${stats.maxHp.total} HP)`;

        // Healthbar rendering
        const hbContainer = document.createElement('div');
        hbContainer.classList.add('health-bar-container');
        if (unit.alliance === 'enemy') hbContainer.classList.add('enemy-hb');

        const hbFill = document.createElement('div');
        hbFill.classList.add('health-bar-fill');
        const hpPct = (unit.hp / stats.maxHp.total) * 100;
        hbFill.style.width = `${Math.max(0, hpPct)}%`;
        const ratio = unit.hp / stats.maxHp.total;
        if (ratio >= 0.8) {
          hbFill.style.background = 'var(--color-success)';
        } else if (ratio >= 0.2) {
          hbFill.style.background = 'orange';
        } else {
          hbFill.style.background = 'var(--color-danger)';
        }

        hbContainer.appendChild(hbFill);
        elUnit.appendChild(hbContainer);
        elCell.appendChild(elUnit);
      }

      elCombatGrid.appendChild(elCell);
    }
  }

  // Toggle paused labels
  if (STATE.combat.paused) {
    elCombatPauseBtn.innerText = 'Start Battle [Enter]';
    elCombatPauseBtn.classList.remove('btn-warning');
    elCombatPauseBtn.classList.add('btn-primary');
    elCombatGrid.classList.add('paused-deploying');
  } else {
    elCombatPauseBtn.innerText = 'Pause / Place [Space]';
    elCombatPauseBtn.classList.remove('btn-primary');
    elCombatPauseBtn.classList.add('btn-warning');
    elCombatGrid.classList.remove('paused-deploying');
  }

  // Update active stance class on buttons
  const btnRetreat = document.getElementById('btn-stance-retreat');
  const btnDefend = document.getElementById('btn-stance-defend');
  const btnHold = document.getElementById('btn-stance-hold');
  const btnAttack = document.getElementById('btn-stance-attack');
  if (btnRetreat && btnDefend && btnHold && btnAttack) {
    const stance = STATE.combat.stance || 'attack';
    btnRetreat.classList.toggle('active-stance', stance === 'retreat');
    btnDefend.classList.toggle('active-stance', stance === 'defend');
    btnHold.classList.toggle('active-stance', stance === 'hold');
    btnAttack.classList.toggle('active-stance', stance === 'attack');
  }

  // Render Deployment Pool Hand cards
  elCombatPoolList.innerHTML = '';
  STATE.combat.pool.forEach((unit, idx) => {
    const card = document.createElement('div');
    card.classList.add('pool-card');
    if (STATE.combat.selectedPoolIndex === idx) {
      card.classList.add('selected');
    }

    const icons = SOLDIER_EMOJIS;
    const numHint = idx < SOLDIERS_CONFIG.maxBandSize ? `<span class="pool-number-hint">[${idx + 1}]</span> ` : '';
    const ratio = unit.hp / unit.maxHp;
    const hpPct = ratio * 100;
    let bgColor = 'var(--color-success)';
    if (ratio < 0.2) {
      bgColor = 'var(--color-danger)';
    } else if (ratio < 0.8) {
      bgColor = 'orange';
    }

    card.innerHTML = `
      <span>${numHint}${icons[unit.type]} ${unit.name}</span>
      <span style="font-size:0.75rem">${unit.type}</span>
      <div class="health-bar-container" style="position: absolute; bottom: 4px; left: 6px; right: 6px; height: 4px;">
        <div class="health-bar-fill" style="width: ${Math.max(0, hpPct)}%; background: ${bgColor}"></div>
      </div>
    `;
    // Enable Drag and Drop to reorder pool cards
    card.draggable = true;
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', idx);
      card.classList.add('dragging');
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const draggedIdx = parseInt(e.dataTransfer.getData('text/plain'));
      if (!isNaN(draggedIdx) && draggedIdx !== idx) {
        const selectedUnit = STATE.combat.selectedPoolIndex !== null ? STATE.combat.pool[STATE.combat.selectedPoolIndex] : null;

        const [moved] = STATE.combat.pool.splice(draggedIdx, 1);
        STATE.combat.pool.splice(idx, 0, moved);

        if (selectedUnit) {
          STATE.combat.selectedPoolIndex = STATE.combat.pool.indexOf(selectedUnit);
        }

        notify('COMBAT_UPDATE');
      }
    });

    card.addEventListener('click', () => {
      if (!STATE.combat.paused) {
        togglePause(); // Force pause to allow placements
      }
      STATE.combat.selectedPoolIndex = idx;
      notify('STATE_UPDATED');
    });

    // Custom hover tooltip for pool cards
    card.addEventListener('mouseover', (e) => {
      const stats = getEffectiveStats(unit);
      let borderAccent = 'var(--text-accent)';
      let headerText = `${unit.name} (Viking Soldier)`;
      const contents = [
        `<b>HP:</b> ${unit.hp} / ${formatStat(stats.maxHp)}`,
        `<b>Damage:</b> ${formatStat(stats.dmg)}`,
        `<b>Range:</b> ${formatStat(stats.range)}`,
        `<b>Speed:</b> ${formatStat(stats.speed)}`
      ];

      if (unit.type === 'runecaster') {
        contents.push(`<hr style="margin: 4px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.15);">`);
        contents.push(`<b>🔮 Runecaster Divine Runes:</b>`);
        const godNames = ['odin', 'thor', 'hel', 'loki', 'freya'];
        godNames.forEach(g => {
          const unlocked = STATE.godQuests[g]?.[4] === true;
          const cooldown = unit.runeCooldowns && unit.runeCooldowns[g] ? unit.runeCooldowns[g] : 0;
          
          let statusSymbol = '🔒';
          let statusText = 'Locked';
          let statusColor = 'var(--text-muted)';
          
          if (unlocked) {
            if (cooldown > 0) {
              statusSymbol = '⏳';
              statusText = `${cooldown} ticks`;
              statusColor = 'var(--text-muted)';
            } else {
              statusSymbol = '✅';
              statusText = 'Ready';
              statusColor = `var(--color-${g})`;
            }
          }
          
          const nameCapitalized = g.charAt(0).toUpperCase() + g.slice(1);
          contents.push(`<span style="font-size: 0.75rem; color: ${statusColor}">${statusSymbol} Rune of ${nameCapitalized} (${statusText})</span>`);
        });
        borderAccent = 'var(--color-hel)';
      }

      elTooltip.innerHTML = `
        <div class="game-tooltip-header">
          <span>${headerText}</span>
        </div>
        <div class="game-tooltip-contents">${contents.join('<br>')}</div>
      `;
      elTooltip.style.borderLeftColor = borderAccent;
      elTooltip.style.display = 'flex';
      elTooltip.style.left = (e.clientX + 15) + 'px';
      elTooltip.style.top = (e.clientY + 15) + 'px';
    });

    card.addEventListener('mousemove', (e) => {
      if (elTooltip.style.display === 'flex') {
        elTooltip.style.left = (e.clientX + 15) + 'px';
        elTooltip.style.top = (e.clientY + 15) + 'px';
      }
    });

    card.addEventListener('mouseleave', () => {
      elTooltip.style.display = 'none';
    });

    elCombatPoolList.appendChild(card);
  });

  renderFormationElement();
}

/* --- Visual Effects Helpers --- */

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

/**
 * Spawn a floating text label rising from a specific cell.
 */
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

/**
 * Spawn a brief full-cell visual particle burst (like block shield, leap wind, or critical green glow).
 */
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

/**
 * Spawn a huntsman shooting projectile (arrow) flying from attacker to defender.
 */
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

  // Calculate rotation angle
  const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
  arrow.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;

  overlayContainer.appendChild(arrow);

  // Trigger CSS transition
  requestAnimationFrame(() => {
    arrow.style.transition = 'all 0.25s linear';
    arrow.style.left = `${endX}px`;
    arrow.style.top = `${endY}px`;
  });

  // Remove after animation completes
  setTimeout(() => {
    arrow.remove();
  }, 250);
}

/* --- Rune visual helpers --- */

/** Per-rune strike icons shown on hit cells */
const RUNE_ICONS = {
  odin:  '⚡',
  thor:  '🔨',
  hel:   '💀',
  loki:  '🌀',
  freya: '🌸'
};

/**
 * Staged rune animation:
 *  1. Immediately: bright full-cell "strike" on the center cell + icon pop.
 *  2. After 150ms: wave ripple spreads to each adjacent cell in the AoE radius.
 * Non-AoE runes only show the center strike.
 */
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

  // --- Step 1: center strike ---
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

  // --- Step 1b: floating label on runecaster cell ---
  if (runecasterRow !== null) {
    const rcPos = getCellPosition(runecasterRow, runecasterCol);
    if (rcPos) {
      const label = document.createElement('span');
      label.className = `rune-cast-label rune-${runeName}`;
      label.innerText = `${RUNE_ICONS[runeName]} ${runeName.toUpperCase()} RUNE`;
      label.style.position = 'absolute';
      label.style.left = `${rcPos.left + rcPos.width / 2}px`;
      label.style.top = `${rcPos.top}px`;
      overlayContainer.appendChild(label);
      label.addEventListener('animationend', () => label.remove(), { once: true });
    }
  }

  // --- Step 2: wave ripple to adjacent cells after short delay ---
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

/**
 * Briefly mark a runecaster unit as casting (adds CSS class, clears after animation).
 * Works by setting a flag read during the next renderCombatGrid call.
 */
export function markRunecasterCasting(unit) {
  if (!unit) return;
  unit.isCastingRune = true;
  setTimeout(() => { unit.isCastingRune = false; }, 600);
}
