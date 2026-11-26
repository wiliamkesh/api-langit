// Api Langit — HUD: the flight instruments as an HTML overlay.
// The overlay is the pilot's panel: altitude, speed, heading and the mission
// readouts, plus a small minimap. Everything is text and bars so it stays
// readable when a screenshot is shrunk to a contact sheet.

import { CONFIG } from './config.js';

function compass(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

export function createHud() {
  const el = (id) => document.getElementById(id);
  const alt = el('hud-alt');
  const spd = el('hud-spd');
  const hdg = el('hud-hdg');
  const waypoint = el('hud-waypoint');
  const waterBar = el('hud-water-bar');
  const waterPct = el('hud-water-pct');
  const fuelBar = el('hud-fuel-bar');
  const fuelPct = el('hud-fuel-pct');
  const fireBar = el('hud-fire-bar');
  const firePct = el('hud-fire-pct');
  const scoreEl = el('hud-score');
  const objective = el('hud-objective');
  const statusEl = el('hud-status');
  const stall = el('hud-stall');
  const minimap = el('hud-minimap');
  const mctx = minimap ? minimap.getContext('2d') : null;

  function drawMinimap(flight, fireSystem) {
    if (!mctx) return;
    const S = minimap.width;
    const half = CONFIG.worldHalf;
    const toMap = (x, z) => [(x / half * 0.5 + 0.5) * S, (z / half * 0.5 + 0.5) * S];
    mctx.clearRect(0, 0, S, S);
    mctx.fillStyle = 'rgba(20, 40, 24, 0.85)';
    mctx.fillRect(0, 0, S, S);
    // Lake.
    const [lx, ly] = toMap(CONFIG.lakeCenter.x, CONFIG.lakeCenter.z);
    mctx.fillStyle = '#2a6ea8';
    mctx.beginPath();
    mctx.arc(lx, ly, (CONFIG.lakeRadius / half * 0.5) * S, 0, Math.PI * 2);
    mctx.fill();
    // Airstrip.
    const [sx, sy] = toMap(CONFIG.stripCenter.x, CONFIG.stripCenter.z);
    mctx.strokeStyle = '#c8c8c8';
    mctx.lineWidth = 2;
    mctx.beginPath();
    mctx.moveTo(sx - 8, sy);
    mctx.lineTo(sx + 8, sy);
    mctx.stroke();
    // Fires.
    for (const zone of fireSystem.zones) {
      if (zone.out) continue;
      const [fx, fy] = toMap(zone.x, zone.z);
      mctx.fillStyle = '#ff5a1e';
      mctx.beginPath();
      mctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
      mctx.fill();
      mctx.strokeStyle = 'rgba(255,90,30,0.5)';
      mctx.beginPath();
      mctx.arc(fx, fy, 6, 0, Math.PI * 2);
      mctx.stroke();
    }
    // Aircraft: a white triangle pointing along its heading.
    const [ax, ay] = toMap(flight.pos.x, flight.pos.z);
    const a = flight.heading;
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(ax + Math.sin(a) * 7, ay + Math.cos(a) * 7);
    mctx.lineTo(ax + Math.sin(a + 2.5) * 5, ay + Math.cos(a + 2.5) * 5);
    mctx.lineTo(ax + Math.sin(a - 2.5) * 5, ay + Math.cos(a - 2.5) * 5);
    mctx.closePath();
    mctx.fill();
  }

  return {
    update(s) {
      // s: { flight, water, fire, score, objective, status, stalled, time }
      const f = s.flight;
      const altFt = Math.max(0, Math.round((f.pos.y - CONFIG.waterLevel) * 3.28084));
      const kts = Math.round(f.speed * 1.94384);
      alt.textContent = `ALT: ${altFt} FT`;
      spd.textContent = `SPD: ${kts} KTS`;
      const hdgDeg = Math.round((((f.heading * 180 / Math.PI) % 360) + 360) % 360);
      hdg.textContent = `HDG: ${hdgDeg}° ${compass(hdgDeg)}`;
      const near = s.fire.nearestActive(f.pos.x, f.pos.z);
      if (near) {
        const km = (near.distance / 1000).toFixed(1);
        waypoint.textContent = `WAYPOINT → FIRE ZONE ${km} KM`;
      } else {
        waypoint.textContent = 'WAYPOINT → ALL CLEAR';
      }
      const water = Math.round(s.water.level);
      waterBar.style.width = `${water}%`;
      waterPct.textContent = `${water}%`;
      const fuel = Math.round(s.fuel);
      fuelBar.style.width = `${fuel}%`;
      fuelPct.textContent = `${fuel}%`;
      fuelBar.className = fuel < 25 ? 'bar fuel low' : 'bar fuel';
      const fire = Math.round(s.fire.totalIntensity());
      const fireMax = 100 * Math.max(1, s.fire.zones.length);
      const fireShown = Math.round((fire / fireMax) * 100);
      fireBar.style.width = `${Math.min(100, fireShown)}%`;
      firePct.textContent = `${fireShown}%`;
      scoreEl.textContent = `SCORE: ${Math.round(s.score)}`;
      objective.textContent = s.objective;
      statusEl.textContent = s.status;
      stall.style.display = s.stalled ? 'block' : 'none';
      drawMinimap(f, s.fire);
    },
    showMenu(show) {
      document.getElementById('menu').style.display = show ? 'flex' : 'none';
    },
    showEnd(title, lines) {
      const end = document.getElementById('end');
      document.getElementById('end-title').textContent = title;
      document.getElementById('end-lines').innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
      end.style.display = 'flex';
    },
    hideEnd() {
      document.getElementById('end').style.display = 'none';
    },
  };
}
