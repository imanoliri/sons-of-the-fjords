/* ==========================================================================
   UI/PARTY.JS — Party roster and Gods quests screens
   ========================================================================== */

import { SOLDIER_EMOJIS } from '../config/soldiers.js';

import { STATE, notify, getEffectiveStats, markSoldierDismissed } from '../state.js';
import { GODS_CONFIG } from '../config/gods.js';
import {
  elQuestsList, elPartyBandContent, elPartyInventoryContent, elPartyHallOfFameContent,
  elModalEvent, elModalEventTitle, elModalEventBody, elModalEventChoices, elModalEventCloseBtn,
  elPartyModal
} from './dom.js';
import { formatStat } from './dom.js';
import { showOverlay, hideOverlay, updateModalKeyboardNavigation } from './overlay.js';

// ── God lore reference ──────────────────────────────────────────────────────
export const GOD_LORE = GODS_CONFIG.lore;

export function showGodLorePopup(gKey) {
  const lore = GOD_LORE[gKey];
  if (!lore) return;

  elModalEventTitle.innerText = lore.title;
  elModalEventTitle.style.color = lore.color;

  const track = STATE.godQuests[gKey];
  const milestoneList = lore.milestoneEffects.map((effect, idx) => {
    let desc = effect;
    if (!desc && idx === 4) {
      desc = `Unlocks Blessing: ${lore.buff}`;
    }
    const check = track[idx] ? '✅' : '🔒';
    const isLockedClass = track[idx] ? '' : ' locked';
    return `<li class="god-lore-milestone-item${isLockedClass}">${check} Milestone ${idx + 1}: ${desc || ''}</li>`;
  }).join('');

  const favorActionHtml = lore.favorAction || '';

  const opps = GODS_CONFIG.pentagramOpposites[gKey] || [];
  const oppositesHtml = opps.map(oppKey => {
    const oppLore = GOD_LORE[oppKey];
    return oppLore ? `<span style="color: ${oppLore.color}; font-weight: bold;">${oppLore.icon} ${oppLore.title.split(' — ')[0]}</span>` : '';
  }).join(' & ');

  elModalEventBody.innerHTML = `
    <div class="god-lore-popup-body">
      <div>
        <p class="god-lore-section-title" style="color: ${lore.color};">👑 Active Blessing (Champion Buff)</p>
        <p class="god-lore-section-content">${lore.buff}</p>
      </div>

      <div>
        <p class="god-lore-section-title">ᚱ Milestones Progression</p>
        <ul class="god-lore-milestones-list">
          ${milestoneList}
        </ul>
      </div>

      <div>
        <p class="god-lore-section-title god-lore-curse-title">⚠️ Active Curse (Wrath)</p>
        <p class="god-lore-section-content">${lore.wrath}</p>
      </div>

      <p><b>🏺 Relic:</b> ${lore.relic}</p>

      <div>
        <p class="god-lore-section-title">📋 How to gain Favor</p>
        <p class="god-lore-section-content">${favorActionHtml}</p>
      </div>

      <div>
        <p class="god-lore-section-title">⚖️ Opposes (Drains Favor)</p>
        <p class="god-lore-section-content">Pleasing this god drains favor from: ${oppositesHtml}</p>
      </div>
    </div>
  `;

  elModalEventChoices.innerHTML = '';
  if (elModalEventCloseBtn) {
    elModalEventCloseBtn.style.display = 'block';
  }

  const box = elModalEvent.querySelector('.modal-box');
  if (box) {
    box.style.maxWidth = '540px';
  }

  showOverlay(elModalEvent);
  updateModalKeyboardNavigation();
}

