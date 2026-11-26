// Api Langit — the water bomber: model built from primitives + arcade flight.
// The aircraft is a yellow-red amphibious water bomber (CL-215 style): a
// boat hull, shoulder wing, twin props, red tips. The flight model is arcade
// on purpose: throttle sets a target speed, pitch/roll steer, bank turns the
// nose, and below stall speed the wing stops flying and the plane sinks.

import * as THREE from 'three';
import { CONFIG } from './config.js';

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

export function createAircraft(scene) {
  const yellow = lambert(0xf2c230);
  const red = lambert(0xd23c1e);
  const dark = lambert(0x22242a);
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';

  // Fuselage: a tube along Z (nose toward +Z) with a rounded nose.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.3, 8.5, 10), yellow);
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), yellow);
  nose.scale.set(1, 0.95, 1.35);
  nose.position.set(0, -0.1, 4.4);
  group.add(nose);
  const tailCone = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 0.35, 3.4, 8), yellow);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.set(0, 0.35, -5.6);
  group.add(tailCone);
  // Red cheatline along the fuselage.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.04, 0.5, 7.6), red);
  stripe.position.set(0, -0.25, 0.3);
  group.add(stripe);
  // Boat hull under the fuselage (the scoops live here).
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 7.0), yellow);
  hull.position.set(0, -1.45, 0.4);
  group.add(hull);
  const hullStep = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.5, 1.2), red);
  hullStep.position.set(0, -1.6, -1.6);
  group.add(hullStep);

  // Cockpit windows: a dark canopy band at the front. It is glassy so the
  // cockpit camera can see through it, and it reads as a canopy outside.
  // Kept very clear (low opacity, no depth write) so the pilot's view
  // through the windshield stays bright.
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 1.0, 2.2),
    new THREE.MeshPhongMaterial({ color: 0x1a2e44, shininess: 90, transparent: true, opacity: 0.16, depthWrite: false }),
  );
  canopy.position.set(0, 0.95, 3.1);
  group.add(canopy);

  // Instrument panel: a tall dark dash with five big lit gauge faces, seen
  // from the cockpit camera (which sits behind and above it). The faces are
  // unlit material so they glow against the dark panel. The dash top sits
  // just above the nose, so the gauges read over it, and a windshield
  // frame (side pillars + top bar) wraps the view, so the cockpit shot
  // reads as "inside the cockpit".
  const dash = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.0, 0.3), dark);
  dash.position.set(0, 1.3, 3.3);
  group.add(dash);
  const faceMat = new THREE.MeshBasicMaterial({ color: 0xd8e4ea });
  const needleMat = new THREE.MeshBasicMaterial({ color: 0xd23c1e });
  const warnMat = new THREE.MeshBasicMaterial({ color: 0xffb020 });
  for (let i = 0; i < 5; i++) {
    const gx = -1.24 + i * 0.62;
    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 14), dark);
    bezel.rotation.x = Math.PI / 2;
    bezel.position.set(gx, 1.5, 3.16);
    group.add(bezel);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.12, 14), faceMat);
    face.rotation.x = Math.PI / 2;
    face.position.set(gx, 1.5, 3.12);
    group.add(face);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), needleMat);
    needle.position.set(gx, 1.5, 3.05);
    needle.rotation.z = -0.6 + i * 0.3;
    group.add(needle);
  }
  // Small amber warning lights row under the gauges.
  for (let i = 0; i < 4; i++) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.05), warnMat);
    lamp.position.set(-0.6 + i * 0.4, 0.95, 3.12);
    group.add(lamp);
  }
  // Control yoke in front of the panel.
  const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.08, 6, 12), dark);
  yoke.position.set(0, 0.7, 2.9);
  group.add(yoke);
  // Windshield frame: raked side pillars + top crossbar, so the forward
  // view is framed like a real cockpit instead of open sky.
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.5, 0.24), dark);
    pillar.position.set(side * 1.7, 2.4, 2.9);
    pillar.rotation.z = -side * 0.1;
    pillar.rotation.x = -0.15;
    group.add(pillar);
  }
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.22, 0.22), dark);
  topBar.position.set(0, 3.1, 2.9);
  topBar.rotation.x = -0.15;
  group.add(topBar);

  // Shoulder wing, red tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(17, 0.35, 2.6), yellow);
  wing.position.set(0, 1.15, 0.6);
  group.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.38, 2.6), red);
    tip.position.set(side * 8.1, 1.15, 0.6);
    group.add(tip);
    // Wingtip float (amphibious), on a short strut so it reads as attached.
    const float = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.6, 8), yellow);
    float.rotation.x = Math.PI / 2;
    float.position.set(side * 7.2, -1.5, 0.6);
    group.add(float);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.7, 0.3), yellow);
    strut.position.set(side * 7.2, -0.2, 0.6);
    group.add(strut);
  }

  // Tail: horizontal stabiliser + vertical fin, both red-tipped.
  const hStab = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.28, 1.7), yellow);
  hStab.position.set(0, 0.9, -6.4);
  group.add(hStab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 2.4), red);
  fin.position.set(0, 2.1, -6.5);
  group.add(fin);

  // Two engines on the wing, each with a spinning propeller.
  const props = [];
  for (const side of [-1, 1]) {
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 2.6, 10), yellow);
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(side * 3.4, 1.15, 0.9);
    group.add(nacelle);
    const prop = new THREE.Group();
    prop.position.set(side * 3.4, 1.15, 2.35);
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0x1c1c20 });
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.12), bladeMat);
      blade.rotation.z = (b / 3) * Math.PI * 2;
      prop.add(blade);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), dark);
    prop.add(hub);
    group.add(prop);
    props.push(prop);
  }

  scene.add(group);
  return { group, props };
}

