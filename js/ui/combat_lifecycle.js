/* ==========================================================================
   UI COMBAT LIFECYCLE MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE, notify } from '../state.js';
import { checkAndAutoDeploy, undeployUnit } from '../combat.js';
import { showToast } from './notifications.js';

let isSelecting = false;
let startX = 0;
let startY = 0;
let selectionBox = null;

export function initCombatSelection() {
  const gridEl = document.getElementById('combat-grid');
  if (!gridEl) return;

  gridEl.addEventListener('contextmenu', (e) => e.preventDefault());

  const btnClear = document.getElementById('btn-clear-plans');
  
  const btnPause = document.getElementById('btn-combat-pause');
  if (btnPause) {
    btnPause.onclick = () => {
      import('../combat.js').then(({ togglePause }) => togglePause());
    };
  }

  const btnFlee = document.getElementById('btn-combat-flee');
  if (btnFlee) {
    btnFlee.onclick = () => {
      import('../combat.js').then(({ fleeCombat }) => fleeCombat());
    };
  }

  if (btnClear) {
    btnClear.onclick = () => {
      if (STATE.combat.grid && STATE.combat.deployHistory) {
        for (let r = 0; r < STATE.combat.grid.length; r++) {
          for (let c = 0; c < STATE.combat.grid[r].length; c++) {
            const unit = STATE.combat.grid[r][c];
            if (unit && unit.alliance === 'player' && STATE.combat.deployHistory.includes(unit.id)) {
              undeployUnit(r, c);
            }
          }
        }
      }
      STATE.combat.plannedLayout = Array.from({ length: 8 }, () => Array(10).fill(null));
      STATE.combat.activePlanningType = null;
      STATE.combat.selectedPlans = [];
      if (STATE.combat.planningWizard) {
        STATE.combat.planningWizard.active = false;
      }
      checkAndAutoDeploy();
      notify('COMBAT_UPDATE');
    };
  }
  
  const setupStanceBtn = (id, stanceValue) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.onclick = () => {
        STATE.combat.stance = stanceValue;
        notify('COMBAT_UPDATE');
      };
    }
  };
  setupStanceBtn('btn-stance-retreat', 'retreat');
  setupStanceBtn('btn-stance-defend', 'defend');
  setupStanceBtn('btn-stance-hold', 'hold');
  setupStanceBtn('btn-stance-attack', 'attack');

  const btnSave = document.getElementById('btn-save-plans');
  if (btnSave) {
    btnSave.onclick = () => {
      const layout = STATE.combat.plannedLayout || Array.from({ length: 8 }, () => Array(10).fill(null));
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(layout));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "battle_plan.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Battle plan saved/downloaded!');
    };
  }

  const btnLoad = document.getElementById('btn-load-plans');
  if (btnLoad) {
    btnLoad.onclick = () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json';
      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const layout = JSON.parse(evt.target.result);
            if (Array.isArray(layout) && layout.length === 8 && layout.every(row => Array.isArray(row) && row.length === 10)) {
              STATE.combat.plannedLayout = layout;
              STATE.combat.plansDefinedThisTick = {};
              for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 10; col++) {
                  if (layout[row][col]) {
                    STATE.combat.plansDefinedThisTick[`${row},${col}`] = true;
                  }
                }
              }
              checkAndAutoDeploy();
              notify('COMBAT_UPDATE');
              showToast('Battle plan loaded successfully!');
            } else {
              showToast('Invalid battle plan layout format.');
            }
          } catch (err) {
            showToast('Error parsing JSON battle plan.');
          }
        };
        reader.readAsText(file);
      };
      fileInput.click();
    };
  }

  const btnPlanTitle = document.getElementById('btn-plan-title');
  if (btnPlanTitle) {
    btnPlanTitle.onclick = () => {
      STATE.combat.movePlansMode = false;
      STATE.combat.selectedPlans = [];

      if (STATE.combat.planningWizard && STATE.combat.planningWizard.active) {
        STATE.combat.planningWizard.active = false;
        STATE.combat.activePlanningType = null;
        notify('COMBAT_UPDATE');
        return;
      }

      STATE.combat.activePlanningType = null;
      let poolTypes = [];
      if (STATE.combat && STATE.combat.pool && STATE.combat.pool.length > 0) {
        poolTypes = [...new Set(STATE.combat.pool.map(u => u.type))];
      }
      const uniqueTypes = poolTypes;

      const wizardTypes = [];
      uniqueTypes.forEach(type => {
        const poolCount = STATE.combat.pool ? STATE.combat.pool.filter(u => u.type === type).length : 0;
        const gridCount = (STATE.combat.grid || []).flat().filter(u => u && u.alliance === 'player' && !u.isCharmed && !u.isConfused && !u.isUndead && u.type === type).length;
        const totalCount = poolCount + gridCount;
        if (totalCount > 0) {
          wizardTypes.push({ type, totalCount });
        }
      });

      if (wizardTypes.length > 0) {
        STATE.combat.planningWizard = {
          active: true,
          types: wizardTypes,
          typeIndex: 0,
          placedCount: 0
        };
      }
      notify('COMBAT_UPDATE');
    };
  }

  const btnMovePlans = document.getElementById('btn-move-plans');
  if (btnMovePlans) {
    btnMovePlans.onclick = () => {
      STATE.combat.movePlansMode = !STATE.combat.movePlansMode;
      if (STATE.combat.movePlansMode) {
        STATE.combat.activePlanningType = null;
        if (STATE.combat.planningWizard) {
          STATE.combat.planningWizard.active = false;
        }
      }
      STATE.combat.selectedPlans = [];
      notify('COMBAT_UPDATE');
    };
  }

  gridEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    
    const isRealUnit = e.target.closest('.combat-unit:not(.ghost-unit)');
    if (isRealUnit || e.target.closest('.orders-card') || e.target.closest('.pool-card') || e.target.closest('.btn') || e.target.closest('button')) {
      return;
    }

    const cellEl = e.target.closest('.combat-cell');
    if (cellEl) {
      const r = parseInt(cellEl.dataset.row);
      const c = parseInt(cellEl.dataset.col);
      const planType = STATE.combat.plannedLayout?.[r]?.[c];
      const isThisTick = STATE.combat.plansDefinedThisTick?.[`${r},${c}`];
      if (STATE.combat.movePlansMode && planType && isThisTick) {
        return;
      }
    }

    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;

    if (!selectionBox) {
      selectionBox = document.createElement('div');
      selectionBox.className = 'selection-box';
      document.body.appendChild(selectionBox);
    }

    selectionBox.style.left = `${startX}px`;
    selectionBox.style.top = `${startY}px`;
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isSelecting || !selectionBox) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const width = Math.abs(startX - currentX);
    const height = Math.abs(startY - currentY);

    if (width > 5 || height > 5) {
      selectionBox.style.display = 'block';
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);

      selectionBox.style.left = `${left}px`;
      selectionBox.style.top = `${top}px`;
      selectionBox.style.width = `${width}px`;
      selectionBox.style.height = `${height}px`;
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (!isSelecting || !selectionBox) return;
    isSelecting = false;
    const isShowing = selectionBox.style.display === 'block';
    
    const boxRect = selectionBox.getBoundingClientRect();
    selectionBox.style.display = 'none';

    if (!isShowing) return;
    if (boxRect.width < 5 || boxRect.height < 5) return;

    const addToSelection = e.shiftKey;

    if (STATE.combat.movePlansMode) {
      if (!addToSelection) {
        STATE.combat.selectedPlans = [];
      }
      let selectedAny = false;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 10; c++) {
          const planType = STATE.combat.plannedLayout?.[r]?.[c];
          const isThisTick = STATE.combat.plansDefinedThisTick?.[`${r},${c}`];
          if (planType && isThisTick) {
            const cellEl = document.querySelector(`.combat-cell[data-row="${r}"][data-col="${c}"]`);
            if (cellEl) {
              const cellRect = cellEl.getBoundingClientRect();
              const intersect = !(
                cellRect.left > boxRect.right ||
                cellRect.right < boxRect.left ||
                cellRect.top > boxRect.bottom ||
                cellRect.bottom < boxRect.top
              );
              if (intersect) {
                if (!STATE.combat.selectedPlans) STATE.combat.selectedPlans = [];
                if (!STATE.combat.selectedPlans.some(p => p.r === r && p.c === c)) {
                  STATE.combat.selectedPlans.push({ r, c });
                }
                selectedAny = true;
              }
            }
          }
        }
      }
      notify('COMBAT_UPDATE');
      return;
    }

    const grid = STATE.combat.grid;
    if (!grid) return;

    if (!addToSelection) {
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          const u = grid[r][c];
          if (u) u.selected = false;
        }
      }
    }

    let selectedAny = false;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const u = grid[r][c];
        if (u && u.alliance === 'player') {
          const cellEl = document.querySelector(`.combat-cell[data-row="${r}"][data-col="${c}"]`);
          if (cellEl) {
            const cellRect = cellEl.getBoundingClientRect();
            const intersect = !(
              cellRect.left > boxRect.right ||
              cellRect.right < boxRect.left ||
              cellRect.top > boxRect.bottom ||
              cellRect.bottom < boxRect.top
            );
            if (intersect) {
              u.selected = true;
              selectedAny = true;
            }
          }
        }
      }
    }

    if (!selectedAny && !addToSelection && boxRect.width < 6 && boxRect.height < 6) {
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          const u = grid[r][c];
          if (u) u.selected = false;
        }
      }
    }

    notify('COMBAT_UPDATE');
  });
}
