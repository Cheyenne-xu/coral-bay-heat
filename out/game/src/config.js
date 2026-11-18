// Coral Bay Heat — shared constants for the open-world city game.
// All names, districts and characters here are invented for this game.
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_GAP = 400; // distance between road centre lines
export const ROAD_W = 96; // road width in pixels
export const BEACH_X = 2920; // east edge: sand and water begin here
export const WATER_X = 3020;

export const GAME_TITLE = 'CORAL BAY HEAT';
export const CITY_NAME = 'Coral Bay';
export const SAVE_KEY = 'coralbayheat-save-v1';

export const PLAYER = {
  walkSpeed: 170,
  runSpeed: 285,
  radius: 14,
  maxHp: 100,
  punchDamage: 12,
  punchRange: 36,
  punchCooldown: 0.35,
};

export const CAR = {
  accel: 430,
  brake: 640,
  reverseAccel: 230,
  maxSpeed: 440,
  maxReverse: 150,
  turnRate: 2.7,
  radius: 22,
};

export const WANTED_HEAT_PER_STAR = 20; // heat 0..100 maps to stars 0..5

export const DISTRICTS = [
  { name: 'Downtown', x0: 0, y0: 0, x1: 1600, y1: 1200, tone: '#c98f5f' },
  { name: 'Marina District', x0: 1600, y0: 0, x1: 2920, y1: 1200, tone: '#5fa8c9' },
  { name: 'Old Town', x0: 0, y0: 1200, x1: 1600, y1: 2400, tone: '#c9a45f' },
  { name: 'Harbor South', x0: 1600, y0: 1200, x1: 2920, y1: 2400, tone: '#7fae6a' },
];

export const CAR_COLORS = [
  '#d94f3d', '#3d7ad9', '#e8c33a', '#e8e8e8', '#2e2e38', '#3fae6a',
  '#c96ad9', '#e07b2e', '#7a5a3a', '#4fb8b0', '#b03060', '#8a9aa8',
];

export const PED_SHIRTS = [
  '#e86a6a', '#6a9ae8', '#6ad98a', '#e8d06a', '#c96ad9', '#e8e8e8',
  '#f09a4a', '#4fc9c2', '#9a6ad9', '#a8c94f',
];

export const PED_NAMES = [
  'Mara', 'Tico', 'Lena', 'Bo', 'Sofia', 'Drex', 'Nia', 'Kip',
  'Rosa', 'Jules', 'Paz', 'Hank', 'Vera', 'Otis', 'Cleo', 'Max',
];

// Game clock: one in-game hour passes every 90 real seconds.
export const CLOCK_RATE = 3600 / 90;
