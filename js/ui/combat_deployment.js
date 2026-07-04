/* ==========================================================================
   UI COMBAT DEPLOYMENT MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE, notify, getEffectiveStats } from '../state.js';
import { sortPoolByPoints, checkAndAutoDeploy, deployUnit, undeployUnit } from '../combat.js';
import { SOLDIERS_CONFIG, SOLDIER_EMOJIS } from '../config/soldiers.js';
import { elCombatPoolList, elTooltip } from './dom.js';
import { formatStat } from './dom.js';

export function renderFormationElement() {
  const container = document.getElementById('formation-container');
  if (!container) return;
  container.innerHTML = '';

  let order = [...(STATE.combat.formationOrder || ['huntsman', 'shieldmaiden', 'berserker', 'huskarl', 'runecaster'])];
  const requiredTypes = ['berserker', 'shieldmaiden', 'huntsman', 'huskarl', 'runecaster'];
  requiredTypes.forEach(t => {
    if (!order.includes(t)) {
      order.push(t);
    }
  });
  STATE.combat.formationOrder = order;

  order.forEach((type, idx) => {
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
    chip.textContent = SOLDIER_EMOJIS[type] || '⚔️';
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

export function renderOrdersPanel() {
  const container = document.getElementById('orders-unit-list');
  if (!container) return;
  container.innerHTML = '';

  let poolTypes = [];
  if (STATE.combat && STATE.combat.pool && STATE.combat.pool.length > 0) {
    poolTypes = [...new Set(STATE.combat.pool.map(u => u.type))];
  }
  const uniqueTypes = poolTypes;

  const btnPlanTitle = document.getElementById('btn-plan-title');
  const wiz = STATE.combat.planningWizard;
  if (wiz && wiz.active && wiz.types && wiz.types.length > 0) {
    // Advance wiz.typeIndex if the current type is no longer in uniqueTypes (runs out of available pool/grid units)
    while (wiz.active && wiz.typeIndex < wiz.types.length && !uniqueTypes.includes(wiz.types[wiz.typeIndex].type)) {
      wiz.typeIndex++;
      wiz.placedCount = 0;
    }
    if (wiz.typeIndex < wiz.types.length) {
      if (btnPlanTitle) {
        btnPlanTitle.classList.add('btn-warning');
        btnPlanTitle.classList.remove('btn-primary');
      }
      STATE.combat.activePlanningType = wiz.types[wiz.typeIndex].type;
    } else {
      if (btnPlanTitle) {
        btnPlanTitle.classList.add('btn-primary');
        btnPlanTitle.classList.remove('btn-warning');
      }
      wiz.active = false;
      STATE.combat.activePlanningType = null;
    }
  } else {
    if (btnPlanTitle) {
      btnPlanTitle.classList.add('btn-primary');
      btnPlanTitle.classList.remove('btn-warning');
    }
    if (wiz) wiz.active = false;
    // Clear active planning type if it's no longer in the uniqueTypes list
    if (STATE.combat.activePlanningType && !uniqueTypes.includes(STATE.combat.activePlanningType)) {
      STATE.combat.activePlanningType = null;
    }
  }

  const btnMovePlans = document.getElementById('btn-move-plans');
  if (btnMovePlans) {
    if (STATE.combat.movePlansMode) {
      btnMovePlans.classList.add('btn-warning');
      btnMovePlans.classList.remove('btn-primary');
    } else {
      btnMovePlans.classList.add('btn-primary');
      btnMovePlans.classList.remove('btn-warning');
    }
  }

  uniqueTypes.forEach(type => {
    const card = document.createElement('div');
    card.classList.add('orders-card');
    if (STATE.combat.activePlanningType === type) {
      card.classList.add('selected-orders-card');
    }
    card.draggable = true;
    
    const emoji = SOLDIER_EMOJIS[type] || '⚔️';
    card.title = `${type.charAt(0).toUpperCase() + type.slice(1)} - Click to plan on map`;
    card.innerHTML = `${emoji}`;

    card.addEventListener('click', () => {
      if (STATE.combat.activePlanningType === type) {
        STATE.combat.activePlanningType = null;
      } else {
        STATE.combat.activePlanningType = type;
        STATE.combat.movePlansMode = false;
        STATE.combat.selectedPlans = [];
        if (STATE.combat.planningWizard) {
          STATE.combat.planningWizard.active = false;
        }
      }
      notify('COMBAT_UPDATE');
    });

    card.addEventListener('dragstart', (e) => {
      STATE.combat.movePlansMode = false;
      STATE.combat.selectedPlans = [];
      e.dataTransfer.setData('text/plain', `plan:${type}`);
      e.dataTransfer.effectAllowed = 'copy';
    });

    container.appendChild(card);
  });
}

export function renderPoolCards() {
  elCombatPoolList.innerHTML = '';
  STATE.combat.pool.forEach((unit, idx) => {
    const card = document.createElement('div');
    card.classList.add('pool-card');
    if (STATE.combat.selectedPoolIndex === idx) {
      card.classList.add('selected');
    }

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
      <span>${numHint}${SOLDIER_EMOJIS[unit.type] || '⚔️'} ${unit.name}</span>
      <span style="font-size:0.75rem">${unit.type}</span>
      <div class="health-bar-container" style="position: absolute; bottom: 4px; left: 6px; right: 6px; height: 4px;">
        <div class="health-bar-fill" style="width: ${Math.max(0, hpPct)}%; background: ${bgColor}"></div>
      </div>
    `;

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
      import('../combat.js').then(({ togglePause }) => {
        if (!STATE.combat.paused) {
          togglePause();
        }
        STATE.combat.selectedPoolIndex = idx;
        notify('STATE_UPDATED');
      });
    });

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
}
