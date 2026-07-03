/* ==========================================================================
   UI/WORLD.JS — World map rendering and overworld logic
   ========================================================================== */

import { STATE, notify, adjustResource, setScreen } from '../state.js';
import { getAdjacentCoords, getActiveMap, tickHazards } from '../world.js';
import { COMBAT_CONFIG } from '../config/combat.js';
import { generateLocationMap } from '../location.js';
import { MOVEMENT_CONFIG } from '../config/movement.js';
import { LOCATION_CONFIG } from '../config/location.js';
import { GODS_CONFIG } from '../config/gods.js';
import { GOD_LORE } from './party.js';
import {
  elWorldMap, elWorldCoords, elHeader, elGold, elFood, elWood, elSheep, elBand, elBlessing, elDay, elWorldDifficultyStatus
} from './dom.js';
import { logWorld } from './notifications.js';
import { autoDiscoverAdjacent } from './location.js';

// Update resource counts and active blessing details
export function renderResourceBar() {
  elGold.innerText = STATE.resources.gold;
  elFood.innerText = STATE.resources.food;
  elWood.innerText = STATE.resources.wood;
  elSheep.innerText = STATE.resources.sheep;
  elBand.innerText = STATE.band.length;
  elDay.innerText = STATE.day || 1;

  const timeFactor = (LOCATION_CONFIG.difficultyScaling && LOCATION_CONFIG.difficultyScaling.timeFactor) || 0.02;
  const maxCap = (LOCATION_CONFIG.difficultyScaling && LOCATION_CONFIG.difficultyScaling.maxTimeFactorCap) !== undefined ? LOCATION_CONFIG.difficultyScaling.maxTimeFactorCap : 2.5;
  const dayValue = STATE.day || 1;
  const dayMulti = Math.min(maxCap, dayValue * timeFactor).toFixed(2);
  if (elWorldDifficultyStatus) {
    elWorldDifficultyStatus.innerText = `+${dayMulti}x Risk`;
  }

  const activeWraths = Object.keys(STATE.godFavor).filter(g => STATE.godFavor[g] <= -4);
  let blessingHtml = '';
  const tempBlessings = [];
  if (STATE.activeBlessing) {
    const lore = GOD_LORE[STATE.activeBlessing];
    tempBlessings.push(`<span data-god-tooltip="${STATE.activeBlessing}" data-tooltip-section="champion" style="color: var(--color-${STATE.activeBlessing}); cursor: pointer;">${lore.icon} ${STATE.activeBlessing.toUpperCase()}</span>`);
  }
  if (STATE.permanentlyActivatedBlessings && STATE.permanentlyActivatedBlessings.length > 0) {
    STATE.permanentlyActivatedBlessings.forEach(b => {
      if (b !== STATE.activeBlessing) {
        const lore = GOD_LORE[b];
        tempBlessings.push(`<span data-god-tooltip="${b}" data-tooltip-section="champion" style="color: var(--color-${b}); cursor: pointer;">${lore.icon} ${b.toUpperCase()}</span>`);
      }
    });
  }

  if (tempBlessings.length > 0) {
    blessingHtml = tempBlessings.join(', ');
  } else {
    blessingHtml = `<span>No Active Buff</span>`;
  }

  if (activeWraths.length > 0) {
    const wrathNames = activeWraths.map(g => {
      return `<span data-god-tooltip="${g}" data-tooltip-section="curse" style="color:var(--color-danger); font-weight:bold; cursor: pointer;">${g.toUpperCase()}'S WRATH</span>`;
    });
    elBlessing.innerHTML = `${blessingHtml}<br>${wrathNames.join(' ⚡ ')}`;
  } else {
    elBlessing.innerHTML = blessingHtml;
  }
}

