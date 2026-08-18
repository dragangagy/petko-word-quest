# Petko Word Quest

Mobile-first English 5-letter word game for the US market.

Independent from the Serbian Petko app. Same gameplay systems (Classic, Competitive, Challenge, Medals), new English word list, QWERTY keyboard, and a separate Supabase project.

## GitHub Pages

Publish this folder as a static site. The app works as a PWA and can be added to a phone home screen.

Required files:

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- image / avatar assets in this folder

## Supabase (new project)

Create a **new** Supabase project for Petko Word Quest. Do not reuse the Serbian Petko project.

1. Run `supabase-schema.sql` in the SQL editor.
2. Run scheduled SQL helpers under `sql/` as needed.
3. Seed English words into `public.words` (generate from the `WORDS` list in `app.js`, or load online words after the table is ready).
4. Set these values in `app.js`:

```js
const SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_SB_PUBLISHABLE_KEY",
  table: "scores",
  playersTable: "players"
};
```

Without these values the app uses local results only.

## Local preview

Open `index.html` in a browser, or serve the folder with any static server.

```powershell
# optional local server example
npx --yes serve .
```

## App stores (Capacitor)

Native shells for Google Play and the Apple App Store use Capacitor with local web assets in `www/`.

```powershell
npm install
npm run build          # copy static files → www/
npm run cap:sync       # sync into android/ and ios/
```

- **appId:** `com.glab.petkowordquest`
- **Play AAB / iOS archive steps, icons, signing:** see [STORE.md](STORE.md)
- iOS Archive requires macOS + Xcode; this Windows machine can generate the project and sync Android.

## Notes

- Word length is 5 letters (A–Z).
- Keyboard is QWERTY.
- Local storage keys use the `pwq-` prefix so they do not collide with Serbian Petko on the same device.
- This is not financial advice or a gambling product; it is a word puzzle game.

## G-Lab Trade module

Studio cross-promo rotator for the top status panel (not an in-game marketplace).

- Local defaults live in `DEFAULT_TRADE_CAMPAIGNS` inside `app.js`.
- Slot timing: first 5 minutes of every half hour (`?trade=1` forces the slot open for QA).
- Optional remote config: run `sql/glab-trade-module.sql`, then campaigns load from `trade_campaigns` with local cache fallback.
- Impressions/clicks are counted locally; queued events flush to `trade_events` when Supabase is configured.
