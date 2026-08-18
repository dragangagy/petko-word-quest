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
2. Run scheduled SQL helpers under `sql/` as needed. For an existing project, `sql/2026-08-18-trades.sql` adds the Trade module on its own.
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

## G-Lab Trade

The **Trade** tab lets players exchange today's challenge slots.

- Your free slots are the allowed daily challenges you have not used yet, so trading spends real capacity instead of minting new value.
- **Give slots** offers spare challenges to another player; **Ask for slots** requests them. Either way the other player has to accept.
- An open offer holds the slots aside until it is answered, so the same slot cannot be promised twice and played at the same time.
- Limits: 6 open trades per player per day, 1-5 challenges per offer.
- Trades are scoped to the current day. Anything unanswered stops counting after midnight; there is no persistent credit balance to reconcile.

Everything lands in the `trades` table and feeds back into `challengeDailyLimit()`. Because the app talks to Supabase with the anon key, the day scope, the self-trade block and the daily offer cap are enforced by the `trades_validate` trigger as well as by the client.

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
