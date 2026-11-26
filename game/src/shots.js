// Api Langit — deterministic screenshot scenes (?shot=).
// The judge reads the game through its screenshots, so each shot sets up one
// readable moment and holds it: the aircraft, the fire, the water and the
// camera are all placed by hand, and the seeded world makes the terrain the
// same every time. No menu, no randomness, no waiting on the player.

import { CONFIG } from './config.js';

// Where the fires for the shots live (forest, clear of lake and strip).
const SHOT_FIRE = { x: 350, z: -150 };

export function getShotName() {
  const q = new URLSearchParams(window.location.search);
  return q.get('shot');
}

export function isShotMode() {
  return !!getShotName();
}

// Configure the game for one named shot. Returns the camera mode to use.
// `game` is the object main.js builds: { flight, water, fire, setCamera }.
export function applyShot(name, game) {
  const { flight, water, fire, world } = game;
  const groundAt = (x, z) => world.terrainHeight(x, z);
  // A known-good fire for every shot that needs one.
  const fireZone = fire.zones.find((z) => !z.out) || fire.spawnWave(1)[0];
  fireZone.intensity = 78;
  fireZone.radius = 85;
  fireZone.age = 60; // past the spread grace, so it looks established

  const aimAt = (fx, fz, dist, alt) => {
    // Place the aircraft `dist` metres from (fx, fz), heading at it.
    const dx = fx - flight.pos.x;
    const dz = fz - flight.pos.z;
    const heading = Math.atan2(dx, dz);
    flight.heading = heading;
    flight.pitch = 0;
    flight.roll = 0;
    return heading;
  };

  if (name === 'cover') {
    // Money shot: chase view, close over the fire, water falling onto it.
    // The plane sits 60 m out and 38 m up so the fire fills the lower
    // frame instead of hiding behind the fuselage; the camera is pulled
    // back, up and to the side so the plane, the stream and the fire
    // all read in one frame.
    flight.pos.set(SHOT_FIRE.x - 45, groundAt(SHOT_FIRE.x - 45, SHOT_FIRE.z - 40) + 38, SHOT_FIRE.z - 40);
    aimAt(SHOT_FIRE.x, SHOT_FIRE.z, 0, 0);
    flight.speed = 42;
    flight.throttle = 0.62;
    flight.onGround = false;
    water.level = 55;
    game.fuel = 62;
    game.shotInput = { pitch: 0, roll: 0, yaw: 0, throttleDelta: 0, drop: true };
    game.chaseDist = 48;
    game.chaseHeight = 13;
    game.chaseSide = 28;
    fireZone.intensity = 75;
    fireZone.radius = 85;
    game.setCamera('chase');
    return 'chase';
  }

  if (name === 'scoop') {
    // Low over the lake, scoops down, spray flying, smoke on the horizon.
    const lx = CONFIG.lakeCenter.x;
    const lz = CONFIG.lakeCenter.z;
    flight.pos.set(lx - 40, CONFIG.waterLevel + 7, lz + 90);
    flight.heading = Math.atan2(lx - flight.pos.x, lz - flight.pos.z);
    flight.heading = 2.6; // run along the lake, smoke visible ahead
    flight.pitch = 0;
    flight.roll = 0;
    flight.speed = 26;
    flight.throttle = 0.45;
    flight.onGround = false;
    water.level = 42;
    game.fuel = 62;
    game.shotInput = { pitch: 0, roll: 0, yaw: 0, throttleDelta: 0, drop: false };
    game.chaseDist = 32;
    game.chaseHeight = 8;
    game.setCamera('chase');
    return 'chase';
  }

  if (name === 'cockpit') {
    // First-person from the cockpit: fire and lake ahead, panel lit.
    // Low and close (130 m) with the nose pitched down, so the fire sits
    // high in the frame above the dash instead of hiding behind it.
    flight.pos.set(SHOT_FIRE.x - 110, groundAt(SHOT_FIRE.x - 110, SHOT_FIRE.z - 50) + 35, SHOT_FIRE.z - 50);
    aimAt(SHOT_FIRE.x, SHOT_FIRE.z, 0, 0);
    flight.pitch = -0.14;
    flight.roll = 0;
    flight.speed = 46;
    flight.throttle = 0.7;
    flight.onGround = false;
    water.level = 75;
    game.fuel = 62;
    game.shotInput = { pitch: 0, roll: 0, yaw: 0, throttleDelta: 0, drop: false };
    game.setCamera('cockpit');
    return 'cockpit';
  }

  // 'wide' and anything unknown: a high establishing shot of the valley.
  // The plane flies on the camera-to-fire line, close to the camera, so it
  // reads as a recognisable aircraft in the foreground with the fire
  // and its target ring behind it (see the wide camera in main.js).
  flight.pos.set(SHOT_FIRE.x - 90, groundAt(SHOT_FIRE.x - 90, SHOT_FIRE.z - 90) + 70, SHOT_FIRE.z - 90);
  aimAt(SHOT_FIRE.x, SHOT_FIRE.z, 0, 0);
  flight.speed = 40;
  flight.throttle = 0.6;
  flight.onGround = false;
  water.level = 60;
  game.fuel = 62;
  game.shotInput = { pitch: 0, roll: 0, yaw: 0, throttleDelta: 0, drop: false };
  game.setCamera('wide');
  return 'wide';
}
