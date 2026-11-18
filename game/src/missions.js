// Missions and the story of Coral Bay Heat. Rico Vega comes home to Coral
// Bay broke; fixer Mara Quinn gives him work, one job at a time. Each
// mission has a start marker (M), an objective, and a cash reward.
import { dist } from './random.js';
import { addCrime, showBanner, showToast } from './player.js';

export const STORY_INTRO = [
  'Rico Vega is back in Coral Bay — broke, with a borrowed jacket and a',
  'reputation he would rather forget. Fixer Mara Quinn has work for him,',
  'if he can stay out of the Coral Bay Police Department\'s way.',
  'Six jobs. One way out. Do the work, take the cash, don\'t get caught.',
];

export const MISSIONS = [
  {
    title: 'Job 1 — Sunset Taxi',
    brief: 'Mara\'s client is waiting at Palm Plaza. Pick them up and drive them to the Marina.',
    start: { x: 600, y: 600 },
    pickup: { x: 620, y: 470 },
    dropoff: { x: 2400, y: 400 },
    reward: 150,
  },
  {
    title: 'Job 2 — Package Run',
    brief: 'Three packages stashed around Old Town. Collect them all and bring them to the Harbor.',
    start: { x: 800, y: 1600 },
    packages: [{ x: 480, y: 2040 }, { x: 1240, y: 1240 }, { x: 1560, y: 2040 }],
    dropoff: { x: 2400, y: 2000 },
    reward: 200,
  },
  {
    title: 'Job 3 — Getaway Driver',
    brief: 'Mara\'s crew just hit a courier van. The cops are already rolling. Get a car and reach the hideout.',
    start: { x: 1600, y: 800 },
    dropoff: { x: 480, y: 2040 },
    reward: 300,
  },
  {
    title: 'Job 4 — Lose the Heat',
    brief: 'Three stars and every unit in the city is looking for you. Lay low until the heat dies.',
    start: { x: 1200, y: 1200 },
    reward: 250,
  },
  {
    title: 'Job 5 — The Harbor Score',
    brief: 'The big one. Grab the cash at the harbor dock, then vanish to the hideout before the CBPD locks the bridges.',
    start: { x: 2000, y: 2000 },
    pickup: { x: 2720, y: 2200 },
    dropoff: { x: 480, y: 2040 },
    reward: 500,
  },
  {
    title: 'Job 6 — Hot Wheels',
    brief: 'Mara has a buyer for a sports car, no questions asked. Bring her a sports car — any one, in one piece — to the Harbor.',
    start: { x: 2400, y: 800 },
    dropoff: { x: 2400, y: 2000 },
    needsSport: true,
    reward: 400,
  },
];

export function currentMission(state) {
  return MISSIONS[state.mission.index] || null;
}

export function missionTarget(state) {
  const m = state.mission;
  const def = currentMission(state);
  if (!def) return null;
  if (m.stage === 'idle') return { x: def.start.x, y: def.start.y, kind: 'start', label: 'M' };
  if (m.step === 0 && def.pickup) return { x: def.pickup.x, y: def.pickup.y, kind: 'pickup', label: '!' };
  if (m.step === 0 && def.packages) {
    const left = state.pickups.filter((pk) => pk.missionOnly);
    if (left.length > 0) return { x: left[0].x, y: left[0].y, kind: 'package', label: 'P' };
  }
  if (def.dropoff) return { x: def.dropoff.x, y: def.dropoff.y, kind: 'dropoff', label: 'D' };
  return null;
}

export function startMission(state, audio) {
  const def = currentMission(state);
  if (!def) return;
  const m = state.mission;
  m.stage = 'active';
  m.step = 0;
  m.timer = 0;
  m.objective = def.brief;
  if (def.packages) {
    m.packagesLeft = def.packages.length;
    for (const pk of def.packages) {
      state.pickups.push({ kind: 'package', x: pk.x, y: pk.y, bob: 0, missionOnly: true });
    }
  }
  if (state.mission.index === 2) {
    // The getaway starts hot: the crew's job already has the cops rolling.
    addCrime(state, 45, 'The job went loud — cops are coming!');
  }
  if (state.mission.index === 3) {
    addCrime(state, 60, 'Three stars! Lose them!');
  }
  showBanner(state, def.title, def.brief);
  if (audio) audio.pickup();
}