// Render 15x15 World Grid Layout
export function renderWorldMap() {
  elWorldMap.innerHTML = '';
  elWorldCoords.innerText = `Longship Pos - X: ${STATE.party.worldX}, Y: ${STATE.party.worldY}`;

  // Update the sidebar title dynamically to reflect the current active map
  const activeMapTitleEl = document.getElementById('world-map-title');
  if (activeMapTitleEl) {
    const activeMap = getActiveMap();
    activeMapTitleEl.innerText = activeMap ? activeMap.name : 'Fjord Expedition';
  }

  const tiles = STATE.worldMap.tiles;
  const revealed = STATE.worldMap.revealed;
  const locations = STATE.worldMap.locations;

  const adjacents = getAdjacentCoords(STATE.party.worldX, STATE.party.worldY);

  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      const elCell = document.createElement('div');
      elCell.classList.add('world-tile');
      elCell.dataset.x = x;
      elCell.dataset.y = y;

      const isFog = revealed[y][x];
      const hasLocation = locations[`${x},${y}`];

      if (isFog) {
        elCell.classList.add('fog');
      } else {
        const terrain = tiles[y][x];
        elCell.classList.add(`terrain-${terrain}`);
        elCell.dataset.terrain = terrain;
        if (hasLocation) {
          elCell.dataset.locationName = hasLocation.name;
          elCell.dataset.locationType = hasLocation.type;
          elCell.dataset.locationBiome = hasLocation.locationType || '';
          elCell.dataset.dangerLevel = hasLocation.dangerLevel || '';
          elCell.dataset.locationId = hasLocation.id || '';
          elCell.dataset.raidType = hasLocation.raidType || '';
        }

        if (hasLocation) {
          const loc = hasLocation;
          if (loc.type === 'town') {
            const marker = document.createElement('span');
            marker.innerText = '🏘️';
            marker.classList.add('town-marker');
            elCell.appendChild(marker);
          } else {
            const isStaticRaid = loc.id.startsWith('raid_');
            if (isStaticRaid) {
              const marker = document.createElement('span');
              const emojiMap = {
                monastery: '⛪',
                settlement: '🏡',
                burial_vault: '🪦',
                cave: '🕳️',
                ruins: '🏰',
                mercenary_camp: '⛺',
                fortress: '🏰',
                warband: '🛡️',
                wolf_den: '🐺',
                giant_lair: '👹',
                underworld: '🌋',
                cursed_isle: '🏝️',
                spider_nest: '🕸️',
                beast_lair: '🐉'
              };
              marker.innerText = emojiMap[loc.raidType] || '⚔️';
              marker.classList.add('raid-marker');
              if (loc.isCleared) {
                marker.classList.add('cleared');
                const checkmark = document.createElement('span');
                checkmark.innerText = '✅';
                checkmark.className = 'raid-checkmark-badge';
                elCell.appendChild(checkmark);
              }
              elCell.appendChild(marker);
            } else {
              elCell.classList.add('visited-wilderness');
            }
          }
        }
      }

      // Draw player longship position
      if (x === STATE.party.worldX && y === STATE.party.worldY) {
        const drakkar = document.createElement('div');
        drakkar.classList.add('player-marker');
        drakkar.innerText = '🚢';
        elCell.dataset.hasPlayer = 'true';
        elCell.appendChild(drakkar);
      }

      // Draw active map hazards (Blizzards and Maelstroms)
      if (STATE.worldMap.hazards && STATE.worldMap.hazards.length > 0) {
        const activeHazards = STATE.worldMap.hazards.filter(h => h.x === x && h.y === y);
        for (const hazard of activeHazards) {
          const hazardEl = document.createElement('div');
          hazardEl.className = `hazard-marker hazard-${hazard.type}`;
          hazardEl.innerText = hazard.type === 'blizzard' ? '❄️' : '🌀';
          elCell.appendChild(hazardEl);
        }
      }

      // Draw active roaming enemy bands
      if (STATE.worldMap.roamingBands && STATE.worldMap.roamingBands.length > 0) {
        const activeBands = STATE.worldMap.roamingBands.filter(b => b.x === x && b.y === y && !b.isDefeated);
        for (const band of activeBands) {
          const bandEl = document.createElement('div');
          bandEl.className = `roaming-band-marker roaming-${band.type}`;
          const dist = Math.abs(band.x - STATE.party.worldX) + Math.abs(band.y - STATE.party.worldY);
          if (dist <= 2 && !band.cooldownTicks) {
            bandEl.classList.add('nearby-alert');
          }
          bandEl.innerText = band.emoji || '🛡️';
          bandEl.title = band.name;
          elCell.appendChild(bandEl);
        }
      }

      // Navigation handler for adjacent cells
      const isAdjacent = adjacents.some(a => a.x === x && a.y === y);
      if (isAdjacent) {
        elCell.classList.add('tile-border-highlight');
        elCell.addEventListener('click', () => {
          movePartyOnWorld(x, y);
        });
      }

      // Allow entering town/raid if clicked on player's current coordinate (and not water, unless there is a location)
      if (x === STATE.party.worldX && y === STATE.party.worldY && (tiles[y][x] !== 'water' || hasLocation)) {
        elCell.addEventListener('click', () => {
          tryEnterCurrentLocation();
        });
      }

      elWorldMap.appendChild(elCell);
    }
  }

  // Center player scroll view — blur first so browser doesn't auto-scrollIntoView the last focused tile
  setTimeout(() => {
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
    const playerMarker = elWorldMap.querySelector('.player-marker');
    if (playerMarker) {
      const wrapper = elWorldMap.parentElement;
      if (wrapper) {
        const scrollX = playerMarker.offsetLeft - (wrapper.clientWidth / 2) + (playerMarker.clientWidth / 2);
        const scrollY = playerMarker.offsetTop - (wrapper.clientHeight / 2) + (playerMarker.clientHeight / 2);
        wrapper.scrollTo({ left: scrollX, top: scrollY });
      }
    }
  }, 50);
}

