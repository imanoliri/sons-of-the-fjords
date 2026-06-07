/* ==========================================================================
   CONFIG: SOLDIERS & STARTING STATE — Sons of the Fjords
   ========================================================================== */

export const SOLDIERS_CONFIG = {
  // Starting resources
  startingResources: {
    gold: 15,
    food: 30,
    wood: 5,
    sheep: 2
  },

  // Starting band (fixed named heroes)
  startingBand: [
    { id: 1, name: 'Sigrid', type: 'shieldmaiden', hp: 60, maxHp: 60, dmg: 4, speed: 2, range: 1 },
    { id: 2, name: 'Halvar', type: 'berserker',    hp: 45, maxHp: 45, dmg: 8, speed: 3, range: 1 },
    { id: 3, name: 'Aslaug', type: 'huntsman',     hp: 35, maxHp: 35, dmg: 6, speed: 2, range: 4 }
  ],

  // Stats for newly recruited soldiers (by type)
  recruitStats: {
    shieldmaiden: { hp: 60, maxHp: 60, dmg: 4, speed: 2, range: 1 },
    berserker:    { hp: 45, maxHp: 45, dmg: 8, speed: 3, range: 1 },
    huntsman:     { hp: 35, maxHp: 35, dmg: 6, speed: 2, range: 4 }
  },

  // Random name pools per type
  recruitNames: {
    shieldmaiden: ['Brynhild', 'Hervor', 'Gerd', 'Signy'],
    berserker:    ['Gunnar', 'Torstein', 'Ragnar', 'Bjorn'],
    huntsman:     ['Egil', 'Ullr', 'Solveig', 'Kari']
  }
};
