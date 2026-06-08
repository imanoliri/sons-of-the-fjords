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

  modifiers: {
    wrath: {
      freya: { maxHpPenalty: -10 },
      thor: { extraLandFoodCost: 1, extraSeaWoodCost: 1 },
      odin: { stepsTrigger: 3, hpLoss: 3 },
      hel: { blockRecruitment: true },
      loki: { maxGoldLoss: 3, maxInjuryDmg: 3, maxFoodLoss: 2 }
    },
    milestones: {
      odin: [
        { index: 1, scoutRadius: 2 },
        { index: 2, targetType: 'huntsman', range: 1 },
        { index: 3, targetType: 'berserker', dmg: 1 }
      ],
      thor: [
        { index: 0, targetType: 'berserker', dmg: 1 },
        { index: 1, targetType: 'berserker', leap: 1 },
        { index: 2, doubleAttackChance: 0.10 },
        { index: 3, targetType: 'all', maxHp: 5 }
      ],
      freya: [
        { index: 0, targetType: 'shieldmaiden', maxHp: 5 },
        { index: 1, healThreshold: 0.5, healAmount: 1 },
        { index: 2, targetType: 'shieldmaiden', dmg: 2 },
        { index: 3, targetType: 'shieldmaiden', blockAmount: 1 }
      ],
      hel: [
        { index: 0, enemyDmgModifier: -1 },
        { index: 1, surviveLethal: true },
        { index: 2, goldDrop: 1 },
        { index: 3, enemySpeedModifier: -0.20, enemyMissChance: 0.20 }
      ],
      loki: [
        { index: 0, chestGoldBonus: 1 },
        { index: 1, enemyMissChance: 0.20 },
        { index: 2, confuseChance: 0.25, confuseDurationTicks: 2 },
        { index: 3, priceReduction: 1 }
      ]
    },
    blessings: {
      odin: { targetType: 'huntsman', range: 2, dmg: 1 },
      thor: { targetType: 'berserker', dmg: 3, leap: 1 },
      freya: { targetType: 'shieldmaiden', healAmount: 2 },
      hel: { targetType: 'enemy_hurt', threshold: 0.5, raiseChance: 0.5, raiseDurationTicks: 3 },
      loki: { targetType: 'enemy_spawn', charmChance: 0.25, charmDurationTicks: 2 }
    }
  },

  // Full lore per god (used for tooltips and quest screen)
  lore: {
    odin: {
      title: 'Odin — The Allfather',
      icon: '🔮',
      color: 'var(--color-odin)',
      relic: 'Shard of Gungnir',
      favorAction: 'Appease with <b>Shard of Gungnir</b> at a Town Shrine, or kill Wolves/Giants.',
      wrath: 'Wrath: Random unit loses 3 HP every 3 world steps.',
      milestoneEffects: [
        'Strategist: Soldiers can attack adjacent lanes.',
        'Scouts reveal a 2-tile radius instead of 1.',
        'All Huntsmen gain +1 Attack Range.',
        'Berserkers gain +1 DMG.',
        null
      ],
      buff: 'Huntsmen gain +2 Attack Range & +1 DMG.'
    },
    thor: {
      title: 'Thor — The Thunderer',
      icon: '⚡',
      color: 'var(--color-thor)',
      relic: "Mjolnir's Core",
      favorAction: "Appease with <b>Mjolnir's Core</b> at a Town Shrine, or kill Draugrs/Lindwurms.",
      wrath: 'Wrath: Storms during travel cost +1 extra Food on land and +1 extra Wood on sea per step.',
      milestoneEffects: [
        'Berserkers gain +1 DMG.',
        'Berserkers gain Leap of 1.',
        'All soldiers gain 10% chance for a Double Attack.',
        'All units gain +5 max HP.',
        null
      ],
      buff: 'Berserkers gain +3 DMG and Leap of 1.'
    },
    freya: {
      title: 'Freya — Goddess of Love & Life',
      icon: '🌸',
      color: 'var(--color-freya)',
      relic: "Freya's Amber Tear",
      favorAction: "Appease with <b>Freya's Amber Tear</b> at a Town Shrine, or trade Sheep/Wood.",
      wrath: 'Wrath: Recruited units start with -10 max HP.',
      milestoneEffects: [
        'Shieldmaidens gain +5 max HP.',
        'Any unit below 50% HP heals 1 HP/tick.',
        'Shieldmaidens gain +2 DMG.',
        'Shieldmaidens block 1 DMG per hit.',
        null
      ],
      buff: 'Shieldmaidens heal 2 HP per combat tick when not in melee.'
    },
    hel: {
      title: 'Hel — Goddess of the Underworld',
      icon: '💀',
      color: 'var(--color-hel)',
      relic: "Hel's Urn of Ash",
      favorAction: "Appease with <b>Hel's Urn of Ash</b> at a Town Shrine, or Sacrifice Sheep at Burial Mounds.",
      wrath: 'Wrath: Dead band members cannot be replaced for 5 turns.',
      milestoneEffects: [
        'Enemies deal -1 DMG.',
        'Player units survive lethal hits once with 1 HP (once per battle).',
        'Slain enemies drop 1 Gold.',
        'Enemies 20% chance to miss a step and 20% chance to miss attacks.',
        null
      ],
      buff: 'Necromancy: Hurt enemies (under 50% HP) have a once-in-a-battle 50% chance to rise as allied undead for 3 ticks.'
    },
    loki: {
      title: 'Loki — The Trickster',
      icon: '🎭',
      color: 'var(--color-loki)',
      relic: "Loki's Trickster Coin",
      favorAction: "Appease with <b>Loki's Trickster Coin</b> at a Town Shrine, or Plunder Burial Mounds.",
      wrath: 'Wrath: Random event triggers each world move (ambush, resource loss, or unit injury).',
      milestoneEffects: [
        'Chest loot gives +1 extra Gold.',
        'Enemies have 20% chance to miss attacks.',
        '25% chance for one enemy per wave to spawn confused (fights allies for 2 ticks).',
        'Town prices reduced by 1 Gold each.',
        null
      ],
      buff: 'Chaos Mirror: 25% chance for spawning monsters to be Charmed, spawning in front of enemies and fighting for you for 2 ticks.'
    }
  }
};
