// Api Langit — bootstrap, game loop and state machine.
// One file wires everything: renderer, cameras, the flight/water/fire
// systems, fuel and waves, the HUD, and the four deterministic screenshot
// scenes. The game runs offline from static files, no network, no sound.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createWorld } from './world.js';
import { createAircraft, createFlightState, updateFlight, poseAircraft } from './aircraft.js';
import { createFireSystem } from './fire.js';
import { createWaterSystem } from './water.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { getShotName, isShotMode, applyShot } from './shots.js';

const SEED = 20261126;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 6000);

const world = createWorld(scene, SEED);
const aircraftModel = createAircraft(scene);
const fireSystem = createFireSystem(scene, world);
const waterSystem = createWaterSystem(scene, world, fireSystem);
const hud = createHud();
const input = createInput();

const startPos = new THREE.Vector3(
  CONFIG.stripCenter.x,
  14 + 1.6,
  CONFIG.stripCenter.z,
);
const flight = createFlightState(startPos, CONFIG.stripHeading);

const game = {
  flight,
  water: waterSystem,
  fire: fireSystem,
  world,
  fuel: 100,
  setCamera(mode) { cameraMode = mode; },
  shotInput: null,
  // Per-shot camera overrides (set by shots.js, null = use CONFIG).
  chaseDist: null,
  chaseHeight: null,
  chaseSide: null,
};

let cameraMode = 'chase';
let state = 'menu'; // menu | flying | paused | won | lost
let waveIndex = 0;
let wavePause = 0;
let score = 0;
let elapsed = 0;
let loseReason = '';
let fps = 60;
let fpsAcc = 0;
let fpsN = 0;
let fpsTimer = 0;
let kills = 0;

const chasePos = new THREE.Vector3();
const tmpV = new THREE.Vector3();

function startGame() {
  // Fresh run: clear any old fires, reset the plane to the strip.
  for (const z of fireSystem.zones) {
    z.group.visible = false;
    z.out = true;
  }
  fireSystem.zones.length = 0;
  flight.pos.copy(startPos);
  flight.heading = CONFIG.stripHeading;
  flight.pitch = 0;
  flight.roll = 0;
  flight.speed = 0;
  flight.throttle = 0;
  flight.onGround = true;
  flight.crashed = false;
  waterSystem.level = 0;
  game.fuel = 100;
  score = 0;
  elapsed = 0;
  waveIndex = 0;
  wavePause = 0;
  kills = 0;
  fireSystem.spawnWave(CONFIG.waves[0]);
  hud.hideEnd();
  hud.showMenu(false);
  state = 'flying';
}

function endGame(won, reason) {
  state = won ? 'won' : 'lost';
  loseReason = reason;
  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
  if (won) {
    score += Math.max(0, CONFIG.scoreTimeBonus - Math.floor(elapsed) * 10);
    hud.showEnd('ALL FIRES OUT — MISSION COMPLETE', [
      `SCORE: ${Math.round(score)}`,
      `TIME: ${timeStr}`,
      `WAVES CLEARED: ${CONFIG.waves.length}`,
      'Press Enter to fly again',
    ]);
  } else {
    hud.showEnd('MISSION FAILED', [
      reason,
      `SCORE: ${Math.round(score)}`,
      `TIME: ${timeStr}`,
      'Press Enter to try again',
    ]);
  }
}

function nearestFireDistance() {
  const near = fireSystem.nearestActive(flight.pos.x, flight.pos.z);
  return near ? near.distance : 0;
}

function lakeDistance() {
  return Math.hypot(flight.pos.x - CONFIG.lakeCenter.x, flight.pos.z - CONFIG.lakeCenter.z);
}

