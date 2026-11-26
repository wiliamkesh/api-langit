// Api Langit — the entrypoint: it hands the game to the grader.
// This program is the whole hand-in step. It copies the static game and the
// screenshots beside it into the output directory, then writes the dossier
// (the summary the judge reads) with the vendored make.fun library.
// It runs on Node 22 with the standard library only, twice, and both runs
// must write the same bytes. Outside the grader, MAKEFUN_OUTPUT_DIR stands
// in for /output, so locally: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The game itself: plain static files, no build step, no network.
mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });

// The screenshots, taken from the running game (the first by name is the cover).
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The dossier, with the gate's own caps: text capped at 160 KiB, at most 4
// screenshots of 256 KiB each, game/ at most 993 files and 48 MiB, and no
// path under game/ longer than 1000 bytes.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
