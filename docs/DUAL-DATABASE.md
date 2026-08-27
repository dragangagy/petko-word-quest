# Petko — dve odvojene baze na Home Assistant

Na istom **PostgreSQL 17** add-onu (`192.168.1.6:5432`) rade **dve odvojene baze** i **dva PostgREST add-ona**.

## Arhitektura

| Igra | Repo / putanja | PostgreSQL baza | PostgREST add-on | Port | URL (LAN) |
|------|----------------|-----------------|------------------|------|-----------|
| **Petko Word Quest** (EN) | `D:\projekti\petko-word-quest\github` · [dragangagy/petko-word-quest](https://github.com/dragangagy/petko-word-quest) | `petko_en` | `petko_postgrest` | **3000** | `http://192.168.1.6:3000` |
| **Petko** (srpska verzija) | `D:\projekti\petko\github` · [dragangagy/petko](https://github.com/dragangagy/petko) | `petko_sr` | `petko_postgrest_sr` | **3001** | `http://192.168.1.6:3001` |

Stara podrazumevana baza `postgres` više se ne koristi za igre (samo sistemski Postgres add-on).

## Šema po bazi

### `petko_en` (Word Quest)
Tabele iz `supabase-schema.sql`:
`scores`, `players`, `challenges`, `challenge_stats`, `challenge_score_stats`, `normal_stats`, `words`, `word_reports`

### `petko_sr` (srpski Petko)
Isti `supabase-schema.sql` **plus** dodatne migracije koje EN verzija nema u glavnoj šemi:
- `supabase-lector-stats.sql` → tabela `lector_stats`
- `sql/2026-08-03-weekend-results.sql` → tabela `weekend_results` + funkcija `record_witch_hunt_result`

**Zaključak:** srpska verzija **deli osnovnu šemu** sa Word Quest-om, ali ima **dve dodatne tabele** (`lector_stats`, `weekend_results`).

## app.js konfiguracija

### Word Quest (EN) — već podešeno
```javascript
const SUPABASE_CONFIG = {
  url: "http://192.168.1.6:3000",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  restPrefix: "",
  // ...
};
```

### Srpski Petko — zameniti cloud Supabase
```javascript
const SUPABASE_CONFIG = {
  url: "http://192.168.1.6:3001",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InBldGtvLWhhIiwiaWF0IjoxNzg3NzQ0OTAyLCJleHAiOjIxMDMxMDQ5MDJ9.89GdhPNVZL1yXM_to4MBvF_M6xCwWMM97YwS56VQAaw",
  restPrefix: "",
  // lectorStatsTable, wordReportsTable, weekendResultsTable ostaju isti
};
```

Za javni pristup (GitHub Pages / mobilna app) koristi **Cloudflare Tunnel** sa dva hostname-a:
- `petko-en-api.tvojdomain.com` → `127.0.0.1:3000`
- `petko-sr-api.tvojdomain.com` → `127.0.0.1:3001`

## Instalacija baza (jednom)

Sa Windows mašine u LAN mreži:
```powershell
python agent-tools\ha_dual_db_setup.py
```

Ili ručno u Postgres add-onu (Terminal / pgAdmin):
1. `scripts/ha-postgres-init-authenticator.sql`
2. `scripts/ha-postgres-init-anon.sql`
3. `CREATE DATABASE petko_en;` / `CREATE DATABASE petko_sr;`
4. Učitati odgovarajuće SQL fajlove u svaku bazu (vidi gore).

## Instalacija PostgREST add-ona

1. U HA: **Add-on Store** → ⋮ → **Check for updates** (repo: `https://github.com/dragangagy/petko-word-quest`)
2. Instalirati / ažurirati **Petko PostgREST (EN)** v1.3.0+ → port 3000
3. Instalirati **Petko PostgREST (SR)** → port 3001
4. Oba add-ona: **Start** + **Watchdog**

Automatski (WebSocket, potreban `HA_TOKEN`):
```powershell
$env:HA_TOKEN = "your-long-lived-token"
python agent-tools\ha_dual_postgrest_setup.py
```

## Test

```powershell
$KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InBldGtvLWhhIiwiaWF0IjoxNzg3NzQ0OTAyLCJleHAiOjIxMDMxMDQ5MDJ9.89GdhPNVZL1yXM_to4MBvF_M6xCwWMM97YwS56VQAaw"
$h = @{ apikey = $KEY; Authorization = "Bearer $KEY" }
Invoke-RestMethod "http://192.168.1.6:3000/players?limit=1" -Headers $h
Invoke-RestMethod "http://192.168.1.6:3001/players?limit=1" -Headers $h
Invoke-RestMethod "http://192.168.1.6:3001/lector_stats?limit=1" -Headers $h
```

## Troubleshooting PGRST002

| Uzrok | Rešenje |
|-------|---------|
| Postgres nije pokrenut | Start **Postgres 17** add-on |
| Pogrešna lozinka | `authenticator` role lozinka = Postgres add-on password (`homeassistant`) |
| Pogrešna baza u URI | EN → `petko_en`, SR → `petko_sr` |
| Port zauzet | Proveri da 3000/3001 nisu u konfliktu |
