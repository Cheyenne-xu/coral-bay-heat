// The player on foot: WASD walking and running, mouse aim, punching and
// shooting, picking things up, and getting in and out of cars. Crime and
// wanted-level bookkeeping live here too, since the player commits the crimes.
import { BEACH_X, CAR, PLAYER, WANTED_HEAT_PER_STAR, WORLD_H, WORLD_W } from './config.js';
import { clamp, dist } from './random.js';
import { collidesBuilding, isWater, resolveBuildingCollision } from './world.js';

export function addCrime(state, heat, label) {
  state.heat = clamp(state.heat + heat, 0, 100);
  state.wanted = Math.min(5, Math.floor(state.heat / WANTED_HEAT_PER_STAR));
  state.lastCrimeAt = state.time;
  state.stats.crimes += 1;
  if (label) showToast(state, label);
}

export function showToast(state, text) {
  state.message = { text, until: state.time + 3 };
}

export function showBanner(state, text, sub) {
  state.banner = { text, sub: sub || '', until: state.time + 3.2 };
}

export function burst(state, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = (speed || 120) * (0.4 + Math.random() * 0.8);
    state.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.4 + Math.random() * 0.5, maxLife: 0.9, color, size: 2 + Math.random() * 3,
    });
  }
}

export function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94;
    p.vy *= 0.94;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

// Nearest car the player could get into, within reach.
export function nearestCar(state, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.driver === 'police') continue;
    const d = dist(state.player.x, state.player.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(state, car, audio) {
  const p = state.player;
  p.onFoot = false;
  p.car = car;
  if (car.driver === 'parked' || car.driver === 'traffic') {
    state.stats.carsStolen += 1;
    addCrime(state, 12, 'Car stolen — the cops noticed');
    if (audio) audio.horn();
  }
  car.driver = 'player';
  car.speed = 0;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  showToast(state, car.kind === 'taxi' ? 'You took the taxi' : 'You took the car — E to get out');
}

export function exitCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  p.onFoot = true;
  p.car = null;
  car.driver = 'parked';
  car.speed = 0;
  // Step out to the side, out of any building.
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.x = clamp(p.x, 20, WORLD_W - 20);
  p.y = clamp(p.y, 20, WORLD_H - 20);
  if (collidesBuilding(state.city, p.x, p.y, PLAYER.radius)) {
    p.x = car.x - Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y - Math.sin(car.angle + Math.PI / 2) * 34;
  }
}

function tryPickup(state, audio) {
  const p = state.player;
  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const pk = state.pickups[i];
    if (pk.missionOnly) continue;
    if (dist(p.x, p.y, pk.x, pk.y) > 30) continue;
    if (pk.kind === 'pistol') {
      p.weapon = 'pistol';
      p.ammo += 24;
      showToast(state, 'Pistol picked up — click to shoot, 24 rounds');
    } else if (pk.kind === 'ammo') {
      p.ammo += 18;
      showToast(state, 'Ammo +18');
    } else if (pk.kind === 'health') {
      p.hp = Math.min(PLAYER.maxHp, p.hp + 40);
      showToast(state, 'Health +40');
    } else if (pk.kind === 'cash') {
      state.cash += 50;
      showToast(state, 'Found $50 on the street');
      if (audio) audio.cash();
      state.pickups.splice(i, 1);
      continue;
    }
    if (audio) audio.pickup();
    burst(state, pk.x, pk.y, '#f2c94c', 10, 90);
    state.pickups.splice(i, 1);
  }
}

export function punch(state, audio) {
  const p = state.player;
  if (!p.onFoot || p.punchCd > 0) return;
  p.punchCd = PLAYER.punchCooldown;
  if (audio) audio.punch();
  const hx = p.x + Math.cos(p.angle) * PLAYER.punchRange;
  const hy = p.y + Math.sin(p.angle) * PLAYER.punchRange;
  burst(state, hx, hy, '#ffffff', 4, 70);
  let hitAnyone = false;
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    if (dist(hx, hy, ped.x, ped.y) < 26) {
      ped.hp -= PLAYER.punchDamage;
      ped.state = 'flee';
      ped.panic = 3;
      hitAnyone = true;
      if (ped.hp <= 0) {
        ped.state = 'down';
        ped.down = 8;
        addCrime(state, 14, 'Pedestrian down — witnesses called it in');
        state.stats.pedsHit += 1;
      } else {
        addCrime(state, 6, 'Assault — someone called the cops');
      }
      burst(state, ped.x, ped.y, '#e86a6a', 8, 110);
    }
  }
  for (const cop of state.cops) {
    if (dist(hx, hy, cop.x, cop.y) < 26) {
      cop.hp -= PLAYER.punchDamage;
      hitAnyone = true;
      addCrime(state, 18, 'You hit a cop!');
      burst(state, cop.x, cop.y, '#3d7ad9', 8, 110);
      if (cop.hp <= 0) cop.down = true;
    }
  }
  if (!hitAnyone) {
    // A swing at thin air still looks like trouble nearby.
  }
}

export function shoot(state, audio) {
  const p = state.player;
  if (!p.onFoot || p.weapon !== 'pistol' || p.ammo <= 0 || p.shootCd > 0) return;
  p.shootCd = 0.22;
  p.ammo -= 1;
  if (audio) audio.shot();
  const mx = p.x + Math.cos(p.angle) * 24;
  const my = p.y + Math.sin(p.angle) * 24;
  state.bullets.push({ x: mx, y: my, angle: p.angle, speed: 900, life: 0.7, fromPlayer: true });
  burst(state, mx, my, '#ffd76a', 5, 160);
  addCrime(state, 4, '');
  state.message = null; // shooting quietly raises heat without spamming toasts
}

export function updatePlayerOnFoot(state, input, dt, audio, camera) {
  const p = state.player;
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  const k = input.keys;
  let mx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
  let my = (k.down ? 1 : 0) - (k.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  p.moving = len > 0;
  if (len > 0) {
    mx /= len;
    my /= len;
    const speed = k.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    p.speed = speed;
    // Move one axis at a time and resolve buildings after each, so Rico
    // slides along a wall instead of sticking to it on a diagonal walk.
    p.x += mx * speed * dt;
    resolveBuildingCollision(state.city, p, PLAYER.radius);
    p.y += my * speed * dt;
    resolveBuildingCollision(state.city, p, PLAYER.radius);
    // Face the mouse while aiming; otherwise face the walk direction.
    const mouse = input.mouse();
    const worldMouse = camera.toWorld(mouse.x, mouse.y);
    p.angle = Math.atan2(worldMouse.y - p.y, worldMouse.x - p.x);
  } else {
    p.speed = 0;
    const mouse = input.mouse();
    const worldMouse = camera.toWorld(mouse.x, mouse.y);
    p.angle = Math.atan2(worldMouse.y - p.y, worldMouse.x - p.x);
  }
  if (isWater(p.x, p.y)) {
    // The sea is out of bounds: shove the player back onto the sand.
    p.x = Math.min(p.x, WATER_X - 20);
    p.hp = Math.max(0, p.hp - 2 * dt);
  }
  p.x = clamp(p.x, 16, WORLD_W - 16);
  p.y = clamp(p.y, 16, WORLD_H - 16);
  tryPickup(state, audio);
  if (input.mouseDown() && p.weapon === 'pistol') shoot(state, audio);
}
