/* ==========================================================================
   UI/COMBAT.JS — Combat grid rendering and visual effects
   ========================================================================== */

import { STATE, notify, getEffectiveStats } from '../state.js';
import { togglePause, deployUnit, undeployUnit, sortPoolByPoints, checkAndAutoDeploy } from '../combat.js';
import { SOLDIERS_CONFIG, SOLDIER_EMOJIS } from '../config/soldiers.js';
import {
  elCombatGrid, elCombatPoolList, elCombatPauseBtn,
  elTooltip, MONSTER_EMOJIS
} from './dom.js';
import { formatStat } from './dom.js';
import { showToast } from './notifications.js';

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

// Helper to handle dragstart for planned positions
function handlePlanDragstart(e, r, c, cellEl) {
  e.dataTransfer.setData('text/plain', `move-plan:${r},${c}`);
  e.dataTransfer.effectAllowed = 'move';

  // Custom multi-drag ghost image
  const isSelected = STATE.combat.selectedPlans && STATE.combat.selectedPlans.some(p => p.r === r && p.c === c);
  const plans = isSelected ? [...STATE.combat.selectedPlans] : [{ r, c }];

  if (plans.length > 1) {
    const minR = Math.min(...plans.map(p => p.r));
    const maxR = Math.max(...plans.map(p => p.r));
    const minC = Math.min(...plans.map(p => p.c));
    const maxC = Math.max(...plans.map(p => p.c));
    
    const rowsCount = maxR - minR + 1;
    const colsCount = maxC - minC + 1;
    
    const cellWidth = cellEl.offsetWidth || 50;
    const cellHeight = cellEl.offsetHeight || 50;
    const gap = 2;
    
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-3000px';
    tempContainer.style.top = '-3000px';
    tempContainer.style.display = 'grid';
    tempContainer.style.gridTemplateRows = `repeat(${rowsCount}, ${cellHeight}px)`;
    tempContainer.style.gridTemplateColumns = `repeat(${colsCount}, ${cellWidth}px)`;
    tempContainer.style.gap = `${gap}px`;
    tempContainer.style.pointerEvents = 'none';
    
    for (let curR = minR; curR <= maxR; curR++) {
      for (let curC = minC; curC <= maxC; curC++) {
        const cellDiv = document.createElement('div');
        cellDiv.style.width = `${cellWidth}px`;
        cellDiv.style.height = `${cellHeight}px`;
        cellDiv.style.display = 'flex';
        cellDiv.style.alignItems = 'center';
        cellDiv.style.justifyContent = 'center';
        
        const isPart = plans.some(p => p.r === curR && p.c === curC);
        if (isPart) {
          const type = STATE.combat.plannedLayout?.[curR]?.[curC];
          if (type) {
            const ghostDiv = document.createElement('div');
            ghostDiv.className = 'combat-unit ghost-unit ghost-soldier-available';
            ghostDiv.innerText = SOLDIER_EMOJIS[type] || '👾';
            ghostDiv.style.opacity = '0.7';
            cellDiv.appendChild(ghostDiv);
          }
        }
        tempContainer.appendChild(cellDiv);
      }
    }
    
    document.body.appendChild(tempContainer);
    
    const clickOffsetX = (c - minC) * (cellWidth + gap) + (e.offsetX || (cellWidth / 2));
    const clickOffsetY = (r - minR) * (cellHeight + gap) + (e.offsetY || (cellHeight / 2));
    
    e.dataTransfer.setDragImage(tempContainer, clickOffsetX, clickOffsetY);
    
    setTimeout(() => {
      tempContainer.remove();
    }, 0);
  }
}

