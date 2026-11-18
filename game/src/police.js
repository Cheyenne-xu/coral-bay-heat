// The Coral Bay police: foot cops who chase and try to arrest the player,
// and black-and-white interceptors that ram the player's car. The force
// scales with the wanted level and backs off as the heat dies down.
// A ram is one hit with a cooldown (POLICE_RAM_COOLDOWN), never damage
// every frame: a single touch must cost a dent, not the whole run.
import {
  POLICE_RAM_COOLDOWN, POLICE_RAM_DAMAGE, POLICE_RAM_DAMAGE_ON_FOOT,
  POLICE_RAM_SPEED_CUT, POLICE_SPAWN_MAX, POLICE_SPAWN_MIN, POLICE_TOP_SPEED,
} from './config.js';
import { clamp, dist, randRange } from './random.js';
import { nearestRoadX, nearestRoadY, resolveBuildingCollision } from './world.js';
import { addCrime, burst, showToast } from './player.js';

export function wantedStars(state) {
  return state.wanted;
}

function spawnCop(state, nearPlayer) {
  const p = state.player;
  // On foot the cops close in from any side; in a car chase they come up
  // behind the player, so the player is not constantly driving into a cop
  // who just spawned in their headlights (which also kept the player
  // "seen" and the wanted level from ever decaying).
  let a;
  if (p.car) {
    a = p.car.angle + Math.PI + (Math.random() - 0.5) * 1.2;
  } else {
    a = Math.random() * Math.PI * 2;
  }
  const d = nearPlayer ? randRange(Math.random, 320, 480) : randRange(Math.random, 500, 700);
  state.cops.push({
    x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d,
    angle: 0, speed: 165, hp: 40, down: false, arrest: 0,
  });
}

function spawnPoliceCar(state) {
  const p = state.player;
  // The unit starts behind the player, along their direction of travel, and
  // snaps to the nearest road — so it chases instead of appearing head-on in
  // the player's path, which used to guarantee a wreck the player never saw.
  const gap = randRange(Math.random, POLICE_SPAWN_MIN, POLICE_SPAWN_MAX);
  let x, y, angle;
  if (p.car) {
    const back = p.car.angle + Math.PI;
    x = p.x + Math.cos(back) * gap;
    y = p.y + Math.sin(back) * gap;
    if (Math.abs(x - nearestRoadX(x)) < Math.abs(y - nearestRoadY(y))) x = nearestRoadX(x);
    else y = nearestRoadY(y);
    angle = p.car.angle;
  } else {
    const rx = nearestRoadX(p.x);
    const ry = nearestRoadY(p.y);
    x = rx + (Math.random() < 0.5 ? -gap : gap);
    y = ry;
    angle = 0;
  }
  state.policeCars.push({
    x: clamp(x, 60, 2860), y: clamp(y, 60, 2340),
    angle, speed: 200, hp: 120, siren: true, stuck: 0, ramCd: 0,
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
    const targetSpeed = d > 260 ? POLICE_TOP_SPEED : 300;
    pc.speed += (targetSpeed - pc.speed) * dt * 0.8;
    pc.x += Math.cos(pc.angle) * pc.speed * dt;
    pc.y += Math.sin(pc.angle) * pc.speed * dt;
    // Interceptors drive around buildings like everyone else: cutting
    // straight through a block looked broken and let them appear on the
    // player's bumper from inside a building. They slide along the wall
    // instead, with no speed cut, so a chase never stalls on a corner.
    resolveBuildingCollision(state.city, pc, 22);
    pc.ramCd = Math.max(0, (pc.ramCd || 0) - dt);
    // Ram the player's car, or knock the player down on foot. One hit per
    // cooldown: the hit costs a dent and a shove, and the player can pull
    // away again instead of being pinned while their health melts.
    if (d < 44 && pc.ramCd <= 0) {
      pc.ramCd = POLICE_RAM_COOLDOWN;
      burst(state, (pc.x + p.x) / 2, (pc.y + p.y) / 2, '#ffb14a', 10, 140);
      state.shake = Math.max(state.shake || 0, 7);
      if (audio) audio.ram();
      if (p.onFoot) {
        p.hp = Math.max(0, p.hp - POLICE_RAM_DAMAGE_ON_FOOT);
        p.x += Math.cos(pc.angle) * 46;
        p.y += Math.sin(pc.angle) * 46;
        if (p.hp <= 0) {
          state.screen = 'busted';
          return 'busted';
        }
      } else if (p.car) {
        p.car.speed *= POLICE_RAM_SPEED_CUT;
        p.hp = Math.max(0, p.hp - POLICE_RAM_DAMAGE);
      }
      pc.speed *= 0.6;
    }
    if (audio) audio.siren(true, dt);
  }
  if (state.policeCars.length === 0 && audio) audio.siren(false, dt);
  return null;
}

// Wanted decay: lay low, stay out of sight, and the heat cools off.
// The grace after a crime is 3 seconds: long enough that a fresh crime
// spree does not clear instantly, short enough that a real getaway can
// actually start cooling (6 seconds meant any bump reset the clock and
// the heat never moved during a chase).
export function decayWanted(state, dt) {
  if (state.time - state.lastCrimeAt < 3) return;
  const nearestCop = state.cops.length > 0
    ? Math.min(...state.cops.map((c) => dist(c.x, c.y, state.player.x, state.player.y)))
    : 9999;
  const nearestCar = state.policeCars.length > 0
    ? Math.min(...state.policeCars.map((c) => dist(c.x, c.y, state.player.x, state.player.y)))
    : 9999;
  // Seen means a unit is close enough to keep eyes on Rico: 320, not the
  // old 420, so a clean getaway at full speed actually opens the gap.
  const seen = Math.min(nearestCop, nearestCar) < 320;
  if (seen) return;
  const rate = state.mission.index === 3 && state.mission.stage === 'active' ? 8 : 2.2;
  state.heat = Math.max(0, state.heat - rate * dt);
  const stars = Math.min(5, Math.floor(state.heat / 20));
  if (stars < state.wanted) {
    state.wanted = stars;
    if (stars === 0) showToast(state, 'You lost them — wanted level clear');
  }
}
