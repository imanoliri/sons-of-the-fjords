/* ==========================================================================
   UI/LOCATION.JS — Dungeon Map rendering and local movement
   ========================================================================== */

import { STATE, notify, adjustResource, executePlunderMound, executeSacrificeSheep } from '../state.js';
import { discoverTile, generateLocationMap } from '../location.js';
import { startCombat } from '../combat.js';
import { LOCATION_CONFIG } from '../config/location.js';
import { GODS_CONFIG } from '../config/gods.js';
import {
  MONSTER_EMOJIS,
  elLocMap, elLocTitle, elLocThreat, elLocDeckCount, elLocationDifficultyStatus,
  elPromptPanel, elModalEvent, elModalEventTitle, elModalEventBody, elModalEventChoices, elModalEventCloseBtn
} from './dom.js';
import { logLocation, showToast } from './notifications.js';
import { showOverlay, hideOverlay } from './overlay.js';

let activePortalTarget = null;
let localPathMovementTimeout = null;

// Trigger screen transition for combat map
export function triggerCombatTransition(coordKey, entity) {
  // Use dynamic import for setScreen to avoid circular dependency
  import('../state.js').then(({ setScreen }) => {
    setScreen('combat');
    startCombat(STATE.party.currentLocationId, coordKey, entity);
  });
}

