/* ==========================================================================
   CONFIG: GODS / PANTHEON — Sons of the Fjords
   ========================================================================== */

export const GODS_CONFIG = {
  // Favor limits
  favorMin: -5,
  favorMax: 5,

  // Pentagram opposites (pleasing one reduces these)
  pentagramOpposites: {
    odin:  ['freya', 'hel'],
    thor:  ['hel',   'loki'],
    freya: ['loki',  'odin'],
    hel:   ['odin',  'thor'],
    loki:  ['thor',  'freya']
  },

  // Full lore per god (used for tooltips and quest screen)
  lore: {
    odin: {
      title: 'Odin — The Allfather',
      icon: '🔮',
      colorVar: '--color-odin',
      relic: 'Shard of Gungnir',
      favorSteps: [
        '1. Explore Raid Sites on the world map',
        '2. Find a 🏆 Dolmen shrine tile — walk onto it to auto-collect the <b>Shard of Gungnir</b>',
        '3. Sail to any 🏘️ Town on the world map',
        '4. Open the Town screen → Temple section → click <b>Appease Odin</b>',
        '5. Repeat: each sacrifice grants +1 Favor toward the next milestone',
        '6. Alternative: Kill 3 Wolves (🐺) or 1 Giant (❄️) to gain 1 Favor'
      ],
      buff: 'Huntsmen gain +2 Attack Range & +1 DMG per turn.',
      wrath: 'Wrath: Random unit loses 1 HP every 3 world steps.',
      milestoneEffects: [
        'Fog of war reveals 1 extra tile on each move.',
        'Scouts reveal a 2-tile radius instead of 1.',
        'All Huntsmen gain +1 Attack Range.',
        'Berserkers gain +1 DMG per combat tick.',
        null
      ]
    },
    thor: {
      title: 'Thor — The Thunderer',
      icon: '⚡',
      colorVar: '--color-thor',
      relic: "Mjolnir's Core",
      favorSteps: [
        '1. Explore Raid Sites on the world map',
        "2. Find a 🏆 Dolmen shrine tile — walk onto it to auto-collect <b>Mjolnir's Core</b>",
        '3. Sail to any 🏘️ Town on the world map',
        '4. Open the Town screen → Temple section → click <b>Appease Thor</b>',
        '5. Repeat: each sacrifice grants +1 Favor toward the next milestone',
        '6. Alternative: Kill 3 Draugrs (🧟) or 1 Lindwurm (🐉) to gain 1 Favor'
      ],
      buff: 'Berserkers gain +3 DMG and +1 Speed.',
      wrath: 'Wrath: Storms during land travel cost +1 extra Food per step.',
      milestoneEffects: [
        'Berserkers gain +1 DMG in combat.',
        'Berserkers move +1 Speed per tick.',
        'Enemy spawn rate slowed by 10%.',
        'All units gain +1 max HP.',
        null
      ]
    },
    freya: {
      title: 'Freya — Goddess of Love & Life',
      icon: '🌸',
      colorVar: '--color-freya',
      relic: "Freya's Amber Tear",
      favorSteps: [
        '1. Explore Raid Sites on the world map',
        "2. Find a 🏆 Dolmen shrine tile — walk onto it to auto-collect <b>Freya's Amber Tear</b>",
        '3. Sail to any 🏘️ Town on the world map',
        '4. Open the Town screen → Temple section → click <b>Appease Freya</b>',
        '5. Repeat: each sacrifice grants +1 Favor toward the next milestone',
        '6. Alternative: Sell 3 Sheep (🐑) or 10 Wood (🪵) to gain 1 Favor'
      ],
      buff: 'Shieldmaidens heal 2 HP per combat tick when not in melee.',
      wrath: 'Wrath: Recruited units start with -10 max HP.',
      milestoneEffects: [
        'Shieldmaidens gain +5 max HP.',
        'Any unit below 25% HP heals 1 HP/tick.',
        'Shieldmaidens gain +2 DMG.',
        'Shieldmaidens block 1 DMG per hit.',
        null
      ]
    },
    hel: {
      title: 'Hel — Goddess of the Underworld',
      icon: '💀',
      colorVar: '--color-hel',
      relic: "Hel's Urn of Ash",
      favorSteps: [
        '1a. <b>Dolmen path:</b> Find a 🏆 Dolmen shrine in a Raid Site → auto-collect <b>Hel\'s Urn of Ash</b>',
        '1b. <b>Burial path:</b> Find a 🪦 Burial Mound in a Raid Site → choose <b>Sacrifice Sheep</b> (costs 1 🐑)',
        '2. Sail to any 🏘️ Town on the world map',
        '3. Open the Town screen → Temple section → click <b>Appease Hel</b>',
        '4. Repeat: each sacrifice grants +1 Favor toward the next milestone'
      ],
      buff: 'Fallen enemies have a 20% chance to rise as allied undead for 3 ticks.',
      wrath: 'Wrath: Dead band members cannot be replaced for 5 turns.',
      milestoneEffects: [
        'Enemies deal -1 DMG.',
        'Player units survive lethal hits once with 1 HP (once per battle).',
        'Slain enemies drop +1 extra Gold.',
        'Gold cost to recruit is reduced by 1.',
        null
      ]
    },
    loki: {
      title: 'Loki — The Trickster',
      icon: '🎭',
      colorVar: '--color-loki',
      relic: "Loki's Trickster Coin",
      favorSteps: [
        "1a. <b>Dolmen path:</b> Find a 🏆 Dolmen shrine in a Raid Site → auto-collect <b>Loki's Trickster Coin</b>",
        '1b. <b>Plunder path:</b> Find a 🪦 Burial Mound in a Raid Site → choose <b>Plunder Mound</b> (+10 Gold, also pleases Loki)',
        '2. Sail to any 🏘️ Town on the world map',
        '3. Open the Town screen → Temple section → click <b>Appease Loki</b>',
        '4. Repeat: each sacrifice grants +1 Favor toward the next milestone'
      ],
      buff: 'Once per battle, your weakest unit swaps position with a random enemy.',
      wrath: 'Wrath: Random event triggers each world move (ambush, resource loss, or unit injury).',
      milestoneEffects: [
        'Chest loot gives +1 extra Gold.',
        'Enemy attack speed reduced by 10%.',
        'One enemy per wave spawns confused (fights allies for 2 ticks).',
        'Town prices reduced by 1 Gold each.',
        null
      ]
    }
  }
};