// Render Gods Progress screens
export function renderQuestsScreen() {
  elQuestsList.innerHTML = '';

  // To map opposites exactly across the star, the gods must be arranged in the polar coordinate order:
  // odin, thor, freya, hel, loki. (Top starts at -90 degrees, increments by 72 deg).
  const gods = ['odin', 'thor', 'freya', 'hel', 'loki'];

  // Calculate polar coordinates dynamically
  // Center is (50, 50), Radius is 40
  const cx = 50;
  const cy = 50;
  const radius = 40;

  const points = gods.map((_, i) => {
    // Odin starts at top (-90 degrees / -PI/2 radians), incrementing by 72 degrees (2 * PI / 5)
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    return { x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(2)) };
  });

  const coordinates = {};
  gods.forEach((gKey, idx) => {
    coordinates[gKey] = {
      top: `${points[idx].y}%`,
      left: `${points[idx].x}%`
    };
  });

  // Star ordering traces vertices by skipping index by 2: 0 -> 2 -> 4 -> 1 -> 3
  const starIndices = [0, 2, 4, 1, 3];
  const starPointsStr = starIndices.map(idx => `${points[idx].x},${points[idx].y}`).join(' ');
  const pentagonPointsStr = points.map(p => `${p.x},${p.y}`).join(' ');

  // Re-append the SVG to make sure it is behind the elements
  const pentagramSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  pentagramSvg.setAttribute('class', 'pentagram-svg');
  pentagramSvg.setAttribute('viewBox', '0 0 100 100');
  pentagramSvg.innerHTML = `
    <circle cx="${cx}" cy="${cy}" r="${radius}" class="pentagram-outer-circle" />
    <polygon points="${pentagonPointsStr}" class="pentagram-pentagon" />
    <polygon points="${starPointsStr}" class="pentagram-star" />
  `;
  elQuestsList.appendChild(pentagramSvg);

  gods.forEach(gKey => {
    const lore = GOD_LORE[gKey];
    const node = document.createElement('div');
    node.classList.add('god-pentagram-node', `deity-${gKey}`);
    const isPermanent = STATE.permanentlyActivatedBlessings && STATE.permanentlyActivatedBlessings.includes(gKey);
    const isActive = STATE.activeBlessing === gKey;
    if (isPermanent || isActive) {
      node.classList.add('permanently-active');
    }
    node.style.top = coordinates[gKey].top;
    node.style.left = coordinates[gKey].left;

    // ── God Identity (hover = full god info tooltip) ──
    const idCol = document.createElement('div');
    idCol.classList.add('god-identity');
    idCol.dataset.godTooltip = gKey;
    idCol.dataset.tooltipSection = 'identity';
    idCol.style.cursor = 'pointer';
    idCol.addEventListener('click', () => {
      showGodLorePopup(gKey);
    });

    const favor = STATE.godFavor[gKey];
    const favorColor = favor > 0 ? 'var(--color-success)' : favor < 0 ? 'var(--color-danger)' : 'var(--text-muted)';
    const favorSign = favor > 0 ? '+' : '';

    const name = document.createElement('span');
    name.classList.add('god-name');
    name.innerHTML = `${lore.icon} ${lore.title.split('—')[0].trim()}`;
    name.style.color = `var(--color-${gKey})`;

    const favorEl = document.createElement('span');
    favorEl.classList.add('god-favor-score');
    favorEl.innerHTML = `Favor: <b style="color:${favorColor}">${favorSign}${favor}</b> / 5`;

    idCol.appendChild(name);
    idCol.appendChild(favorEl);
    node.appendChild(idCol);

    // ── Milestones track ──
    const trackCol = document.createElement('div');
    trackCol.classList.add('god-progress-bar');

    const track = STATE.godQuests[gKey];
    const runeSets = {
      odin: ['ᚨ', 'ᛗ', 'ᚷ', 'ᚹ', 'ᛃ'],
      thor: ['ᚦ', 'ᚱ', 'ᛏ', 'ᛋ', 'ᚲ'],
      freya: ['ᚠ', 'ᛒ', 'ᛚ', 'ᛞ', 'ᚢ'],
      hel: ['ᚾ', 'ᛁ', 'ᚲ', 'ᛉ', 'ᛦ'],
      loki: ['ᛇ', 'ᚹ', 'ᚺ', 'ᛈ', 'ᛞ']
    };
    const runes = runeSets[gKey] || ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ'];

    for (let i = 0; i < 5; i++) {
      const step = document.createElement('div');
      step.classList.add('milestone-step');
      step.innerText = runes[i];
      step.dataset.godTooltip = gKey;
      step.dataset.tooltipSection = 'milestone';
      step.dataset.milestoneIdx = i;
      step.style.cursor = 'help';
      if (track[i]) {
        step.classList.add('achieved');
      }
      trackCol.appendChild(step);
    }
    node.appendChild(trackCol);

    // ── Champion toggle button/label ──
    const toggleCol = document.createElement('div');
    toggleCol.classList.add('champion-selector-cell');

    const isChampion = track.every(x => x === true);
    if (isChampion) {
      const btn = document.createElement('button');
      btn.classList.add('btn', 'btn-sm');
      btn.dataset.godTooltip = gKey;
      btn.dataset.tooltipSection = 'champion';

      const isPermanent = STATE.permanentlyActivatedBlessings && STATE.permanentlyActivatedBlessings.includes(gKey);
      if (isPermanent) {
        btn.innerText = 'Always Active ✨';
        btn.classList.add('btn-primary', 'btn-always-active');
        btn.style.cursor = 'help';
        btn.disabled = false; // Enable hover interaction even if permanently active
        btn.addEventListener('click', (e) => {
          e.preventDefault();
        });
      } else if (STATE.activeBlessing === gKey) {
        btn.innerText = 'Active ✨';
        btn.classList.add('btn-primary');
        btn.style.cursor = 'help';
      } else {
        btn.innerText = 'Activate Buff';
        btn.addEventListener('click', () => {
          STATE.activeBlessing = gKey;
          notify('STATE_UPDATED');
          import('./notifications.js').then(({showToast}) => {
             showToast(`${GOD_LORE[gKey].icon} ${gKey.charAt(0).toUpperCase() + gKey.slice(1)} Buff activated!`, GOD_LORE[gKey].icon, true);
          });
        });
      }
      toggleCol.appendChild(btn);
    } else {
      const locked = document.createElement('span');
      locked.style.cssText = 'font-size:0.75rem;color:var(--text-muted);cursor:help;';
      locked.innerText = '🔒 Locked';
      locked.dataset.godTooltip = gKey;
      locked.dataset.tooltipSection = 'champion_locked';
      toggleCol.appendChild(locked);
    }

    node.appendChild(toggleCol);
    elQuestsList.appendChild(node);
  });
}