// Render 10x10 Dungeon Discovery View (Carcassonne)
export function renderLocationMap() {
  elLocMap.innerHTML = '';

  const locId = STATE.party.currentLocationId;
  const locState = STATE.locations[locId];
  if (!locState) return;

  const locData = Object.values(STATE.worldMap.locations).find(l => l.id === locId);
  const locName = locData ? locData.name : (locState.isSubCave ? 'Sub-Cave Chamber' : 'Exploring Site');
  const dangerVal = locState.dangerLevel || 3;
  const diffValNum = locState.difficulty || 1.0;
  const diffVal = diffValNum.toFixed(2);

  elLocTitle.innerText = locName;

  let threatColor = 'var(--color-success)'; // green
  if (diffValNum >= 1.0 && diffValNum <= 1.5) {
    threatColor = 'var(--color-loki)'; // orange
  } else if (diffValNum > 1.5) {
    threatColor = 'var(--color-danger)'; // red
  }
  elLocThreat.innerHTML = `<span style="color:${threatColor}">(${diffVal}x Threat)</span>`;

  elLocDeckCount.innerText = locState.tileStack.length;

  const stars = '💀'.repeat(dangerVal);
  elLocationDifficultyStatus.innerHTML = `Danger: <span style="color:var(--color-danger)">${stars}</span>`;

  const placed = locState.placedTiles;
  const px = STATE.party.localX;
  const py = STATE.party.localY;

  // Check if player is standing on a cave entrance/exit or burial mound
  const currentTile = placed[`${px},${py}`];
  if (currentTile && currentTile.entity && (currentTile.entity.type === 'cave_entrance' || (currentTile.entity.type === 'burial_mound' && !currentTile.entity.isExplored))) {
    const ent = currentTile.entity;
    elPromptPanel.classList.remove('hidden');
    elPromptPanel.innerHTML = '';

    const textSpan = document.createElement('span');
    textSpan.id = 'portal-prompt-text';
    elPromptPanel.appendChild(textSpan);

    if (ent.type === 'cave_entrance') {
      if (ent.isExit) {
        textSpan.innerText = '🪜 Ladder to upper level ';
      } else {
        textSpan.innerText = '🕳️ Entrance to cave ';
      }

      const btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-primary';
      btn.id = 'btn-use-portal';
      btn.innerText = '[enter]';
      btn.addEventListener('click', () => {
        triggerEnterCavePortal(`${px},${py}`, ent);
      });
      elPromptPanel.appendChild(btn);

    } else if (ent.type === 'burial_mound') {
      textSpan.innerText = '🪦 Burial Mound: ';

      const btnExplore = document.createElement('button');
      btnExplore.className = 'btn btn-sm btn-primary';
      btnExplore.style.marginRight = '0.5rem';
      btnExplore.innerText = '[enter]';
      btnExplore.addEventListener('click', () => {
        triggerEncounterEvent(`${px},${py}`, ent);
      });

      const btn1 = document.createElement('button');
      btn1.className = 'btn btn-sm btn-warning';
      btn1.style.marginRight = '0.5rem';
      btn1.innerText = '[1] Plunder';
      btn1.addEventListener('click', () => {
        const action = executePlunderMound(ent);
        logLocation(`${action.icon} ${action.toast}`, 'gain-message');
        notify('STATE_UPDATED');
      });

      const btn2 = document.createElement('button');
      btn2.className = 'btn btn-sm btn-primary';
      btn2.style.marginRight = '0.5rem';
      btn2.innerText = '[2] Sacrifice';
      btn2.addEventListener('click', () => {
        const action = executeSacrificeSheep(ent);
        if (action) {
          logLocation(`${action.icon} ${action.toast}`, 'gain-message');
        } else {
          logLocation('⚠️ You have no sheep to sacrifice!', 'warn-message');
        }
        notify('STATE_UPDATED');
      });

      const btn3 = document.createElement('button');
      btn3.className = 'btn btn-sm';
      btn3.innerText = '[3] Leave';
      btn3.addEventListener('click', () => {
        elPromptPanel.classList.add('hidden');
        activePortalTarget = null;
        notify('STATE_UPDATED');
      });

      elPromptPanel.appendChild(btnExplore);
      elPromptPanel.appendChild(btn1);
      elPromptPanel.appendChild(btn2);
      elPromptPanel.appendChild(btn3);
    }

    activePortalTarget = { coordKey: `${px},${py}`, entity: ent };
  } else {
    elPromptPanel.classList.add('hidden');
    activePortalTarget = null;
  }

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const elCell = document.createElement('div');
      elCell.classList.add('location-tile');
      elCell.dataset.x = x;
      elCell.dataset.y = y;

      const coordKey = `${x},${y}`;
      const tile = placed[coordKey];
      const isNeighbor = Math.abs(x - px) + Math.abs(y - py) === 1;

      if (tile) {
        // Render terrain
        elCell.classList.add(`terrain-${tile.terrainType}`);
        elCell.dataset.terrain = tile.terrainType;

        let entityDesc = '';
        if (tile.entity) {
          const ent = tile.entity;
          if (ent.type === 'treasure' && !ent.isLooted) entityDesc = '🪙 Treasure Chest (Loot Gold)';
          else if (ent.type === 'wood_source' && !ent.isLooted) entityDesc = '🪵 Wood Source (Harvest Wood)';
          else if (ent.type === 'sheep_source' && !ent.isLooted) entityDesc = '🐑 Lost Sheep (Rescue Sheep)';
          else if (ent.type === 'ore_deposit' && !ent.isLooted) entityDesc = '🪨 Ore Deposit (Mine Gold)';
          else if (ent.type === 'fishing_spot' && !ent.isLooted) entityDesc = '🎣 Fishing Spot (Catch Food)';
          else if (ent.type === 'berry_bush' && !ent.isLooted) entityDesc = '🍒 Berry Bush (Gather Berries)';
          else if (ent.type === 'enemy_army' && !ent.isDefeated) entityDesc = `👹 Monster Nest (${ent.monsters[0].monsterClass})`;
          else if (ent.type === 'burial_mound' && !ent.isExplored) entityDesc = '🪦 Ancient Burial Mound';
          else if (ent.type === 'dolmen' && !ent.isVisited) entityDesc = `🏆 Sacred Dolmen Stone (Appease ${ent.godName.toUpperCase()})`;
          else if (ent.type === 'cave_entrance') {
            if (ent.isExit) {
              entityDesc = '🪜 Cave Exit Portal (Return to surface)';
            } else if (ent.visited) {
              entityDesc = '🕳️ Active Cave Entrance (Visited)';
            } else {
              entityDesc = '🕳️ Cave Sub-Dungeon Portal';
            }
          }

          if (entityDesc) {
            elCell.dataset.entityType = ent.type;
            elCell.dataset.entityState = entityDesc;
          }
        }

        // Show interactive entity if present
        if (tile.entity) {
          const ent = tile.entity;
          const badge = document.createElement('span');
          badge.classList.add('location-entity');

          if (ent.type === 'treasure' && !ent.isLooted) {
            badge.innerText = '🪙';
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              if (x === px && y === py) triggerEncounterEvent(coordKey, ent);
              else attemptLocalPathMove(x, y);
            });
          }
          else if (ent.type === 'wood_source' && !ent.isLooted) {
            badge.innerText = '🪵';
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              if (x === px && y === py) triggerEncounterEvent(coordKey, ent);
              else attemptLocalPathMove(x, y);
            });
          }
          else if (ent.type === 'sheep_source' && !ent.isLooted) {
            badge.innerText = '🐑';
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              if (x === px && y === py) triggerEncounterEvent(coordKey, ent);
              else attemptLocalPathMove(x, y);
            });
          }
          else if (ent.type === 'ore_deposit' && !ent.isLooted) {
            badge.innerText = '🪨';
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              if (x === px && y === py) triggerEncounterEvent(coordKey, ent);
              else attemptLocalPathMove(x, y);
            });
          }
          else if (ent.type === 'fishing_spot' && !ent.isLooted) {
            badge.innerText = '🎣';
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              if (x === px && y === py) triggerEncounterEvent(coordKey, ent);
              else attemptLocalPathMove(x, y);
            });
          }
          else if (ent.type === 'berry_bush' && !ent.isLooted) {
            badge.innerText = '🍒';
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              if (x === px && y === py) triggerEncounterEvent(coordKey, ent);
              else attemptLocalPathMove(x, y);
            });
          }
          else if (ent.type === 'enemy_army' && !ent.isDefeated) {
            const firstMonster = ent.monsters && ent.monsters[0] ? ent.monsters[0].monsterClass : '';
            badge.innerText = MONSTER_EMOJIS[firstMonster] || '👹';
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              attemptLocalPathMove(x, y);
            });
          }
          else if (ent.type === 'burial_mound' && !ent.isExplored) {
            badge.innerText = '🪦';
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              if (x === px && y === py) {
                triggerEncounterEvent(coordKey, ent);
              } else {
                attemptLocalPathMove(x, y);
              }
            });
          }
          else if (ent.type === 'dolmen' && !ent.isVisited) {
            badge.innerText = '🏆';
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              if (x === px && y === py) triggerEncounterEvent(coordKey, ent);
              else attemptLocalPathMove(x, y);
            });
          }
          else if (ent.type === 'cave_entrance') {
            if (ent.isExit) {
              badge.innerText = '🪜';
              badge.classList.add('exit-portal');
            } else {
              badge.innerText = '🕳️';
              if (ent.visited) {
                badge.classList.add('visited-portal');
              }
            }
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              if (x === px && y === py) {
                triggerEnterCavePortal(coordKey, ent);
              } else {
                attemptLocalPathMove(x, y);
              }
            });
          }

          elCell.appendChild(badge);
        }

        // Draw player band local marker
        if (x === px && y === py) {
          const marker = document.createElement('div');
          marker.classList.add('player-marker');
          marker.innerText = '⚔️';
          elCell.dataset.hasPlayer = 'true';
          elCell.appendChild(marker);
        }

        // Click to move player locally to any visible placed tiles
        elCell.style.cursor = 'pointer';
        elCell.addEventListener('click', () => {
          attemptLocalPathMove(x, y);
        });

        if (isNeighbor) {
          elCell.classList.add('tile-border-highlight');
        }

      } else {
        // Render fog of war
        elCell.classList.add('fog');

        // Adjacent tiles are clickable to move/discover
        if (isNeighbor) {
          elCell.classList.add('tile-border-highlight');
          elCell.addEventListener('click', () => {
            attemptLocalMove(x, y);
          });
        }
      }

      elLocMap.appendChild(elCell);
    }
  }

  // Center player scroll view — blur first so browser doesn't auto-scrollIntoView the last focused tile
  setTimeout(() => {
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
    const playerMarker = elLocMap.querySelector('.player-marker');
    if (playerMarker) {
      const wrapper = elLocMap.parentElement;
      if (wrapper) {
        const scrollX = playerMarker.offsetLeft - (wrapper.clientWidth / 2) + (playerMarker.clientWidth / 2);
        const scrollY = playerMarker.offsetTop - (wrapper.clientHeight / 2) + (playerMarker.clientHeight / 2);
        wrapper.scrollTo({ left: scrollX, top: scrollY });
      }
    }
  }, 50);
}

