/* ==========================================================================
   UI BINDINGS TOOLTIPS MODULE - SONS OF THE FJORDS
   ========================================================================== */

import { STATE } from '../state.js';
import { getActiveMap } from '../world.js';
import { BIOME_MONSTER_POOLS } from '../config/biomes.js';
import { GODS_CONFIG } from '../config/gods.js';
import { TOWN_CONFIG } from '../config/town.js';
import { getEffectiveStats } from '../state.js';
import { formatStat } from './dom.js';
import { elTooltip, MONSTER_EMOJIS } from './dom.js';
import { GOD_LORE } from './party.js';

export function initTooltipEvents() {
  let hoverTimeout = null;
  let lastClientX = 0;
  let lastClientY = 0;

  function showLocationTileTooltip(tile, clientX, clientY) {
    const x = tile.dataset.x;
    const y = tile.dataset.y;
    const terrain = tile.dataset.terrain;
    const hasPlayer = tile.dataset.hasPlayer === 'true';
    const entityType = tile.dataset.entityType;
    const entityState = tile.dataset.entityState;

    let headerText = `${terrain ? terrain.charAt(0).toUpperCase() + terrain.slice(1) : 'Tile'}`;
    const coordsText = `X: ${x}, Y: ${y}`;

    let contents = [];
    if (hasPlayer) {
      contents.push('⚔️ Viking Expedition Band');
    }
    if (entityState) {
      contents.push(entityState);
    }

    if (contents.length === 0) {
      if (tile.classList.contains('discovery-edge')) {
        headerText = 'Unexplored Boundary';
        contents.push('Step here to draw and discover a new tile from the deck.');
      } else if (terrain === 'deep_water' || terrain === 'chasm' || terrain === 'mountain') {
        contents.push(`Rough ${terrain === 'deep_water' ? 'deep water' : terrain}. Impassable obstacle!`);
      } else {
        contents.push('Empty ground. Safe to cross.');
      }
    }
    const contentsText = contents.join('<br>');

    elTooltip.innerHTML = `
      <div class="game-tooltip-header">
        <span>${headerText}</span>
        <span class="game-tooltip-coords">${coordsText}</span>
      </div>
      <div class="game-tooltip-contents">${contentsText}</div>
    `;
    elTooltip.style.borderLeftColor = 'var(--text-accent)';
    elTooltip.style.display = 'flex';
    elTooltip.style.left = (clientX + 15) + 'px';
    elTooltip.style.top = (clientY + 15) + 'px';
  }

  function getTownPrices(tx, ty) {
    tx = Number(tx);
    ty = Number(ty);

    let forestCount = 0;
    let waterCount = 0;
    let plainsCount = 0;
    let snowCount = 0;
    let mountainCount = 0;

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 3) {
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

    return { foodCost, woodCost, sheepBuyCost, sheepSellGain, woodSellGain, dp };
  }

  function showWorldTileTooltip(tile, clientX, clientY) {
    const x = tile.dataset.x;
    const y = tile.dataset.y;
    const terrain = tile.dataset.terrain;
    const locationName = tile.dataset.locationName;
    const locationType = tile.dataset.locationType;
    const locationBiome = tile.dataset.locationBiome;
    const hasPlayer = tile.dataset.hasPlayer === 'true';

    const headerText = `${terrain ? terrain.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Terrain'}`;
    const coordsText = `X: ${x}, Y: ${y}`;

    let borderAccent = 'var(--text-accent)';
    if (terrain === 'water') borderAccent = 'var(--tile-water)';
    else if (terrain === 'deep_water') borderAccent = 'var(--tile-deep-water)';
    else if (terrain === 'river') borderAccent = 'var(--tile-river)';
    else if (terrain === 'plains') borderAccent = 'var(--tile-plains)';
    else if (terrain === 'forest') borderAccent = 'var(--tile-forest)';
    else if (terrain === 'snow') borderAccent = 'var(--tile-snow)';
    else if (terrain === 'mountain') borderAccent = 'var(--tile-mountain)';

    let contents = [];
    if (hasPlayer) {
      contents.push('🚢 Drakkar Longship');
    }
    if (locationName) {
      const typeLabel = locationType === 'town' ? 'Town' : 'Raid Site';
      contents.push(`🏘️ ${locationName} (${typeLabel})`);
      if (locationType === 'town') {
        const prices = getTownPrices(x, y);
        const foodMod = prices.foodCost - prices.dp.food.baseCost;
        const woodMod = prices.woodCost - prices.dp.woodBuy.baseCost;
        const sheepBuyMod = prices.sheepBuyCost - prices.dp.sheepBuy.baseCost;
        const sheepSellMod = prices.sheepSellGain - prices.dp.sheepSell.baseGain;
        const woodSellMod = prices.woodSellGain - prices.dp.woodSell.baseGain;

        const foodModText = foodMod !== 0 ? ` <span style="color:${foodMod > 0 ? 'var(--color-danger)' : 'var(--color-success)'}; font-size: 0.72rem; font-weight: bold;">(${foodMod > 0 ? '+' : ''}${foodMod})</span>` : '';
        const woodModText = woodMod !== 0 ? ` <span style="color:${woodMod > 0 ? 'var(--color-danger)' : 'var(--color-success)'}; font-size: 0.72rem; font-weight: bold;">(${woodMod > 0 ? '+' : ''}${woodMod})</span>` : '';
        const sheepBuyModText = sheepBuyMod !== 0 ? ` <span style="color:${sheepBuyMod > 0 ? 'var(--color-danger)' : 'var(--color-success)'}; font-size: 0.72rem; font-weight: bold;">(${sheepBuyMod > 0 ? '+' : ''}${sheepBuyMod})</span>` : '';
        const sheepSellModText = sheepSellMod !== 0 ? ` <span style="color:${sheepSellMod > 0 ? 'var(--color-success)' : 'var(--color-danger)'}; font-size: 0.72rem; font-weight: bold;">(${sheepSellMod > 0 ? '+' : ''}${sheepSellMod})</span>` : '';
        const woodSellModText = woodSellMod !== 0 ? ` <span style="color:${woodSellMod > 0 ? 'var(--color-success)' : 'var(--color-danger)'}; font-size: 0.72rem; font-weight: bold;">(${woodSellMod > 0 ? '+' : ''}${woodSellMod})</span>` : '';

        let priceLines = [];
        priceLines.push(`<span>🍖 Buy Food: buy ${prices.dp.food.foodGained} for <b>${prices.foodCost}g</b>${foodModText}</span>`);
        priceLines.push(`<span>🪵 Buy Wood: buy ${prices.dp.woodBuy.woodGained} for <b>${prices.woodCost}g</b>${woodModText}</span>`);
        priceLines.push(`<span>🐑 Buy Sheep: buy ${prices.dp.sheepBuy.sheepGained} for <b>${prices.sheepBuyCost}g</b>${sheepBuyModText}</span>`);
        priceLines.push(`<span>🐑 Sell Sheep: sell ${prices.dp.sheepSell.sheepSold} for <b>${prices.sheepSellGain}g</b>${sheepSellModText}</span>`);
        priceLines.push(`<span>🪵 Sell Wood: sell ${prices.dp.woodSell.woodSold} for <b>${prices.woodSellGain}g</b>${woodSellModText}</span>`);

        contents.push('<div style="margin-top: 5px; border-top: 1px dashed rgba(255,255,255,0.15); padding-top: 5px; font-size: 0.78rem; display: flex; flex-direction: column; gap: 2px;">' + priceLines.join('') + '</div>');
      }
      const danger = tile.dataset.dangerLevel;
      if (danger && locationType === 'raid') {
        contents.push(`💀 Danger Level: ${'💀'.repeat(danger)} (Level ${danger})`);
      }
    }

    const locationId = tile.dataset.locationId;
    const raidType = tile.dataset.raidType;

    if (contents.length === 0) {
      if (terrain === 'deep_water') {
        contents.push('🌊 Deep Water. Extremely dangerous, non-traversable.');
      } else if (terrain === 'water') {
        contents.push('Open water. Safe sailing, costs 1 Food per step (+1 Wood if available, else 3 Food).');
      } else if (terrain === 'river') {
        contents.push('River stream. Fast sailing, costs 1 Food per step (+1 Wood if available, else 3 Food).');
      } else {
        contents.push('Rugged land. Slow travel, costs 3 Food per step.');
      }
    }

    if (locationType !== 'town' && (locationType === 'raid' || (terrain !== 'water' && terrain !== 'deep_water' && terrain !== 'river'))) {
      const biome = locationType === 'raid' ? (locationBiome || 'default') : terrain;
      let pool = [...(BIOME_MONSTER_POOLS[biome] || BIOME_MONSTER_POOLS.default)];
      const activeMap = getActiveMap();
      if (activeMap && activeMap.monsterPoolOverrides) {
        const overrides = activeMap.monsterPoolOverrides;
        const preventSet = new Set();
        
        function applyOverrideTier(p, tier) {
          if (!tier) return p;
          if (tier.prevent?.length) tier.prevent.forEach(m => preventSet.add(m));
          if (tier.remove?.length)  p = p.filter(m => !tier.remove.includes(m));
          if (tier.add?.length)     p = [...p, ...tier.add];
          return p;
        }

        pool = applyOverrideTier(pool, overrides.global);
        pool = applyOverrideTier(pool, overrides.byBiomeType?.[biome]);
        if (raidType) {
          pool = applyOverrideTier(pool, overrides.byRaidType?.[raidType]);
        }
        if (locationId) {
          pool = applyOverrideTier(pool, overrides.byLocationId?.[locationId]);
        }
        pool = [...new Set(pool)];
        if (preventSet.size) {
          pool = pool.filter(m => !preventSet.has(m));
        }
      }

      if (pool.length > 0) {
        const list = pool.map(enemy => {
          if (enemy.endsWith('s') || enemy.toLowerCase().endsWith('shaman') || enemy.includes('(')) return enemy;
          if (enemy.endsWith('Wolf')) return enemy.replace('Wolf', 'Wolves');
          return enemy + 's';
        }).join(', ');
        contents.push(`⚔️ Spawns: <span style="color:var(--color-danger); font-weight:600;">${list}</span>`);
      }
    }

    const contentsText = contents.join('<br>');

    elTooltip.innerHTML = `
      <div class="game-tooltip-header">
        <span>${headerText}</span>
        <span class="game-tooltip-coords">${coordsText}</span>
      </div>
      ${contentsText ? `<div class="game-tooltip-contents">${contentsText}</div>` : ''}
    `;
    elTooltip.style.borderLeftColor = borderAccent;
    elTooltip.style.display = 'flex';
    elTooltip.style.left = (clientX + 15) + 'px';
    elTooltip.style.top = (clientY + 15) + 'px';
  }

  document.body.addEventListener('mouseover', (e) => {
    const godTarget = e.target.closest('[data-god-tooltip]');
    if (godTarget) {
      const section = godTarget.dataset.tooltipSection;
      if (section === 'identity') return;

      const gKey = godTarget.dataset.godTooltip;
      const lore = GOD_LORE[gKey];
      if (!lore) return;

      let header = '';
      let content = '';

      if (section === 'milestone') {
        const idx = parseInt(godTarget.dataset.milestoneIdx);
        const achieved = STATE.godQuests[gKey][idx];

        const runeSets = {
          odin: ['ᚨ', 'ᛗ', 'ᚷ', 'ᚹ', 'ᛃ'],
          thor: ['ᚦ', 'ᚱ', 'ᛏ', 'ᛋ', 'ᚲ'],
          freya: ['ᚠ', 'ᛒ', 'ᛚ', 'ᛞ', 'ᚢ'],
          hel: ['ᚾ', 'ᛁ', 'ᚲ', 'ᛉ', 'ᛦ'],
          loki: ['ᛇ', 'ᚹ', 'ᚺ', 'ᛈ', 'ᛞ']
        };
        const runeNames = {
          'ᚨ': 'Ansuz', 'ᛗ': 'Mannaz', 'ᚷ': 'Gebo', 'ᚹ': 'Wunjo', 'ᛃ': 'Jera',
          'ᚦ': 'Thurisaz', 'ᚱ': 'Raido', 'ᛏ': 'Tiwaz', 'ᛋ': 'Sowilo', 'ᚲ': 'Kenaz',
          'ᚠ': 'Fehu', 'ᛒ': 'Berkana', 'ᛚ': 'Laguz', 'ᛞ': 'Dagaz', 'ᚢ': 'Uruz',
          'ᚾ': 'Nauthiz', 'ᛁ': 'Isa', 'ᛇ': 'Eihwaz', 'ᛉ': 'Algiz', 'ᛦ': 'Yr',
          'ᚺ': 'Hagalaz', 'ᛈ': 'Perthro'
        };
        const runeChar = runeSets[gKey] ? runeSets[gKey][idx] : '';
        const runeName = runeNames[runeChar] ? ` <span style="font-style:italic; font-size:0.75rem; color:var(--text-muted); font-weight:normal; margin-left:6px;">(${runeChar} ${runeNames[runeChar]})</span>` : '';

        header = `${lore.icon} Milestone ${['I', 'II', 'III', 'IV', 'V'][idx]}${runeName}`;

        let statusHtml = achieved
          ? `<span style="color:var(--color-success)">✅ Completed</span>`
          : `<span style="color:var(--text-muted)">🔒 Unlocked at Favor +${idx + 1}</span>`;

        let effectHtml = `<b style="color:${lore.color}">${lore.milestoneEffects[idx]}</b>`;
        content = `${statusHtml}<br><div style="margin-top:4px;">${effectHtml}</div>`;
      } else if (section === 'champion') {
        header = `${lore.icon} Champion Buff`;
        content = `<b style="color:${lore.color}">${lore.buff}</b>`;
      } else if (section === 'champion_locked') {
        header = `${lore.icon} Champion Buff`;
        content = `<span style="color:var(--text-muted)">reach Milestone 5 to unlock:</span><br><b style="color:${lore.color}">${lore.buff}</b>`;
      } else if (section === 'curse') {
        header = `${lore.icon} Active Curse (${gKey.toUpperCase()})`;
        content = `<b style="color:var(--color-danger)">${lore.wrath}</b>`;
      }

      elTooltip.innerHTML = `
        <div class="game-tooltip-header">
          <span>${header}</span>
        </div>
        <div class="game-tooltip-contents">${content}</div>
      `;
      elTooltip.style.borderLeftColor = section === 'curse' ? 'var(--color-danger)' : lore.color;
      elTooltip.style.left = (e.clientX + 15) + 'px';
      elTooltip.style.top = (e.clientY + 15) + 'px';
      elTooltip.style.display = 'flex';
    }
  });

  document.body.addEventListener('mouseover', (e) => {
    const tile = e.target.closest('.world-tile, .location-tile, .combat-cell');
    if (!tile) {
      if (!e.target.closest('[data-god-tooltip]')) {
        elTooltip.style.display = 'none';
      }
      return;
    }

    if (tile.classList.contains('fog')) {
      elTooltip.style.display = 'none';
      return;
    }

    if (tile.classList.contains('world-tile')) {
      if (hoverTimeout) clearTimeout(hoverTimeout);
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      hoverTimeout = setTimeout(() => {
        showWorldTileTooltip(tile, lastClientX, lastClientY);
      }, 800);
      return;
    }

    if (tile.classList.contains('location-tile')) {
      if (hoverTimeout) clearTimeout(hoverTimeout);
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      const entityType = tile.dataset.entityType;
      if (entityType === 'burial_mound') {
        hoverTimeout = setTimeout(() => {
          showLocationTileTooltip(tile, lastClientX, lastClientY);
        }, 800);
      } else {
        showLocationTileTooltip(tile, lastClientX, lastClientY);
      }
      return;
    }

    let headerText = '';
    let coordsText = '';
    let contentsText = '';
    let borderAccent = 'var(--text-accent)';

    if (tile.classList.contains('combat-cell')) {
      const r = Number(tile.dataset.row);
      const c = Number(tile.dataset.col);
      headerText = `Combat Grid Lane ${r + 1}`;
      coordsText = `Col: ${c}`;

      const unitEl = tile.querySelector('.combat-unit');
      if (unitEl) {
        const unit = STATE.combat.grid[r] ? STATE.combat.grid[r][c] : null;
        if (unit) {
          const stats = getEffectiveStats(unit);
          const allianceText = unit.alliance === 'player' ? 'Viking Soldier' : 'Monster';
          headerText = `${unit.name} (${allianceText})`;

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

          contentsText = contents.join('<br>');
        } else {
          contentsText = unitEl.title || 'Combat unit/monster.';
        }
      } else {
        contentsText = c <= 1 ? 'Deployable Zone' : 'Empty lane battlefield.';
      }
    }

    if (!headerText) {
      elTooltip.style.display = 'none';
      return;
    }

    elTooltip.innerHTML = `
      <div class="game-tooltip-header">
        <span>${headerText}</span>
        <span class="game-tooltip-coords">${coordsText}</span>
      </div>
      <div class="game-tooltip-contents">${contentsText}</div>
    `;
    elTooltip.style.borderLeftColor = borderAccent;
    elTooltip.style.display = 'flex';
  });

  document.body.addEventListener('mousemove', (e) => {
    if (elTooltip.style.display === 'flex') {
      elTooltip.style.left = (e.clientX + 15) + 'px';
      elTooltip.style.top = (e.clientY + 15) + 'px';
    }
    const tile = e.target.closest('.world-tile, .location-tile');
    if (tile) {
      lastClientX = e.clientX;
      lastClientY = e.clientY;
    }
  });

  document.body.addEventListener('mouseout', (e) => {
    const tile = e.target.closest('.world-tile, .location-tile, .combat-cell');
    const godTarget = e.target.closest('[data-god-tooltip]');

    if (tile && (tile.classList.contains('world-tile') || tile.dataset.entityType === 'burial_mound')) {
      const enteringTile = e.relatedTarget?.closest('.world-tile, .location-tile');
      if (enteringTile !== tile) {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        elTooltip.style.display = 'none';
      }
    } else if (tile && !e.relatedTarget?.closest('.world-tile, .location-tile, .combat-cell')) {
      elTooltip.style.display = 'none';
    }

    if (godTarget && !e.relatedTarget?.closest('[data-god-tooltip]')) {
      elTooltip.style.display = 'none';
    }
  });
}
