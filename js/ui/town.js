/* ==========================================================================
   UI/TOWN.JS — Town screen rendering
   ========================================================================== */

import { SOLDIER_EMOJIS } from '../config/soldiers.js';

import { STATE, adjustResource, sacrificeRelic, notify, buyFood, buyWood, sellSheepDynamic, sellWoodDynamic, buySheepDynamic, getHealCost, healWarriors, getEffectiveStats } from '../state.js';
import { TOWN_CONFIG } from '../config/town.js';
import { GODS_CONFIG } from '../config/gods.js';
import {
  elTownName, elShrineList, elShrineEmpty,
  elPatronCard, elPatronList
} from './dom.js';
import { formatStat } from './dom.js';
import { showToast, logWorld } from './notifications.js';

// ── God lore reference ──────────────────────────────────────────────────────
const GOD_LORE = GODS_CONFIG.lore;

// Render Town Options
export function renderTownScreen() {
  const locId = STATE.party.currentLocationId;
  const locData = Object.values(STATE.worldMap.locations).find(l => l.id === locId);
  elTownName.innerText = locData ? locData.name : 'Viking Kaufang';

  // Compute local trade rates based on 3x3 surrounding tiles
  let plainsCount = 0;
  let forestCount = 0;
  let waterCount = 0;
  let snowCount = 0;
  let mountainCount = 0;

  const locKey = Object.keys(STATE.worldMap.locations).find(k => STATE.worldMap.locations[k].id === locId);
  if (locKey) {
    const [tx, ty] = locKey.split(',').map(Number);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx >= 0 && nx < 15 && ny >= 0 && ny < 15) {
          const terrain = STATE.worldMap.tiles[ny][nx];
          if (terrain === 'forest') forestCount++;
          else if (terrain === 'water' || terrain === 'river') waterCount++;
          else if (terrain === 'plains') plainsCount++;
          else if (terrain === 'snow') snowCount++;
          else if (terrain === 'mountain') mountainCount++;
        }
      }
    }
  }

  const dp = TOWN_CONFIG.dynamicPricing || {
    food: { baseCost: 2, minCost: 1, maxCost: 5, foodGained: 5 },
    woodBuy: { baseCost: 2, minCost: 1, maxCost: 5, woodGained: 2, scarceBonus: 2 },
    sheepBuy: { baseCost: 6, minCost: 3, maxCost: 10, sheepGained: 1 },
    sheepSell: { baseGain: 4, minGain: 1, maxGain: 8, sheepSold: 1, scarceBonus: 2 },
    woodSell: { baseGain: 4, minGain: 1, maxGain: 8, woodSold: 10, scarceBonus: 2 }
  };

  let foodCost = Math.max(dp.food.minCost, Math.min(dp.food.maxCost, dp.food.baseCost + Math.floor((snowCount + mountainCount) / 2) - Math.floor((waterCount + plainsCount) / 2)));
  let woodCost = Math.max(dp.woodBuy.minCost, Math.min(dp.woodBuy.maxCost, dp.woodBuy.baseCost + (forestCount === 0 ? dp.woodBuy.scarceBonus : 0) - Math.floor(forestCount / 3)));
  let sheepBuyCost = Math.max(dp.sheepBuy.minCost, Math.min(dp.sheepBuy.maxCost, dp.sheepBuy.baseCost - Math.floor(plainsCount / 2) + Math.floor((snowCount + mountainCount + waterCount) / 3)));

  if (STATE.godQuests.loki?.[3]) {
    const m4Config = GODS_CONFIG.modifiers.milestones.loki.find(m => m.index === 3);
    const reduction = m4Config?.priceReduction ?? 1;
    foodCost = Math.max(dp.food.minCost, foodCost - reduction);
    woodCost = Math.max(dp.woodBuy.minCost, woodCost - reduction);
    sheepBuyCost = Math.max(dp.sheepBuy.minCost, sheepBuyCost - reduction);
  }

  const sheepSellGain = Math.max(dp.sheepSell.minGain, Math.min(dp.sheepSell.maxGain, dp.sheepSell.baseGain + (plainsCount <= 1 ? dp.sheepSell.scarceBonus : 0) - Math.floor(plainsCount / 3)));
  const woodSellGain = Math.max(dp.woodSell.minGain, Math.min(dp.woodSell.maxGain, dp.woodSell.baseGain + (forestCount <= 1 ? dp.woodSell.scarceBonus : 0) - Math.floor(forestCount / 3)));

  const marketList = document.getElementById('town-market-list');
  if (marketList) {
    marketList.innerHTML = '';
    const trades = [
      {
        id: 'btn-buy-food', label: `Buy ${dp.food.foodGained} 🍖 (-${foodCost} 🪙)`, btnText: 'Buy [F]', action: () => {
          const res = buyFood(foodCost, dp.food.foodGained);
          logWorld(res.message, res.success ? 'gain-message' : 'warn-message');
          renderTownScreen();
        }
      },
      {
        id: 'btn-buy-wood', label: `Buy ${dp.woodBuy.woodGained} 🪵 (-${woodCost} 🪙)`, btnText: 'Buy [W]', action: () => {
          const res = buyWood(woodCost, dp.woodBuy.woodGained);
          logWorld(res.message, res.success ? 'gain-message' : 'warn-message');
          renderTownScreen();
        }
      },
      {
        id: 'btn-sell-wood', label: `Sell ${dp.woodSell.woodSold} 🪵 (+${woodSellGain} 🪙)`, btnText: 'Sell [H]', action: () => {
          const res = sellWoodDynamic(woodSellGain, dp.woodSell.woodSold);
          logWorld(res.message, res.success ? 'gain-message' : 'warn-message');
          renderTownScreen();
        }
      },
      {
        id: 'btn-buy-sheep', label: `Buy ${dp.sheepBuy.sheepGained} 🐑 (-${sheepBuyCost} 🪙)`, btnText: 'Buy [S]', action: () => {
          const res = buySheepDynamic(sheepBuyCost, dp.sheepBuy.sheepGained);
          logWorld(res.message, res.success ? 'gain-message' : 'warn-message');
          renderTownScreen();
        }
      },
      {
        id: 'btn-sell-sheep', label: `Sell ${dp.sheepSell.sheepSold} 🐑 (+${sheepSellGain} 🪙)`, btnText: 'Sell [G]', action: () => {
          const res = sellSheepDynamic(sheepSellGain, dp.sheepSell.sheepSold);
          logWorld(res.message, res.success ? 'gain-message' : 'warn-message');
          renderTownScreen();
        }
      }
    ];

    trades.forEach(t => {
      const row = document.createElement('div');
      row.classList.add('trade-row');
      const span = document.createElement('span');
      span.innerText = t.label;
      const btn = document.createElement('button');
      btn.classList.add('btn', 'btn-sm');
      btn.id = t.id;
      btn.innerText = t.btnText;
      btn.addEventListener('click', t.action);
      row.appendChild(span);
      row.appendChild(btn);
      marketList.appendChild(row);
    });
  }

  // Build relic lists for temple offerings
  elShrineList.innerHTML = '';
  const relics = STATE.inventory.filter(i =>
    i.includes('Shard of Gungnir') ||
    i.includes('Mjolnir\'s Core') ||
    i.includes('Amber Tear') ||
    i.includes('Urn of Ash') ||
    i.includes('Trickster Coin')
  );

  if (relics.length > 0) {
    elShrineEmpty.classList.add('hidden');

    // Map objects mappings
    relics.forEach(relic => {
      const god = GODS_CONFIG.relicToGod[relic] || 'odin';
      const mapName = god.charAt(0).toUpperCase() + god.slice(1);
      const row = document.createElement('div');
      row.classList.add('trade-row');

      const label = document.createElement('span');
      label.innerText = relic;

      const btn = document.createElement('button');
      btn.classList.add('btn', 'btn-sm', 'btn-primary');
      if (STATE.godFavor[god] >= 5) {
        btn.innerText = `Sacrifice (+5 🪙)`;
      } else {
        btn.innerText = `Appease ${mapName}`;
      }
      btn.addEventListener('click', () => {
        sacrificeRelic(relic, god);
        renderTownScreen();
      });

      row.appendChild(label);
      row.appendChild(btn);
      elShrineList.appendChild(row);
    });
  } else {
    elShrineEmpty.classList.remove('hidden');
  }
  // ── Divine Patron card ──────────────────────────────────────────────────────
  // Find all gods where all 5 milestones are complete (ascended)
  const ascendedGods = Object.keys(STATE.godQuests).filter(g => STATE.godQuests[g].every(x => x === true));
  if (ascendedGods.length > 0) {
    elPatronCard.classList.remove('hidden');
    elPatronList.innerHTML = '';
    ascendedGods.forEach(god => {
      const lore = GOD_LORE[god];
      const isActive = STATE.activeBlessing === god;
      const isPermanent = STATE.permanentlyActivatedBlessings && STATE.permanentlyActivatedBlessings.includes(god);

      const row = document.createElement('div');
      row.classList.add('trade-row');

      const label = document.createElement('span');
      if (isPermanent) {
        label.innerHTML = `<b style="color:${lore.color}">${lore.icon} ${god.charAt(0).toUpperCase() + god.slice(1)}</b> <span style="color:var(--color-success);font-size:0.8em">✨ PERMANENT ACTIVE</span><br><i style="font-size:0.82em;opacity:0.75">${lore.buff}</i>`;
      } else if (isActive) {
        label.innerHTML = `<b style="color:${lore.color}">${lore.icon} ${god.charAt(0).toUpperCase() + god.slice(1)}</b> <span style="color:var(--text-muted);font-size:0.8em">● CURRENT PATRON</span><br><i style="font-size:0.82em;opacity:0.75">${lore.buff}</i>`;
      } else {
        label.innerHTML = `${lore.icon} ${god.charAt(0).toUpperCase() + god.slice(1)}<br><i style="font-size:0.82em;opacity:0.75">${lore.buff}</i>`;
      }

      const actions = document.createElement('div');
      actions.style.cssText = 'display: flex; gap: 0.5rem;';

      if (!isPermanent) {
        if (!isActive) {
          const switchBtn = document.createElement('button');
          switchBtn.classList.add('btn', 'btn-sm', 'btn-primary');
          const cost = GODS_CONFIG.patronSwitchCost || 5;
          switchBtn.innerText = `Switch (${cost} 🪙)`;
          switchBtn.addEventListener('click', () => {
            if (STATE.resources.gold < cost) {
              showToast('Not enough Gold to switch Divine Patron.', '💰');
              return;
            }
            adjustResource('gold', -cost);
            STATE.activeBlessing = god;
            notify('STATE_UPDATED');
            showToast(`${lore.icon} ${god.charAt(0).toUpperCase() + god.slice(1)} is now your Divine Patron!`, lore.icon);
            renderTownScreen();
          });
          actions.appendChild(switchBtn);
        }

        const permBtn = document.createElement('button');
        permBtn.classList.add('btn', 'btn-sm', 'btn-warning');
        permBtn.innerText = 'Perm Unlock (100 🪙)';
        permBtn.addEventListener('click', () => {
          if (STATE.resources.gold < 100) {
            showToast('Not enough Gold for permanent activation.', '💰');
            return;
          }
          adjustResource('gold', -100);
          if (!STATE.permanentlyActivatedBlessings) STATE.permanentlyActivatedBlessings = [];
          STATE.permanentlyActivatedBlessings.push(god);
          notify('STATE_UPDATED');
          showToast(`${lore.icon} ${god.charAt(0).toUpperCase() + god.slice(1)} Buff permanently activated!`, lore.icon, true);
          renderTownScreen();
        });
        actions.appendChild(permBtn);
      }

      row.appendChild(label);
      row.appendChild(actions);
      elPatronList.appendChild(row);
    });
  } else {
    elPatronCard.classList.add('hidden');
  }

  // Update Heal Warriors button and label dynamically
  const elHealLabel = document.getElementById('heal-warriors-label');
  const elHealBtn = document.getElementById('btn-heal-warriors');
  if (elHealLabel && elHealBtn) {
    const cost = getHealCost();
    const injuredCount = STATE.band.filter(w => w.hp < w.maxHp).length;
    if (injuredCount === 0) {
      elHealLabel.innerText = 'All warriors are fully healthy.';
      elHealBtn.disabled = true;
      elHealBtn.classList.add('btn-disabled');
    } else {
      elHealLabel.innerText = `Heal ${injuredCount} injured warrior${injuredCount > 1 ? 's' : ''} (-${cost} 🪙)`;
      if (STATE.resources.gold < cost) {
        elHealBtn.disabled = true;
        elHealBtn.classList.add('btn-disabled');
      } else {
        elHealBtn.disabled = false;
        elHealBtn.classList.remove('btn-disabled');
      }
    }
  }

  // Render recruiting stats with modifiers
  ['shieldmaiden', 'berserker', 'huntsman', 'huskarl', 'runecaster'].forEach(t => {
    const el = document.getElementById(`recruit-stats-${t}`);
    if (el) {
      const dummy = { type: t, hp: 0, maxHp: 0, dmg: 0, speed: 0, range: 0 };
      const eff = getEffectiveStats(dummy);
      el.innerText = `HP: ${formatStat(eff.maxHp)} | ATK: ${formatStat(eff.dmg)} | SPD: ${formatStat(eff.speed)} | RNG: ${formatStat(eff.range)}`;
    }
  });

  // Great Hall recruitment labels
  const unitIcons = SOLDIER_EMOJIS;
  const resourceEmojis = { gold: '🪙', food: '🍖', wood: '🪵', sheep: '🐑' };
  ['shieldmaiden', 'berserker', 'huntsman', 'huskarl', 'runecaster'].forEach(t => {
    const labelEl = document.getElementById(`label-recruit-${t}`);
    if (labelEl) {
      const costs = TOWN_CONFIG.recruitCosts[t];
      const costStrings = [];
      for (const [res, amt] of Object.entries(costs)) {
        const emoji = resourceEmojis[res.toLowerCase()] || res;
        costStrings.push(`-${amt} ${emoji}`);
      }
      const capName = t.charAt(0).toUpperCase() + t.slice(1);
      const icon = unitIcons[t] || '';
      labelEl.innerText = `${icon} Hire ${capName} (${costStrings.join(', ')})`;
    }
  });
}
