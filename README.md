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

## G-Lab Trade

`G-Lab Trade` is the house promo module that drives the banner slot in the status panel. The slot replaces the G-Lab signature for the first 5 minutes of every half hour, and one campaign is drawn per half-hour cycle.

A campaign is either a **banner image** (`image`) or a **text card** (`title`, `subtitle`, `cta`). Defaults live in the `TRADE_CAMPAIGNS` list in `app.js`:

```js
{
  id: "numerology",              // unique campaign key
  title: "Numerology",
  subtitle: "Astrology and Tarot by G-Lab",
  cta: "Open app",
  href: "https://dragangagy.github.io/numerology-app/",
  label: "Open Numerology App", // aria-label for the link
  image: "ad-numerology.png",   // optional; omit to render the text card
  alt: "Numerology, Astrology and Tarot app",
  weight: 3                     // higher weight = drawn more often
}
```

Optional fields: `dailyCap` (max views per day, `0` = unlimited), `start` / `end` (`YYYY-MM-DD`, inclusive), `days` (`0`–`6`, Sunday first), `hours` (`0`–`23`), and `enabled`.

Rotation draws from a shuffled deck holding one card per weight point, so `weight: 3` against `weight: 1` really does win three cycles out of four, and an immediate repeat is swapped out whenever another card is queued. The draw is stored in `localStorage`, so every tab and every reload inside one cycle shows the same campaign and counts a single view.

### Remote campaigns and reporting

Run `sql/2026-08-18-glab-trade.sql` to add the optional `trade_campaigns` and `trade_events` tables. When `trade_campaigns` has active rows they replace the built-in defaults and get cached locally, so campaigns can change without a redeploy. Views and clicks are queued locally and flushed to `trade_events`; the `trade_campaign_stats` view rolls them up per day. Both tables are optional — without them the module runs fully offline on the defaults.

In the browser console `window.glabTrade` exposes `campaigns()`, `stats()`, `refresh()`, and `preview("petko")` to pin a campaign on screen (`preview()` clears it).

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
