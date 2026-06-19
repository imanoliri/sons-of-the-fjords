import { STATE, notify } from './state.js';
import { GODS_CONFIG } from './config/gods.js';
import { initUIBindings } from './ui/bindings.js';
import { showToast, logWorld, logLocation } from './ui/notifications.js';
import { renderWorldMap, renderResourceBar, startWorldHazardTicker, stopWorldHazardTicker } from './ui/world.js';
import { renderTownScreen } from './ui/town.js';
import { renderLocationMap, autoDiscoverAdjacent } from './ui/location.js';
import { renderCombatGrid, spawnHuntsmanProjectile, spawnCombatParticle, spawnFloatyText, flashRuneOnCells, markRunecasterCasting } from './ui/combat.js';
import { renderQuestsScreen, renderPartyPanel, GOD_LORE } from './ui/party.js';
import { showOverlay, hideOverlay } from './ui/overlay.js';
import {
  screens, elHeader, elModalAscension, elModalAscensionText, elModalGameOver,
  elModalEventTitle, elModalEventBody, elModalRaidCleared, elModalRaidClearedText,
  elModalSagaVictory, elModalSagaVictoryText
} from './ui/dom.js';

// Re-export specific modules for external app.js or other systems
export { initUIBindings, logWorld, logLocation, showToast };

// Global render router
export function render() {
  // Toggle screens panels
  for (const sName in screens) {
    if (sName === STATE.activeScreen) {
      screens[sName].classList.remove('hidden');
    } else {
      screens[sName].classList.add('hidden');
    }
  }

  // Display/Hide header bar
  if (STATE.activeScreen === 'menu') {
    elHeader.classList.add('hidden');
  } else {
    elHeader.classList.remove('hidden');
  }

  const appContainer = document.querySelector('.app-container');
  if (appContainer) {
    if (STATE.activeScreen === 'combat') {
      appContainer.classList.add('combat-active');
    } else {
      appContainer.classList.remove('combat-active');
    }
  }

  // Render sub sections
  renderResourceBar();

  if (STATE.activeScreen === 'world') {
    renderWorldMap();
  } else if (STATE.activeScreen === 'town') {
    renderTownScreen();
  } else if (STATE.activeScreen === 'location') {
    renderLocationMap();
  } else if (STATE.activeScreen === 'combat') {
    renderCombatGrid();
  } else if (STATE.activeScreen === 'quests') {
    renderQuestsScreen();
  }
}