export function completeMission(state, audio) {
  const def = currentMission(state);
  const m = state.mission;
  state.cash += def.reward;
  state.stats.missionsDone += 1;
  m.stage = 'done';
  m.objective = `${def.title} complete — $${def.reward} banked.`;
  showBanner(state, 'JOB DONE', `+ $${def.reward} — ${def.title}`);
  if (audio) audio.missionDone();
  // Clear mission packages still on the ground.
  state.pickups = state.pickups.filter((pk) => !pk.missionOnly);
  if (state.mission.index >= MISSIONS.length - 1) {
    state.storyDone = true;
    showBanner(state, 'STORY COMPLETE', 'Rico owns Coral Bay now. Free roam — the city is yours.');
    return;
  }
  state.mission.index += 1;
  state.mission.stage = 'idle';
  state.mission.step = 0;
  const next = currentMission(state);
  state.mission.objective = `Next job: ${next.title}. Find the yellow M marker.`;
}

export function updateMissions(state, dt, audio) {
  const m = state.mission;
  const def = currentMission(state);
  if (!def) {
    m.objective = 'Story complete — free roam. The city is yours, Rico.';
    return;
  }
  const p = state.player;
  if (m.stage === 'idle') {
    const t = missionTarget(state);
    m.objective = `${def.title} — go to the yellow M marker to start.`;
    if (t && dist(p.x, p.y, t.x, t.y) < 46) startMission(state, audio);
    return;
  }
  if (m.stage !== 'active') return;

  // Job 4 is pure evasion: survive until the wanted level hits zero.
  if (state.mission.index === 3) {
    m.timer += dt;
    m.objective = `Lose the cops! Wanted ${state.wanted}★ — stay out of sight until the heat dies.`;
    if (state.wanted === 0 && m.timer > 6) {
      completeMission(state, audio);
    }
    return;
  }

  // Package collection.
  if (def.packages && m.step === 0) {
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pk = state.pickups[i];
      if (!pk.missionOnly) continue;
      if (dist(p.x, p.y, pk.x, pk.y) < 36) {
        state.pickups.splice(i, 1);
        m.packagesLeft -= 1;
        showToast(state, `Package grabbed — ${m.packagesLeft} left`);
        if (audio) audio.pickup();
        if (m.packagesLeft <= 0) {
          m.step = 1;
          showToast(state, 'All packages collected — take them to the Harbor');
        }
      }
    }
    const left = state.pickups.filter((pk) => pk.missionOnly).length;
    m.objective = `Collect the packages — ${left} left, then deliver to the Harbor.`;
    return;
  }

  // Pickup then dropoff (taxi, harbor score).
  if (def.pickup && m.step === 0) {
    m.objective = 'Go to the pickup point.';
    if (dist(p.x, p.y, def.pickup.x, def.pickup.y) < 46) {
      m.step = 1;
      if (state.mission.index === 0) {
        m.passenger = 'client';
        showToast(state, 'Client aboard — drive to the Marina, no crashes!');
      } else {
        showToast(state, 'Cash grabbed — get to the hideout!');
        addCrime(state, 25, 'The dock alarm is screaming!');
      }
      if (audio) audio.pickup();
    }
    return;
  }
  if (def.dropoff) {
    // Job 6 only counts if Rico arrives in a sports car.
    if (def.needsSport) {
      const inSport = !p.onFoot && p.car && p.car.kind === 'sport';
      m.objective = inSport
        ? 'Sports car secured — deliver it to the Harbor dropoff.'
        : 'Steal a sports car and bring it to the Harbor dropoff.';
      if (inSport && dist(p.x, p.y, def.dropoff.x, def.dropoff.y) < 52) {
        completeMission(state, audio);
      }
      return;
    }
    m.objective = state.mission.index === 0
      ? 'Drive the client to the Marina dropoff.'
      : state.mission.index === 2
        ? 'Reach the hideout — and stay ahead of the cops.'
        : 'Reach the hideout with the score.';
    if (dist(p.x, p.y, def.dropoff.x, def.dropoff.y) < 52) {
      completeMission(state, audio);
    }
  }
}