// Render the active band roster and inventory items in the party panel
export function renderPartyPanel() {
  // 1. Render Band Warriors
  elPartyBandContent.innerHTML = '';
  if (STATE.band.length === 0) {
    elPartyBandContent.innerHTML = '<p style="color:var(--text-muted);">Your band has no warriors recruited.</p>';
  } else {
    STATE.band.forEach(unit => {
      const row = document.createElement('div');
      row.className = 'trade-row';
      row.style.alignItems = 'center';
      row.style.padding = '0.5rem 0';
      row.style.maxWidth = '450px';
      row.style.margin = '0 auto';

      const details = document.createElement('div');
      details.style.display = 'flex';
      details.style.flexDirection = 'column';
      details.style.gap = '2px';

      const effStats = getEffectiveStats(unit);

      const name = document.createElement('span');
      const icons = SOLDIER_EMOJIS;
      name.innerHTML = `<b>${icons[unit.type] || '⚔️'} ${unit.name}</b> (${unit.type.toUpperCase()})`;

      const stats = document.createElement('span');
      stats.style.fontSize = '0.75rem';
      stats.style.color = 'var(--text-muted)';
      stats.innerText = `ATK: ${formatStat(effStats.dmg)} | SPD: ${formatStat(effStats.speed)} | RNG: ${formatStat(effStats.range)}`;

      details.appendChild(name);
      details.appendChild(stats);

      const hpSection = document.createElement('div');
      hpSection.style.display = 'flex';
      hpSection.style.flexDirection = 'column';
      hpSection.style.alignItems = 'flex-end';
      hpSection.style.gap = '4px';
      hpSection.style.width = '120px';

      const hpText = document.createElement('span');
      hpText.style.fontSize = '0.8rem';
      hpText.innerHTML = `HP: <b>${unit.hp}</b> / ${formatStat(effStats.maxHp)}`;

      const hbContainer = document.createElement('div');
      hbContainer.className = 'health-bar-container';
      hbContainer.style.position = 'relative';
      hbContainer.style.width = '100%';
      hbContainer.style.height = '6px';
      hbContainer.style.background = '#222';
      hbContainer.style.borderRadius = '3px';
      hbContainer.style.overflow = 'hidden';

      const hbFill = document.createElement('div');
      hbFill.className = 'health-bar-fill';
      hbFill.style.height = '100%';
      hbFill.style.width = `${(unit.hp / effStats.maxHp.total) * 100}%`;
      const ratio = unit.hp / effStats.maxHp.total;
      if (ratio >= 0.8) {
        hbFill.style.background = 'var(--color-success)';
      } else if (ratio >= 0.2) {
        hbFill.style.background = 'orange';
      } else {
        hbFill.style.background = 'var(--color-danger)';
      }

      hbContainer.appendChild(hbFill);
      hpSection.appendChild(hpText);
      hpSection.appendChild(hbContainer);

      const disbandBtn = document.createElement('button');
      disbandBtn.className = 'btn btn-sm btn-danger btn-no-shortcut';
      disbandBtn.style.padding = '2px 8px';
      disbandBtn.style.marginLeft = '1rem';
      disbandBtn.innerText = 'Disband';
      disbandBtn.addEventListener('click', () => {
        const idx = STATE.band.findIndex(u => u.id === unit.id);
        if (idx !== -1) {
          markSoldierDismissed(unit.id);
          STATE.band.splice(idx, 1);
          notify('RESOURCES_UPDATED');
          renderPartyPanel();
        }
      });

      row.appendChild(details);
      row.appendChild(hpSection);
      row.appendChild(disbandBtn);
      elPartyBandContent.appendChild(row);
    });
  }

  // 2. Render Inventory
  elPartyInventoryContent.innerHTML = '';
  if (STATE.inventory.length === 0) {
    elPartyInventoryContent.innerHTML = '<p style="color:var(--text-muted);">Your cargo holds no items.</p>';
  } else {
    const counts = {};
    STATE.inventory.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });

    Object.entries(counts).forEach(([item, count]) => {
      const row = document.createElement('div');
      row.className = 'trade-row';
      row.style.padding = '0.5rem 0';
      row.style.maxWidth = '450px';
      row.style.margin = '0 auto';

      const label = document.createElement('span');
      label.innerHTML = `💎 <b>${item}</b>`;

      const qty = document.createElement('span');
      qty.style.fontWeight = 'bold';
      qty.innerText = `x${count}`;

      row.appendChild(label);
      row.appendChild(qty);



      elPartyInventoryContent.appendChild(row);
    });
  }
}

