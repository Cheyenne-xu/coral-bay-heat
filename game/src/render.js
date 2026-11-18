// Drawing only: the city, the people and cars in it, the sky and the menus.
// The camera follows the player smoothly; the world is drawn in world space,
// the HUD and menus in screen space. All art is drawn in code — no images.
import { BEACH_X, DISTRICTS, GAME_TITLE, ROAD_W, WATER_X, WORLD_H, WORLD_W } from './config.js';
import { ROAD_XS, ROAD_YS } from './world.js';
import { clamp } from './random.js';
import { drawHud } from './hud.js';
import { MISSIONS, STORY_INTRO, missionTarget } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_INTRO = 'intro';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  let viewW = 0;
  let viewH = 0;
  const camera = {
    x: 800, y: 800, scale: 1,
    toWorld(sx, sy) {
      return {
        x: this.x + (sx - viewW / 2) / this.scale,
        y: this.y + (sy - viewH / 2) / this.scale,
      };
    },
  };

  function resize() {
    dpr = window.devicePixelRatio || 1;
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    camera.scale = clamp(Math.min(viewW / 1150, viewH / 760), 0.55, 1.35);
  }

  function updateCamera(state, dt) {
    const p = state.player;
    const k = 1 - Math.exp(-4.5 * dt);
    camera.x += (p.x - camera.x) * k;
    camera.y += (p.y - camera.y) * k;
    const halfW = viewW / 2 / camera.scale;
    const halfH = viewH / 2 / camera.scale;
    camera.x = clamp(camera.x, halfW - 100, WORLD_W - halfW + 100);
    camera.y = clamp(camera.y, halfH - 100, WORLD_H - halfH + 100);
    // Camera shake from crashes and rams fades out over a fraction of a second.
    state.shake = Math.max(0, (state.shake || 0) - dt * 26);
  }

  function dayTint(state) {
    // 06:00-18:00 day, 18:00-20:00 dusk, 20:00-06:00 night.
    const hour = (state.clock / 3600) % 24;
    if (hour >= 6 && hour < 18) return null;
    if (hour >= 18 && hour < 20) return { color: 'rgba(255,110,60,0.10)', dark: 0.06 };
    return { color: 'rgba(20,30,80,0.20)', dark: 0.16 };
  }

  function drawGround(state) {
    const city = state.city;
    // Grass base.
    ctx.fillStyle = '#5a7a4a';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    // District ground tints, from the district table: each quarter of the
    // city reads differently from the air and on the minimap.
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.tone;
      ctx.globalAlpha = 0.16;
      ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
    }
    ctx.globalAlpha = 1;
    // Parks.
    for (const park of city.parks) {
      ctx.fillStyle = '#4f8a4a';
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = '#3a6a3a';
      for (let i = 0; i < 8; i += 1) {
        const tx = park.x + 30 + ((i * 67) % (park.w - 60));
        const ty = park.y + 30 + ((i * 113) % (park.h - 60));
        ctx.beginPath();
        ctx.arc(tx, ty, 14, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#2e5a2e';
      ctx.font = `700 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(park.name.toUpperCase(), park.x + park.w / 2, park.y + park.h - 14);
    }
    // Beach and water, east edge.
    ctx.fillStyle = '#e8d49a';
    ctx.fillRect(BEACH_X, 0, WATER_X - BEACH_X, WORLD_H);
    ctx.fillStyle = '#2e7a9a';
    ctx.fillRect(WATER_X, 0, WORLD_W - WATER_X, WORLD_H);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let y = 60; y < WORLD_H; y += 180) {
      ctx.fillRect(WATER_X + 8, y, 60, 4);
      ctx.fillRect(WATER_X + 90, y + 90, 44, 4);
    }
    ctx.fillStyle = '#2e7a9a';
    ctx.font = `700 18px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('CORAL BAY — THE WATER', WATER_X + 110, 60);
    // Palm trees along the beach and the marina front.
    for (const palm of city.palms) {
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(palm.x - 2, palm.y - 4, 4, 12);
      ctx.fillStyle = '#3f8a3f';
      for (let f = 0; f < 5; f += 1) {
        const a = (f / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.ellipse(palm.x + Math.cos(a) * 9, palm.y - 6 + Math.sin(a) * 6, 9, 3.5, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Roads.
    ctx.fillStyle = '#33363d';
    for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD_H);
    for (const ry of ROAD_YS) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
    // Sidewalks.
    ctx.fillStyle = '#8a8f98';
    for (const rx of ROAD_XS) {
      ctx.fillRect(rx - ROAD_W / 2 - 10, 0, 10, WORLD_H);
      ctx.fillRect(rx + ROAD_W / 2, 0, 10, WORLD_H);
    }
    for (const ry of ROAD_YS) {
      ctx.fillRect(0, ry - ROAD_W / 2 - 10, WORLD_W, 10);
      ctx.fillRect(0, ry + ROAD_W / 2, WORLD_W, 10);
    }
    // Lane dashes.
    ctx.fillStyle = '#e8c33a';
    for (const rx of ROAD_XS) {
      for (let y = 20; y < WORLD_H; y += 64) ctx.fillRect(rx - 2, y, 4, 30);
    }
    for (const ry of ROAD_YS) {
      for (let x = 20; x < BEACH_X; x += 64) ctx.fillRect(x, ry - 2, 30, 4);
    }
    // Buildings.
    for (const b of city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      ctx.fillStyle = 'rgba(255,240,180,0.85)';
      const cols = b.windows;
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          ctx.fillRect(b.x + 12 + cx * ((b.w - 24) / cols), b.y + 12 + cy * ((b.h - 24) / rows), 8, 10);
        }
      }
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(b.x + b.w / 2 - 2, b.y - 16, 4, 16);
      }
    }
    // Road name labels at a few junctions.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `700 16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('PALM AVE', 800, 388);
    ctx.fillText('MARINA BLVD', 2000, 788);
    ctx.fillText('HARBOR RD', 2000, 1988);
    ctx.fillText('OLD TOWN SQ', 800, 1588);
  }

  function drawCarShape(car) {
    const len = car.kind === 'truck' ? 58 : 46;
    const wid = car.kind === 'truck' ? 28 : 24;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-len / 2, -wid / 2, len, wid, 7);
    ctx.fill();
    ctx.fillStyle = '#1c2430';
    ctx.fillRect(-len / 2 + 10, -wid / 2 + 4, 12, wid - 8);
    ctx.fillRect(len / 2 - 20, -wid / 2 + 4, 12, wid - 8);
    ctx.fillStyle = '#cfe8ff';
    ctx.fillRect(-4, -wid / 2 + 3, 10, wid - 6);
    if (car.kind === 'taxi') {
      ctx.fillStyle = '#11141b';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    if (car.kind === 'truck') {
      ctx.fillStyle = '#d8d8d8';
      ctx.fillRect(-len / 2 + 4, -wid / 2 + 3, 18, wid - 6);
    }
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(len / 2 - 2, -wid / 2 + 2, 3, 5);
    ctx.fillRect(len / 2 - 2, wid / 2 - 7, 3, 5);
    ctx.restore();
  }

  function drawPoliceCarShape(pc) {
    ctx.save();
    ctx.translate(pc.x, pc.y);
    ctx.rotate(pc.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-20, -8, 46, 24);
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath();
    ctx.roundRect(-23, -12, 46, 24, 7);
    ctx.fill();
    ctx.fillStyle = '#11141b';
    ctx.fillRect(-6, -12, 12, 24);
    ctx.fillStyle = '#1c2430';
    ctx.fillRect(-13, -9, 10, 18);
    ctx.fillRect(8, -9, 10, 18);
    const blink = Math.floor(performance.now() / 180) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2e2e' : '#2e6aff';
    ctx.beginPath();
    ctx.arc(-2, -12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blink ? '#2e6aff' : '#ff2e2e';
    ctx.beginPath();
    ctx.arc(6, -12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#11141b';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CBPD', pc.x, pc.y - 20);
  }

  function drawPerson(x, y, angle, shirt, down, isCop) {
    ctx.save();
    ctx.translate(x, y);
    if (down) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isCop ? '#1e3a6e' : shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(6, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    if (isCop) {
      ctx.fillStyle = '#ffd23a';
      ctx.fillRect(-4, -11, 8, 3);
    }
    ctx.restore();
  }

  function drawWorld(state, now) {
    const p = state.player;
    // The whole ground is drawn every frame: at this city size it still
    // holds 60 fps, so no culling pass is worth its complexity here.
    drawGround(state);

    // Fading tyre marks from hard turns, oldest first.
    if (state.skids.length > 0) {
      ctx.strokeStyle = 'rgba(20,20,24,0.5)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (const s of state.skids) {
        ctx.globalAlpha = Math.max(0, Math.min(0.5, s.life / 14 * 0.5));
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Mission marker: a tall pulsing beacon, visible across the city.
    // Gameplay only — the title screen has its own backdrop without it.
    const target = (state.screen === 'play' || state.screen === 'paused') ? missionTarget(state) : null;
    if (target) {
      const pulse = 1 + Math.sin(now / 300) * 0.18;
      ctx.save();
      ctx.translate(target.x, target.y);
      ctx.scale(pulse, pulse);
      ctx.strokeStyle = '#ffd23a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,210,58,0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#11141b';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(target.label, 0, 5);
      ctx.restore();
      // A light pillar so the marker reads from far away.
      const grad = ctx.createLinearGradient(target.x, target.y - 260, target.x, target.y);
      grad.addColorStop(0, 'rgba(255,210,58,0)');
      grad.addColorStop(1, 'rgba(255,210,58,0.35)');
      ctx.fillStyle = grad;
      ctx.fillRect(target.x - 8, target.y - 260, 16, 260);
    }

    // Pickups.
    for (const pk of state.pickups) {
      const bob = Math.sin(now / 300 + pk.bob) * 3;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      if (pk.kind === 'pistol') {
        ctx.fillStyle = '#2e2e38';
        ctx.fillRect(-10, -3, 20, 6);
        ctx.fillRect(2, 3, 5, 8);
      } else if (pk.kind === 'health') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-9, -9, 18, 18);
        ctx.fillStyle = '#e5534b';
        ctx.fillRect(-2, -7, 4, 14);
        ctx.fillRect(-7, -2, 14, 4);
      } else if (pk.kind === 'cash') {
        ctx.fillStyle = '#4fd17a';
        ctx.fillRect(-10, -6, 20, 12);
        ctx.fillStyle = '#1e7a3a';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', 0, 4);
      } else if (pk.kind === 'package') {
        ctx.fillStyle = '#c98f3a';
        ctx.fillRect(-10, -8, 20, 16);
        ctx.strokeStyle = '#7a5a1a';
        ctx.strokeRect(-10, -8, 20, 16);
      } else if (pk.kind === 'ammo') {
        ctx.fillStyle = '#e8c33a';
        ctx.fillRect(-8, -5, 16, 10);
      }
      ctx.restore();
    }

    for (const car of state.cars) drawCarShape(car);
    for (const pc of state.policeCars) drawPoliceCarShape(pc);
    for (const ped of state.peds) {
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.state === 'down', false);
    }
    for (const cop of state.cops) {
      drawPerson(cop.x, cop.y, cop.angle, '#1e3a6e', cop.down, true);
    }

    // Player.
    if (p.onFoot) {
      const blink = p.hp < 30 && Math.floor(now / 200) % 2 === 0;
      if (!blink) {
        drawPerson(p.x, p.y, p.angle, '#e5534b', false, false);
        // Aim line and gun.
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16);
        ctx.lineTo(p.x + Math.cos(p.angle) * 44, p.y + Math.sin(p.angle) * 44);
        ctx.stroke();
        if (p.weapon === 'pistol') {
          ctx.fillStyle = '#222';
          ctx.save();
          ctx.translate(p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16);
          ctx.rotate(p.angle);
          ctx.fillRect(0, -2, 14, 4);
          ctx.restore();
        }
      }
    }
    // Bullets.
    ctx.fillStyle = '#ffd76a';
    for (const b of state.bullets) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.fillRect(-7, -1.5, 14, 3);
      ctx.restore();
    }
    // Particles.
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Day / night tint over the world.
    const tint = dayTint(state);
    if (tint) {
      ctx.fillStyle = tint.color;
      ctx.fillRect(camera.x - viewW, camera.y - viewH, viewW * 2, viewH * 2);
      ctx.fillStyle = `rgba(5,8,25,${tint.dark})`;
      ctx.fillRect(camera.x - viewW, camera.y - viewH, viewW * 2, viewH * 2);
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const w = Math.min(640, viewW - 40);
    const h = 150 + lines.length * 30;
    const x = (viewW - w) / 2;
    const y = (viewH - h) / 2;
    ctx.fillStyle = 'rgba(10,14,20,0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent || '#ffd23a';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent || '#ffd23a';
    ctx.font = '800 40px ' + FONT;
    ctx.fillText(title, viewW / 2, y + 62);
    ctx.fillStyle = '#eef1f5';
    ctx.font = '16px ' + FONT;
    for (let i = 0; i < lines.length; i += 1) {
      ctx.fillText(lines[i], viewW / 2, y + 104 + i * 30);
    }
    ctx.fillStyle = '#ffd23a';
    ctx.font = '700 16px ' + FONT;
    ctx.fillText(prompt, viewW / 2, y + h - 22);
  }

  function draw(state, screen, now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(0, 0, viewW, viewH);
    // Camera shake: a random offset up to `state.shake` world pixels, so a
    // crash or a police ram lands on screen as well as in the health bar.
    const sh = state.shake || 0;
    const camX = camera.x + (sh > 0 ? (Math.random() * 2 - 1) * sh : 0);
    const camY = camera.y + (sh > 0 ? (Math.random() * 2 - 1) * sh : 0);
    if (screen === SCREEN_TITLE || screen === SCREEN_INTRO) {
      // Title over a slow pan of the city.
      ctx.save();
      ctx.setTransform(dpr * camera.scale, 0, 0, dpr * camera.scale,
        dpr * (viewW / 2 - camX * camera.scale), dpr * (viewH / 2 - camY * camera.scale));
      drawWorld(state, now);
      ctx.restore();
      ctx.fillStyle = 'rgba(8,10,18,0.45)';
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd23a';
      ctx.font = '800 64px ' + FONT;
      ctx.fillText(GAME_TITLE, viewW / 2, viewH * 0.24);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 22px ' + FONT;
      ctx.fillText('An open-world crime story in Coral Bay', viewW / 2, viewH * 0.24 + 38);
      if (screen === SCREEN_TITLE) {
        drawPanel('WELCOME TO CORAL BAY', [
          'Steal cars. Lose the cops. Do Mara\'s jobs. Own the city.',
          'WASD move / drive  •  Mouse aim  •  Click shoot  •  F punch',
          'E enter / exit car  •  Shift run  •  P pause  •  M mute',
          `Cash $${state.cash}  •  Jobs done ${state.stats.missionsDone} of ${MISSIONS.length}`,
        ], 'Press ENTER or click to start  •  C continue saved game', '#ffd23a');
      } else {
        drawPanel('THE STORY SO FAR', STORY_INTRO, 'Press ENTER to begin Job 1', '#4fc9c2');
      }
      return;
    }
    // Play and its overlays.
    ctx.save();
    ctx.setTransform(dpr * camera.scale, 0, 0, dpr * camera.scale,
      dpr * (viewW / 2 - camX * camera.scale), dpr * (viewH / 2 - camY * camera.scale));
    drawWorld(state, now);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(ctx, state, viewW, viewH, now);
    }
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', [
        'The city waits for no one — except now.',
        `Cash $${state.cash}  •  Jobs done ${state.stats.missionsDone} of ${MISSIONS.length}  •  Cars stolen ${state.stats.carsStolen}`,
        'Progress saves automatically when you finish a job.',
      ], 'Press P or click to resume', '#4fc9c2');
    } else if (screen === SCREEN_OVER) {
      drawPanel('WASTED', [
        'Rico went down in the streets of Coral Bay.',
        `Cash $${state.cash}  •  Jobs done ${state.stats.missionsDone} of ${MISSIONS.length}`,
      ], 'Press ENTER to try again', '#e5534b');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', [
        'The Coral Bay Police Department caught up with Rico.',
        `Cash $${state.cash}  •  Jobs done ${state.stats.missionsDone} of ${MISSIONS.length}`,
        'Bail costs $100. Pay up and get back to work.',
      ], 'Press ENTER to post bail and continue', '#3d7ad9');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, camera, updateCamera, resize };
}