// Listen to key actions triggered by state
export function handleStateNotification(event, data) {
  if (event === 'SCREEN_CHANGE') {
    if (data === 'world') {
      startWorldHazardTicker();
    } else {
      stopWorldHazardTicker();
    }
    render();
  }
  else if (event === 'FAVOR_UPDATED' || event === 'RESOURCES_UPDATED') {
    renderResourceBar();
    if (STATE.activeScreen === 'quests') renderQuestsScreen();
    if (STATE.activeScreen === 'town') renderTownScreen();
  }
  else if (event === 'COMBAT_START') {
    render();
  }
  else if (event === 'COMBAT_UPDATE' || event === 'COMBAT_PAUSED') {
    if (STATE.activeScreen === 'combat') renderCombatGrid();
  }
  else if (event === 'COMBAT_DAMAGE') {
    if (STATE.activeScreen === 'combat') {
      if (data.attacker && data.attacker.type === 'huntsman' && data.defender) {
        spawnHuntsmanProjectile(data.attacker.row, data.attacker.col, data.defender.row, data.defender.col);
      }
      renderCombatGrid();
    }
  }
  else if (event === 'COMBAT_DEATH') {
    logWorld(`Dead: Unit '${data.name}' was slain on the lanes.`, 'combat-message');
    if (STATE.activeScreen === 'combat' && data.row !== undefined && data.col !== undefined) {
      spawnCombatParticle(data.row, data.col, 'particle-death-fade');
      spawnFloatyText(data.row, data.col, '💀 SLAIN', 'var(--color-danger)');
    }
  }
  else if (event === 'COMBAT_EFFECT_TRIGGER') {
    if (data.effect === 'loki_miss') {
      logWorld(`🎭 Loki's Trick: Enemy missed their attack!`, 'warn-message');
      showToast(`Enemy missed (Loki)`, '🎭');
      if (data.unit) {
        spawnFloatyText(data.unit.row, data.unit.col, '💨 DODGED!', 'var(--color-loki)');
      }
    } else if (data.effect === 'hel_miss') {
      logWorld(`💀 Hel's Chill: Enemy missed their attack!`, 'warn-message');
      showToast(`Enemy missed (Hel)`, '💀');
      if (data.unit) {
        spawnFloatyText(data.unit.row, data.unit.col, '💨 MISSED!', 'var(--color-hel)');
      }
    } else if (data.effect === 'thor_double') {
      logWorld(`⚡ Thor's Wrath: Allied unit '${data.unit.name}' strikes twice!`, 'gain-message');
      showToast(`Double Strike!`, '⚡');
      spawnFloatyText(data.unit.row, data.unit.col, '⚡ DOUBLE STRIKE!', 'var(--color-thor)');
    } else if (data.effect === 'loki_charm') {
      logWorld(`🌀 Loki's Mirror: Spawning enemy '${data.unit.name}' is Charmed to fight for you!`, 'gain-message');
      showToast(`Charm: ${data.unit.name}!`, '🌀');
    } else if (data.effect === 'loki_confuse') {
      logWorld(`😵 Loki's Chaos: Spawning enemy '${data.unit.name}' is Confused!`, 'warn-message');
      showToast(`Confused: ${data.unit.name}`, '😵');
    } else if (data.effect === 'loki_charm_wearoff') {
      logWorld(`🎭 Loki's Charm faded: Charmed unit '${data.unit.name}' broke free!`, 'warn-message');
      showToast(`Charm wore off`, '🎭');
    } else if (data.effect === 'hel_undead') {
      logWorld(`💀 Hel's Necromancy: Hurt enemy '${data.unit.name}' converted into an allied Undead Draugr!`, 'gain-message');
      showToast(`Draugr Rises!`, '💀');
      spawnCombatParticle(data.unit.row, data.unit.col, 'particle-raise-undead');
      spawnFloatyText(data.unit.row, data.unit.col, '🧟 RISEN!', 'var(--color-hel)');
    } else if (data.effect === 'huskarl_armor') {
      spawnFloatyText(data.unit.row, data.unit.col, '🛡️ Blocked 1', '#ccc');
      spawnCombatParticle(data.unit.row, data.unit.col, 'particle-armor-hit');
    } else if (data.effect === 'shieldmaiden_block') {
      const amt = data.amount || 1;
      spawnFloatyText(data.unit.row, data.unit.col, `🛡️ Blocked ${amt}`, 'var(--color-freya)');
      spawnCombatParticle(data.unit.row, data.unit.col, 'particle-armor-hit');
    } else if (data.effect === 'hel_survive') {
      spawnFloatyText(data.unit.row, data.unit.col, '💚 SURVIVED!', 'var(--color-hel)');
      spawnCombatParticle(data.unit.row, data.unit.col, 'particle-survive-lethal');
    } else if (data.effect === 'unit_leap') {
      spawnFloatyText(data.unit.row, data.unit.col, '💨 LEAP!', 'var(--color-thor)');
      spawnCombatParticle(data.unit.row, data.unit.col, 'particle-leap-wind');
    } else if (data.effect === 'unit_heal') {
      spawnFloatyText(data.unit.row, data.unit.col, `💚 +${data.amount} HP`, 'var(--color-success)');
      spawnCombatParticle(data.unit.row, data.unit.col, 'particle-heal-pulse');
    } else if (data.effect === 'rune_odin') {
      const t = data.target;
      logWorld(`⚡ ${data.unit.name} carved the Odin Rune — lightning AoE burst at [${t.row},${t.col}]! 25 dmg + 5/tick DoT for 3 ticks. (-1 Gold)`, 'gain-message');
      showToast(`Odin Rune: Lightning Cluster!`, '⚡', true);
      flashRuneOnCells(t.row, t.col, 'odin', true, data.unit.row, data.unit.col);
      markRunecasterCasting(data.unit);
    } else if (data.effect === 'rune_thor') {
      const t = data.target;
      logWorld(`🔨 ${data.unit.name} carved the Thor Rune — smashed ${t.name} for 50 dmg + 10 AoE + 2-tick stun! (-1 Gold)`, 'gain-message');
      showToast(`Thor Rune: Thunderstrike!`, '🔨', true);
      flashRuneOnCells(t.row, t.col, 'thor', true, data.unit.row, data.unit.col);
      markRunecasterCasting(data.unit);
    } else if (data.effect === 'rune_hel') {
      const t = data.target;
      logWorld(`💀 ${data.unit.name} carved the Hel Rune — halved ${t.name}'s HP (now ${t.hp})! (-1 Gold)`, 'gain-message');
      showToast(`Hel Rune: Death's Grip!`, '💀', true);
      flashRuneOnCells(t.row, t.col, 'hel', false, data.unit.row, data.unit.col);
      markRunecasterCasting(data.unit);
    } else if (data.effect === 'loki_rune_teleport') {
      logWorld(`🌀 Loki Rune teleported ${data.unit.name} back to the start of its lane! (-1 Gold)`, 'gain-message');
      showToast(`Loki Rune: Banished!`, '🌀', true);
      flashRuneOnCells(data.unit.row, data.unit.col, 'loki', false);
    } else if (data.effect === 'rune_loki') {
      const t = data.target;
      logWorld(`🌀 ${data.unit.name} carved the Loki Rune — banished ${t.name} to the start of lane ${t.row}! (-1 Gold)`, 'gain-message');
      showToast(`Loki Rune: Banished!`, '🌀', true);
      flashRuneOnCells(t.row, t.col, 'loki', false, data.unit.row, data.unit.col);
      markRunecasterCasting(data.unit);
    } else if (data.effect === 'rune_freya') {
      const t = data.target;
      logWorld(`🌸 ${data.unit.name} carved the Freya Rune — healed allies around [${t.row},${t.col}] to full HP! (-1 Gold)`, 'gain-message');
      showToast(`Freya Rune: Blessed Healing!`, '🌸', true);
      flashRuneOnCells(t.row, t.col, 'freya', true, data.unit.row, data.unit.col);
      markRunecasterCasting(data.unit);
    }
  }
  else if (event === 'COMBAT_BREACH') {
    logWorld(`Line breached! Monster '${data.unit.name}' reached base and stole 2 ${data.stolen}!`, 'warn-message');
  }
  else if (event === 'COMBAT_SUCCESS_REPLACE') {
    logWorld(`Success! '${data.name}' reached Asgard boundary, earning 1 Gold and returning to pool.`, 'gain-message');
  }
  else if (event === 'COMBAT_VICTORY') {
    logWorld('VICTORY! The lane has been cleared of monsters.', 'gain-message');
    showToast('Victory! You cleared the monsters.', '⚔️', true);

    // Auto-resolve pending move on victory
    if (STATE.party.pendingLocalX !== undefined && STATE.party.pendingLocalY !== undefined) {
      STATE.party.localX = STATE.party.pendingLocalX;
      STATE.party.localY = STATE.party.pendingLocalY;

      const locId = STATE.party.currentLocationId;
      autoDiscoverAdjacent(locId);

      const locState = STATE.locations[locId];
      if (locState) {
        const coordKey = `${STATE.party.localX},${STATE.party.localY}`;
        const tile = locState.placedTiles[coordKey];
        if (tile && tile.entity && tile.entity.type === 'enemy_army') {
          tile.entity.isDefeated = true;
        }
        if (locState.preGeneratedEntities[coordKey]) {
          const entity = locState.preGeneratedEntities[coordKey];
          if (entity && entity.type === 'enemy_army') {
            entity.isDefeated = true;
          }
        }
      }
      delete STATE.party.pendingLocalX;
      delete STATE.party.pendingLocalY;
    }

    const isWarHorn = STATE.combat.isWarHornBattle || STATE.combat.entityCoordKey === 'war_horn';
    setTimeout(() => {
      const locId = STATE.party.currentLocationId;
      import('./state.js').then(({ setScreen }) => {
        if (!locId) {
          setScreen('world');
        } else {
          const locData = Object.values(STATE.worldMap.locations).find(l => l.id === locId);
          setScreen((locData && locData.type === 'town') ? 'world' : 'location');
        }
        import('./location.js').then(({ checkRaidCleared }) => {
          checkRaidCleared(locId);
          if (isWarHorn) {
            const modal = document.getElementById('modal-raid-cleared');
            const modalShown = modal && !modal.classList.contains('hidden');
            if (!modalShown) {
              import('./ui/location.js').then(({ gatherAndAnimateLoot }) => {
                gatherAndAnimateLoot();
              });
            }
          }
        });
      });
    }, 1000);
  }
  else if (event === 'COMBAT_FLEE') {
    const stolenParts = Object.entries(data.stolen)
      .filter(([res, amt]) => amt > 0)
      .map(([res, amt]) => `${amt} ${res}`)
      .join(', ');
    const msg = stolenParts ? `Fled combat! Stolen resources during retreat: ${stolenParts}.` : 'Fled combat safely!';
    logWorld(msg, 'warn-message');
    showToast('You fled from combat!', '🏃', true);

    delete STATE.party.pendingLocalX;
    delete STATE.party.pendingLocalY;

    const locId = STATE.party.currentLocationId;
    import('./state.js').then(({ setScreen }) => {
      if (!locId) {
        setScreen('world');
      } else {
        const locData = Object.values(STATE.worldMap.locations).find(l => l.id === locId);
        setScreen((locData && locData.type === 'town') ? 'world' : 'location');
      }
    });
  }
  else if (event === 'COMBAT_DEFEAT') {
    logWorld('DEFEAT! All your Viking soldiers perished on the battlefield.', 'combat-message');
    showToast('Your band was wiped out!', '💀', true);
    // If gold is also 0, trigger Game Over modal, else force them to world map so they recruit
    if (STATE.resources.gold === 0) {
      showOverlay(elModalGameOver);
    } else {
      import('./state.js').then(({ setScreen }) => {
        setScreen('world');
      });
    }
  }
  else if (event === 'RELIC_SACRIFICED') {
    logWorld(`You sacrificed a ${data.relicId} relic to appease ${data.godName.toUpperCase()}.`, 'gain-message');
  }
  else if (event === 'RELIC_SACRICES_GOLD' || event === 'RELIC_SACRIFICED_GOLD') {
    logWorld(`Sacrificed a ${data.relicId} relic to maxed god ${data.godName.toUpperCase()}. Gained +5 Gold!`, 'gain-message');
    showToast(`Gained +5 Gold from sacrifice!`, '🪙');
  }
  else if (event === 'FAVOR_GAIN_ACTION') {
    logWorld(`Action Pleased the Gods: Gained 1 Favor with ${data.god.toUpperCase()} by ${data.reason}!`, 'gain-message');
    showToast(`Gained +1 Favor with ${data.god.toUpperCase()}!`, '✨');
  }
  else if (event === 'QUEST_MILESTONE') {
    showToast(`Quest Milestone ${data.index + 1} reached for ${data.god.toUpperCase()}!`, '✨', true);
  }
  else if (event === 'GOD_QUESTS_COMPLETE') {
    const godName = data;
    const lore = GOD_LORE[godName];
    elModalAscension.dataset.god = godName;
    elModalAscension.querySelector('.modal-box').className = `modal-box glass-panel animate-glow deity-${godName}`;
    elModalAscension.querySelector('.logo-text').innerText = `⚡ ${godName.toUpperCase()} CHAMPION ⚡`;
    elModalAscensionText.innerHTML = `You have completed all Milestones for <b>${lore.title}</b>!<br><br><b>Patron Buff unlocked:</b><br><i style="color: var(--color-${godName})">${lore.buff}</i>`;

    // Hide final ascension button
    document.getElementById('btn-ascend-victory').classList.add('hidden');
    document.getElementById('btn-ascend-continue').innerText = 'Continue';

    // Remove any previously injected buff button
    const prevBuff = document.getElementById('btn-ascend-buff');
    if (prevBuff) prevBuff.remove();

    // Inject active buff button
    const btnBuff = document.createElement('button');
    btnBuff.id = 'btn-ascend-buff';
    btnBuff.className = 'btn btn-primary';
    btnBuff.innerText = `Activate ${godName.charAt(0).toUpperCase() + godName.slice(1)}'s Blessing`;
    btnBuff.addEventListener('click', () => {
      STATE.activeBlessing = godName;
      notify('STATE_UPDATED');
      showToast(`${lore.icon} ${godName.charAt(0).toUpperCase() + godName.slice(1)}'s Blessing activated!`, lore.icon, true);
      hideOverlay(elModalAscension);
      if (STATE.combat.active) {
        STATE.combat.paused = false;
        notify('COMBAT_UPDATE');
      }
    });

    const btnContinue = document.getElementById('btn-ascend-continue');
    btnContinue.parentNode.insertBefore(btnBuff, btnContinue);

    if (STATE.combat.active) {
      STATE.combat.paused = true;
      notify('COMBAT_UPDATE');
    }
    showOverlay(elModalAscension);
  }
  else if (event === 'ASCENSION_TRIGGERED') {
    elModalAscension.dataset.god = 'odin';
    elModalAscension.querySelector('.modal-box').className = `modal-box glass-panel animate-glow deity-odin`;
    elModalAscension.querySelector('.logo-text').innerText = 'A S C E N S I O N';
    elModalAscensionText.innerHTML = `You have completed all milestones for <b>ALL 5 GODS</b>!<br><br>The gates of Valhalla are open. You have achieved final ascension!`;

    // Unhide final ascension button
    document.getElementById('btn-ascend-victory').classList.remove('hidden');
    document.getElementById('btn-ascend-continue').innerText = 'Stay in Midgard';

    // Remove any previously injected buff button
    const prevBuff = document.getElementById('btn-ascend-buff');
    if (prevBuff) prevBuff.remove();

    if (STATE.combat.active) {
      STATE.combat.paused = true;
      notify('COMBAT_UPDATE');
    }
    showOverlay(elModalAscension);
  }
  else if (event === 'RAID_SITE_CLEARED') {
    elModalRaidClearedText.innerHTML = `You have plundered and cleared the raiding site <b>${data.name}</b>!<br><br>All hostiles have been defeated and the area is secured.`;
    showOverlay(elModalRaidCleared);
    showToast(`Raid Site Cleared: ${data.name}!`, '⚔️', true);
  }
  else if (event === 'SAGA_VICTORY_ACHIEVED') {
    elModalSagaVictoryText.innerHTML = `All raiding sites in Midgard have been cleared of defenders!<br><br>Your saga is complete, and your name will echo forever in the halls of Valhalla!`;
    showOverlay(elModalSagaVictory);
    showToast(`Campaign Victory: Midgard Cleared!`, '👑', true);
  }
  else if (event === 'GAME_OVER') {
    showOverlay(elModalGameOver);
  }
}