// World Move State Processing
export function movePartyOnWorld(x, y) {
  x = Number(x);
  y = Number(y);

  const previousTerrain = STATE.worldMap.tiles[STATE.party.worldY][STATE.party.worldX];
  const targetTerrain = STATE.worldMap.tiles[y][x];

  // Verify costs
  let cost = 3;
  let woodCost = 0;

  if (targetTerrain === 'water' || targetTerrain === 'river') {
    const thorWrath = GODS_CONFIG.modifiers.wrath.thor;
    const extraSeaWood = thorWrath?.extraSeaWoodCost ?? 1;
    let requiredWood = 1;
    if (targetTerrain === 'water' && STATE.godFavor.thor === -5) {
      requiredWood = 1 + extraSeaWood;
    }
    if (STATE.resources.wood >= requiredWood) {
      cost = 1;
      woodCost = requiredWood;
      if (targetTerrain === 'water' && STATE.godFavor.thor === -5) {
        logWorld("Thor's Wrath: Rough seas increase sea travel wood cost (+1 Wood).", 'warn-message');
      }
    } else {
      cost = 3;
      woodCost = 0;
    }
  } else {
    cost = 3;
  }

  // Thor's Wrath: Storms during land travel cost +1 extra Food per step (only at -5 favor)
  if (targetTerrain !== 'water' && targetTerrain !== 'river' && STATE.godFavor.thor === -5) {
    const extraLandFood = GODS_CONFIG.modifiers.wrath.thor?.extraLandFoodCost ?? 1;
    cost += extraLandFood;
    logWorld(`Thor's Wrath: Lightning storms increase land travel food cost (+${extraLandFood}).`, 'warn-message');
  }

  // Deduct food & wood
  if (STATE.resources.food >= cost) {
    adjustResource('food', -cost);
    if (woodCost > 0) {
      adjustResource('wood', -woodCost);
    }
    if (targetTerrain === 'water' || targetTerrain === 'river') {
      const modeText = targetTerrain === 'water' ? 'Sailed' : 'Rowed';
      if (woodCost > 0) {
        logWorld(`${modeText} 1 tile. Consumed 1 Food and 1 Wood (hull maintenance).`);
      } else {
        logWorld(`${modeText} 1 tile without wood. Consumed 3 Food (rowing exhaustion).`, 'warn-message');
      }
    } else {
      logWorld(`Traveled on ${targetTerrain}. Consumed ${cost} Food.`);
    }
  } else {
    // We don't have enough food for this movement step. Try consuming sheep first.
    if (STATE.resources.sheep > 0) {
      adjustResource('sheep', -1);
      const yieldAmt = MOVEMENT_CONFIG.sheepFoodYield || 15;
      adjustResource('food', yieldAmt);
      logWorld(`HUNGERING! Slaughtered 1 Sheep to harvest emergency rations (+${yieldAmt} Food).`, 'warn-message');
      adjustResource('food', -cost);
      if (woodCost > 0) {
        adjustResource('wood', -woodCost);
      }
    } else {
      // Starving: units lose 3 hp per movement
      const dmg = MOVEMENT_CONFIG.starvationHpDamage || 3;
      let deadUnits = [];
      for (let i = STATE.band.length - 1; i >= 0; i--) {
        const u = STATE.band[i];
        u.hp -= dmg;
        if (u.hp <= 0) {
          deadUnits.push(u.name);
          STATE.band.splice(i, 1);
        }
      }
      logWorld(`STARVING! No sheep left. Your units lost ${dmg} HP from hunger.`, 'warn-message');
      if (deadUnits.length > 0) {
        logWorld(`Starvation claimed: ${deadUnits.join(', ')}.`, 'warn-message');
      }
      if (STATE.band.length === 0 && STATE.resources.gold === 0) {
        notify('GAME_OVER');
      }
    }
  }

  STATE.party.previousWorldX = STATE.party.worldX;
  STATE.party.previousWorldY = STATE.party.worldY;
  STATE.party.worldX = x;
  STATE.party.worldY = y;
  STATE.day = (STATE.day || 1) + 1;

  // Apply Huskarl upkeep: 1 gold each per move on the world map.
  const huskarlsCount = STATE.band.filter(u => u.type === 'huskarl').length;
  if (huskarlsCount > 0) {
    adjustResource('gold', -huskarlsCount);
    logWorld(`Huskarl Upkeep: Paid ${huskarlsCount} Gold for elite frontline soldiers.`, 'warn-message');
  }

  renderResourceBar();

  // Reveal fog in a 2-tile radius around player
  revealWorldFog(x, y);

  // Check if player moved onto an active roaming band
  if (STATE.worldMap.roamingBands && STATE.worldMap.roamingBands.length > 0) {
    const bandOnTile = STATE.worldMap.roamingBands.find(b => b.x === x && b.y === y && !b.isDefeated && !b.cooldownTicks);
    if (bandOnTile) {
      logWorld(`WARBAND ENCOUNTER: You intercepted the enemy group '${bandOnTile.name}'! Prepare for battle!`, 'warn-message');
      triggerRoamingCombat(bandOnTile);
      notify('STATE_UPDATED');
      return;
    }
  }

  // Odin's Wrath: Random unit loses 1 HP every 3 world steps (only at -5 favor)
  if (STATE.godFavor.odin === -5) {
    if (STATE.odinWrathSteps === undefined) STATE.odinWrathSteps = 0;
    STATE.odinWrathSteps++;
    const odinWrath = GODS_CONFIG.modifiers.wrath.odin;
    const stepsTrigger = odinWrath?.stepsTrigger ?? 3;
    if (STATE.odinWrathSteps >= stepsTrigger) {
      STATE.odinWrathSteps = 0;
      if (STATE.band.length > 0) {
        const idx = Math.floor(Math.random() * STATE.band.length);
        const target = STATE.band[idx];
        const hpLoss = odinWrath?.hpLoss ?? 1;
        target.hp -= hpLoss;
        logWorld(`Odin's Wrath: Blizzard claimed ${hpLoss} HP from ${target.name}.`, 'warn-message');
        if (target.hp <= 0) {
          STATE.band.splice(idx, 1);
          logWorld(`Odin's Wrath: ${target.name} perished in the tundra.`, 'warn-message');
          if (STATE.band.length === 0 && STATE.resources.gold === 0) {
            notify('GAME_OVER');
          }
        }
      }
    }
  } else {
    STATE.odinWrathSteps = 0;
  }

  // Loki's Wrath: Random event triggers each world move (only at -5 favor)
  if (STATE.godFavor.loki === -5) {
    const roll = Math.random();
    const lokiWrath = GODS_CONFIG.modifiers.wrath.loki;
    if (roll < 0.33) {
      const maxGold = lokiWrath?.maxGoldLoss ?? 3;
      const goldLoss = Math.min(STATE.resources.gold, maxGold);
      if (goldLoss > 0) {
        adjustResource('gold', -goldLoss);
        logWorld(`Loki's Wrath: Trickster sprites purloined ${goldLoss} Gold from your chest!`, 'warn-message');
      }
    } else if (roll < 0.66) {
      if (STATE.band.length > 0) {
        const idx = Math.floor(Math.random() * STATE.band.length);
        const target = STATE.band[idx];
        const maxDmg = lokiWrath?.maxInjuryDmg ?? 5;
        const dmg = Math.min(target.hp - 1, maxDmg);
        if (dmg > 0) {
          target.hp -= dmg;
          logWorld(`Loki's Wrath: Loki tripped ${target.name}, dealing ${dmg} injury damage.`, 'warn-message');
        }
      }
    } else {
      const maxFood = lokiWrath?.maxFoodLoss ?? 3;
      const foodLoss = Math.min(STATE.resources.food, maxFood);
      if (foodLoss > 0) {
        adjustResource('food', -foodLoss);
        logWorld(`Loki's Wrath: Ravens ruined ${foodLoss} Food rations!`, 'warn-message');
      }
    }
  }

  notify('STATE_UPDATED');
}

