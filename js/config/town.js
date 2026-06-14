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
    shieldmaiden: { gold: 5, food: 10 },
    berserker:    { gold: 7, sheep: 1 },
    huntsman:     { gold: 6, wood: 3 },
    huskarl:      { gold: 12, food: 15, wood: 5 },
    runecaster:   { gold: 15, food: 15, wood: 8 }
  },

  // Dynamic pricing coefficients and limits based on surrounding geography
  dynamicPricing: {
    food: {
      baseCost: 2,
      minCost: 1,
      maxCost: 5,
      foodGained: 5
    },
    woodBuy: {
      baseCost: 2,
      minCost: 1,
      maxCost: 5,
      woodGained: 2,
      scarceBonus: 2
    },
    sheepBuy: {
      baseCost: 6,
      minCost: 3,
      maxCost: 10,
      sheepGained: 1
    },
    sheepSell: {
      baseGain: 4,
      minGain: 1,
      maxGain: 8,
      sheepSold: 1,
      scarceBonus: 2
    },
    woodSell: {
      baseGain: 4,
      minGain: 1,
      maxGain: 8,
      woodSold: 10,
      scarceBonus: 2
    }
  }
};