// Render the Hall of Fame tab
export function renderHallOfFame() {
  elPartyHallOfFameContent.innerHTML = '';

  if (!STATE.hallOfFame || STATE.hallOfFame.length === 0) {
    elPartyHallOfFameContent.innerHTML = '<p style="color:var(--text-muted);">No warriors have been recorded in the Hall of Fame yet.</p>';
    return;
  }

  // Sort: active first, then dead, then dismissed. Within each group, sort by hiredDay
  const sorted = [...STATE.hallOfFame].sort((a, b) => {
    const statusOrder = { active: 0, dead: 1, dismissed: 2 };
    const diff = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
    if (diff !== 0) return diff;
    return (a.hiredDay || 0) - (b.hiredDay || 0);
  });

  const icons = SOLDIER_EMOJIS;
  const statusIcons = { active: '⚔️', dead: '💀', dismissed: '🖐️' };
  const statusColors = { active: 'var(--color-success)', dead: 'var(--color-danger)', dismissed: 'var(--text-muted)' };

  sorted.forEach(record => {
    const card = document.createElement('div');
    card.className = 'hof-card';
    card.style.cssText = 'border: 1px solid var(--border-color); border-radius: 8px; padding: 0.75rem; margin-bottom: 0.75rem; background: rgba(0,0,0,0.3);';

    // Header row
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; cursor: pointer;';

    const nameSpan = document.createElement('span');
    nameSpan.innerHTML = `${statusIcons[record.status] || '⚔️'} ${icons[record.type] || '⚔️'} <b>${record.name}</b> <span style="color:var(--text-muted);font-size:0.8rem;">(${record.type.toUpperCase()})</span>`;
    nameSpan.style.color = statusColors[record.status] || 'inherit';

    const statusSpan = document.createElement('span');
    statusSpan.style.cssText = `font-size: 0.75rem; color: ${statusColors[record.status]};`;
    if (record.status === 'active') {
      statusSpan.innerText = `Active \u00b7 Hired Day ${record.hiredDay}`;
    } else if (record.status === 'dead') {
      statusSpan.innerText = `Died Day ${record.deathDay || '?'}`;
    } else {
      statusSpan.innerText = `Dismissed Day ${record.deathDay || '?'}`;
    }

    header.appendChild(nameSpan);
    header.appendChild(statusSpan);
    card.appendChild(header);

    // Death cause
    if (record.deathCause && record.status !== 'active') {
      const causeEl = document.createElement('p');
      causeEl.style.cssText = 'font-size: 0.8rem; color: var(--text-muted); margin: 0 0 0.5rem 0; font-style: italic;';
      causeEl.innerText = record.deathCause;
      card.appendChild(causeEl);
    }

    // Collapsible details
    const detailsToggle = document.createElement('button');
    detailsToggle.className = 'btn btn-sm btn-no-shortcut';
    detailsToggle.style.cssText = 'padding: 2px 8px; font-size: 0.7rem; margin-bottom: 0.5rem;';
    detailsToggle.innerText = '\u25b6 Stats & History';
    card.appendChild(detailsToggle);

    const detailsDiv = document.createElement('div');
    detailsDiv.style.display = 'none';
    card.appendChild(detailsDiv);

    detailsToggle.addEventListener('click', () => {
      if (detailsDiv.style.display === 'none') {
        detailsDiv.style.display = 'block';
        detailsToggle.innerText = '\u25bc Stats & History';
        renderSoldierDetails(detailsDiv, record);
      } else {
        detailsDiv.style.display = 'none';
        detailsToggle.innerText = '\u25b6 Stats & History';
      }
    });

    elPartyHallOfFameContent.appendChild(card);
  });
}

