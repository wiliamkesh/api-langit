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

export function createFireSystem(scene, world) {
  const flameTex = makeRadialTexture(
    'rgba(255,205,80,1)', 'rgba(255,140,30,0.85)', 'rgba(200,40,0,0)',
  );
  const smokeTex = makeRadialTexture(
    'rgba(90,85,85,0.55)', 'rgba(70,66,66,0.4)', 'rgba(60,58,58,0)',
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
    // Flames: sprites that flicker; smoke: sprites that rise and fade.
    const flames = [];
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: flameTex, transparent: true, depthWrite: false,
      }));
      // Spread the flames across the burning disc, not stacked on one spot.
      const a = (i / 14) * Math.PI * 2 + (i % 3) * 0.7;
      const r = (0.15 + (i % 4) * 0.2) * CONFIG.fireStartRadius * 0.55;
      s.position.set(Math.cos(a) * r, 3 + (i % 3) * 2.5, Math.sin(a) * r);
      s.scale.set(9 + (i % 3) * 3, 12 + (i % 4) * 3, 1);
      s.userData.baseScale = s.scale.clone();
      s.userData.phase = i * 1.37;
      group.add(s);
      flames.push(s);
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
      flames,
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
          zone.group.visible = true;
          for (const f of zone.flames) f.visible = false;
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
      zone.scorch.scale.set(zone.radius, zone.radius, 1);
      const flick = zone.intensity / 100;
      for (const f of zone.flames) {
        const w = Math.sin(time * 6 + f.userData.phase) * 0.5 + 0.5;
        const s = f.userData.baseScale;
        f.scale.set(s.x * (0.75 + w * 0.45) * grow * flick, s.y * (0.8 + w * 0.4) * grow * flick, 1);
        f.material.opacity = 0.5 + w * 0.4;
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