// Render 10x8 Combat lanes grid
export function renderCombatGrid() {
  elCombatGrid.innerHTML = '';

  const grid = STATE.combat.grid;
  if (!grid || grid.length === 0) return;

  const planningActive = !!((STATE.combat.planningWizard && STATE.combat.planningWizard.active) || STATE.combat.activePlanningType || STATE.combat.movePlansMode);
  if (planningActive) {
    elCombatGrid.classList.add('planning-active');
  } else {
    elCombatGrid.classList.remove('planning-active');
  }

  // Build grid layout cells
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 10; c++) {
      const elCell = document.createElement('div');
      elCell.classList.add('combat-cell');
      elCell.dataset.row = r;
      elCell.dataset.col = c;

      const planType = STATE.combat.plannedLayout?.[r]?.[c];
      const isThisTick = STATE.combat.plansDefinedThisTick?.[`${r},${c}`];
      const isSelectedPlan = STATE.combat.selectedPlans?.some(p => p.r === r && p.c === c);
      if (isSelectedPlan) {
        elCell.classList.add('selected-planned-cell');
      }

      // Make columns plan/deploy drop zones
      if (c < 10) {
        if (STATE.combat.movePlansMode && planType && isThisTick) {
          elCell.draggable = true;
          elCell.addEventListener('dragstart', (e) => {
            handlePlanDragstart(e, r, c, elCell);
          });
        }

        // Drag over / drop handlers for planning layout
        elCell.addEventListener('dragover', (e) => {
          e.preventDefault();
        });
        elCell.addEventListener('drop', (e) => {
          e.preventDefault();
          const dragData = e.dataTransfer.getData('text/plain');
          if (dragData && dragData.startsWith('plan:')) {
            const type = dragData.replace('plan:', '');
            if (!STATE.combat.plannedLayout) {
              STATE.combat.plannedLayout = Array.from({ length: 8 }, () => Array(10).fill(null));
            }
            if (type === 'clear') {
              STATE.combat.plannedLayout[r][c] = null;
              if (STATE.combat.plansDefinedThisTick) delete STATE.combat.plansDefinedThisTick[`${r},${c}`];
              if (STATE.combat.selectedPlans) {
                STATE.combat.selectedPlans = STATE.combat.selectedPlans.filter(p => !(p.r === r && p.c === c));
              }
            } else {
              STATE.combat.plannedLayout[r][c] = type;
              if (!STATE.combat.plansDefinedThisTick) STATE.combat.plansDefinedThisTick = {};
              STATE.combat.plansDefinedThisTick[`${r},${c}`] = true;
            }
            checkAndAutoDeploy();
            notify('COMBAT_UPDATE');
          } else if (dragData && dragData.startsWith('move-plan:')) {
            const [startR, startC] = dragData.replace('move-plan:', '').split(',').map(Number);
            const dRow = r - startR;
            const dCol = c - startC;
            const plansToMove = (STATE.combat.selectedPlans && STATE.combat.selectedPlans.some(p => p.r === startR && p.c === startC))
              ? [...STATE.combat.selectedPlans]
              : [{ r: startR, c: startC }];

            const moves = [];
            plansToMove.forEach(p => {
              const newR = Math.max(0, Math.min(7, p.r + dRow));
              const newC = Math.max(0, Math.min(9, p.c + dCol));
              const type = STATE.combat.plannedLayout[p.r][p.c];
              moves.push({ fromR: p.r, fromC: p.c, toR: newR, toC: newC, type });
            });

            // Phase 1: Clear old plan positions
            moves.forEach(m => {
              STATE.combat.plannedLayout[m.fromR][m.fromC] = null;
              if (STATE.combat.plansDefinedThisTick) delete STATE.combat.plansDefinedThisTick[`${m.fromR},${m.fromC}`];
            });

            // Phase 2: Set new plan positions
            moves.forEach(m => {
              STATE.combat.plannedLayout[m.toR][m.toC] = m.type;
              if (!STATE.combat.plansDefinedThisTick) STATE.combat.plansDefinedThisTick = {};
              STATE.combat.plansDefinedThisTick[`${m.toR},${m.toC}`] = true;
            });

            // Phase 3: Gather related deploying units to move (remove temporarily from grid to prevent blocking)
            const unitsToMove = [];
            moves.forEach(m => {
              if (m.fromR !== m.toR) {
                const grid = STATE.combat.grid;
                let unit = null;
                let unitCol = -1;
                for (let checkCol = 0; checkCol <= 1; checkCol++) {
                  const cell = grid[m.fromR][checkCol];
                  // Search for matching player unit in this lane
                  if (cell && cell.alliance === 'player' && cell.type === m.type && !cell.isCharmed && !cell.isConfused && !cell.isUndead) {
                    unit = cell;
                    unitCol = checkCol;
                    break;
                  }
                }
                if (unit) {
                  grid[m.fromR][unitCol] = null;
                  unitsToMove.push({ unit, toR: m.toR, preferredCol: unitCol });
                }
              }
            });

            // Phase 4: Place units back onto the grid in their new lanes
            unitsToMove.forEach(item => {
              const grid = STATE.combat.grid;
              let targetCol = item.preferredCol;
              if (grid[item.toR][targetCol]) {
                targetCol = (item.preferredCol === 0) ? 1 : 0;
              }
              if (grid[item.toR][targetCol]) {
                if (!grid[item.toR][0]) targetCol = 0;
                else if (!grid[item.toR][1]) targetCol = 1;
              }
              item.unit.row = item.toR;
              item.unit.col = targetCol;
              grid[item.toR][targetCol] = item.unit;
            });

            // Update selection to match new coordinates
            const newSelection = [];
            moves.forEach(m => {
              newSelection.push({ r: m.toR, c: m.toC });
            });
            STATE.combat.selectedPlans = newSelection;

            checkAndAutoDeploy();
            notify('COMBAT_UPDATE');
          }
        });

        // Contextmenu (right-click) to clear planning
        elCell.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (STATE.combat.plannedLayout && STATE.combat.plannedLayout[r][c]) {
            STATE.combat.plannedLayout[r][c] = null;
            if (STATE.combat.plansDefinedThisTick) delete STATE.combat.plansDefinedThisTick[`${r},${c}`];
            if (STATE.combat.selectedPlans) {
              STATE.combat.selectedPlans = STATE.combat.selectedPlans.filter(p => !(p.r === r && p.c === c));
            }
            checkAndAutoDeploy();
            notify('COMBAT_UPDATE');
          }
        });

        elCell.addEventListener('click', (e) => {
          if (STATE.combat.movePlansMode) {
            e.stopPropagation();
            const planType = STATE.combat.plannedLayout?.[r]?.[c];
            const isThisTick = STATE.combat.plansDefinedThisTick?.[`${r},${c}`];
            if (planType && isThisTick) {
              if (!e.shiftKey) {
                STATE.combat.selectedPlans = [];
              }
              if (!STATE.combat.selectedPlans) STATE.combat.selectedPlans = [];
              const existsIdx = STATE.combat.selectedPlans.findIndex(p => p.r === r && p.c === c);
              if (existsIdx !== -1) {
                STATE.combat.selectedPlans.splice(existsIdx, 1);
              } else {
                STATE.combat.selectedPlans.push({ r, c });
              }
              notify('COMBAT_UPDATE');
            }
            return;
          }

          let type = null;
          let wiz = null;
          if (STATE.combat.planningWizard && STATE.combat.planningWizard.active) {
            wiz = STATE.combat.planningWizard;
            const currentWizType = wiz.types[wiz.typeIndex];
            if (currentWizType) {
              type = currentWizType.type;
            }
          } else if (STATE.combat.activePlanningType) {
            type = STATE.combat.activePlanningType;
          }

          if (type) {
            e.stopPropagation();
            
            if (!STATE.combat.plannedLayout) {
              STATE.combat.plannedLayout = Array.from({ length: 8 }, () => Array(10).fill(null));
            }
            STATE.combat.plannedLayout[r][c] = type;
            if (!STATE.combat.plansDefinedThisTick) STATE.combat.plansDefinedThisTick = {};
            STATE.combat.plansDefinedThisTick[`${r},${c}`] = true;
            
            if (wiz) {
              wiz.placedCount++;
              if (wiz.placedCount >= wiz.types[wiz.typeIndex].totalCount) {
                wiz.typeIndex++;
                wiz.placedCount = 0;
                if (wiz.typeIndex >= wiz.types.length) {
                  wiz.active = false;
                }
              }
            }
            
            checkAndAutoDeploy();
            notify('COMBAT_UPDATE');
          } else {
            // Delete plan if click on cell with existing planned location when not actively placing/moving
            const planType = STATE.combat.plannedLayout?.[r]?.[c];
            if (planType) {
              e.stopPropagation();
              STATE.combat.plannedLayout[r][c] = null;
              if (STATE.combat.plansDefinedThisTick) delete STATE.combat.plansDefinedThisTick[`${r},${c}`];
              if (STATE.combat.selectedPlans) {
                STATE.combat.selectedPlans = STATE.combat.selectedPlans.filter(p => !(p.r === r && p.c === c));
              }
              checkAndAutoDeploy();
              notify('COMBAT_UPDATE');
            } else {
              // Click on a completely empty cell
              if (c <= 1 && STATE.combat.paused && !grid[r][c] && STATE.combat.selectedPoolIndex !== null) {
                deployUnit(STATE.combat.selectedPoolIndex, r, c);
                return;
              }
              
              const unit = grid[r][c];
              if (!unit) {
                // Clear selected units
                for (let row = 0; row < grid.length; row++) {
                  for (let col = 0; col < grid[row].length; col++) {
                    const u = grid[row][col];
                    if (u) u.selected = false;
                  }
                }
                // Clear selected planned locations
                STATE.combat.selectedPlans = [];
                notify('COMBAT_UPDATE');
              }
            }
          }
        });

        if (c <= 1 && STATE.combat.paused && !grid[r][c]) {
          if (STATE.combat.selectedPoolIndex !== null) {
            elCell.classList.add('deployable-zone');
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
      }

      // Check for unit placed in cell
      const unit = grid[r][c];
      if (unit) {
        const elUnit = document.createElement('div');
        elUnit.classList.add('combat-unit', `alliance-${unit.alliance}`);

        // Highlight selected units
        if (unit.alliance === 'player' && unit.selected) {
          elUnit.classList.add('selected-unit');
        }

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
          const stance = unit.stance || STATE.combat.stance || 'attack';
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

        // Left-click selection and right-click undeployment
        if (unit.alliance === 'player') {
          elUnit.addEventListener('click', (e) => {
            e.stopPropagation();
            if (STATE.combat.fleeMode) {
              unit.isFleeing = true;
              notify('COMBAT_UPDATE');
              return;
            }
            if (e.shiftKey) {
              // Shift-click: toggle selection of this unit (additively)
              unit.selected = !unit.selected;
              notify('COMBAT_UPDATE');
            } else {
              // Regular click: remove/undeploy unit from map
              if (STATE.combat.paused) {
                undeployUnit(r, c);
              }
            }
          });

          // Right-click to undeploy (only when paused)
          elUnit.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (STATE.combat.paused) {
              undeployUnit(r, c);
            }
          });

          if (STATE.combat.fleeMode) {
            elUnit.classList.add('fleeing-target');
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
      } else if (c < 10 && STATE.combat.plannedLayout && STATE.combat.plannedLayout[r][c]) {
        // Draw ghost planned unit
        const type = STATE.combat.plannedLayout[r][c];

        // Determine ghost order state
        let orderState = 'no soldier available';

        // 1. Check if deployed in lane r
        let isDeployedInLane = false;
        for (let checkC = 0; checkC < 10; checkC++) {
          const cell = grid[r][checkC];
          if (cell && cell.alliance === 'player' && cell.type === type && !cell.isCharmed && !cell.isConfused && !cell.isUndead) {
            isDeployedInLane = true;
            break;
          }
        }

        if (isDeployedInLane) {
          orderState = 'soldier deployed';
        } else {
          // 2. Check if available in pool
          const isAvailableInPool = STATE.combat.pool.some(u => u.type === type);
          if (isAvailableInPool) {
            orderState = 'soldier available';
          }
        }

        const elGhost = document.createElement('div');
        elGhost.classList.add('combat-unit', 'ghost-unit');
        if (orderState === 'no soldier available') {
          elGhost.classList.add('ghost-no-soldier');
          elGhost.title = `Order: ${type} (No soldier available) - Click to delete`;
        } else if (orderState === 'soldier available') {
          elGhost.classList.add('ghost-soldier-available');
          elGhost.title = `Order: ${type} (Available to deploy) - Click to delete`;
        } else if (orderState === 'soldier deployed') {
          elGhost.classList.add('ghost-soldier-deployed');
          elGhost.title = `Order: ${type} (Deployed in lane) - Click to delete`;
        }
        elGhost.innerText = SOLDIER_EMOJIS[type] || '👾';

        const isThisTick = STATE.combat.plansDefinedThisTick && STATE.combat.plansDefinedThisTick[`${r},${c}`];
        if (STATE.combat.movePlansMode && isThisTick) {
          elGhost.draggable = true;
          elGhost.addEventListener('dragstart', (e) => {
            handlePlanDragstart(e, r, c, elCell);
          });
        }

        elGhost.addEventListener('click', (e) => {
          if (STATE.combat.movePlansMode) {
            return;
          }
          e.stopPropagation();
          STATE.combat.plannedLayout[r][c] = null;
          if (STATE.combat.plansDefinedThisTick) delete STATE.combat.plansDefinedThisTick[`${r},${c}`];
          if (STATE.combat.selectedPlans) {
            STATE.combat.selectedPlans = STATE.combat.selectedPlans.filter(p => !(p.r === r && p.c === c));
          }
          checkAndAutoDeploy();
          notify('COMBAT_UPDATE');
        });
        elGhost.addEventListener('contextmenu', (e) => {
          if (STATE.combat.movePlansMode) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          STATE.combat.plannedLayout[r][c] = null;
          if (STATE.combat.plansDefinedThisTick) delete STATE.combat.plansDefinedThisTick[`${r},${c}`];
          if (STATE.combat.selectedPlans) {
            STATE.combat.selectedPlans = STATE.combat.selectedPlans.filter(p => !(p.r === r && p.c === c));
          }
          checkAndAutoDeploy();
          notify('COMBAT_UPDATE');
        });

        elCell.appendChild(elGhost);
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
  renderOrdersPanel();
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

/* --- Orders Panel & Drag-Selection Helpers --- */

export function renderOrdersPanel() {
  const container = document.getElementById('orders-unit-list');
  if (!container) return;
  container.innerHTML = '';

  const btnPlanTitle = document.getElementById('btn-plan-title');
  const wiz = STATE.combat.planningWizard;
  if (wiz && wiz.active && wiz.types && wiz.types.length > 0 && wiz.typeIndex < wiz.types.length) {
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
    if (wiz) wiz.active = false;
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

  // Get unique unit types present in the spawning pool
  let poolTypes = [];
  if (STATE.combat && STATE.combat.pool && STATE.combat.pool.length > 0) {
    poolTypes = [...new Set(STATE.combat.pool.map(u => u.type))];
  }
  const uniqueTypes = poolTypes;

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

let isSelecting = false;
let startX = 0;
let startY = 0;
let selectionBox = null;

export function initCombatSelection() {
  const gridEl = document.getElementById('combat-grid');
  if (!gridEl) return;

  gridEl.addEventListener('contextmenu', (e) => e.preventDefault());

  const btnClear = document.getElementById('btn-clear-plans');
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
    // Only select on left click
    if (e.button !== 0) return;
    
    // Ignore if clicking on a real unit or input/button/removable card
    const isRealUnit = e.target.closest('.combat-unit:not(.ghost-unit)');
    if (isRealUnit || e.target.closest('.orders-card') || e.target.closest('.pool-card') || e.target.closest('.btn') || e.target.closest('button')) {
      return;
    }

    // Ignore starting selection box if clicking/dragging a movable plan cell
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
    selectionBox.style.display = 'none'; // Keep hidden until drag starts
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

    // Clear previous selection if not holding shift
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
            // Check intersection
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

    // If click or very small drag on empty space, deselect all
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

