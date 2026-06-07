/* ==========================================================================
   CONFIG: TOWN TRADE & SERVICES — Sons of the Fjords
   ========================================================================== */

export const TOWN_CONFIG = {
  // Market Stall trades: each entry is { label, cost: {resource: delta}, gain: {resource: delta} }
  trades: [
    { id: 'buy-food',  label: 'Buy 5 Food',   cost: { gold: -2 }, gain: { food:  5  } },
    { id: 'buy-wood',  label: 'Buy 2 Wood',   cost: { gold: -2 }, gain: { wood:  2  } },
    { id: 'sell-sheep',label: 'Sell 1 Sheep', cost: { sheep: -1}, gain: { gold:  4  } },
    { id: 'sell-wood', label: 'Sell 10 Wood', cost: { wood: -10}, gain: { gold:  4  } },
    { id: 'buy-sheep', label: 'Buy 1 Sheep',  cost: { gold: -6 }, gain: { sheep: 1  } }
  ],

  // Shipyard
  repairHullCost: { wood: -3 },

  // Great Hall recruit costs (gold only)
  recruitCosts: {
    shieldmaiden: 5,
    berserker:    7,
    huntsman:     6
  },

  // Divine Patron switch cost
  patronSwitchCost: 5,

  // Seidr Shrine: which relic belongs to which god
  shrineRelics: {
    'Shard of Gungnir':       'odin',
    "Mjolnir's Core":         'thor',
    "Freya's Amber Tear":     'freya',
    "Hel's Urn of Ash":       'hel',
    "Loki's Trickster Coin":  'loki'
  }
};