// Reveal Fog surrounding coords
export function revealWorldFog(px, py) {
  const size = 15;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.abs(x - px) + Math.abs(y - py);
      if (dist <= 2) {
        STATE.worldMap.revealed[y][x] = false; // Reveal fog
      }
    }
  }
}

// Helper to dynamically resolve and enter the player's current world location if not water
export function tryEnterCurrentLocation() {
  const px = STATE.party.worldX;
  const py = STATE.party.worldY;
  const locKey = `${px},${py}`;
  let locData = STATE.worldMap.locations[locKey];
  const terrain = STATE.worldMap.tiles[py][px];

  if (terrain === 'water' && !locData) {
    logWorld('Cannot enter the deep sea.');
    return;
  }

  if (!locData) {
    let locationType = 'default';
    if (terrain === 'mountain') locationType = 'mountain';
    else if (terrain === 'forest') locationType = 'forest';
    else if (terrain === 'snow') locationType = 'default';

    // Scale danger level based on distance from starting point (2,7)
    const startX = 2;
    const startY = 7;
    const distance = Math.abs(px - startX) + Math.abs(py - startY);
    const dangerLevel = Math.min(5, Math.max(1, Math.floor(distance / 3) + 1));

    locData = {
      id: `dynamic_raid_${px}_${py}`,
      name: `Wilderness ${terrain.charAt(0).toUpperCase() + terrain.slice(1)}`,
      type: 'raid',
      terrain: terrain,
      locationType: locationType,
      dangerLevel: dangerLevel
    };
    STATE.worldMap.locations[locKey] = locData;
  }
  enterLocation(locData);
}

