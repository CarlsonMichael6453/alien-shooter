# Alien Shooter

A portrait alien shooter you play with two fingers. One finger drags the ship around. A second finger, held anywhere, fires straight up.

Play it in the browser: [https://carlsonmichael6453.github.io/alien-shooter/](https://carlsonmichael6453.github.io/alien-shooter/)

That link goes live after this branch is merged to `main` and the Pages workflow finishes. Until then, use the local web server below.

## How to play

- Put one finger down and drag. The ship follows the drag from wherever the touch starts, so your thumb does not sit on top of the ship.
- Put a second finger down anywhere and hold it. The ship fires straight up until you lift that finger.
- Either finger can land first. The first touch steers and the second touch fires. Lifting the steering finger does not turn the firing finger into a steering finger.
- Alien ships and asteroids fall from the top. Bullets destroy them for points. If one hits your ship, you lose a life. Three lives, then tap to play again.
- The spawn rate and speed climb over the run.

On a computer: drag with the mouse or use WASD / arrow keys to move, and hold Space (or the right mouse button) to fire.

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