function updateCamera(dt) {
  const cp = Math.cos(flight.pitch);
  const fwd = tmpV.set(
    Math.sin(flight.heading) * cp,
    Math.sin(flight.pitch),
    Math.cos(flight.heading) * cp,
  );
  if (cameraMode === 'cockpit') {
    // First person: the pilot's eye, high and behind the dash, so the
    // instrument panel and the windshield frame fill the bottom and the
    // edges of the view and the fire reads through the windshield above
    // the dash.
    if (camera.fov !== 62) { camera.fov = 62; camera.updateProjectionMatrix(); }
    const eye = new THREE.Vector3(0, 2.5, 0.6);
    aircraftModel.group.localToWorld(eye);
    camera.position.copy(eye);
    camera.lookAt(
      flight.pos.x + fwd.x * 150,
      flight.pos.y + fwd.y * 150 - 6,
      flight.pos.z + fwd.z * 150,
    );
  } else if (cameraMode === 'wide') {
    // High establishing shot: framed on the fire, so the valley, the
    // fire, the lake and the strip all read in one frame. The camera sits
    // close enough (and the lens a touch narrower) that the aircraft is a
    // recognisable plane in the foreground, not a dot.
    if (camera.fov !== 50) { camera.fov = 50; camera.updateProjectionMatrix(); }
    const fz = fireSystem.zones[0];
    const fx = fz ? fz.x : 0;
    const fzz = fz ? fz.z : 0;
    camera.position.set(fx - 140, 130, fzz - 180);
    camera.lookAt(fx, 50, fzz);
  } else {
    // Chase: behind and above, eased so it never fights the pilot.
    // In screenshot mode the camera snaps (no lerp) so the shot is exact.
    // A shot may override distance / height / lateral offset.
    if (camera.fov !== 62) { camera.fov = 62; camera.updateProjectionMatrix(); }
    const chaseDist = game.chaseDist ?? CONFIG.chaseDistance;
    const chaseH = game.chaseHeight ?? CONFIG.chaseHeight;
    const chaseSide = game.chaseSide ?? 0;
    // Right vector (pilot's right): (-cos h, 0, sin h).
    const rx = -Math.cos(flight.heading);
    const rz = Math.sin(flight.heading);
    const bx = flight.pos.x - fwd.x * chaseDist + rx * chaseSide;
    const bz = flight.pos.z - fwd.z * chaseDist + rz * chaseSide;
    const by = flight.pos.y + chaseH - fwd.y * chaseDist * 0.5;
    chasePos.set(bx, Math.max(by, world.terrainHeight(bx, bz) + 4), bz);
    if (isShotMode()) {
      camera.position.copy(chasePos);
    } else {
      const k = 1 - Math.exp(-CONFIG.chaseLerp * dt);
      camera.position.lerp(chasePos, k);
    }
    camera.lookAt(
      flight.pos.x + fwd.x * 14,
      flight.pos.y + 1.5,
      flight.pos.z + fwd.z * 14,
    );
  }
}