function renderSoldierDetails(container, record) {
  container.innerHTML = '';
  const s = record.stats;

  // Stats grid
  const statsHtml = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.3rem 1rem; font-size: 0.75rem; margin-bottom: 0.75rem;">
      <div>\u2694\ufe0f <b>Attacks Made:</b> ${s.attacksMade}</div>
      <div>\ud83d\udca5 <b>Damage Dealt:</b> ${s.damageDealt}</div>
      <div>\ud83d\udee1\ufe0f <b>Damage Received:</b> ${s.damageReceived}</div>
      <div>\ud83d\udd30 <b>Damage Blocked:</b> ${s.damageBlocked} (${s.blockedHits} hits)</div>
      <div>\ud83d\udc9a <b>Damage Healed:</b> ${s.damageHealed}</div>
      <div>\u26a1 <b>Double Attacks:</b> ${s.doubleAttacks}</div>
      <div>\ud83e\uddb6 <b>Cells Moved:</b> ${s.cellsMoved}</div>
      <div>\ud83e\udd85 <b>Leaps:</b> ${s.leaps}</div>
      <div>\ud83d\udc80 <b>Enemies Killed:</b> ${s.enemiesKilled}</div>
      <div>\ud83c\udfc6 <b>Reached Enemy End:</b> ${s.timesReachedEnd}</div>
      <div>\ud83d\udccb <b>Times Deployed:</b> ${s.timesDeployed}</div>
      <div>\ud83c\udf96\ufe0f <b>Combats Won:</b> ${s.combatsWon} / ${s.combatsParticipated}</div>
    </div>
  `;
  container.innerHTML += statsHtml;

  // Rune stats (if any)
  const runeEntries = Object.entries(s.runesCast || {});
  if (runeEntries.length > 0) {
    const runeIcons = { odin: '\u26a1', thor: '\ud83d\udd28', hel: '\ud83d\udc80', loki: '\ud83c\udccf', freya: '\ud83d\udc9a' };
    let runeHtml = '<div style="font-size: 0.75rem; margin-bottom: 0.75rem;"><b>\ud83d\udd2e Rune Casts:</b><br>';
    runeEntries.forEach(([rune, count]) => {
      runeHtml += `  ${runeIcons[rune] || '\u2728'} ${rune.charAt(0).toUpperCase() + rune.slice(1)}: ${count}x<br>`;
    });
    runeHtml += `  Rune Damage: ${s.runeDamageDealt} \u00b7 Rune Kills: ${s.runeKills} \u00b7 Rune Healing: ${s.runeHealingDone}`;
    runeHtml += '</div>';
    container.innerHTML += runeHtml;
  }

  // Kill list
  const killEntries = Object.entries(s.killList || {});
  if (killEntries.length > 0) {
    let killHtml = '<div style="font-size: 0.75rem; margin-bottom: 0.75rem;"><b>\ud83d\udde1\ufe0f Kill List:</b><br>';
    killEntries.sort((a, b) => b[1] - a[1]).forEach(([monster, count]) => {
      killHtml += `  ${monster}: ${count}x<br>`;
    });
    killHtml += '</div>';
    container.innerHTML += killHtml;
  }

  // Event timeline (consolidate repeated events on the same day)
  if (record.events && record.events.length > 0) {
    const grouped = [];
    const seen = new Map();
    record.events.forEach(ev => {
      const key = `${ev.day}|||${ev.text}`;
      if (seen.has(key)) {
        seen.get(key).count++;
      } else {
        const entry = { day: ev.day, text: ev.text, count: 1 };
        seen.set(key, entry);
        grouped.push(entry);
      }
    });
    let eventsHtml = '<div style="font-size: 0.75rem;"><b>\ud83d\udcdc Timeline:</b><br>';
    grouped.forEach(ev => {
      const countStr = ev.count > 1 ? ` (${ev.count})` : '';
      eventsHtml += `  <span style="color:var(--text-muted);">Day ${ev.day}:</span> ${ev.text}${countStr}<br>`;
    });
    eventsHtml += '</div>';
    container.innerHTML += eventsHtml;
  }
}
