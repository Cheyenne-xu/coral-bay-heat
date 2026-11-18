// Vehicles: player car physics (acceleration, braking, steering, skids and
// crashes) and the traffic AI that drives the road grid, turns at junctions
// and honks when it is stuck.
import { BEACH_X, CAR, ROAD_W, WORLD_H, WORLD_W } from './config.js';
import { clamp, dist, randRange, turnToward } from './random.js';
import { isRoad, isWater, nearestRoadX, nearestRoadY, resolveBuildingCollision } from './world.js';
import { addCrime, burst } from './player.js';

function carLength(car) {
  return car.kind === 'truck' ? 58 : 46;
}

function carWidth() {
  return 24;
}

export function carsOverlap(a, b) {
  return dist(a.x, a.y, b.x, b.y) < (carLength(a) + carLength(b)) / 2 - 6;
}

function crashInto(state, car, other, audio, hard) {
  const d = dist(car.x, car.y, other.x, other.y);
  if (d === 0) return;
  const nx = (other.x - car.x) / d;
  const ny = (other.y - car.y) / d;
  other.x += nx * 6;
  other.y += ny * 6;
  const impact = Math.abs(car.speed) + Math.abs(other.speed || 0);
  if (impact > 120) {
    burst(state, (car.x + other.x) / 2, (car.y + other.y) / 2, '#ffb14a', 12, 150);
    if (audio) audio.crash();
    if (car.driver === 'player' && impact > 260) {
      addCrime(state, 3, 'Crash — reckless driving');
      state.player.hp = Math.max(0, state.player.hp - 4);
    }
  }
  if (hard) {
    car.speed *= 0.4;
    if (other.speed !== undefined) other.speed *= 0.5;
  }
}

export function updatePlayerCar(state, input, dt, audio) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  const k = input.keys;
  const forward = k.up ? 1 : k.down ? -1 : 0;
  if (forward > 0) car.speed += CAR.accel * dt;
  else if (forward < 0) {
    if (car.speed > 30) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverseAccel * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 160 * dt);
  }
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  const steer = (k.left ? -1 : 0) + (k.right ? 1 : 0);
  const steerSign = car.speed >= 0 ? 1 : -1;
  if (steer !== 0 && Math.abs(car.speed) > 8) {
    car.angle += steer * CAR.turnRate * steerSign * dt * clamp(Math.abs(car.speed) / 160, 0.35, 1);
  }
  const prevX = car.x;
  const prevY = car.y;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Skid smoke on hard turns at speed.
  if (Math.abs(car.speed) > 260 && steer !== 0 && Math.random() < 0.5) {
    state.particles.push({
      x: car.x - Math.cos(car.angle) * 18, y: car.y - Math.sin(car.angle) * 18,
      vx: -Math.cos(car.angle) * 20, vy: -Math.sin(car.angle) * 20,
      life: 0.5, maxLife: 0.5, color: '#9aa0a8', size: 5,
    });
  }
  if (isWater(car.x, car.y) || car.x < 20 || car.y < 20 || car.x > WORLD_W - 20 || car.y > WORLD_H - 20) {
    car.x = prevX;
    car.y = prevY;
    car.speed *= -0.25;
    if (audio) audio.crash();
  }
  if (resolveBuildingCollision(state.city, car, CAR.radius)) {
    if (Math.abs(car.speed) > 200) {
      burst(state, car.x, car.y, '#ffb14a', 10, 140);
      if (audio) audio.crash();
      addCrime(state, 2, 'You smashed into a building');
      state.player.hp = Math.max(0, state.player.hp - 3);
    }
    car.speed *= 0.45;
  }
  // Car-to-car bumps.
  for (const other of state.cars) {
    if (other === car || other.driver === 'player') continue;
    if (carsOverlap(car, other)) crashInto(state, car, other, audio, true);
  }
  for (const pc of state.policeCars) {
    if (carsOverlap(car, pc)) crashInto(state, car, pc, audio, true);
  }
  // Running over a pedestrian is a serious crime.
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    if (dist(car.x, car.y, ped.x, ped.y) < 26 && Math.abs(car.speed) > 40) {
      ped.state = 'down';
      ped.down = 10;
      ped.hp = 0;
      state.stats.pedsHit += 1;
      addCrime(state, 16, 'You ran someone over!');
      burst(state, ped.x, ped.y, '#e86a6a', 12, 150);
      if (audio) audio.crash();
      car.speed *= 0.7;
    }
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = Math.abs(car.speed);
  if (audio) audio.engine(car.speed, true);
}