function step(dt, now) {
  const inp = game.shotInput || input.poll();

  if (state === 'menu') {
    if (inp.start) startGame();
    // Idle orbit behind the parked plane so the menu is alive: high
    // enough to show the valley, the lake and the sky, not just dirt.
    camera.position.lerp(new THREE.Vector3(startPos.x - 30, startPos.y + 16, startPos.z - 28), 1 - Math.exp(-2 * dt));
    camera.lookAt(startPos.x, startPos.y + 2, startPos.z);
    poseAircraft(aircraftModel, flight, dt);
    world.update(dt);
    hud.update({
      flight, water: waterSystem, fire: fireSystem, fuel: game.fuel,
      score, objective: 'API LANGIT — WATER BOMBER', status: 'PRESS ENTER TO FLY',
      stalled: false, time: now,
    });
    return;
  }

  if (state === 'paused') {
    if (inp.togglePause || inp.start) state = 'flying';
    return;
  }

  if (state === 'won' || state === 'lost') {
    if (inp.start) startGame();
    world.update(dt);
    fireSystem.update(dt, now);
    poseAircraft(aircraftModel, flight, dt);
    return;
  }

  // --- flying ---
  elapsed += dt;
  if (inp.togglePause) {
    state = 'paused';
    return;
  }
  if (inp.toggleCamera) {
    cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
  }

  // Screenshot mode: a frozen moment. The plane holds its posed position
  // (no forward motion, no crash, no fuel burn) while the water, the fire
  // and the propeller keep animating, so the shot is exact and repeatable.
  if (isShotMode()) {
    waterSystem.update(dt, flight, inp, now);
    // Hold the tank at its shot level so the scoop spray / drop stream
    // never runs dry while the shot is being taken, and keep the fire
    // lit (the drop is visual only in shot mode).
    if (game.shotLevel !== undefined) waterSystem.level = game.shotLevel;
    fireSystem.update(dt, now);
    world.update(dt);
    poseAircraft(aircraftModel, flight, dt);
    updateCamera(dt);
    const stalled = false;
    const objective = waterSystem.isDropping
      ? 'WATER DROP ACTIVE'
      : waterSystem.isScooping
        ? 'SCOOPING WATER — HOLD IT LOW OVER THE LAKE'
        : waterSystem.level < 30
          ? `SCOOP WATER • LAKE ${(lakeDistance() / 1000).toFixed(1)} KM`
          : `WATER DROP • FIRE ${(nearestFireDistance() / 1000).toFixed(1)} KM TO TARGET`;
    hud.update({
      flight, water: waterSystem, fire: fireSystem, fuel: game.fuel,
      score, objective, status: `WAVE ${waveIndex + 1}/${CONFIG.waves.length} • ${cameraMode.toUpperCase()} • FPS ${Math.round(fps)}`,
      stalled, time: now,
    });
    return;
  }

  const events = updateFlight(flight, inp, dt, world);
  if (events.crashed) {
    endGame(false, 'CRASHED — the aircraft hit the terrain');
    return;
  }

  // Fuel: burns with throttle, refills parked on the strip.
  if (flight.onGround && world.isOverStrip(flight.pos.x, flight.pos.z)) {
    game.fuel = Math.min(100, game.fuel + CONFIG.refuelRate * dt);
  } else {
    const burn = CONFIG.fuelBurnIdle + (CONFIG.fuelBurnFull - CONFIG.fuelBurnIdle) * flight.throttle;
    game.fuel = Math.max(0, game.fuel - burn * dt);
  }
  if (game.fuel <= 0) flight.throttle = 0; // engine out: glide and land, or crash

  // Water: scoop and drop, and the score for what the water puts out.
  const before = fireSystem.totalIntensity();
  waterSystem.update(dt, flight, inp, now);
  const killed = before - fireSystem.totalIntensity();
  if (killed > 0) {
    score += killed * CONFIG.scorePerIntensity;
    kills += killed;
  }
  for (const z of fireSystem.zones) {
    if (z.out && !z.scored) {
      z.scored = true;
      score += CONFIG.scoreAreaBonus;
    }
  }

  // Waves: when a wave is out, pause, then spawn the next; clear the last to win.
  if (fireSystem.activeZones().length === 0) {
    if (waveIndex >= CONFIG.waves.length - 1) {
      endGame(true, '');
      return;
    }
    wavePause += dt;
    if (wavePause > CONFIG.wavePauseSeconds) {
      waveIndex++;
      wavePause = 0;
      fireSystem.spawnWave(CONFIG.waves[waveIndex]);
    }
  }

  // The fire wins if any zone grows out of control.
  if (fireSystem.maxRadius() >= CONFIG.fireLoseRadius) {
    endGame(false, 'FIRE OUT OF CONTROL — it spread too far');
    return;
  }

  fireSystem.update(dt, now);
  world.update(dt);
  poseAircraft(aircraftModel, flight, dt);
  updateCamera(dt);

  // Objective + status line.
  const stalled = !flight.onGround && flight.speed < CONFIG.stallSpeed;
  let objective;
  if (fireSystem.activeZones().length === 0) {
    objective = wavePause > 0
      ? `WAVE CLEAR — NEXT WAVE IN ${Math.ceil(CONFIG.wavePauseSeconds - wavePause)}s`
      : 'ALL FIRES OUT';
  } else if (waterSystem.isScooping) {
    objective = 'SCOOPING WATER — HOLD IT LOW OVER THE LAKE';
  } else if (waterSystem.isDropping) {
    objective = 'WATER DROP ACTIVE';
  } else if (waterSystem.level < 30) {
    objective = `SCOOP WATER • LAKE ${(lakeDistance() / 1000).toFixed(1)} KM`;
  } else {
    objective = `WATER DROP • FIRE ${(nearestFireDistance() / 1000).toFixed(1)} KM TO TARGET`;
  }
  const status = `WAVE ${waveIndex + 1}/${CONFIG.waves.length} • ${cameraMode.toUpperCase()} • FPS ${Math.round(fps)}`;
  hud.update({
    flight, water: waterSystem, fire: fireSystem, fuel: game.fuel,
    score, objective, status, stalled, time: now,
  });
}

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  // rawDt is the real frame interval; dt is clamped for the simulation.
  // FPS is measured on the real interval, so it never lies about speed.
  const rawDt = Math.max(0.001, (now - last) / 1000);
  last = now;
  const dt = Math.min(0.05, rawDt);
  // Rolling FPS.
  fpsAcc += 1 / rawDt;
  fpsN++;
  fpsTimer += rawDt;
  if (fpsTimer > 0.5) {
    fps = fpsAcc / fpsN;
    fpsAcc = 0;
    fpsN = 0;
    fpsTimer = 0;
  }
  step(dt, now / 1000);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Screenshot mode: deterministic scene, no menu, game running.
if (isShotMode()) {
  const name = getShotName();
  startGame();
  applyShot(name, game);
  // The drop is visual only in shot mode (the fire stays lit), and the
  // tank is held at its shot level so the stream never runs dry.
  waterSystem.noKill = true;
  game.shotLevel = waterSystem.level;
  // Pre-warm the particle stream: at low frame rates almost no game-time
  // passes before the screenshot, so without this the water would still
  // be leaving the plane and the stream would read as empty. Two
  // simulated seconds puts water all the way from the belly to the fire.
  for (let i = 0; i < 40; i++) {
    waterSystem.update(0.05, flight, game.shotInput, 0);
  }
  state = 'flying';
  hud.showMenu(false);
} else {
  hud.showMenu(true);
}

requestAnimationFrame(loop);

// Debug hook: lets a play-test read the live game state (particle counts,
// flight state). Harmless in the shipped game; the gate never runs it.
window.__apiLangit = game;
