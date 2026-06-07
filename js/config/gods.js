/* ==========================================================================
   CONFIG: GODS / PANTHEON — Sons of the Fjords
   ========================================================================== */

export const GODS_CONFIG = {
  // Favor limits
  favorMin: -5,
  favorMax: 5,

  // Divine Patron switch cost in town
  patronSwitchCost: 5,

  // Pentagram opposites (pleasing one reduces these)
  pentagramOpposites: {
    odin: ['freya', 'hel'],
    thor: ['hel', 'loki'],
    freya: ['loki', 'odin'],
    hel: ['odin', 'thor'],
    loki: ['thor', 'freya']
  },

  // Alternative favor targets
  alternativeFavor: {
    odin: { wolvesTarget: 2, giantsTarget: 1 },
    thor: { draugrsTarget: 2, lindwurmsTarget: 1 },
    freya: { sheepTarget: 2, woodTarget: 5 }
  },

  // Relics & magic objects
  magicObjects: {
    odin: "Shard of Gungnir",
    thor: "Mjolnir's Core",
    freya: "Freya's Amber Tear",
    hel: "Hel's Urn of Ash",
    loki: "Loki's Trickster Coin"
  },

  relicToGod: {
    'Shard of Gungnir': 'odin',
    "Mjolnir's Core": 'thor',
    "Freya's Amber Tear": 'freya',
    "Hel's Urn of Ash": 'hel',
    "Loki's Trickster Coin": 'loki'
  },

  // Encounter actions
  encounterActions: {
    plunderMound: {
      cost: {},
      gain: { gold: 10 },
      favorChanges: { loki: 1 },
      toast: 'Plundered Burial Mound! Gained +10 Gold (Thor displeased, Loki pleased).',
      icon: '🪦'
    },
    sacrificeSheep: {
      cost: { sheep: -1 },
      gain: {},
      favorChanges: { hel: 1 },
      toast: 'Sacrificed a sheep to appease Hel.',
      icon: '🐑'
    }
  },

  // Combat blessings, milestones, and wrath modifiers
  modifiers: {
    blessings: {
      odin: { targetType: 'huntsman', range: 2, dmg: 1 },
      thor: { targetType: 'berserker', dmg: 3, speed: 1 }
    },
    milestones: {
      odin: [
        { index: 2, targetType: 'huntsman', range: 1 },
        { index: 3, targetType: 'berserker', dmg: 1 }
      ],
      thor: [
        { index: 0, targetType: 'berserker', dmg: 1 },
        { index: 1, targetType: 'berserker', speed: 1 },
        { index: 3, targetType: 'all', maxHp: 5 }
      ],
      freya: [
        { index: 0, targetType: 'shieldmaiden', maxHp: 5 },
        { index: 2, targetType: 'shieldmaiden', dmg: 2 }
      ]
    },
    wrath: {
      freya: { maxHpPenalty: -10 }
    }
  },

  // Full lore per god (used for tooltips and quest screen)
  lore: {
    odin: {
      title: 'Odin — The Allfather',
      icon: '🔮',
      color: 'var(--color-odin)',
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
      color: 'var(--color-thor)',
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
      wrath: 'Wrath: Storms during travel cost +1 extra Food on land and +1 extra Wood on sea per step.',
      milestoneEffects: [
        'Berserkers gain +1 DMG in combat.',
        'Berserkers move +1 Speed per tick.',
        'Enemy spawn rate slowed by 10%.',
        'All units gain +5 max HP.',
        null
      ]
    },
    freya: {
      title: 'Freya — Goddess of Love & Life',
      icon: '🌸',
      color: 'var(--color-freya)',
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
      color: 'var(--color-hel)',
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
      color: 'var(--color-loki)',
      relic: "Loki's Trickster Coin",
      favorSteps: [
        "1a. <b>Dolmen path:</b> Find a 🏆 Dolmen shrine in a Raid Site → auto-collect <b>Loki's Trickster Coin</b>",
        '1b. <b>Plunder path:</b> Find a 🪦 Burial Mound in a Raid Site → choose <b>Plunder Mound</b> (+10 Gold, also pleases Loki)',
        '2. Sail to any 🏘️ Town on the world map',
        '3. Open the Town screen → Temple section → click <b>Appease Loki</b>',
        '4. Repeat: each sacrifice grants +1 Favor toward the next milestone'
      ],
      buff: 'Chaos Mirror: 25% chance for spawning monsters to be Charmed, spawning on the left and fighting for you.',
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
