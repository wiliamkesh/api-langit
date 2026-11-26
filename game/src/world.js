// Api Langit — the valley: terrain, lake, forest, airstrip, sky, light.
// The world is a 2400 m square valley: a mountain rim, a lake in a dip to
// the south-west, a flat airstrip beside it, and forest on the valley floor.
// Terrain height is a pure function, so the aircraft, the fires and the
// screenshots can all ask "how high is the ground here?".

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeFbm } from './random.js';

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

// Smoothstep that falls from 1 to 0 as d goes from near to far.
function falloff(d, near, far) {
  return 1 - clamp01((d - near) / (far - near));
}

export function makeTerrainHeight(seed) {
  const fbm = makeFbm(seed);
  const { worldHalf, lakeCenter, lakeRadius, stripCenter } = CONFIG;
  return function terrainHeight(x, z) {
    const r = Math.hypot(x, z) / worldHalf;
    // Mountain rim: only beyond r=0.62, so the valley floor stays flat.
    // The radius is capped at 1.0: without the cap the square terrain's
    // corners (r=1.41) spike to ~1050 m and read as one giant smooth tan
    // pyramid from the lake. The rim is also roughened with noise so the
    // ridge silhouette is jagged, not a clean cone.
    const rc = Math.min(r, 1.0);
    const rimBase = Math.pow(Math.max(0, rc - 0.62) / 0.38, 2) * 240;
    const rim = rimBase * (0.55 + 0.9 * fbm(x * 0.0016 + 31.7, z * 0.0016 + 11.2));
    // Rolling hills, masked out near the lake and the strip so both stay clean.
    // (falloff is 1 close and 0 far, so the mask is its inverse.)
    const dLake = Math.hypot(x - lakeCenter.x, z - lakeCenter.z);
    const dStrip = Math.hypot(x - stripCenter.x, z - stripCenter.z);
    const mask = Math.min(1 - falloff(dLake, lakeRadius + 60, lakeRadius + 220), 1 - falloff(dStrip, 130, 260));
    const hills = (fbm(x * 0.0016 + 7.3, z * 0.0016 + 2.1) - 0.5) * 46 * mask;
    let h = 16 + rim + hills;
    // Lake dip: a smooth bowl so the water plane has a shoreline.
    h -= 34 * falloff(dLake, lakeRadius * 0.35, lakeRadius + 110);
    // Airstrip: blend toward a flat pad.
    const stripBlend = falloff(dStrip, 90, 230);
    h = h * (1 - stripBlend) + 14 * stripBlend;
    return h;
  };
}

