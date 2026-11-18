// Coral Bay Heat — boot and the one loop. The game moves between screens:
// title, story intro, play, paused, wasted and busted. Play advances in
// fixed 1/60 s steps; ?shot=title|drive|chase|mission stages one frozen
// scene instead and paints it for a screenshot.
import { CAR, CLOCK_RATE, PLAYER, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { createGame, resetGame } from './world.js';
import {
  ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_RESTART, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';
import { enterCar, exitCar, nearestCar, punch, shoot, showBanner, showToast, updateParticles, updatePlayerOnFoot } from './player.js';
import { updatePlayerCar, updateTraffic } from './vehicles.js';
import { updateBullets, updatePedestrians } from './pedestrians.js';
import { decayWanted, updatePolice } from './police.js';
import { updateMissions } from './missions.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createGame(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function announce(message) {
  status.textContent = message;
}

function saveGame() {
  try {
    const p = state.player;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash, missionIndex: state.mission.index,
      missionsDone: state.stats.missionsDone, hp: p.hp,
      x: p.x, y: p.y, clock: state.clock, storyDone: state.storyDone,
    }));
  } catch { /* storage off: the save lasts this visit only */ }
}

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function applySave(save) {
  state.cash = save.cash;
  state.mission.index = save.missionIndex;
  state.stats.missionsDone = save.missionsDone || 0;
  state.player.hp = save.hp || PLAYER.maxHp;
  state.player.x = save.x;
  state.player.y = save.y;
  state.clock = save.clock || state.clock;
  state.storyDone = !!save.storyDone;
  state.mission.stage = 'idle';
  state.mission.objective = 'Find the yellow M marker to continue your jobs.';
  state.camera.x = save.x;
  state.camera.y = save.y;
  renderer.camera.x = save.x;
  renderer.camera.y = save.y;
}

function runShot(name) {
  const scene = stageShot(name, state);
  renderer.camera.x = state.camera.x;
  renderer.camera.y = state.camera.y;
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, performance.now());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = 'title';
  let accumulator = 0;
  let last = performance.now();
  let hadSave = !!loadSave();
  let savedMissions = state.stats.missionsDone;

  function startNew() {
    resetGame(state);
    savedMissions = 0;
    state.screen = 'play';
    screen = 'intro';
    audio.ensure();
    announce('The story so far. Press Enter to begin Job 1.');
  }

  function continueGame() {
    const save = loadSave();
    if (!save) { startNew(); return; }
    resetGame(state);
    applySave(save);
    savedMissions = state.stats.missionsDone;
    state.screen = 'play';
    screen = 'play';
    audio.ensure();
    showToast(state, 'Welcome back, Rico. The city missed you.');
    announce('Continuing your saved game.');
  }

  function step(dt) {
    state.time += dt;
    state.clock = (state.clock + CLOCK_RATE * dt) % 86400;
    const p = state.player;
    if (p.onFoot) updatePlayerOnFoot(state, input, dt, audio, renderer.camera);
    else updatePlayerCar(state, input, dt, audio);
    updateTraffic(state, dt, audio);
    updatePedestrians(state, dt);
    updateBullets(state, dt, audio);
    const busted = updatePolice(state, dt, audio);
    decayWanted(state, dt);
    updateMissions(state, dt, audio);
    updateParticles(state, dt);
    // Pickups bob.
    for (const pk of state.pickups) pk.bob += dt;
    renderer.updateCamera(state, dt);
    if (busted === 'busted') {
      screen = 'busted';
      state.screen = 'busted';
      announce('Busted by the Coral Bay police.');
      return;
    }
    if (p.hp <= 0) {
      screen = 'over';
      state.screen = 'over';
      announce('Wasted. Rico went down in Coral Bay.');
      return;
    }
    // Autosave whenever a job is finished.
    if (state.stats.missionsDone > savedMissions) {
      savedMissions = state.stats.missionsDone;
      saveGame();
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    const clicked = input.takeClick();
    if (actions & ACTION_MUTE) {
      audio.ensure();
      audio.setMuted(!audio.isMuted());
      state.muted = audio.isMuted();
      showToast(state, audio.isMuted() ? 'Sound off' : 'Sound on');
    }
    if (screen === 'title') {
      if ((actions & ACTION_RESTART) || clicked) startNew();
      else if (actions & ACTION_INTERACT && hadSave) continueGame();
      return;
    }
    if (screen === 'intro') {
      if ((actions & ACTION_RESTART) || clicked) {
        screen = 'play';
        state.screen = 'play';
        showBanner(state, 'JOB 1 — SUNSET TAXI', 'Find the yellow M marker to start work.');
        announce('Playing. Follow the yellow M marker.');
      }
      return;
    }
    if (screen === 'play') {
      if (actions & ACTION_PAUSE) {
        screen = 'paused';
        state.screen = 'paused';
        announce('Paused.');
        return;
      }
      if (actions & ACTION_INTERACT) {
        audio.ensure();
        if (state.player.onFoot) {
          const car = nearestCar(state, 70);
          if (car) enterCar(state, car, audio);
        } else {
          exitCar(state);
        }
      }
      if (actions & ACTION_PUNCH) punch(state, audio);
      return;
    }
    if (screen === 'paused') {
      if ((actions & ACTION_PAUSE) || clicked) {
        screen = 'play';
        state.screen = 'play';
        announce('Playing.');
      }
      return;
    }
    if (screen === 'over') {
      if ((actions & ACTION_RESTART) || clicked) {
        startNew();
      }
      return;
    }
    if (screen === 'busted') {
      if ((actions & ACTION_RESTART) || clicked) {
        state.cash = Math.max(0, state.cash - 100);
        state.wanted = 0;
        state.heat = 0;
        state.cops = [];
        state.policeCars = [];
        state.player.hp = 60;
        screen = 'play';
        state.screen = 'play';
        showToast(state, 'Bail paid — $100. Stay out of trouble, Rico.');
        announce('Bail paid. Back on the streets.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === 'play') {
      let guard = 0;
      while (accumulator >= STEP && screen === 'play' && guard < 8) {
        step(STEP);
        accumulator -= STEP;
        guard += 1;
      }
      if (guard >= 8) accumulator = 0;
    } else if (screen === 'title') {
      // The title backdrop drifts slowly across downtown.
      renderer.camera.x = 800 + Math.sin(now / 9000) * 260;
      renderer.camera.y = 800 + Math.cos(now / 12000) * 180;
      accumulator = 0;
    } else {
      accumulator = 0;
    }
    // Keep the renderer's camera in sync with the staged camera on menus.
    if (screen === 'title') {
      state.camera.x = renderer.camera.x;
      state.camera.y = renderer.camera.y;
    }
    renderer.draw(state, screen, now);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      state.screen = 'paused';
      announce('Paused.');
    }
  });
  canvas.addEventListener('mousedown', () => audio.ensure(), { once: true });

  announce('Coral Bay Heat. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
