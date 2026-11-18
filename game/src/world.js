// The city of Coral Bay: road grid, districts, buildings, parks, beach and
// harbour, plus the geometry helpers (road / water / building tests) and the
// top-level game state that every other system reads and updates.
import {
  BEACH_X, CAR_COLORS, DISTRICTS, PED_NAMES, PED_SHIRTS, ROAD_GAP, ROAD_W,
  WATER_X, WORLD_H, WORLD_W,
} from './config.js';
import { chance, clamp, createRandom, pick, randInt, randRange } from './random.js';

export const ROAD_XS = [];
export const ROAD_YS = [];
for (let x = ROAD_GAP; x < WORLD_W - 120; x += ROAD_GAP) ROAD_XS.push(x);
for (let y = ROAD_GAP; y < WORLD_H - 120; y += ROAD_GAP) ROAD_YS.push(y);

export function isRoad(x, y) {
  if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return false;
  for (const rx of ROAD_XS) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

export function isWater(x, y) {
  return x >= WATER_X && y >= 0 && y < WORLD_H;
}

export function isBeach(x, y) {
  return x >= BEACH_X && x < WATER_X && y >= 0 && y < WORLD_H;
}

export function nearestRoadX(x) {
  let best = ROAD_XS[0];
  for (const rx of ROAD_XS) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}

export function nearestRoadY(y) {
  let best = ROAD_YS[0];
  for (const ry of ROAD_YS) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}

// A point on a road centre line, away from the beach.
export function randomRoadPoint(rng) {
  if (rng() < 0.5) {
    const rx = pick(rng, ROAD_XS);
    return { x: rx, y: randRange(rng, 200, WORLD_H - 200) };
  }
  const ry = pick(rng, ROAD_YS);
  return { x: randRange(rng, 200, BEACH_X - 200), y: ry };
}

// A point on a sidewalk (just off a road, on a block edge).
export function randomSidewalkPoint(rng) {
  const p = randomRoadPoint(rng);
  const off = ROAD_W / 2 + 14;
  if (rng() < 0.5) p.x += rng() < 0.5 ? off : -off;
  else p.y += rng() < 0.5 ? off : -off;
  return { x: clamp(p.x, 40, BEACH_X - 40), y: clamp(p.y, 40, WORLD_H - 40) };
}

function buildCity(rng) {
  const buildings = [];
  const parks = [
    { x: 440, y: 440, w: 320, h: 320, name: 'Palm Plaza' },
    { x: 2040, y: 1640, w: 320, h: 320, name: 'Harbor Green' },
    { x: 1240, y: 2040, w: 320, h: 320, name: 'Old Town Gardens' },
  ];
  // Palm trees line the beach and the marina front, so the east edge reads
  // as a coast instead of a flat strip of sand.
  const palms = [];
  for (let y = 120; y < WORLD_H - 60; y += 170) {
    palms.push({ x: BEACH_X - 40 + randRange(rng, -8, 8), y: y + randRange(rng, -20, 20) });
  }
  for (let x = 1700; x < BEACH_X - 120; x += 260) {
    palms.push({ x, y: 240 + randRange(rng, -14, 14) });
  }
  const blockW = ROAD_GAP - ROAD_W - 24;
  for (let bx = 0; bx < ROAD_XS.length; bx += 1) {
    for (let by = 0; by < ROAD_YS.length; by += 1) {
      const bx0 = ROAD_XS[bx] + ROAD_W / 2 + 12;
      const by0 = ROAD_YS[by] + ROAD_W / 2 + 12;
      const cx = bx0 + blockW / 2;
      const cy = by0 + blockW / 2;
      let inPark = false;
      for (const park of parks) {
        if (cx > park.x - 40 && cx < park.x + park.w + 40 && cy > park.y - 40 && cy < park.y + park.h + 40) inPark = true;
      }
      if (inPark || cx > BEACH_X - 160) continue;
      const district = DISTRICTS.find((d) => cx >= d.x0 && cx < d.x1 && cy >= d.y0 && cy < d.y1) || DISTRICTS[0];
      const tall = district.name === 'Downtown' && chance(rng, 0.55);
      const w = tall ? randRange(rng, 130, 200) : randRange(rng, 90, 170);
      const h = tall ? randRange(rng, 130, 200) : randRange(rng, 90, 170);
      buildings.push({
        x: cx - w / 2, y: cy - h / 2, w, h,
        color: district.tone,
        roof: pick(rng, ['#5a4a3a', '#3a4a5a', '#6a5a4a', '#4a3a2e', '#445566']),
        tall,
        windows: randInt(rng, 2, 5),
        district: district.name,
      });
    }
  }
  return { buildings, parks, palms };
}

export function collidesBuilding(city, x, y, radius) {
  for (const b of city.buildings) {
    if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of buildings and the world edge; returns true on a hit.
export function resolveBuildingCollision(city, obj, radius) {
  const b = collidesBuilding(city, obj.x, obj.y, radius);
  if (!b) return false;
  const left = obj.x - (b.x - radius);
  const right = b.x + b.w + radius - obj.x;
  const top = obj.y - (b.y - radius);
  const bottom = b.y + b.h + radius - obj.y;
  const min = Math.min(left, right, top, bottom);
  if (min === left) obj.x = b.x - radius;
  else if (min === right) obj.x = b.x + b.w + radius;
  else if (min === top) obj.y = b.y - radius;
  else obj.y = b.y + b.h + radius;
  return true;
}

export function clampToWorld(obj, margin) {
  obj.x = clamp(obj.x, margin, WORLD_W - margin);
  obj.y = clamp(obj.y, margin, WORLD_H - margin);
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
export function createGame(seed) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const state = {
    seed,
    rng,
    city,
    time: 0, // real seconds played
    clock: 8 * 3600 + 20 * 60, // 08:20 in-game
    cash: 120,
    wanted: 0,
    heat: 0,
    lastCrimeAt: -999,
    screen: 'title',
    paused: false,
    storyDone: false,
    banner: null, // { text, sub, until }
    message: null, // small toast { text, until }
    camera: { x: 800, y: 800 },
    player: {
      x: 800, y: 860, angle: -Math.PI / 2, hp: 100,
      onFoot: true, car: null, weapon: 'fists', ammo: 0,
      punchCd: 0, shootCd: 0, speed: 0, moving: false,
    },
    cars: [],
    peds: [],
    cops: [],
    policeCars: [],
    bullets: [],
    particles: [],
    pickups: [],
    skids: [], // fading tyre marks from hard turns
    shake: 0, // camera shake left, in pixels; decays every frame
    mission: {
      index: 0, stage: 'idle', // idle | active | done
      step: 0, target: null, packagesLeft: 0,
      timer: 0, objective: 'Find the yellow M marker to start work.',
      passenger: null,
    },
    stats: { crimes: 0, carsStolen: 0, missionsDone: 0, pedsHit: 0 },
    shotMode: false,
    muted: false,
  };

  // Traffic cars, parked cars and pedestrians, spread over the city.
  for (let i = 0; i < 16; i += 1) {
    const p = randomRoadPoint(rng);
    const horizontal = Math.abs(p.x - nearestRoadX(p.x)) < Math.abs(p.y - nearestRoadY(p.y));
    state.cars.push({
      kind: pick(rng, ['sedan', 'sedan', 'sedan', 'sport', 'truck', 'taxi']),
      color: pick(rng, CAR_COLORS),
      x: horizontal ? p.x : nearestRoadX(p.x) + (rng() < 0.5 ? -20 : 20),
      y: horizontal ? nearestRoadY(p.y) + (rng() < 0.5 ? -20 : 20) : p.y,
      angle: horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      speed: randRange(rng, 90, 150),
      cruise: randRange(rng, 110, 170),
      driver: 'traffic',
      hp: 100,
      honkCd: randRange(rng, 2, 9),
    });
  }
  for (let i = 0; i < 10; i += 1) {
    const p = randomRoadPoint(rng);
    state.cars.push({
      kind: pick(rng, ['sedan', 'sedan', 'sport', 'truck']),
      color: pick(rng, CAR_COLORS),
      x: nearestRoadX(p.x) + (rng() < 0.5 ? -ROAD_W / 2 + 16 : ROAD_W / 2 - 16),
      y: p.y,
      angle: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2,
      speed: 0, cruise: 0, driver: 'parked', hp: 100, honkCd: 0,
    });
  }
  for (let i = 0; i < 26; i += 1) {
    const p = randomSidewalkPoint(rng);
    state.peds.push({
      name: pick(rng, PED_NAMES),
      x: p.x, y: p.y, angle: randRange(rng, 0, Math.PI * 2),
      speed: randRange(rng, 40, 75), shirt: pick(rng, PED_SHIRTS),
      state: 'walk', tx: p.x, ty: p.y, down: 0, panic: 0, hp: 30,
    });
  }
  // A pistol and a health pack near the start, so combat is discoverable.
  state.pickups.push({ kind: 'pistol', x: 860, y: 940, bob: 0 });
  state.pickups.push({ kind: 'health', x: 740, y: 940, bob: 0 });
  state.pickups.push({ kind: 'cash', x: 800, y: 1020, bob: 0 });
  return state;
}

export function resetGame(state) {
  const fresh = createGame(state.seed);
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
}
