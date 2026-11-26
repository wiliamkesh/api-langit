// Api Langit — water: scooping from the lake and dropping on the fire.
// One particle pool (THREE.Points) serves three effects: the scoop spray
// behind the floats, the drop stream falling from the belly, and the steam
// where water meets fire. A drop particle that reaches the ground hands its
// water to the fire system at that spot; a full tank puts out about one fire.

import * as THREE from 'three';
import { CONFIG } from './config.js';

const POOL = 900;
const DROP_PER_PARTICLE = 0.5;
const DROP_SPAWN_PER_SEC = 220;
const SPRAY_SPAWN_PER_SEC = 140;

function makeDotTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.75)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createWaterSystem(scene, world, fireSystem) {
  const positions = new Float32Array(POOL * 3);
  const colors = new Float32Array(POOL * 3);
  const velocities = new Float32Array(POOL * 3);
  const life = new Float32Array(POOL);
  const kind = new Uint8Array(POOL); // 0 = drop, 1 = spray, 2 = steam
  for (let i = 0; i < POOL; i++) positions[i * 3 + 1] = -9999;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 5.0, map: makeDotTexture(), vertexColors: true, transparent: true,
    opacity: 0.95, depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  let cursor = 0;
  let dropAcc = 0;
  let sprayAcc = 0;
  let steamAcc = 0;

  function spawn(x, y, z, vx, vy, vz, r, g, b, ttl, k) {
    const i = cursor;
    cursor = (cursor + 1) % POOL;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    velocities[i * 3] = vx;
    velocities[i * 3 + 1] = vy;
    velocities[i * 3 + 2] = vz;
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
    life[i] = ttl;
    kind[i] = k;
  }

  const system = {
    level: 0,
    isScooping: false,
    isDropping: false,
    // Screenshot mode: the drop is visual only, so the fire stays lit
    // for the shot instead of being put out while the camera waits.
    noKill: false,
    // Exposed for debugging (particle counts, stream checks).
    points,

    update(dt, flight, input, time) {
      const C = CONFIG;
      const p = flight.pos;
      const overLake = world.isOverLake(p.x, p.z);
      const altAboveWater = p.y - C.waterLevel;
      const speed = flight.speed;

      // --- Scoop: low over the lake, moving, not too fast, tank not full.
      const canScoop = overLake && altAboveWater < C.scoopMaxAlt && speed > 6
        && speed < C.scoopMaxSpeed && system.level < C.waterMax;
      system.isScooping = canScoop;
      if (canScoop) {
        system.level = Math.min(C.waterMax, system.level + C.scoopRate * dt);
        sprayAcc += SPRAY_SPAWN_PER_SEC * dt;
        while (sprayAcc >= 1) {
          sprayAcc -= 1;
          // Spray kicks up behind both floats in a tall fan.
          const side = Math.random() < 0.5 ? -1 : 1;
          spawn(
            p.x + side * 2.5, C.waterLevel + 0.6, p.z - 1,
            (Math.random() - 0.5) * 6 - Math.sin(flight.heading) * speed * 0.35,
            3 + Math.random() * 5,
            (Math.random() - 0.5) * 6 - Math.cos(flight.heading) * speed * 0.35,
            0.92, 0.96, 1.0, 1.0 + Math.random() * 0.5, 1,
          );
        }
      }

      // --- Drop: Space held, tank not empty, airborne.
      const wantDrop = input.drop && system.level > 0 && !flight.onGround;
      system.isDropping = wantDrop;
      if (wantDrop) {
        system.level = Math.max(0, system.level - C.dropRate * dt);
        dropAcc += DROP_SPAWN_PER_SEC * dt;
        while (dropAcc >= 1) {
          dropAcc -= 1;
          // A dense stream out of the belly, slightly behind the aircraft,
          // so it reads as one solid column of water from the chase view.
          spawn(
            p.x + (Math.random() - 0.5) * 1.4 - Math.sin(flight.heading) * 2,
            p.y - 1.8,
            p.z + (Math.random() - 0.5) * 1.4 - Math.cos(flight.heading) * 2,
            Math.sin(flight.heading) * speed * 0.92 + (Math.random() - 0.5) * 1.2,
            -2 - Math.random() * 2,
            Math.cos(flight.heading) * speed * 0.92 + (Math.random() - 0.5) * 1.2,
            0.55, 0.75, 1.0, 6, 0,
          );
        }
      }

      // --- Particles: gravity, ground, fire, steam.
      for (let i = 0; i < POOL; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        if (life[i] <= 0) {
          positions[i * 3 + 1] = -9999;
          continue;
        }
        const k = kind[i];
        if (k === 0) velocities[i * 3 + 1] -= 22 * dt; // drop falls fast
        else if (k === 1) velocities[i * 3 + 1] -= 6 * dt; // spray arcs
        else velocities[i * 3 + 1] += 3 * dt; // steam rises
        positions[i * 3] += velocities[i * 3] * dt;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
        const px = positions[i * 3];
        const py = positions[i * 3 + 1];
        const pz = positions[i * 3 + 2];
        if (k === 0) {
          const groundY = world.terrainHeight(px, pz);
          if (py <= groundY + 0.5) {
            // Water lands: hurt the fire here, puff a little steam.
            // In screenshot mode the drop is visual only (noKill).
            const killed = system.noKill ? 0 : fireSystem.applyWater(px, pz, DROP_PER_PARTICLE);
            if (killed > 0) {
              steamAcc += 2;
              while (steamAcc >= 1) {
                steamAcc -= 1;
                spawn(px, groundY + 1, pz,
                  (Math.random() - 0.5) * 2, 3 + Math.random() * 3, (Math.random() - 0.5) * 2,
                  0.9, 0.9, 0.9, 1.4, 2);
              }
            }
            life[i] = 0;
            positions[i * 3 + 1] = -9999;
          }
        } else if (k === 1 && py <= C.waterLevel) {
          life[i] = 0;
          positions[i * 3 + 1] = -9999;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
  return system;
}