// Enter Cave Sub-Dungeon Portal
export function triggerEnterCavePortal(coordKey, entity) {
  if (entity.isExit) {
    // Going back to parent location
    STATE.party.currentLocationId = entity.targetLocationId;
    const [px, py] = entity.targetCoords.split(',').map(Number);
    STATE.party.localX = px;
    STATE.party.localY = py;

    // Mark the parent cave entrance as visited (if it exists)
    const parentLoc = STATE.locations[entity.targetLocationId];
    if (parentLoc) {
      const parentTile = parentLoc.placedTiles[entity.targetCoords];
      if (parentTile && parentTile.entity) {
        parentTile.entity.visited = true;
      }
    }

    autoDiscoverAdjacent(entity.targetLocationId);
    notify('STATE_UPDATED');
    logLocation('Climbed back up from the damp cave chambers.');
  } else {
    // Going down to sub-cave
    const parentLocationId = STATE.party.currentLocationId;
    const parentCoords = coordKey;

    entity.visited = true; // Mark entrance in parent as visited

    STATE.party.currentLocationId = entity.targetLocationId;
    generateLocationMap(entity.targetLocationId, 'cave', parentLocationId, parentCoords);
    STATE.party.localX = 5;
    STATE.party.localY = 5;

    autoDiscoverAdjacent(entity.targetLocationId);
    notify('STATE_UPDATED');
    logLocation('Stepped down into the deep Jotunn Crag Cave chambers.');
  }
}