// --- Flight state ---------------------------------------------------------
export function createFlightState(startPos, startHeading) {
  return {
    pos: startPos.clone(),
    heading: startHeading,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    onGround: true,
    crashed: false,
    verticalSpeed: 0,
  };
}

// input: { pitch, roll, yaw, throttleDelta, drop } each -1..1 (throttleDelta is a rate)
// Returns events: { tookOff, landed, crashed } (booleans, true only that frame).
export function updateFlight(state, input, dt, world) {
  const events = { tookOff: false, landed: false, crashed: false };
  if (state.crashed) return events;
  const C = CONFIG;

  // Throttle: Shift/R/F move it; it stays where the pilot leaves it.
  state.throttle = Math.max(0, Math.min(1, state.throttle + input.throttleDelta * dt * 0.55));

  // Pitch and roll ease toward the commanded angle; they relax a little
  // toward level when the pilot lets go, so the plane stays flyable.
  const targetPitch = input.pitch * C.maxPitch;
  const targetRoll = input.roll * C.maxRoll;
  const pitchRate = C.pitchRate * (state.onGround ? 0 : 1);
  state.pitch += Math.max(-pitchRate * dt, Math.min(pitchRate * dt, targetPitch - state.pitch));
  if (input.pitch === 0) state.pitch *= Math.max(0, 1 - 0.12 * dt);
  state.roll += Math.max(-C.rollRate * dt, Math.min(C.rollRate * dt, targetRoll - state.roll));
  if (input.roll === 0) state.roll *= Math.max(0, 1 - 0.55 * dt);

  // Speed chases the throttle target; climbing bleeds speed, diving gains it.
  const targetSpeed = state.throttle * C.maxSpeed;
  const accel = state.speed < targetSpeed ? C.accel : C.accel * 0.6;
  state.speed += Math.max(-accel * dt, Math.min(accel * dt, targetSpeed - state.speed));
  state.speed -= Math.sin(state.pitch) * 9 * dt;
  state.speed = Math.max(0, state.speed);

  // Heading: bank turns the nose, rudder helps. Banking right turns right.
  const speedFactor = Math.max(0, Math.min(1, state.speed / C.maxSpeed));
  state.heading -= (state.roll * C.turnFromBank * speedFactor + input.yaw * C.yawRate) * dt;

  // Forward vector from heading + pitch.
  const cp = Math.cos(state.pitch);
  const forward = {
    x: Math.sin(state.heading) * cp,
    y: Math.sin(state.pitch),
    z: Math.cos(state.heading) * cp,
  };
  const prevY = state.pos.y;
  state.pos.x += forward.x * state.speed * dt;
  state.pos.z += forward.z * state.speed * dt;
  // Vertical: follow the pitch while the wing flies; sink when stalled.
  let vy = forward.y * state.speed;
  if (!state.onGround && state.speed < C.stallSpeed) {
    vy -= C.sinkWhenStalled * (1 - state.speed / C.stallSpeed);
  }
  state.pos.y += vy * dt;
  state.verticalSpeed = dt > 0 ? (state.pos.y - prevY) / dt : 0;

  // Stay inside the valley.
  const lim = CONFIG.worldHalf - 60;
  state.pos.x = Math.max(-lim, Math.min(lim, state.pos.x));
  state.pos.z = Math.max(-lim, Math.min(lim, state.pos.z));

  // Ground contact.
  const groundY = world.terrainHeight(state.pos.x, state.pos.z);
  const gearY = groundY + 1.6;
  const overLake = world.isOverLake(state.pos.x, state.pos.z);
  const overStrip = world.isOverStrip(state.pos.x, state.pos.z);
  const floorY = overLake ? Math.max(groundY, CONFIG.waterLevel) + 1.2 : gearY;

  if (state.onGround) {
    // Rolling on the strip (or the water after a water landing).
    state.pos.y = floorY;
    state.pitch = 0;
    if (state.speed >= C.takeoffSpeed && input.pitch > 0.25) {
      state.onGround = false;
      events.tookOff = true;
    }
  } else if (state.pos.y <= floorY) {
    // Touchdown: gentle + on the strip or the lake = landing, else a crash.
    const gentle = state.verticalSpeed > -7 && state.speed < 46;
    if (gentle && (overStrip || overLake)) {
      state.onGround = true;
      state.pos.y = floorY;
      state.pitch = 0;
      state.roll *= 0.3;
      events.landed = true;
    } else {
      state.crashed = true;
      state.pos.y = floorY;
      events.crashed = true;
    }
  }
  return events;
}

// Apply the flight state to the visible model.
export function poseAircraft(model, state, dt) {
  model.group.position.copy(state.pos);
  model.group.rotation.y = state.heading;
  model.group.rotation.x = -state.pitch;
  model.group.rotation.z = -state.roll;
  // Propellers spin faster with throttle.
  const spin = (2 + state.throttle * 26) * dt;
  for (const prop of model.props) prop.rotation.z += spin;
}
