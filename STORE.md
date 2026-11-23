# Store prep

This game has no ads. Do not add an ad SDK, an ad placeholder, or a product that removes ads. Monetization is optional premium ships only: SuperPink, Festive, and MegaDark at $1.99 each, or all three for $3.99. Purchases are not connected yet.



The native listing is not final. Placeholders are in `app.config.ts` and `eas.json`. The public site is published from `main`.

## Still needed before a store submit

- App display name. `app.config.ts` uses `PLACEHOLDER`.
- Publisher / developer name. Not chosen.
- A real iOS bundle id. Current value: `com.placeholder.alienshooter`.
- A real Android application id. Current value: `com.placeholder.alienshooter`.
- Apple Team ID and an App Store Connect app.
- A Google Play Console app and a service account for EAS Submit.
- `eas init` so the project has an EAS project id. `eas.json` is only the build profile skeleton.
- A public URL for `public/privacy.html` after the publisher and app name are filled in.
- A support URL and the final feedback address. `src/config.ts` still has the demo inbox.
- Age rating, category, and the store description.
- Approval of `assets/icon.png` (1024, original 2D ship on a glossy badge).

## Screenshots

`npm run store:shots` serves the web export and writes phone captures to `store-shots/`. Store listings usually want:

- iPhone 6.7 inch: 1290×2796
- iPhone 6.5 inch: 1284×2778
- Android phone: 1080×1920

Run the script with `STORE_WIDTH` and `STORE_HEIGHT` to match a listing. The script opens the menu, pause, tutorial, high scores, and ship select through the `?debug=1` hook.