// Enter Town or Dungeon
export function enterLocation(locData) {
  if (locData.type === 'town') {
    STATE.party.currentLocationId = locData.id;
    let autoHealed = 0;
    import('../state.js').then(({ getEffectiveStats }) => {
      for (const warrior of STATE.band) {
        const effStats = getEffectiveStats(warrior);
        if (warrior.hp < effStats.maxHp.total && warrior.hp >= effStats.maxHp.total * 0.8) {
          warrior.hp = effStats.maxHp.total;
          autoHealed++;
        }
      }
      setScreen('town');
      if (autoHealed > 0) {
        logWorld(`Entered town: ${locData.name}. ${autoHealed} warrior(s) at >=80% HP healed automatically.`, 'gain-message');
      } else {
        logWorld(`Entered town: ${locData.name}.`);
      }
    });
  } else {
    // Generate/Load Location Sub-Grid
    STATE.party.currentLocationId = locData.id;

    generateLocationMap(locData.id, locData.terrain);

    // Start player at local coordinates 5,5 (start tile)
    STATE.party.localX = 5;
    STATE.party.localY = 5;

    autoDiscoverAdjacent(locData.id);

    setScreen('location');
    logWorld(`Entering raid coordinates: ${locData.name}.`);
  }
}

// Real-time world map hazard ticker reference
let worldHazardTicker = null;

export function startWorldHazardTicker() {
  if (worldHazardTicker) clearInterval(worldHazardTicker);
  worldHazardTicker = setInterval(() => {
    if (STATE.activeScreen !== 'world' || STATE.combat.active) return;

    // Check proximity alerts for nearby roaming bands
    if (STATE.worldMap.roamingBands) {
      const px = STATE.party.worldX;
      const py = STATE.party.worldY;
      const playerTileKey = `${px},${py}`;
      const playerLocation = STATE.worldMap.locations?.[playerTileKey];
      const isPlayerInTown = playerLocation && playerLocation.type === 'town';

      if (!isPlayerInTown) {
        const nearbyBands = STATE.worldMap.roamingBands.filter(b => !b.isDefeated && !b.cooldownTicks && (Math.abs(b.x - px) + Math.abs(b.y - py) <= 2));
        for (const band of nearbyBands) {
          if (!band.alerted) {
            logWorld(`⚠️ THREAT: The enemy band '${band.name}' is closing in on your position!`, 'warn-message');
            band.alerted = true;
          }
        }
      }
      STATE.worldMap.roamingBands.forEach(b => {
        if (isPlayerInTown || Math.abs(b.x - px) + Math.abs(b.y - py) > 2) {
          b.alerted = false;
        }
      });
    }

    const hazardCollisions = tickHazards();
    if (hazardCollisions.length > 0) {
      for (const collision of hazardCollisions) {
        if (collision.band) {
          logWorld(collision.text, 'warn-message');
          triggerRoamingCombat(collision.band);
          break; // Enter combat and pause ticker/updates
        } else {
          logWorld(collision.text, 'warn-message');
          if (collision.dead.length > 0) {
            logWorld(`Sagas remember the fallen: ${collision.dead.join(', ')} perished in the disaster.`, 'warn-message');
          }
        }
      }
      if (STATE.band.length === 0 && STATE.resources.gold === 0) {
        notify('GAME_OVER');
      }
    }
    renderWorldMap();
  }, 3000); // Ticks every 3 seconds in real time
}

