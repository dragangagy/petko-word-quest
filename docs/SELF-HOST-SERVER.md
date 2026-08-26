# Petko — sopstveni server (bez cloud Supabase)

Baza i API rade na **Home Assistant** (`192.168.1.6`):

| Servis | Port | Uloga |
|--------|------|--------|
| PostgreSQL 17 | 5432 | baza (scores, players, challenges…) |
| PostgREST | 3000 | REST API (zamenjuje Supabase `/rest/v1`) |

Aplikacija (web + Android) koristi isti `anonKey` JWT — samo menja **URL** sa cloud Supabase na tvoj javni HTTPS endpoint.

## 1. Lokalni test (samo u kućnoj mreži)

```powershell
curl http://192.168.1.6:3000/players -H "apikey: ANON_KEY" -H "Authorization: Bearer ANON_KEY"
```

Ako vraća JSON (ili `[]`), API radi.

## 2. Javni pristup — Cloudflare Tunnel (preporuka, besplatno)

Bez otvaranja portova na ruteru. Potreban [Cloudflare](https://dash.cloudflare.com) nalog.

### U HA

1. **Add-on Store** → **Cloudflared** (Community add-ons / hassio-addons)
2. Instaliraj i u Configuration nalepi **tunnel token** iz Cloudflare Zero Trust
3. U Cloudflare dashboardu dodaj **Public Hostname**:
   - Subdomain: npr. `petko-api.tvojdomain.com`
   - Service: `http://127.0.0.1:3000`
4. U `app.js` postavi:
   ```javascript
   url: "https://petko-api.tvojdomain.com",
   ```

### Privremeni URL (bez domena)

U Cloudflared add-onu možeš koristiti **Quick Tunnel** — dobijaš `https://xxxx.trycloudflare.com`. Korisno za test, URL se menja posle restarta.

## 3. app.js konfiguracija

```javascript
const SUPABASE_CONFIG = {
  url: "https://petko-api.tvojdomain.com",  // javni HTTPS
  anonKey: "eyJhbGci...",                    // isti lokalni JWT
  restPrefix: "",                            // PostgREST direktno, ne /rest/v1
  // ...
};
```

Posle izmene: `npm run build` → deploy web / `npm run cap:sync` → novi Android build.

## 4. Gasenje cloud Supabase

1. Proveri da igra radi na novom URL-u (leaderboard, challenge, profil)
2. U [Supabase dashboard](https://supabase.com/dashboard) → Project Settings → **Pause project** ili obriši projekat
3. Ukloni stari URL iz koda (već zamenjen u `app.js`)

## 5. Održavanje

- **Backup HA**: Settings → System → Backups (pre svake veće izmene)
- Postgres lozinka: add-on **Postgres 17** → Configuration
- PostgREST logovi: add-on **Petko PostgREST** → Log

## Troubleshooting

| Problem | Rešenje |
|---------|---------|
| PGRST002 / schema cache | PostgREST ne vidi Postgres — proveri `postgres_host: 127.0.0.1`, lozinku, da je Postgres **started** |
| Add-on nije u Store-u | Settings → Add-ons → ⋮ → Check for updates; ukloni i ponovo dodaj repo `https://github.com/dragangagy/petko-word-quest` |
| Web/Android ne povezuje | URL mora biti **HTTPS javni**, ne `192.168.x.x` |
| CORS | PostgREST + Cloudflare obično ne blokiraju; GitHub Pages origin je OK |
