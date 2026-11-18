// Screenshot scenes behind ?shot=title|drive|chase|mission (with &seed=N).
// Each scene stages a real game state directly — a fresh city, the player,
// traffic, police and a mission marker placed where the camera can see them
// — then the main loop paints that frozen frame, so the same seed always
// gives the same picture. No autopilot, no simulation: the frame is staged
// from the game's own entities and renderer.
import { createGame, randomRoadPoint } from './world.js';
import { startMission } from './missions.js';
import { addCrime } from './player.js';

function placeTraffic(state, spots) {
  let used = 0;
  for (let i = 0; i < state.cars.length && used < spots.length; i += 1) {
    const car = state.cars[i];
    if (car.driver === 'player') continue; // never overwrite the player's car
    car.x = spots[used].x;
    car.y = spots[used].y;
    car.angle = spots[used].angle;
    car.speed = spots[used].speed || 0;
    car.driver = spots[used].driver || 'traffic';
    car.color = spots[used].color || car.color;
    used += 1;
  }
}

function placePeds(state, spots) {
  for (let i = 0; i < spots.length && i < state.peds.length; i += 1) {
    const ped = state.peds[i];
    ped.x = spots[i].x;
    ped.y = spots[i].y;
    ped.angle = spots[i].angle || 0;
    ped.state = 'walk';
  }
}

// Stage the named scene on a fresh game state and return the screen to draw.
export function stageShot(name, state) {
  const fresh = createGame(state.seed);
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
  state.shotMode = true;
  const p = state.player;

  if (name === 'drive') {
    // Midday on Palm Ave: Rico driving a red sports car through traffic,
    // Job 1 active, marker ahead.
    state.clock = 13 * 3600 + 30 * 60;
    state.cash = 320;
    const car = state.cars.find((c) => c.kind === 'sport') || state.cars[0];
    car.x = 800; car.y = 800; car.angle = 0; car.speed = 300;
    car.driver = 'player'; car.color = '#d94f3d';
    p.onFoot = false; p.car = car; p.x = 800; p.y = 800; p.angle = 0;
    placeTraffic(state, [
      { x: 1080, y: 780, angle: 0, speed: 130, color: '#3d7ad9' },
      { x: 560, y: 820, angle: Math.PI, speed: 120, color: '#e8c33a' },
      { x: 800, y: 1180, angle: Math.PI / 2, speed: 110, color: '#3fae6a' },
      { x: 1240, y: 420, angle: 0, speed: 140, color: '#e8e8e8' },
    ]);
    placePeds(state, [
      { x: 700, y: 740, angle: Math.PI / 2 },
      { x: 960, y: 860, angle: -Math.PI / 2 },
      { x: 1180, y: 760, angle: Math.PI },
    ]);
    state.camera.x = 800;
    state.camera.y = 800;
    state.mission.index = 0;
    state.mission.stage = 'active';
    state.mission.step = 0;
    state.mission.objective = 'Job 1 — Sunset Taxi: pick up the client at Palm Plaza.';
    state.screen = 'play';
    return { screen: 'play' };
  }

  if (name === 'chase') {
    // Dusk getaway: three stars, two CBPD interceptors on Rico's tail,
    // Job 3 in progress, skid smoke behind the car.
    state.clock = 19 * 3600 + 10 * 60;
    state.cash = 540;
    addCrime(state, 65, '');
    state.message = null;
    const car = state.cars.find((c) => c.kind === 'sport') || state.cars[0];
    car.x = 1200; car.y = 1200; car.angle = 0; car.speed = 400;
    car.driver = 'player'; car.color = '#e8c33a';
    p.onFoot = false; p.car = car; p.x = 1200; p.y = 1200; p.angle = 0;
    p.hp = 68;
    state.policeCars.push(
      { x: 980, y: 1180, angle: 0, speed: 380, hp: 120, siren: true, stuck: 0 },
      { x: 940, y: 1240, angle: 0.1, speed: 360, hp: 120, siren: true, stuck: 0 },
    );
    state.cops.push({ x: 1420, y: 1140, angle: Math.PI, speed: 165, hp: 40, down: false, arrest: 0 });
    placeTraffic(state, [
      { x: 1560, y: 1180, angle: 0, speed: 120, color: '#3d7ad9' },
      { x: 1200, y: 1560, angle: Math.PI / 2, speed: 100, color: '#e8e8e8' },
    ]);
    for (let i = 0; i < 10; i += 1) {
      state.particles.push({
        x: 1200 - i * 22, y: 1200 + (i % 2 === 0 ? 12 : -12),
        vx: -40, vy: 0, life: 0.6, maxLife: 0.6, color: '#9aa0a8', size: 5,
      });
    }
    state.camera.x = 1200;
    state.camera.y = 1200;
    state.mission.index = 2;
    state.mission.stage = 'active';
    state.mission.step = 0;
    state.mission.objective = 'Job 3 — Getaway Driver: reach the hideout, lose the cops!';
    state.screen = 'play';
    return { screen: 'play' };
  }

  if (name === 'mission') {
    // Morning at the harbor: Rico on foot with a pistol, a package in reach,
    // a cop closing in, Job 2 active.
    state.clock = 10 * 3600 + 5 * 60;
    state.cash = 410;
    p.x = 1560; p.y = 2000; p.angle = -0.5; p.hp = 82;
    p.weapon = 'pistol'; p.ammo = 18;
    state.pickups.push({ kind: 'package', x: 1640, y: 1960, bob: 0, missionOnly: true });
    state.cops.push({ x: 1700, y: 2080, angle: Math.PI, speed: 165, hp: 40, down: false, arrest: 0 });
    placeTraffic(state, [
      { x: 1600, y: 1820, angle: Math.PI / 2, speed: 90, color: '#3fae6a' },
      { x: 1880, y: 2000, angle: 0, speed: 110, color: '#d94f3d' },
    ]);
    placePeds(state, [
      { x: 1500, y: 1940, angle: 0 },
      { x: 1760, y: 1920, angle: Math.PI },
      { x: 1640, y: 2100, angle: -Math.PI / 2 },
    ]);
    state.camera.x = 1600;
    state.camera.y = 2000;
    state.mission.index = 1;
    state.mission.stage = 'active';
    state.mission.step = 0;
    state.mission.packagesLeft = 2;
    state.mission.objective = 'Job 2 — Package Run: collect the packages — 2 left, then deliver to the Harbor.';
    state.screen = 'play';
    return { screen: 'play' };
  }

  // Default: title. Golden-hour downtown, traffic and pedestrians moving
  // in the backdrop behind the title panel.
  state.clock = 17 * 3600 + 40 * 60;
  state.cash = 120;
  state.camera.x = 800;
  state.camera.y = 800;
  const spot = randomRoadPoint(state.rng);
  void spot;
  placeTraffic(state, [
    { x: 700, y: 800, angle: 0, speed: 120, color: '#d94f3d' },
    { x: 1100, y: 820, angle: Math.PI, speed: 130, color: '#3d7ad9' },
    { x: 800, y: 1000, angle: Math.PI / 2, speed: 100, color: '#e8c33a' },
  ]);
  placePeds(state, [
    { x: 640, y: 740, angle: Math.PI / 2 },
    { x: 900, y: 860, angle: -Math.PI / 2 },
    { x: 760, y: 900, angle: 0 },
  ]);
  state.screen = 'title';
  return { screen: 'title' };
}

export { startMission };
