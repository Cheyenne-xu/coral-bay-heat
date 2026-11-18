// The Coral Bay police: foot cops who chase and try to arrest the player,
// and black-and-white interceptors that ram the player's car. The force
// scales with the wanted level and backs off as the heat dies down.
import { dist, randRange } from './random.js';
import { nearestRoadX, nearestRoadY } from './world.js';
import { addCrime, burst, showToast } from './player.js';

export function wantedStars(state) {
  return state.wanted;
}

function spawnCop(state, nearPlayer) {
  const p = state.player;
  const a = Math.random() * Math.PI * 2;
  const d = nearPlayer ? randRange(Math.random, 320, 480) : randRange(Math.random, 500, 700);
  state.cops.push({
    x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d,
    angle: 0, speed: 165, hp: 40, down: false, arrest: 0,
  });
}

function spawnPoliceCar(state) {
  const p = state.player;
  const rx = nearestRoadX(p.x);
  const ry = nearestRoadY(p.y);
  const behind = p.car ? -1 : 1;
  state.policeCars.push({
    x: rx + (Math.random() < 0.5 ? -260 : 260) * behind,
    y: ry,
    angle: p.car ? p.car.angle : 0,
    speed: 200, hp: 120, siren: true, stuck: 0,
  });
}

export function updatePolice(state, dt, audio) {
  const p = state.player;
  // Reinforcements arrive while the heat is on; they leave when it cools.
  if (state.wanted >= 1) {
    const wantCops = Math.min(4, state.wanted);
    if (state.cops.filter((c) => !c.down).length < wantCops && Math.random() < dt * 0.7) {
      spawnCop(state, true);
    }
    const wantCars = state.wanted >= 2 ? Math.min(3, state.wanted - 1) : 0;
    if (state.policeCars.length < wantCars && Math.random() < dt * 0.5) {
      spawnPoliceCar(state);
    }
  } else {
    if (state.cops.length > 0 && Math.random() < dt * 0.4) state.cops.shift();
    if (state.policeCars.length > 0 && Math.random() < dt * 0.4) state.policeCars.shift();
  }

  // Foot cops: run at the player; an arrest needs them close and the player slow.
  for (let i = state.cops.length - 1; i >= 0; i -= 1) {
    const cop = state.cops[i];
    if (cop.down) {
      state.cops.splice(i, 1);
      burst(state, cop.x, cop.y, '#3d7ad9', 10, 120);
      continue;
    }
    const d = dist(cop.x, cop.y, p.x, p.y);
    cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
    if (!p.onFoot) {
      // On foot they cannot catch a car: hold position near the road.
      cop.x += Math.cos(cop.angle) * 60 * dt;
      cop.y += Math.sin(cop.angle) * 60 * dt;
      cop.arrest = 0;
      continue;
    }
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    if (d < 34) {
      cop.arrest += dt;
      if (p.speed < 60) cop.arrest += dt * 1.5;
      if (cop.arrest > 1.6) {
        state.screen = 'busted';
        if (audio) audio.busted();
        return 'busted';
      }
    } else {
      cop.arrest = Math.max(0, cop.arrest - dt);
    }
    // A cop who wanders too far off gives up and despawns.
    if (d > 1100) state.cops.splice(i, 1);
  }

  // Police cars: steer at the player and ram.
  for (let i = state.policeCars.length - 1; i >= 0; i -= 1) {
    const pc = state.policeCars[i];
    const d = dist(pc.x, pc.y, p.x, p.y);
    if (d > 1400) {
      state.policeCars.splice(i, 1);
      continue;
    }
    const wantAngle = Math.atan2(p.y - pc.y, p.x - pc.x);
    let diff = wantAngle - pc.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    pc.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const targetSpeed = d > 260 ? 380 : 300;
    pc.speed += (targetSpeed - pc.speed) * dt * 0.8;
    pc.x += Math.cos(pc.angle) * pc.speed * dt;
    pc.y += Math.sin(pc.angle) * pc.speed * dt;
    // Ram the player's car, or knock the player down on foot.
    if (d < 44) {
      burst(state, (pc.x + p.x) / 2, (pc.y + p.y) / 2, '#ffb14a', 10, 140);
      if (audio) audio.crash();
      if (p.onFoot) {
        p.hp = Math.max(0, p.hp - 18 * dt * 10);
        p.x += Math.cos(pc.angle) * 60 * dt * 10;
        p.y += Math.sin(pc.angle) * 60 * dt * 10;
        if (p.hp <= 0) {
          state.screen = 'busted';
          return 'busted';
        }
      } else if (p.car) {
        p.car.speed *= 0.55;
        p.hp = Math.max(0, p.hp - 2);
      }
      pc.speed *= 0.5;
    }
    if (audio) audio.siren(true, dt);
  }
  if (state.policeCars.length === 0 && audio) audio.siren(false, dt);
  return null;
}

// Wanted decay: lay low, stay out of sight, and the heat cools off.
export function decayWanted(state, dt) {
  if (state.time - state.lastCrimeAt < 6) return;
  const nearestCop = state.cops.length > 0
    ? Math.min(...state.cops.map((c) => dist(c.x, c.y, state.player.x, state.player.y)))
    : 9999;
  const nearestCar = state.policeCars.length > 0
    ? Math.min(...state.policeCars.map((c) => dist(c.x, c.y, state.player.x, state.player.y)))
    : 9999;
  const seen = Math.min(nearestCop, nearestCar) < 420;
  if (seen) return;
  const rate = state.mission.index === 3 && state.mission.stage === 'active' ? 6 : 2.2;
  state.heat = Math.max(0, state.heat - rate * dt);
  const stars = Math.min(5, Math.floor(state.heat / 20));
  if (stars < state.wanted) {
    state.wanted = stars;
    if (stars === 0) showToast(state, 'You lost them — wanted level clear');
  }
}
