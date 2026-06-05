# 🌍 LinguaGuessr

**Hear the world. Guess where.** A "GeoGuessr for the ear": you hear a fragment of real
human speech and guess where on Earth it's spoken. A demo by [Levelbrook](https://levelbrook.com).

**Live:** https://lingua.levelbrook.com · https://linguaguessr-89s.pages.dev

## What it does
- **Daily Challenge** — 5 seeded rounds everyone shares, with a shareable emoji score card + streaks.
- **Classic** — endless play in three guess modes: *Casual* (multiple choice), *Explorer*
  (world region), *Expert* (drop a pin on a map, scored by great-circle distance).
- **Replay penalty** — the first listen earns the most; replays cost points. Nail it on one
  listen for a 🦻 Golden Ear.
- **"Show the word" hint** — reveal the written transcript for a lower score.
- **Respectful reveal** — every language is announced with its flag, a greeting, speaker count,
  and a cultural note. Confetti on strong guesses.

## Data
~1,800 short clips of real human speech across **37 languages / 8 world regions**. Each clip is a
brief fragment used for the listening puzzle, with its original source linked on the reveal screen.
The app just reads a flat manifest of clip URLs (`public/manifest.json`).

## Develop
```bash
npm install
npm run dev      # local dev server
npm run build    # production build -> dist/
```

## Deploy (Cloudflare Pages)
```bash
export CLOUDFLARE_API_TOKEN=...   # never commit this — see .env.example
npm run build
npx wrangler pages deploy dist --project-name=linguaguessr --branch=main
```

## Tech
Vite + React, Leaflet (CARTO dark tiles), Cloudflare Pages. Zero-backend SPA.

### Migrating audio to your own storage (R2)
The app reads `clip.url` straight from `public/manifest.json`. To self-host audio, enable
**R2** in the Cloudflare dashboard, upload the clips, and rewrite `clip.url` to your R2 custom
domain. No app changes required.

---
Credentials live in `cloudflare-key.local` / `.env` (both gitignored). No secrets are committed.
