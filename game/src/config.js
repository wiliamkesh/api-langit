// Api Langit — game tuning constants.
// One place for every number that shapes how the game feels: flight, fuel,
// water, fire, world size and the win/lose lines. Nothing here is a secret.

export const CONFIG = {
  // World (metres). The valley is a 2400 x 2400 square; the lake sits in a
  // dip near the south-west, the airstrip on flat ground beside it.
  worldSize: 2400,
  worldHalf: 1200,
  waterLevel: 4,
  lakeCenter: { x: -560, z: 420 },
  lakeRadius: 260,
  stripCenter: { x: -260, z: 560 },
  stripHeading: 0.35, // radians, runway direction
  stripLength: 340,
  stripWidth: 26,

  // Flight model (arcade, not a full sim).
  maxSpeed: 62, // m/s at full throttle
  cruiseSpeed: 38,
  stallSpeed: 20, // below this the wing stops flying
  accel: 14, // m/s^2 toward the throttle target speed
  maxPitch: 0.55, // radians up/down
  maxRoll: 1.05, // radians of bank
  pitchRate: 0.9, // rad/s toward the commanded pitch
  rollRate: 1.9, // rad/s toward the commanded roll
  yawRate: 0.35, // rad/s from rudder alone
  turnFromBank: 0.55, // heading rad/s per radian of bank, scaled by speed
  sinkWhenStalled: 9, // m/s extra sink below stall speed
  takeoffSpeed: 26, // m/s needed to lift off the strip

  // Fuel. Full tank lasts roughly four minutes of mixed flying.
  fuelMax: 100,
  fuelBurnIdle: 0.55, // %/s at throttle 0
  fuelBurnFull: 1.15, // %/s at throttle 1 (lerped between the two)
  refuelRate: 25, // %/s while parked on the strip

  // Water tank.
  waterMax: 100,
  scoopRate: 34, // %/s while scooping on the lake
  dropRate: 45, // %/s while the drop is open
  scoopMaxAlt: 9, // metres above the water to scoop
  scoopMaxSpeed: 34, // m/s, faster than this and the scoops skip

  // Fire. Intensity is 0..100 per zone; radius grows while it burns.
  fireStartRadius: 55,
  fireMaxRadius: 150,
  fireGrowRate: 1.6, // metres/s of radius while burning
  fireIntensityStart: 82,
  fireSpreadGrace: 45, // seconds before a fire starts growing
  waterKillPerSecond: 26, // intensity lost per second of direct water
  fireLoseRadius: 190, // a zone this big ends the game

  // Waves. Wave 1 = 1 fire, wave 2 = 2, wave 3 = 3. Clear them all to win.
  waves: [1, 2, 3],
  wavePauseSeconds: 6, // breather between waves

  // Scoring.
  scorePerIntensity: 12, // points per intensity point put out
  scoreAreaBonus: 1500, // per fire zone fully out
  scoreTimeBonus: 4000, // base, minus time taken

  // Camera.
  chaseDistance: 26,
  chaseHeight: 7,
  chaseLerp: 4.5,
  cockpitOffset: { x: 0, y: 2.5, z: 0.6 },
};
