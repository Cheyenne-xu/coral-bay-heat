// Pedestrians: they stroll the sidewalks, chat, panic and flee from gunfire
// and speeding cars, and get back up after a while if they were knocked down.
import { WORLD_H, WORLD_W } from './config.js';
import { clamp, dist, randRange, turnToward } from './random.js';
import { isWater, randomSidewalkPoint, resolveBuildingCollision } from './world.js';
import { burst } from './player.js';

export function updatePedestrians(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.state === 'down') {
      ped.down -= dt;
      if (ped.down <= 0) {
        ped.state = 'walk';
        ped.hp = 30;
        const spot = randomSidewalkPoint(state.rng);
        ped.x = spot.x;
        ped.y = spot.y;
      }
      continue;
    }
    // Danger nearby: gunfire, a speeding car, or the player sprinting at them.
    let danger = null;
    if (state.bullets.length > 0) {
      const b = state.bullets[state.bullets.length - 1];
      if (dist(ped.x, ped.y, b.x, b.y) < 260) danger = b;
    }
    const playerCar = p.car;
    if (playerCar && Math.abs(playerCar.speed) > 220 && dist(ped.x, ped.y, playerCar.x, playerCar.y) < 200) {
      danger = playerCar;
    }
    if (danger) {
      ped.state = 'flee';
      ped.panic = 2.5;
    }
    if (ped.state === 'flee') {
      ped.panic -= dt;
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = turnToward(ped.angle, away, 5 * dt);
      ped.x += Math.cos(ped.angle) * 150 * dt;
      ped.y += Math.sin(ped.angle) * 150 * dt;
      if (ped.panic <= 0) ped.state = 'walk';
    } else {
      const d = dist(ped.x, ped.y, ped.tx, ped.ty);
      if (d < 12) {
        const spot = randomSidewalkPoint(state.rng);
        ped.tx = spot.x;
        ped.ty = spot.y;
      } else {
        const want = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
        ped.angle = turnToward(ped.angle, want, 3 * dt);
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
      }
    }
    ped.x = clamp(ped.x, 20, WORLD_W - 20);
    ped.y = clamp(ped.y, 20, WORLD_H - 20);
    if (isWater(ped.x, ped.y)) ped.x = 2900;
    resolveBuildingCollision(state.city, ped, 12);
  }
}

// Bullets in flight: move, fade, and hurt whoever they touch.
export function updateBullets(state, dt, audio) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      for (const ped of state.peds) {
        if (ped.state === 'down') continue;
        if (dist(b.x, b.y, ped.x, ped.y) < 16) {
          ped.hp -= 20;
          burst(state, ped.x, ped.y, '#e86a6a', 8, 120);
          if (ped.hp <= 0) {
            ped.state = 'down';
            ped.down = 9;
            state.stats.pedsHit += 1;
          } else {
            ped.state = 'flee';
            ped.panic = 4;
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const cop of state.cops) {
        if (cop.down) continue;
        if (dist(b.x, b.y, cop.x, cop.y) < 16) {
          cop.hp -= 25;
          burst(state, cop.x, cop.y, '#3d7ad9', 8, 120);
          if (cop.hp <= 0) cop.down = true;
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of state.cars) {
        if (dist(b.x, b.y, car.x, car.y) < 26) {
          car.hp -= 8;
          burst(state, b.x, b.y, '#ffd76a', 5, 100);
          if (car.hp <= 0 && car.driver !== 'player') {
            car.driver = 'parked';
            car.speed = 0;
            burst(state, car.x, car.y, '#888888', 16, 160);
            if (audio) audio.crash();
          }
          dead = true;
          break;
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
  void randRange;
}