// Renders choice dialogs for location interactions
export function triggerEncounterEvent(coordKey, entity) {
  if (entity.type === 'treasure') {
    let goldGained = entity.silver;
    let bonus = 0;
    if (STATE.godQuests.loki?.[0]) {
      const m1Config = GODS_CONFIG.modifiers.milestones.loki.find(m => m.index === 0);
      bonus = m1Config?.chestGoldBonus ?? 1;
      goldGained += bonus;
    }
    adjustResource('gold', goldGained);
    entity.isLooted = true;
    logLocation(`🪙 Uncovered buried chest! Looted +${goldGained} Gold.${STATE.godQuests.loki?.[0] ? ` (Loki bonus +${bonus})` : ''}`, 'gain-message');
    notify('STATE_UPDATED');
  }
  else if (entity.type === 'wood_source') {
    adjustResource('wood', entity.wood);
    entity.isLooted = true;
    logLocation(`🪵 Harvested wood source! Gathered +${entity.wood} Wood.`, 'gain-message');
    notify('STATE_UPDATED');
  }
  else if (entity.type === 'sheep_source') {
    adjustResource('sheep', entity.sheep);
    entity.isLooted = true;
    logLocation(`🐑 Rescued lost sheep! Added +${entity.sheep} Sheep to herd.`, 'gain-message');
    notify('STATE_UPDATED');
  }
  else if (entity.type === 'ore_deposit') {
    adjustResource('gold', entity.gold);
    entity.isLooted = true;
    logLocation(`🪨 Mined ore deposit! Gained +${entity.gold} Gold.`, 'gain-message');
    notify('STATE_UPDATED');
  }
  else if (entity.type === 'fishing_spot') {
    adjustResource('food', entity.food);
    entity.isLooted = true;
    logLocation(`🎣 Caught fresh fish! Added +${entity.food} Food.`, 'gain-message');
    notify('STATE_UPDATED');
  }
  else if (entity.type === 'berry_bush') {
    adjustResource('food', entity.food);
    entity.isLooted = true;
    logLocation(`🍒 Gathered wild berries! Added +${entity.food} Food.`, 'gain-message');
    notify('STATE_UPDATED');
  }
  else if (entity.type === 'dolmen') {
    STATE.inventory.push(entity.magicObjectId);
    entity.isVisited = true;
    logLocation(`🏆 Retrieved ${entity.magicObjectId} relic from Druid Dolmen!`, 'gain-message');
    notify('STATE_UPDATED');
  }
  else {
    // Show overlay modal for entities with real choices
    if (elModalEventCloseBtn) {
      elModalEventCloseBtn.style.display = 'none';
    }
    const box = elModalEvent.querySelector('.modal-box');
    if (box) {
      box.style.maxWidth = '';
    }
    showOverlay(elModalEvent);
    elModalEventChoices.innerHTML = '';

    if (entity.type === 'burial_mound') {
      elModalEventTitle.innerText = 'Burial Mound';
      elModalEventBody.innerText = `You uncover an ancient viking Barrow Grave. Deep markings suggest a warrior tomb. Defile the grave to look for relics, or perform a sacrifice of Sheep to please Hel?`;

      const choice1 = document.createElement('button');
      choice1.classList.add('btn', 'btn-warning');
      choice1.innerText = 'Plunder Mound (+10 Gold, pleases Loki, angers Thor)';
      choice1.addEventListener('click', () => {
        const action = executePlunderMound(entity);
        hideOverlay(elModalEvent);
        notify('STATE_UPDATED');
        logLocation(`${action.icon} ${action.toast}`, 'gain-message');
      });

      const choice2 = document.createElement('button');
      choice2.classList.add('btn', 'btn-primary');
      choice2.innerText = 'Sacrifice Sheep (-1 Sheep, pleases Hel)';
      choice2.addEventListener('click', () => {
        const action = executeSacrificeSheep(entity);
        if (action) {
          hideOverlay(elModalEvent);
          logLocation(`${action.icon} ${action.toast}`, 'gain-message');
        } else {
          logLocation('⚠️ You have no sheep to sacrifice!', 'warn-message');
        }
        notify('STATE_UPDATED');
      });

      const choice3 = document.createElement('button');
      choice3.classList.add('btn');
      choice3.innerText = 'Leave Grave untouched';
      choice3.addEventListener('click', () => {
        hideOverlay(elModalEvent);
      });

      elModalEventChoices.appendChild(choice1);
      elModalEventChoices.appendChild(choice2);
      elModalEventChoices.appendChild(choice3);
    }
  }
}