export function createWorld(scene, seed) {
  const { worldSize, waterLevel, lakeCenter, lakeRadius, stripCenter, stripHeading, stripLength, stripWidth } = CONFIG;
  const terrainHeight = makeTerrainHeight(seed);

  // ---- Sky dome: golden-hour gradient, warm at the horizon, blue above.
  const skyGeo = new THREE.SphereGeometry(4200, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x5b7cb3) },
      mid: { value: new THREE.Color(0xe8a35c) },
      low: { value: new THREE.Color(0xf7c98a) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main() {
        float h = normalize(vPos).y;
        vec3 c = h > 0.08 ? mix(mid, top, smoothstep(0.08, 0.45, h))
                          : mix(low, mid, smoothstep(-0.05, 0.08, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // ---- Light: low warm sun + cool sky fill. No shadow maps (large scene).
  const sun = new THREE.DirectionalLight(0xffc98a, 2.1);
  sun.position.set(-900, 420, 700);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0x8fa8d8, 0x5a4632, 1.05);
  scene.add(hemi);
  // Haze far enough out that the distant ridges keep their colour
  // instead of washing tan.
  scene.fog = new THREE.Fog(0xe8b878, 1400, 5200);

  // ---- Terrain: displaced plane with vertex colours.
  const seg = 140;
  const terrainGeo = new THREE.PlaneGeometry(worldSize, worldSize, seg, seg);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color(0x4a7a3a);
  const cGrassDry = new THREE.Color(0x7a8a3f);
  const cRock = new THREE.Color(0x6e6a66);
  const cRockDark = new THREE.Color(0x46423e);
  const cSand = new THREE.Color(0xb59a6a);
  const cScorch = new THREE.Color(0x2e2620);
  // Separate noise field for rock patches, so high ground is mottled
  // instead of one uniform tan.
  const cfbm = makeFbm(seed + 101);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    // Colour by height and by slope (steep = rock).
    const hN = clamp01(h / 180);
    tmp.copy(cGrass).lerp(cGrassDry, clamp01((h - 40) / 90));
    tmp.lerp(cRock, hN * hN);
    // Rocky variation: darker patches on high ground so distant ridges
    // read as broken rock instead of uniform tan.
    const rockPatch = clamp01((cfbm(x * 0.004 + 53.1, z * 0.004 + 17.9) - 0.3) * 1.4);
    tmp.lerp(cRockDark, rockPatch * hN * hN);
    // Sandy shore where the ground meets the water.
    const dLake = Math.hypot(x - lakeCenter.x, z - lakeCenter.z);
    if (h < waterLevel + 3 && dLake < lakeRadius + 90) tmp.copy(cSand).lerp(tmp, 0.35);
    // Scorched patches are painted later by the fire system (it recolors).
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  terrain.name = 'terrain';
  scene.add(terrain);

  // ---- Lake: a flat blue disc at the water level.
  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(lakeRadius + 55, 48),
    new THREE.MeshPhongMaterial({ color: 0x2a6ea8, transparent: true, opacity: 0.88, shininess: 120 }),
  );
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(lakeCenter.x, waterLevel, lakeCenter.z);
  lake.name = 'lake';
  scene.add(lake);

  // ---- Airstrip: dark asphalt pad + white centreline + threshold bars.
  const stripGroup = new THREE.Group();
  stripGroup.position.set(stripCenter.x, 14.35, stripCenter.z);
  stripGroup.rotation.y = -stripHeading;
  const asphalt = new THREE.Mesh(
    new THREE.BoxGeometry(stripWidth, 0.5, stripLength),
    new THREE.MeshLambertMaterial({ color: 0x3a3d42 }),
  );
  stripGroup.add(asphalt);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf2f2e8 });
  for (let i = -4; i <= 4; i++) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 14), lineMat);
    dash.position.set(0, 0.35, i * 32);
    stripGroup.add(dash);
  }
  for (const side of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(stripWidth - 4, 0.2, 3), lineMat);
    bar.position.set(0, 0.35, side * (stripLength / 2 - 8));
    stripGroup.add(bar);
  }
  // Windsock pole at the strip's edge.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 9, 6),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
  );
  pole.position.set(stripWidth / 2 + 8, 4.5, -stripLength / 2 + 12);
  stripGroup.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 4.5, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8641f }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(stripWidth / 2 + 8, 8.6, -stripLength / 2 + 12);
  stripGroup.add(sock);
  scene.add(stripGroup);

  // ---- Forest: instanced trunks + foliage cones, kept off lake and strip.
  const treeRand = (() => {
    let s = seed * 7919 + 13;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  })();
  const treeSpots = [];
  let guard = 0;
  while (treeSpots.length < 900 && guard++ < 20000) {
    const x = (treeRand() * 2 - 1) * (CONFIG.worldHalf - 120);
    const z = (treeRand() * 2 - 1) * (CONFIG.worldHalf - 120);
    const h = terrainHeight(x, z);
    if (h < 9 || h > 95) continue;
    if (Math.hypot(x - lakeCenter.x, z - lakeCenter.z) < lakeRadius + 25) continue;
    if (Math.hypot(x - stripCenter.x, z - stripCenter.z) < 150) continue;
    treeSpots.push({ x, z, h, s: 0.75 + treeRand() * 0.7, r: treeRand() * Math.PI * 2 });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 5, 5);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4128 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const coneGeo = new THREE.ConeGeometry(3.4, 13, 6);
  const coneMat = new THREE.MeshLambertMaterial({ color: 0x2f5e2a });
  const cones = new THREE.InstancedMesh(coneGeo, coneMat, treeSpots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const sc = new THREE.Vector3();
  treeSpots.forEach((t, i) => {
    q.setFromAxisAngle(up, t.r);
    sc.set(t.s, t.s, t.s);
    m.compose(new THREE.Vector3(t.x, t.h + 2.2 * t.s, t.z), q, sc);
    trunks.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(t.x, t.h + (5 + 6.5) * t.s, t.z), q, sc);
    cones.setMatrixAt(i, m);
  });
  trunks.instanceMatrix.needsUpdate = true;
  cones.instanceMatrix.needsUpdate = true;
  scene.add(trunks);
  scene.add(cones);

  // ---- Distant mountain silhouettes: irregular ridged peaks, not pyramids.
  // Each peak is a cone whose vertices are displaced with a seeded random
  // (ragged flanks, leaning apex) and rendered flat-shaded, so the facets
  // read as rock instead of a smooth triangle. Heights, widths and rocky
  // colours vary, the peaks cluster unevenly, and they stand tall enough
  // to clear the smooth terrain rim behind the valley.
  const ridgeColors = [0x3d4550, 0x4a4640, 0x37404e, 0x524a3e, 0x333c48];
  const ridgeRand = (() => {
    let s = seed * 104729 + 77;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  })();
  function displacePeak(geo, hgt, base, amount) {
    const p = geo.attributes.position;
    const leanX = (ridgeRand() - 0.5) * base * 0.5;
    const leanZ = (ridgeRand() - 0.5) * base * 0.5;
    for (let v = 0; v < p.count; v++) {
      const vx = p.getX(v);
      const vy = p.getY(v);
      const vz = p.getZ(v);
      // k = 1 at the base, 0 at the tip: the flanks go ragged and wavy,
      // the tip stays sharp but leans sideways.
      const k = 1 - (vy + hgt / 2) / hgt;
      p.setX(v, vx + (ridgeRand() - 0.5) * base * amount * k + leanX * (1 - k));
      p.setZ(v, vz + (ridgeRand() - 0.5) * base * amount * k + leanZ * (1 - k));
      p.setY(v, vy + (ridgeRand() - 0.5) * hgt * 0.08 * k);
    }
    geo.computeVertexNormals();
    return geo;
  }
  for (let i = 0; i < 18; i++) {
    // Uneven spacing: clusters and gaps, like a real range.
    const a = (i / 18) * Math.PI * 2 + (ridgeRand() - 0.5) * 0.55;
    const r = 1500 + ridgeRand() * 420;
    const hgt = 320 + ridgeRand() * 300;
    const base = 380 + ridgeRand() * 320;
    const mat = new THREE.MeshLambertMaterial({
      color: ridgeColors[i % ridgeColors.length],
      flatShading: true,
    });
    const peak = new THREE.Mesh(
      displacePeak(new THREE.ConeGeometry(base, hgt, 12, 4), hgt, base, 0.55),
      mat,
    );
    // Squash some peaks wide and low, stretch others tall and narrow.
    peak.scale.set(1 + (ridgeRand() - 0.5) * 0.8, 1, 1 + (ridgeRand() - 0.5) * 0.8);
    peak.position.set(Math.cos(a) * r, hgt * 0.28, Math.sin(a) * r);
    peak.rotation.y = ridgeRand() * Math.PI;
    scene.add(peak);
    // Shoulder peak on one flank: breaks the single-triangle silhouette.
    const shHgt = hgt * (0.45 + ridgeRand() * 0.2);
    const shBase = base * (0.5 + ridgeRand() * 0.2);
    const shAngle = a + (ridgeRand() - 0.5) * 0.5;
    const shR = r + (ridgeRand() - 0.5) * 260;
    const shoulder = new THREE.Mesh(
      displacePeak(new THREE.ConeGeometry(shBase, shHgt, 10, 3), shHgt, shBase, 0.5),
      new THREE.MeshLambertMaterial({
        color: ridgeColors[(i + 2) % ridgeColors.length],
        flatShading: true,
      }),
    );
    shoulder.position.set(Math.cos(shAngle) * shR, shHgt * 0.28, Math.sin(shAngle) * shR);
    shoulder.rotation.y = ridgeRand() * Math.PI;
    scene.add(shoulder);
  }
  // Rocky outcrops on the valley rim itself, so the smooth rim slope is
  // broken up by jagged rock in the mid-ground too.
  for (let i = 0; i < 8; i++) {
    const a = ridgeRand() * Math.PI * 2;
    const r = 1080 + ridgeRand() * 160;
    const ox = Math.cos(a) * r;
    const oz = Math.sin(a) * r;
    const hgt = 70 + ridgeRand() * 90;
    const base = 90 + ridgeRand() * 90;
    const geo = new THREE.ConeGeometry(base, hgt, 8, 2);
    const p = geo.attributes.position;
    for (let v = 0; v < p.count; v++) {
      const vx = p.getX(v);
      const vy = p.getY(v);
      const vz = p.getZ(v);
      const k = 1 - (vy + hgt / 2) / hgt;
      p.setX(v, vx * (1 + (ridgeRand() - 0.5) * 0.6 * k));
      p.setZ(v, vz * (1 + (ridgeRand() - 0.5) * 0.6 * k));
    }
    geo.computeVertexNormals();
    const outcrop = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      color: ridgeColors[(i + 2) % ridgeColors.length],
      flatShading: true,
    }));
    outcrop.position.set(ox, terrainHeight(ox, oz) + hgt * 0.18, oz);
    outcrop.rotation.y = ridgeRand() * Math.PI;
    scene.add(outcrop);
  }

  function isOverLake(x, z) {
    return Math.hypot(x - lakeCenter.x, z - lakeCenter.z) < lakeRadius + 20
      && terrainHeight(x, z) < waterLevel;
  }
  function isOverStrip(x, z) {
    // Rotate the point into strip-local space.
    const dx = x - stripCenter.x;
    const dz = z - stripCenter.z;
    const c = Math.cos(stripHeading);
    const s = Math.sin(stripHeading);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    return Math.abs(lx) < stripWidth / 2 + 6 && Math.abs(lz) < stripLength / 2 + 10;
  }

  return {
    terrainHeight,
    isOverLake,
    isOverStrip,
    treeSpots,
    update(_dt) {
      // The lake shimmers: a slow opacity breathing so it reads as water.
      lake.material.opacity = 0.84 + Math.sin(performance.now() * 0.0004) * 0.04;
    },
  };
}