export function updateTraffic(state, dt, audio) {
  const p = state.player;
  for (const car of state.cars) {
    if (car.driver !== 'traffic') continue;
    car.honkCd -= dt;
    // Ease toward cruise speed; slow down for the car ahead.
    let target = car.cruise;
    for (const other of state.cars) {
      if (other === car) continue;
      const ahead = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
      const side = Math.abs((other.x - car.x) * Math.sin(car.angle) - (other.y - car.y) * Math.cos(car.angle));
      if (ahead > 0 && ahead < 70 && side < 30) { target = 0; break; }
    }
    if (target === 0 && car.honkCd <= 0 && dist(car.x, car.y, p.x, p.y) < 500) {
      car.honkCd = 6;
      if (audio) audio.horn();
    }
    car.speed += clamp(target - car.speed, -260 * dt, 180 * dt);
    const moving = Math.abs(car.speed) > 1;
    if (moving) {
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
    }
    // At a junction, sometimes turn onto the cross road.
    const onX = Math.abs(car.x - nearestRoadX(car.x)) < 26;
    const onY = Math.abs(car.y - nearestRoadY(car.y)) < 26;
    if (onX && onY && Math.random() < dt * 0.5) {
      const horizontal = Math.abs(Math.cos(car.angle)) > 0.5;
      if (horizontal) {
        car.angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        car.y = nearestRoadY(car.y) + (Math.random() < 0.5 ? -20 : 20);
      } else {
        car.angle = Math.random() < 0.5 ? 0 : Math.PI;
        car.x = nearestRoadX(car.x) + (Math.random() < 0.5 ? -20 : 20);
      }
    }
    // Stay on the road network: if pushed off, steer back to the nearest road.
    if (!isRoad(car.x, car.y) && moving) {
      const rx = nearestRoadX(car.x);
      const ry = nearestRoadY(car.y);
      const toX = Math.abs(car.x - rx) < Math.abs(car.y - ry);
      const want = toX ? Math.atan2(0, rx - car.x) : Math.atan2(ry - car.y, 0);
      car.angle = turnToward(car.angle, want, 1.6 * dt);
    }
    if (car.x < 60 || car.y < 60 || car.x > BEACH_X - 60 || car.y > WORLD_H - 60) {
      // Wrap to the far side so traffic never piles up at the edge.
      car.x = randRange(Math.random, 300, BEACH_X - 300);
      car.y = nearestRoadY(car.y);
      car.angle = Math.random() < 0.5 ? 0 : Math.PI;
    }
    if (isWater(car.x, car.y)) car.x = BEACH_X - 80;
  }
  // Parked cars never move, but a hard hit can nudge them.
  void ROAD_W;
}

export function spawnTrafficCar(state) {
  const rng = state.rng;
  const p = { x: 0, y: 0 };
  const rx = [400, 800, 1200, 1600, 2000, 2400, 2800][Math.floor(rng() * 7)];
  p.x = rx;
  p.y = randRange(rng, 200, WORLD_H - 200);
  state.cars.push({
    kind: 'sedan', color: '#3d7ad9', x: p.x, y: p.y,
    angle: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2,
    speed: 120, cruise: 140, driver: 'traffic', hp: 100, honkCd: 5,
  });
}

export { carLength, carWidth };