export function autoDiscoverAdjacent(locId) {
  const locState = STATE.locations[locId];
  if (!locState) return;

  const px = STATE.party.localX;
  const py = STATE.party.localY;

  let radius = 1;
  if (STATE.godQuests.odin?.[1]) {
    const m1Config = GODS_CONFIG.modifiers.milestones.odin.find(m => m.index === 1);
    radius = m1Config?.scoutRadius ?? 2;
  }

  const neighbors = [];
  if (radius === 1) {
    neighbors.push(
      { x: px + 1, y: py },
      { x: px - 1, y: py },
      { x: px, y: py + 1 },
      { x: px, y: py - 1 }
    );
  } else {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        if (Math.abs(dx) + Math.abs(dy) <= 2 && (dx !== 0 || dy !== 0)) {
          neighbors.push({ x: px + dx, y: py + dy });
        }
      }
    }
  }

  neighbors.forEach(n => {
    if (n.x >= 0 && n.x < 10 && n.y >= 0 && n.y < 10) {
      const coordKey = `${n.x},${n.y}`;
      if (!locState.placedTiles[coordKey]) {
        discoverTile(locId, n.x, n.y);
      }
    }
  });
}

function findLocalPath(startX, startY, targetX, targetY, locState) {
  if (startX === targetX && startY === targetY) return [];

  const queue = [{ x: startX, y: startY, path: [] }];
  const visited = new Set();
  visited.add(`${startX},${startY}`);

  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 }
  ];

  while (queue.length > 0) {
    const current = queue.shift();

    if (current.x === targetX && current.y === targetY) {
      return current.path;
    }

    for (const dir of directions) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const nKey = `${nx},${ny}`;

      if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10 && !visited.has(nKey)) {
        const tile = locState.placedTiles[nKey];
        if (tile) {
          const terrainType = locState.preGeneratedGrid[nKey];
          let isPassable = terrainType !== 'chasm' && terrainType !== 'mountain' && terrainType !== 'deep_water';
          if (isPassable && (nx !== targetX || ny !== targetY)) {
            const hasEnemy = tile.entity && tile.entity.type === 'enemy_army' && !tile.entity.isDefeated;
            if (hasEnemy) {
              isPassable = false;
            }
          }
          if (isPassable) {
            visited.add(nKey);
            queue.push({
              x: nx,
              y: ny,
              path: [...current.path, { x: nx, y: ny }]
            });
          }
        }
      }
    }
  }

  return null;
}

