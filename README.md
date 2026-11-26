# Api Langit — Water Bomber

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/wiliamkesh/api-langit/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/wiliamkesh/api-langit/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

A flight game for the [make.fun best flight game bounty](https://make.fun/c/best-flight-game-20261126-0057): fly a yellow-red amphibious water bomber over a golden-hour valley, scoop water from the lake, and drop it on the wildfire before it spreads out of control.

## The game

- **Take off** from the airstrip, **scoop** low over the lake, **drop** on the fire.
- **Three waves** of fire (1, then 2, then 3 zones). A fire spreads while it burns; put it out before any zone grows out of control.
- **Fuel** burns with throttle — land on the strip to refuel. **Stall** below flying speed and the wing stops flying.
- **Controls:** W/S climb and descend, A/D bank, Q/E rudder, Shift/Ctrl throttle, Space drop water, C cockpit/chase camera, P pause.
- **Tech:** three.js (vendored as `game/vendor/three.min.js`), plain static files, no network, no build step. The HUD is an HTML overlay; the minimap is a live canvas.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Screenshots

The four shots in `screenshots/` are real renders of the game, taken in headless Chromium with `?shot=cover|scoop|cockpit|wide` (see `shots.json`).

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.

## License

MIT — see [LICENSE](LICENSE).
