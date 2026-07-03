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

// Import extracted UI modules to expose them correctly to parent files
export { renderFormationElement, renderOrdersPanel, renderPoolCards } from './combat_deployment.js';
export { initCombatSelection } from './combat_lifecycle.js';
export { getCellEl, getCellPosition, spawnFloatyText, spawnCombatParticle, spawnHuntsmanProjectile, flashRuneOnCells, markRunecasterCasting } from './combat_spawner.js';

import { renderFormationElement, renderOrdersPanel, renderPoolCards } from './combat_deployment.js';

function handlePlanDragstart(e, r, c, cellEl) {
  e.dataTransfer.setData('text/plain', `move-plan:${r},${c}`);
  e.dataTransfer.effectAllowed = 'move';

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

      if (c < 10) {
        if (STATE.combat.movePlansMode && planType && isThisTick) {
          elCell.draggable = true;
          elCell.addEventListener('dragstart', (e) => {
            handlePlanDragstart(e, r, c, elCell);
          });
        }

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

            moves.forEach(m => {
              STATE.combat.plannedLayout[m.fromR][m.fromC] = null;
              if (STATE.combat.plansDefinedThisTick) delete STATE.combat.plansDefinedThisTick[`${m.fromR},${m.fromC}`];
            });

            moves.forEach(m => {
              STATE.combat.plannedLayout[m.toR][m.toC] = m.type;
              if (!STATE.combat.plansDefinedThisTick) STATE.combat.plansDefinedThisTick = {};
              STATE.combat.plansDefinedThisTick[`${m.toR},${m.toC}`] = true;
            });

            const unitsToMove = [];
            moves.forEach(m => {
              if (m.fromR !== m.toR) {
                const grid = STATE.combat.grid;
                let unit = null;
                let unitCol = -1;
                for (let checkCol = 0; checkCol <= 1; checkCol++) {
                  const cell = grid[m.fromR][checkCol];
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

            const newSelection = [];
            moves.forEach(m => {
              newSelection.push({ r: m.toR, c: m.toC });
            });
            STATE.combat.selectedPlans = newSelection;

            checkAndAutoDeploy();
            notify('COMBAT_UPDATE');
          }
        });

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
              if (c <= 1 && STATE.combat.paused && !grid[r][c] && STATE.combat.selectedPoolIndex !== null) {
                deployUnit(STATE.combat.selectedPoolIndex, r, c);
                return;
              }
              
              const unit = grid[r][c];
              if (!unit) {
                for (let row = 0; row < grid.length; row++) {
                  for (let col = 0; col < grid[row].length; col++) {
                    const u = grid[row][col];
                    if (u) u.selected = false;
                  }
                }
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

      const unit = grid[r][c];
      if (unit) {
        const elUnit = document.createElement('div');
        elUnit.classList.add('combat-unit', `alliance-${unit.alliance}`);

        if (unit.alliance === 'player' && unit.selected) {
          elUnit.classList.add('selected-unit');
        }

        if (unit.isFleeing) {
          elUnit.classList.add('fleeing');
          elUnit.innerText = '🏃‍♂️';
        } else {
          elUnit.innerText = SOLDIER_EMOJIS[unit.type] || MONSTER_EMOJIS[unit.type] || '👾';
        }

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

        if (unit.isAttacking) {
          elUnit.classList.add('attacking');
        }

        if (unit.isCastingRune) {
          elUnit.classList.add('casting-rune');
        }

        if (unit.stunnedTicksLeft > 0) {
          elUnit.classList.add('stunned');
          const orbit = document.createElement('span');
          orbit.className = 'stun-orbit';
          orbit.innerText = '★★★';
          elUnit.appendChild(orbit);
          const stunBadge = document.createElement('span');
          stunBadge.className = 'stun-badge';
          stunBadge.title = `Stunned (${unit.stunnedTicksLeft} ticks left)`;
          stunBadge.innerText = unit.stunnedTicksLeft;
          elUnit.appendChild(stunBadge);
        }

        if (STATE.combat.activeDoTs?.some(d => d.unit?.id === unit.id && d.ticksLeft > 0)) {
          elUnit.classList.add('burning');
          const burnIcon = document.createElement('span');
          burnIcon.className = 'burn-icon';
          burnIcon.innerText = '🔥';
          elUnit.appendChild(burnIcon);
        }

        if (unit.alliance === 'player') {
          elUnit.addEventListener('click', (e) => {
            e.stopPropagation();
            if (STATE.combat.fleeMode) {
              unit.isFleeing = true;
              notify('COMBAT_UPDATE');
              return;
            }
            if (e.shiftKey) {
              unit.selected = !unit.selected;
              notify('COMBAT_UPDATE');
            } else {
              if (STATE.combat.paused) {
                undeployUnit(r, c);
              }
            }
          });

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
        const type = STATE.combat.plannedLayout[r][c];
        let orderState = 'no soldier available';

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

  renderPoolCards();
  renderFormationElement();
  renderOrdersPanel();
}