export function attemptLocalPathMove(targetX, targetY) {
  const locId = STATE.party.currentLocationId;
  const locState = STATE.locations[locId];
  if (!locState) return;

  if (localPathMovementTimeout) {
    clearTimeout(localPathMovementTimeout);
    localPathMovementTimeout = null;
  }

  const path = findLocalPath(STATE.party.localX, STATE.party.localY, targetX, targetY, locState);
  if (!path || path.length === 0) {
    return;
  }

  let stepIndex = 0;
  function nextStep() {
    if (STATE.activeScreen !== 'location') return;
    if (document.querySelector('.modal-overlay:not(.hidden)')) return;

    const step = path[stepIndex];
    attemptLocalMove(step.x, step.y);

    if (STATE.party.localX === step.x && STATE.party.localY === step.y && !document.querySelector('.modal-overlay:not(.hidden)')) {
      stepIndex++;
      if (stepIndex < path.length) {
        localPathMovementTimeout = setTimeout(nextStep, 150);
      }
    }
  }

  nextStep();
}

export function attemptLocalMove(targetX, targetY) {
  const locId = STATE.party.currentLocationId;
  const locState = STATE.locations[locId];
  if (!locState) return;

  // Bounds check
  if (targetX < 0 || targetX >= 10 || targetY < 0 || targetY >= 10) return;

  // Check if it's adjacent to the current player position
  const isAdjacent = Math.abs(targetX - STATE.party.localX) + Math.abs(targetY - STATE.party.localY) === 1;
  if (!isAdjacent) return;

  const coordKey = `${targetX},${targetY}`;
  const terrainType = locState.preGeneratedGrid[coordKey];

  // Impassable terrain block
  const isImpassable = terrainType === 'chasm' || terrainType === 'mountain' || terrainType === 'deep_water';
  if (isImpassable) {
    logLocation(`The rugged ${terrainType === 'deep_water' ? 'deep water' : terrainType} is impassable!`, 'warn-message');
    return;
  }

  // If tile is unplaced, reveal it
  let tile = locState.placedTiles[coordKey];
  if (!tile) {
    discoverTile(locId, targetX, targetY);
    tile = locState.placedTiles[coordKey];
  }

  if (!tile) return;

  // Check tile entities
  if (tile.entity) {
    const ent = tile.entity;

    if (ent.type === 'enemy_army' && !ent.isDefeated) {
      // Set pending coordinates, trigger combat, but do NOT move yet
      STATE.party.pendingLocalX = targetX;
      STATE.party.pendingLocalY = targetY;
      triggerCombatTransition(coordKey, ent);
      return;
    }

    // Move player first for non-combat entities
    STATE.party.localX = targetX;
    STATE.party.localY = targetY;
    autoDiscoverAdjacent(locId);
    notify('STATE_UPDATED');

    // Automatically trigger interactions
    if (ent.type === 'treasure' && !ent.isLooted) {
      triggerEncounterEvent(coordKey, ent);
    } else if (ent.type === 'wood_source' && !ent.isLooted) {
      triggerEncounterEvent(coordKey, ent);
    } else if (ent.type === 'sheep_source' && !ent.isLooted) {
      triggerEncounterEvent(coordKey, ent);
    } else if (ent.type === 'ore_deposit' && !ent.isLooted) {
      triggerEncounterEvent(coordKey, ent);
    } else if (ent.type === 'fishing_spot' && !ent.isLooted) {
      triggerEncounterEvent(coordKey, ent);
    } else if (ent.type === 'berry_bush' && !ent.isLooted) {
      triggerEncounterEvent(coordKey, ent);
    } else if (ent.type === 'dolmen' && !ent.isVisited) {
      triggerEncounterEvent(coordKey, ent);
    }
  } else {
    // Normal empty tile movement
    STATE.party.localX = targetX;
    STATE.party.localY = targetY;
    autoDiscoverAdjacent(locId);
    notify('STATE_UPDATED');
  }
}

