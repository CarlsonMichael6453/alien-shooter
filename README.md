# Alien Shooter

A portrait alien shooter you play with two fingers. One finger drags the ship around. A second finger, held anywhere, fires straight up.

Play it in the browser: [https://carlsonmichael6453.github.io/alien-shooter/](https://carlsonmichael6453.github.io/alien-shooter/)

That link goes live after this branch is merged to `main` and the Pages workflow finishes. Until then, use the local web server below.

## How to play

- Put one finger down and drag. The ship follows the drag from wherever the touch starts, so your thumb does not sit on top of the ship.
- Put a second finger down anywhere and hold it. The ship fires straight up until you lift that finger.
- Either finger can land first. The first touch steers and the second touch fires. Lifting the steering finger does not turn the firing finger into a steering finger.
- You start with 100 rounds. Each bullet spends one. Ammo boxes marked 50, 100, and 200 drift down; fly into them to reload. The 50 box is the common one and the 200 box is rare.
- Scouts have 5 health, saucers 10, and big gold cruisers 15. A bullet does 1 damage, and a bar over each ship shows what is left. Tougher ships show up less often.
- Power-ups are not used the moment you touch them. Their icons start at the bottom left, up to three at a time, including duplicates. A fourth pickup stays in space until a slot is free. Lift the firing finger and tap an icon (or press 1, 2, or 3). Only one power-up runs at a time; the others dim until it ends.
- Besides rapid fire, the bomb, and the laser, you can find a shield (one hit or 6 seconds), wingman drones (8 seconds, no ammo), and a time warp (enemies move at half speed for 5 seconds).
- Every 1000 points a boss blocks the lane. Beat it and the sector changes: Deep Space, Asteroid Belt, Nebula, Red Giant, Alien Homeworld, then the cycle returns harder. From the Asteroid Belt on, battleships (40 health) and carriers (30 health) show up. The sector name can be moved in the HUD editor.
- The first time you play, prompts walk you through moving, shooting with a second finger, and using a power-up. They do not come back after you finish them. The gear at the top right opens settings and pauses the run. Replay tutorial is in that menu.
- Settings also has Edit HUD. Drag the score, ammo, low-ammo warning, lives, and power-up slots. Each one can be resized, faded, or hidden, and Reset to default puts them back. The layout is saved on this device. Tapping the gear never steers or fires.
- Rapid fire lasts 5 seconds, shoots four times as fast inside a 30° cone, and does not spend ammo. The bomb drifts forward, ticks once a second for 3 seconds, then bursts across about half the screen. The laser lasts 8 seconds, does not spend ammo, and aims with the firing finger.
- If a ship hits you, you lose a life. Three lives, then tap to play again.

On a computer: drag or use WASD / arrows to move, hold Space to fire, and press 1, 2, or 3 to use a stored power-up. While the laser is active, point the mouse to aim it. Music and effects are synthesized in the browser (no recorded tracks) and start after the first tap. Volume and mute live in settings.

## Run it on the web

```bash
npm install
npx expo start --web
```

The dev server ignores the GitHub Pages base path, so open the URL Expo prints (usually `http://localhost:8081`).

To preview the production export the way GitHub Pages serves it:

```bash
npm run export:web
npm run preview:web
```

Then open `http://127.0.0.1:4173/alien-shooter/`.

## Run it in Expo Go

This project is Expo SDK 58. Install Expo Go that matches SDK 58, then:

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go on the same Wi-Fi. The phone stays in portrait. Controls are the same two-finger scheme as the website.

`@shopify/react-native-skia` draws the native game and is included in the Expo Go build for this SDK, so you do not need a custom dev client for the demo.

## GitHub Pages

Pushes to `main` run `.github/workflows/pages.yml`. The workflow typechecks, runs the unit tests, exports the web build, and publishes `dist/` to GitHub Pages.

The site is hosted under `/alien-shooter/`. `experiments.baseUrl` in `app.config.ts` is `/alien-shooter`, and `scripts/patch-web-export.js` locks the viewport so the mobile browser does not scroll or pinch-zoom over the game.

Pages has to use **GitHub Actions** as its source (Settings → Pages → Build and deployment → Source). The deploy job only runs from `main`.

## Development

```bash
npm test
npm run typecheck
npm run export:web
npm run test:touch
```

`test:touch` serves the export and drives two real touch points in Chrome, including the case where the steering finger lifts while the firing finger stays down.