export function triggerRoamingCombat(band) {
  import('./overlay.js').then(({ showOverlay, hideOverlay }) => {
    import('./dom.js').then(({ elModalEvent, elModalEventTitle, elModalEventBody, elModalEventChoices, elModalEventCloseBtn }) => {
      if (elModalEventCloseBtn) elModalEventCloseBtn.style.display = 'none';

      const monsterClass = band.monsters?.[0]?.monsterClass;
      const monsterStats = COMBAT_CONFIG.monsters[monsterClass] || {};
      const isBribableWithGold = monsterStats.isBribableWithGold === true;
      const isDistractableWithSheep = monsterStats.isDistractableWithSheep === true;
      
      elModalEventTitle.innerText = `Ambushed: ${band.name}`;
      elModalEventBody.innerHTML = `
        The hostile roaming band <b>${band.name}</b> (${band.emoji}) has intercepted your party!<br><br>
        They are blocking your path and outnumber your vanguard. How will you respond?
      `;

      elModalEventChoices.innerHTML = '';

      // Choice 1: Fight!
      const fightBtn = document.createElement('button');
      fightBtn.className = 'btn btn-danger';
      fightBtn.innerText = 'Stand and Fight!';
      fightBtn.addEventListener('click', () => {
        hideOverlay(elModalEvent);
        setScreen('combat');
        import('../combat.js').then(({ startCombat }) => {
          startCombat(null, `roaming_${band.id}`, {
            type: 'enemy_army',
            monsters: band.monsters,
            isDefeated: false
          });
        });
      });
      elModalEventChoices.appendChild(fightBtn);

      // Choice 2: Bribe (costs 30 Gold) - Only for bribable beings
      if (isBribableWithGold) {
        const bribeBtn = document.createElement('button');
        bribeBtn.className = 'btn btn-warning';
        bribeBtn.innerText = `Bribe them with 30 Gold (${STATE.resources.gold >= 30 ? 'Available' : 'Insufficient Gold'})`;
        if (STATE.resources.gold < 30) {
          bribeBtn.disabled = true;
        }
        bribeBtn.addEventListener('click', () => {
          adjustResource('gold', -30);
          band.cooldownTicks = 3;
          hideOverlay(elModalEvent);
          logWorld(`BRIBE: You paid 30 Gold to bribe ${band.name}. They will ignore you for 3 ticks.`, 'warn-message');
          notify('STATE_UPDATED');
        });
        elModalEventChoices.appendChild(bribeBtn);
      }

      // Choice 3: Distract with Sheep (costs 2 Sheep) - Only for distractable monsters
      if (isDistractableWithSheep) {
        const distractBtn = document.createElement('button');
        distractBtn.className = 'btn btn-primary';
        distractBtn.innerText = `Distract with 2 Sheep (${STATE.resources.sheep >= 2 ? 'Available' : 'Insufficient Sheep'})`;
        if (STATE.resources.sheep < 2) {
          distractBtn.disabled = true;
        }
        distractBtn.addEventListener('click', () => {
          adjustResource('sheep', -2);
          band.cooldownTicks = 3;
          hideOverlay(elModalEvent);
          logWorld(`DISTRACTION: You left 2 Sheep behind to distract ${band.name}. They will ignore you for 3 ticks.`, 'warn-message');
          notify('STATE_UPDATED');
        });
        elModalEventChoices.appendChild(distractBtn);
      }

      showOverlay(elModalEvent);
    });
  });
}

export function stopWorldHazardTicker() {
  if (worldHazardTicker) {
    clearInterval(worldHazardTicker);
    worldHazardTicker = null;
  }
}
