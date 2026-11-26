// Api Langit — deterministic randomness.
// A small seeded PRNG (mulberry32) plus a value-noise field, so the terrain,
// the forest and the fire spots are the same every run for a given seed.
// Screenshot mode uses seed 1, so the four shots are reproducible.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth value noise over a 2D grid. Deterministic for a given seed.
export function makeNoise2D(seed) {
  const rand = mulberry32(seed);
  const size = 64;
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const at = (x, y) => grid[((y % size + size) % size) * size + ((x % size + size) % size)];
  const smooth = (t) => t * t * (3 - 2 * t);
  return function noise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    const u = smooth(xf);
    const v = smooth(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

// Fractal brownian motion: a few octaves of the value noise above.
export function makeFbm(seed) {
  const noise = makeNoise2D(seed);
  return function fbm(x, y) {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    for (let i = 0; i < 4; i++) {
      sum += amp * noise(x * freq, y * freq);
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum;
  };
}