export function useWarHorn() {
  const locId = STATE.party.currentLocationId;
  const locState = STATE.locations[locId];
  if (!locState) return;

  // 1. Discover all tiles in the current location (just the 10x10)
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const coordKey = `${x},${y}`;
      if (!locState.placedTiles[coordKey]) {
        discoverTile(locId, x, y);
      }
    }
  }

  // Render the fully discovered map
  renderLocationMap();
  logLocation('Sounded the War Horn! The entire area is revealed, and defenders are summoned.');
  showToast('War Horn Sounded! 📯', '📯', true);

  // 2. Pause for 1 second, then begin the battle against all enemies in this level
  setTimeout(() => {
    const combinedMonsters = [];
    const uniqueEnemies = new Set();
    
    // Check placed tiles
    for (const tile of Object.values(locState.placedTiles)) {
      if (tile.entity && tile.entity.type === 'enemy_army' && !tile.entity.isDefeated) {
        uniqueEnemies.add(tile.entity);
      }
    }
    // Check pre-generated entities
    for (const entity of Object.values(locState.preGeneratedEntities)) {
      if (entity && entity.type === 'enemy_army' && !entity.isDefeated) {
        uniqueEnemies.add(entity);
      }
    }

    if (uniqueEnemies.size === 0) {
      logLocation('The horns echo, but no defenders remain to answer.');
      showToast('No defenders remain!', '📯');
      return;
    }

    for (const enemy of uniqueEnemies) {
      combinedMonsters.push(...enemy.monsters);
    }

    // Start combat
    import('../state.js').then(({ setScreen }) => {
      setScreen('combat');
      STATE.combat.isWarHornBattle = true;
      import('../combat.js').then(({ startCombat }) => {
        startCombat(locId, 'war_horn', {
          type: 'enemy_army',
          monsters: combinedMonsters,
          isDefeated: false
        });
      });
    });
  }, 1000);
}

