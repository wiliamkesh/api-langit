// Api Langit — wildfire: zones that burn, spread, smoke and go out.
// A fire zone is a patch of forest with an intensity (0..100) and a radius
// that grows while it burns. Water dropped inside the radius kills the
// intensity; at 0 the zone is out and leaves a scorched patch behind.
// Waves spawn 1, then 2, then 3 zones; clearing every wave wins the game.

import * as THREE from 'three';
import { CONFIG } from './config.js';

// Candidate fire spots: forested valley floor, clear of lake and strip.
const SPOTS = [
  { x: 350, z: -150 },
  { x: 650, z: 300 },
  { x: -50, z: -550 },
  { x: 200, z: 650 },
  { x: -700, z: -350 },
  { x: 750, z: -400 },
];

function makeRadialTexture(inner, mid, outer) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.45, mid);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// A pointed flame tongue: a teardrop with a white-hot core, orange mid and
// red transparent edge, drawn once on a canvas and reused by every flame
// sprite. Pointed, not round, so the fire reads as FLAME, not a glow blob.
function makeFlameTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 256);
  // Outer tongue (orange-red).
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,230,140,0.95)');
  grad.addColorStop(0.35, 'rgba(255,170,40,0.92)');
  grad.addColorStop(0.7, 'rgba(255,90,15,0.85)');
  grad.addColorStop(1, 'rgba(190,30,0,0.0)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(64, 6); // pointed tip
  g.bezierCurveTo(104, 70, 116, 130, 110, 190);
  g.bezierCurveTo(106, 232, 88, 252, 64, 252);
  g.bezierCurveTo(40, 252, 22, 232, 18, 190);
  g.bezierCurveTo(12, 130, 24, 70, 64, 6);
  g.fill();
  // Inner core (white-hot yellow), shorter and narrower.
  const core = g.createLinearGradient(0, 60, 0, 256);
  core.addColorStop(0, 'rgba(255,246,200,0.98)');
  core.addColorStop(0.5, 'rgba(255,210,90,0.95)');
  core.addColorStop(1, 'rgba(255,120,20,0.0)');
  g.fillStyle = core;
  g.beginPath();
  g.moveTo(64, 62);
  g.bezierCurveTo(88, 110, 94, 160, 90, 205);
  g.bezierCurveTo(88, 232, 78, 250, 64, 250);
  g.bezierCurveTo(50, 250, 40, 232, 38, 205);
  g.bezierCurveTo(34, 160, 40, 110, 64, 62);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export function createFireSystem(scene, world) {
  const flameTex = makeFlameTexture();
  const glowTex = makeRadialTexture(
    'rgba(255,205,80,1)', 'rgba(255,140,30,0.85)', 'rgba(200,40,0,0)',
  );
  const smokeTex = makeRadialTexture(
    'rgba(90,85,85,0.55)', 'rgba(70,66,66,0.4)', 'rgba(60,58,58,0)',
  );
  const emberTex = makeRadialTexture(
    'rgba(255,220,120,1)', 'rgba(255,120,20,0.9)', 'rgba(255,60,0,0)',
  );
  const zones = [];
  let spotIndex = 0;

  function makeZone(spot) {
    const group = new THREE.Group();
    const groundY = world.terrainHeight(spot.x, spot.z);
    group.position.set(spot.x, groundY, spot.z);
    // Scorched ground: a dark disc that grows with the fire.
    const scorch = new THREE.Mesh(
      new THREE.CircleGeometry(1, 24),
      new THREE.MeshBasicMaterial({ color: 0x33291f, transparent: true, opacity: 0.62 }),
    );
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.y = 0.4;
    group.add(scorch);
    // Target ring: a bright glowing ring on the ground around the fire,
    // so the fire zone reads as the mission target from the air.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1.08, 48),
      new THREE.MeshBasicMaterial({
        color: 0xff7a00, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.8;
    group.add(ring);
    // Hot base glow: a low wide wash of heat under the flame tongues.
    const baseGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0.85,
    }));
    baseGlow.position.set(0, 4, 0);
    baseGlow.scale.set(46, 18, 1);
    baseGlow.userData.baseScale = baseGlow.scale.clone();
    group.add(baseGlow);
    // Flames: pointed teardrop tongues that flicker; taller in the middle,
    // shorter at the rim, so the fire has a peak instead of a flat top.
    const flames = [];
    const FLAME_COUNT = 18;
    for (let i = 0; i < FLAME_COUNT; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: flameTex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      // Spread the flames across the burning disc, not stacked on one spot.
      const a = (i / FLAME_COUNT) * Math.PI * 2 + (i % 3) * 0.7;
      const r = (0.12 + (i % 5) * 0.16) * CONFIG.fireStartRadius * 0.55;
      const tall = i % 5 === 0; // every fifth flame is a tall central tongue
      const w = (tall ? 8 : 6) + (i % 3) * 1.5;
      const h = (tall ? 30 : 18) + (i % 4) * 3;
      s.position.set(Math.cos(a) * r, h * 0.42, Math.sin(a) * r);
      s.scale.set(w, h, 1);
      s.userData.baseScale = s.scale.clone();
      s.userData.phase = i * 1.37;
      s.userData.baseY = s.position.y;
      group.add(s);
      flames.push(s);
    }
    // Embers: bright sparks that shoot up from the fire and fade.
    const embers = [];
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: emberTex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0.9,
      }));
      s.position.set((i % 4 - 1.5) * 6, 6 + i * 3, ((i + 2) % 4 - 1.5) * 6);
      s.scale.set(2.2, 2.2, 1);
      s.userData.phase = i * 0.9;
      s.userData.speed = 9 + (i % 4) * 3;
      group.add(s);
      embers.push(s);
    }
    const smokes = [];
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: smokeTex, transparent: true, depthWrite: false, opacity: 0.55,
      }));
      s.position.set((i % 3 - 1) * 7, 16 + i * 4.5, ((i + 1) % 3 - 1) * 7);
      s.scale.set(24 + i * 4, 24 + i * 4, 1);
      s.userData.phase = i * 2.1;
      group.add(s);
      smokes.push(s);
    }
    scene.add(group);
    return {
      x: spot.x,
      z: spot.z,
      radius: CONFIG.fireStartRadius,
      intensity: CONFIG.fireIntensityStart,
      age: 0,
      out: false,
      group,
      scorch,
      ring,
      baseGlow,
      flames,
      embers,
      smokes,
    };
  }

  function spawnWave(count) {
    const spawned = [];
    for (let i = 0; i < count; i++) {
      const spot = SPOTS[spotIndex % SPOTS.length];
      spotIndex++;
      const zone = makeZone(spot);
      zones.push(zone);
      spawned.push(zone);
    }
    return spawned;
  }

  function applyWater(x, z, amount) {
    // Water that lands inside a zone's radius kills its intensity.
    let killed = 0;
    for (const zone of zones) {
      if (zone.out) continue;
      const d = Math.hypot(x - zone.x, z - zone.z);
      if (d < zone.radius + 25) {
        const before = zone.intensity;
        zone.intensity = Math.max(0, zone.intensity - amount);
        killed += before - zone.intensity;
        if (zone.intensity <= 0) {
          zone.out = true;
          zone.group.visible = false; // flames + smoke gone, scorch stays? no: hide all
          zone.scorch.visible = true;
          zone.ring.visible = false;
          zone.group.visible = true;
          for (const f of zone.flames) f.visible = false;
          for (const e of zone.embers) e.visible = false;
          zone.baseGlow.visible = false;
          for (const s of zone.smokes) s.visible = false;
        }
      }
    }
    return killed;
  }

  function update(dt, time) {
    for (const zone of zones) {
      if (zone.out) continue;
      zone.age += dt;
      // The fire spreads once it has had its grace period.
      if (zone.age > CONFIG.fireSpreadGrace && zone.radius < CONFIG.fireMaxRadius) {
        zone.radius += CONFIG.fireGrowRate * dt;
      }
      const grow = zone.radius / CONFIG.fireStartRadius;
      const flick = zone.intensity / 100;
      zone.scorch.scale.set(zone.radius, zone.radius, 1);
      // Target ring: hugs the fire's edge and pulses, so the zone reads
      // as the mission target from the air.
      zone.ring.scale.set(zone.radius, zone.radius, 1);
      zone.ring.material.opacity = 0.6 + Math.sin(time * 3) * 0.25;
      zone.baseGlow.scale.set(
        zone.baseGlow.userData.baseScale.x * grow * flick,
        zone.baseGlow.userData.baseScale.y * (0.7 + flick * 0.5),
        1,
      );
      for (const f of zone.flames) {
        const w = Math.sin(time * 6 + f.userData.phase) * 0.5 + 0.5;
        const s = f.userData.baseScale;
        f.scale.set(s.x * (0.75 + w * 0.45) * grow * flick, s.y * (0.8 + w * 0.4) * grow * flick, 1);
        f.material.opacity = 0.5 + w * 0.4;
      }
      for (const e of zone.embers) {
        e.position.y += dt * e.userData.speed;
        if (e.position.y > 52) {
          e.position.y = 5;
          e.position.x = (Math.sin(time * 2 + e.userData.phase) * 14);
          e.position.z = (Math.cos(time * 1.7 + e.userData.phase) * 14);
        }
        e.material.opacity = 0.95 * (1 - e.position.y / 55);
      }
      for (const s of zone.smokes) {
        s.position.y += dt * 2.2;
        if (s.position.y > 46) s.position.y = 12;
        s.material.opacity = 0.42 + Math.sin(time * 1.5 + s.userData.phase) * 0.14;
      }
    }
  }

  function activeZones() {
    return zones.filter((z) => !z.out);
  }
  function totalIntensity() {
    let sum = 0;
    for (const z of zones) if (!z.out) sum += z.intensity;
    return sum;
  }
  function maxRadius() {
    let m = 0;
    for (const z of zones) if (!z.out) m = Math.max(m, z.radius);
    return m;
  }
  function nearestActive(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const zone of activeZones()) {
      const d = Math.hypot(x - zone.x, z - zone.z);
      if (d < bestD) {
        bestD = d;
        best = zone;
      }
    }
    return best ? { zone: best, distance: bestD } : null;
  }

  return {
    zones,
    spawnWave,
    applyWater,
    update,
    activeZones,
    totalIntensity,
    maxRadius,
    nearestActive,
  };
}
