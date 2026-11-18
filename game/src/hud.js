// HUD and minimap: health bar, cash, wanted stars, clock, mission tracker,
// weapon readout, and the live minimap in the corner.
import { BEACH_X, DISTRICTS, ROAD_XS, ROAD_YS, WATER_X, WORLD_H, WORLD_W } from './config.js';
import { missionTarget } from './missions.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function fmtClock(seconds) {
  const total = Math.floor(seconds) % 86400;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function drawHud(ctx, state, w, h, now) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  // Top-left: health + cash.
  ctx.fillStyle = 'rgba(10,14,20,0.62)';
  ctx.fillRect(14, 12, 250, 64);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = `700 15px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('RICO VEGA', 26, 34);
  ctx.fillStyle = '#2a2f38';
  ctx.fillRect(26, 42, 150, 12);
  const hpFrac = Math.max(0, state.player.hp / 100);
  ctx.fillStyle = hpFrac > 0.5 ? '#4fd17a' : hpFrac > 0.25 ? '#e8c33a' : '#e5534b';
  ctx.fillRect(26, 42, 150 * hpFrac, 12);
  ctx.fillStyle = '#4fd17a';
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText(`$${state.cash}`, 188, 55);
  ctx.fillStyle = '#8b93a3';
  ctx.font = `12px ${FONT}`;
  ctx.fillText(state.player.weapon === 'pistol' ? `PISTOL  ${state.player.ammo} rounds` : 'FISTS — find a pistol', 26, 70);

  // Top-right: wanted stars + clock.
  ctx.fillStyle = 'rgba(10,14,20,0.62)';
  ctx.fillRect(w - 264, 12, 250, 64);
  ctx.textAlign = 'right';
  ctx.font = `700 15px ${FONT}`;
  ctx.fillStyle = '#e8e8e8';
  ctx.fillText(fmtClock(state.clock), w - 26, 34);
  ctx.fillText(state.wanted > 0 ? 'WANTED' : 'CLEAN', w - 26, 55);
  ctx.font = '22px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
  ctx.fillStyle = state.wanted > 0 ? '#ffd23a' : '#8b93a3';
  ctx.fillText(stars, w - 120, 58);

  // Mission tracker, under the health box.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(10,14,20,0.62)';
  const obj = state.mission.objective || '';
  ctx.fillRect(14, 84, Math.min(430, 24 + ctx.measureText(obj).width + 30), 30);
  ctx.fillStyle = '#ffd23a';
  ctx.font = `700 14px ${FONT}`;
  ctx.fillText('◆ ' + obj, 26, 104);

  // Toast + banner.
  if (state.message && state.time < state.message.until) {
    ctx.fillStyle = 'rgba(10,14,20,0.75)';
    ctx.font = `14px ${FONT}`;
    const tw = ctx.measureText(state.message.text).width;
    ctx.fillRect((w - tw) / 2 - 12, h - 84, tw + 24, 28);
    ctx.fillStyle = '#eef1f5';
    ctx.textAlign = 'center';
    ctx.fillText(state.message.text, w / 2, h - 65);
  }
  if (state.banner && state.time < state.banner.until) {
    const alpha = Math.min(1, (state.banner.until - state.time) / 0.6);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23a';
    ctx.font = `800 34px ${FONT}`;
    ctx.fillText(state.banner.text, w / 2, h * 0.3);
    ctx.fillStyle = '#eef1f5';
    ctx.font = `16px ${FONT}`;
    ctx.fillText(state.banner.sub, w / 2, h * 0.3 + 28);
    ctx.globalAlpha = 1;
  }

  // Controls hint, bottom-left.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  ctx.fillRect(14, h - 34, 560, 22);
  ctx.fillStyle = '#c8cdd6';
  ctx.font = `12px ${FONT}`;
  ctx.fillText('WASD move/drive  •  Mouse aim  •  Click shoot  •  F punch  •  E enter/exit car  •  Shift run  •  P pause  •  M mute', 22, h - 19);

  drawMinimap(ctx, state, w, h, now);
  ctx.restore();
}

function drawMinimap(ctx, state, w, h, now) {
  const size = 178;
  const x0 = w - size - 14;
  const y0 = h - size - 14;
  const sx = size / WORLD_W;
  const sy = size / WORLD_H;
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.fillRect(x0 - 6, y0 - 6, size + 12, size + 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  // Land, water, roads.
  ctx.fillStyle = '#3a4a3a';
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#2e6a8a';
  ctx.fillRect(x0 + WATER_X * sx, y0, size - WATER_X * sx, size);
  ctx.fillStyle = '#d9c48a';
  ctx.fillRect(x0 + BEACH_X * sx, y0, (WATER_X - BEACH_X) * sx, size);
  ctx.strokeStyle = '#5a5f68';
  ctx.lineWidth = 3;
  for (const rx of ROAD_XS) {
    ctx.beginPath();
    ctx.moveTo(x0 + rx * sx, y0);
    ctx.lineTo(x0 + rx * sx, y0 + size);
    ctx.stroke();
  }
  for (const ry of ROAD_YS) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ry * sy);
    ctx.lineTo(x0 + size, y0 + ry * sy);
    ctx.stroke();
  }
  // District labels are too small to read; show parks instead.
  ctx.fillStyle = '#4f8a4a';
  for (const park of state.city.parks) {
    ctx.fillRect(x0 + park.x * sx, y0 + park.y * sy, park.w * sx, park.h * sy);
  }
  // Mission marker, pulsing.
  const target = missionTarget(state);
  if (target) {
    const pulse = 3 + Math.sin(now / 260) * 1.5;
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath();
    ctx.arc(x0 + target.x * sx, y0 + target.y * sy, pulse + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#11141b';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(target.label, x0 + target.x * sx, y0 + target.y * sy + 3);
  }
  // Cars, cops, player.
  ctx.fillStyle = '#e8e8e8';
  for (const car of state.cars) {
    if (car.driver === 'parked') continue;
    ctx.fillRect(x0 + car.x * sx - 1.5, y0 + car.y * sy - 1.5, 3, 3);
  }
  ctx.fillStyle = '#3d7ad9';
  for (const pc of state.policeCars) {
    ctx.fillRect(x0 + pc.x * sx - 2, y0 + pc.y * sy - 2, 4, 4);
  }
  ctx.fillStyle = '#3d7ad9';
  for (const cop of state.cops) {
    ctx.fillRect(x0 + cop.x * sx - 1.5, y0 + cop.y * sy - 1.5, 3, 3);
  }
  const p = state.player;
  ctx.save();
  ctx.translate(x0 + p.x * sx, y0 + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.strokeRect(x0 - 6, y0 - 6, size + 12, size + 12);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = `700 11px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('CORAL BAY', x0 - 6, y0 - 10);
  void DISTRICTS;
}
