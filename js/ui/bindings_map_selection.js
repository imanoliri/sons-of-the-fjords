/* ==========================================================================
   UI BINDINGS MAP SELECTION - SONS OF THE FJORDS
   ========================================================================== */

import { STATE, setScreen } from '../state.js';
import { getAvailableMaps, setActiveMap, initializeWorld } from '../world.js';
import { LOCATION_CONFIG } from '../config/location.js';
import { elMapContainer, elDots, MONSTER_EMOJIS } from './dom.js';

export function setupMapSelection() {
  const maps = getAvailableMaps();
  let selectedMapIndex = 0;

  const TERRAIN_ICONS = {
    plains:   '🌿',
    forest:   '🌲',
    water:    '🌊',
    snow:     '❄️',
    mountain: '⛰️',
    river:    '💧',
    cave:     '🕳️'
  };

  const DIFFICULTY_COLORS = {
    1: '#4ade80',
    2: '#facc15',
    3: '#f97316',
    4: '#ef4444'
  };

  function renderDifficultyStars(level) {
    const color = DIFFICULTY_COLORS[level] || '#888';
    return Array.from({ length: 4 }, (_, i) =>
      `<span style="color:${i < level ? color : 'rgba(255,255,255,0.2)'};">◆</span>`
    ).join('');
  }

  function getPossibleEnemiesForMap(map) {
    const pool = new Set([
      ...(LOCATION_CONFIG.enemyArmy?.monsterPool || []),
      ...(LOCATION_CONFIG.difficultyScaling?.bosses || [])
    ]);

    const overrides = map.monsterPoolOverrides;
    if (!overrides) return Array.from(pool);

    if (overrides.global?.remove) {
      overrides.global.remove.forEach(m => pool.delete(m));
    }
    if (overrides.global?.add) {
      overrides.global.add.forEach(m => pool.add(m));
    }
    if (overrides.byBiomeType) {
      for (const b in overrides.byBiomeType) {
        if (overrides.byBiomeType[b].add) {
          overrides.byBiomeType[b].add.forEach(m => pool.add(m));
        }
      }
    }
    if (overrides.byRaidType) {
      for (const r in overrides.byRaidType) {
        if (overrides.byRaidType[r].add) {
          overrides.byRaidType[r].add.forEach(m => pool.add(m));
        }
      }
    }
    if (overrides.byLocationId) {
      for (const loc in overrides.byLocationId) {
        if (overrides.byLocationId[loc].add) {
          overrides.byLocationId[loc].add.forEach(m => pool.add(m));
        }
      }
    }
    return Array.from(pool);
  }

  function getTerrainFrequencies(map) {
    const size = map.gridSize || 15;
    const counts = {};
    const conditions = map.terrainZones.map(zone => {
      if (zone.condition === 'default') {
        return { label: zone.label, test: () => true };
      }
      try {
        const fn = new Function('x', 'y', `return (${zone.condition});`);
        return { label: zone.label, test: fn };
      } catch (e) {
        return { label: zone.label, test: () => false };
      }
    });

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let terrain = 'plains';
        for (const cond of conditions) {
          if (cond.test(x, y)) {
            terrain = cond.label;
            break;
          }
        }
        counts[terrain] = (counts[terrain] || 0) + 1;
      }
    }
    return counts;
  }

  function renderMapCards() {
    elMapContainer.innerHTML = '';
    elDots.innerHTML = '';

    maps.forEach((map, i) => {
      const card = document.createElement('div');
      card.className = 'map-card' + (i === selectedMapIndex ? ' map-card--selected' : '');
      card.dataset.mapIndex = i;

      const freqs = getTerrainFrequencies(map);
      const uniqueTerrains = Object.keys(freqs).sort((a, b) => freqs[b] - freqs[a]);
      const terrainBadges = uniqueTerrains
        .map(t => `<span class="terrain-badge">${TERRAIN_ICONS[t] || '🗺️'} ${t}</span>`)
        .join('');

      const worldEnemies = getPossibleEnemiesForMap(map);
      const enemyBadges = worldEnemies
        .map(e => `<span class="enemy-badge" title="${e}">${MONSTER_EMOJIS[e] || '👿'}</span>`)
        .join('');

      const raidCount  = Object.values(map.locations).filter(l => l.type === 'raid').length;
      const townCount  = Object.values(map.locations).filter(l => l.type === 'town').length;

      card.innerHTML = `
        <div class="map-card-header">
          <span class="map-card-emoji">${map.emoji}</span>
          <div class="map-card-titles">
            <div class="map-card-name">${map.name}</div>
            <div class="map-card-subtitle">${map.subtitle}</div>
          </div>
        </div>
        <p class="map-card-desc">${map.description}</p>
        <div class="map-card-meta">
          <div class="map-card-difficulty">
            <span class="meta-label">Difficulty</span>
            <span class="difficulty-stars">${renderDifficultyStars(map.difficulty)}</span>
            <span class="difficulty-label" style="color:${DIFFICULTY_COLORS[map.difficulty]}">${map.difficultyLabel}</span>
          </div>
          <div class="map-card-stats">
            <span class="meta-stat">🏰 ${townCount} Towns</span>
            <span class="meta-stat">⚔️ ${raidCount} Raids</span>
            <span class="meta-stat">📐 ${map.gridSize}×${map.gridSize}</span>
          </div>
        </div>
        <div class="terrain-badges">${terrainBadges}</div>
        ${enemyBadges ? `<div class="enemy-badges-container"><div class="enemy-badges">${enemyBadges}</div></div>` : ''}
        <div class="map-card-select-indicator">
          ${i === selectedMapIndex 
            ? `<button class="btn btn-primary btn-start-card-voyage" style="width: 100%; font-family: var(--font-logo); font-size: 0.78rem; padding: 0.35rem 0.5rem; margin: 0; line-height: 1.2;">⚓ Start Adventure</button>`
            : 'Click to Select'
          }
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-start-card-voyage')) {
          setActiveMap(maps[selectedMapIndex].id);
          initializeWorld();
          setScreen('world');
          return;
        }
        selectedMapIndex = i;
        renderMapCards();
      });

      elMapContainer.appendChild(card);

      const dot = document.createElement('button');
      dot.className = 'map-dot' + (i === selectedMapIndex ? ' map-dot--active' : '');
      dot.title = map.name;
      dot.addEventListener('click', () => {
        selectedMapIndex = i;
        renderMapCards();
        const cards = elMapContainer.querySelectorAll('.map-card');
        if (cards[i]) cards[i].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      });
      elDots.appendChild(dot);
    });
  }

  renderMapCards();

  // Return controllers needed for arrow keyboard shortcuts
  return {
    getSelectedIndex: () => selectedMapIndex,
    setSelectedIndex: (idx) => { selectedMapIndex = idx; },
    renderMapCards,
    maps
  };
}
