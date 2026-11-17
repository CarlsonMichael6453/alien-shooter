# Alien Shooter

Expo SDK 58 game. One screen, no router. Read the versioned Expo docs before changing Expo APIs.

- Game simulation is pure TypeScript in `src/game/` and is covered by `npm test`.
- Web draws with a canvas (`src/render/GameCanvas.web.tsx`) and listens to real touch events so two fingers work. Scroll and pinch-zoom are disabled.
- iOS and Android draw with `@shopify/react-native-skia`, which ships in Expo Go for this SDK.
- Web export uses `experiments.baseUrl` `/alien-shooter` for GitHub Pages. Do not drop that when changing `app.config.ts`.
- `npx expo install` for SDK packages. `npm test` and `npm run typecheck` before finishing.
