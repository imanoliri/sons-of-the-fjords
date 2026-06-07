/* ==========================================================================
   CONFIG: MOVEMENT — Sons of the Fjords
   ========================================================================== */

export const MOVEMENT_CONFIG = {
  // Food cost to move onto a tile of each terrain type
  terrainMoveCost: {
    water:    1,
    river:    1,
    plains:   3,
    forest:   3,
    snow:     3,
    mountain: 3,
    deep_water: null  // impassable
  },

  // Fog-of-war reveal radius around player position (Manhattan distance)
  fogRevealRadius: 2,

  // Emergency food settings
  sheepFoodYield: 15,
  starvationHpDamage: 3
};
