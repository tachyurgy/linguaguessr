# 🌍 LinguaGuessr

**Hear the world. Guess where.** A "GeoGuessr for the ear": you hear a short fragment of
real human speech and have to name the language — and drop a pin where on Earth it's spoken.

**Live:** https://lingua.levelbrook.com

A demo by [Levelbrook Consulting](https://levelbrook.com) — a Rails & web engineering practice.
This repo is the whole thing: a zero-backend React SPA plus the Python pipeline that builds and
verifies its audio corpus.

---

## What it is

You press play, listen to ~15–20 seconds of someone actually speaking, and guess. Three guess
modes scale the difficulty: **Casual** (multiple choice), **Explorer** (pick the world region),
and **Expert** (drop a pin on a map, scored by great-circle distance to the language's homeland).
A **Daily Challenge** gives everyone the same five seeded rounds with a shareable emoji score card
and streaks; **Classic** is endless play. The whole game runs in the browser — there is no backend,
no auth, no database. The frontend just reads a flat JSON manifest of clip URLs and plays audio off
the edge.

## Why it's interesting (the engineering story)

The hard part of a game like this isn't the UI — it's having a trustworthy, *verified* corpus of
real-world speech across dozens of languages, served cheaply and globally. There's no off-the-shelf
dataset of "short, clean, monolingual clips of a named language, tagged to a place on a map," so the
corpus is built from scratch:

- **Sourced from YouTube** via `yt-dlp` search, one 15–20s audio-only slice per video, biased toward
  clean monolingual speech (news, interviews, audiobooks) with per-language query pools.
- **Whisper-verified.** Every candidate clip is transcribed and language-detected with
  [MLX Whisper](https://github.com/ml-explore/mlx-examples) (Apple-silicon Whisper). A clip is
  **accepted only when Whisper's detected language matches the target** — so the answer key is
  machine-confirmed, not just trusted from the search query. Clips that are too short, silent, or
  mislabeled get dropped; a hard blocklist kills known-bad video IDs.
- **English translation on reveal.** Each clip gets a `text_en` translation (AWS Translate, with a
  fallback path) so the reveal screen shows what was actually said — a respectful detail rather than
  treating speakers as anonymous audio.
- **Scoring with real mechanics.** Map guesses score on an exponential decay of great-circle distance
  (`scoreMap`), with a **replay penalty** (each extra listen scales the round cap by 0.85 — nail it on
  one listen for a 🦻 Golden Ear), a **speed bonus** that drains after a grace window, a one-tap
  **dialect bonus** for languages with regional varieties, and Wordle-style **daily seeding** so two
  players on the same UTC day get an identical puzzle.
- **Edge-served, zero-backend.** The built SPA and the manifest ship to Cloudflare Pages; audio is
  served from object storage (Cloudflare R2). Nothing is rendered or computed server-side.

### What to inspect if you're poking around

- **`src/engine.js`** — the pure game logic: seeded RNG (`mulberry32`), daily-puzzle construction,
  haversine distance, all the scoring/ranking/share-card functions. No framework, fully testable.
- **`audio_corpus_builder/build_corpus.py`** — the discovery → download → Whisper-verify → accept loop,
  including the language-code mapping and quality gates that decide what's allowed into the corpus.
- **`public/manifest.json`** — the single source of truth the game reads: every clip's URL, language,
  region, family, map coordinates, transcript, translation, and provenance.

## Architecture

```
                    BUILD TIME (Python, local)                  RUN TIME (browser + edge)
  ┌───────────────────────────────────────────┐        ┌──────────────────────────────────┐
  │  yt-dlp search ──► 15–20s audio slice      │        │  React/Vite SPA (Cloudflare Pages)│
  │       │                                    │        │      │                            │
  │       ▼                                    │        │      ├─ reads public/manifest.json │
  │  MLX Whisper: transcribe + detect language │        │      ├─ plays clip.url (R2 audio)  │
  │       │     (accept only if lang matches)  │        │      ├─ Leaflet map (CARTO tiles)  │
  │       ▼                                    │        │      └─ scoring in src/engine.js   │
  │  finalize.py ──► merge into manifest.json  │ ─────► │                                    │
  │  translate-manifest.mjs ──► add text_en    │        │   (no backend, no auth, no DB)    │
  └───────────────────────────────────────────┘        └──────────────────────────────────┘
```

- **Frontend:** React 18 + Vite, vanilla CSS, [Leaflet](https://leafletjs.com) with CARTO dark map
  tiles. Single-page, client-only; state and streaks live in `localStorage`.
- **Corpus pipeline:** Python (`audio_corpus_builder/`) — `yt-dlp` for discovery/download, MLX Whisper
  for transcription and language verification, `finalize.py` to merge accepted clips into the manifest.
- **Translation:** `scripts/translate-manifest.mjs` adds an English `text_en` to every clip (AWS
  Translate primary, fallback for unsupported source languages). Idempotent — re-running only fills in
  new clips.
- **Edge serving:** built assets and the manifest deploy to Cloudflare Pages; audio clips are hosted on
  Cloudflare R2 (`clip.url` points straight at the bucket, so audio storage can be swapped without
  touching the app).

## The corpus

The live manifest currently holds **1,851 clips across 38 languages**, mapped to **9 world regions** and
**18 language families**, with **15 dialect varieties across 6 languages** (German, Persian, French,
Portuguese, Spanish, Tamil) powering the optional dialect-bonus round, plus a separate **Accent Mode**
covering **47 languages**. Numbers are read directly from `public/manifest.json`; counts move as the
corpus grows.

### Provenance & licensing — read this honestly

The game code in this repo is **MIT-licensed** (see `LICENSE`).

The **audio clips are not.** They are short excerpts taken from YouTube videos for a
language-identification demo, and **each clip carries the original uploader's rights** — every clip in
the manifest is tagged `"YouTube (clip used for demo; rights with original uploader)"`, and the
reveal screen links back to the original source video. **These clips are not Creative Commons** and
are not redistributed as a dataset; the corpus exists to make the demo playable. A few minor languages
fall back to sentence clips from Google's [FLEURS](https://huggingface.co/datasets/google/fleurs)
dataset.

Because that all-rights-reserved provenance is real legal exposure for a public repo, there is a
**license-safe lane** in progress (`audio_corpus_builder/build_cc_corpus.py`,
`public/cc-clips/`) that sources *only* videos a creator published under YouTube's Creative Commons –
Attribution license, **verifies the CC license per video before downloading a single byte**, and
records the required attribution (creator, channel, source URL) for each clip. The intent is to be
able to drop the legacy clips and ship a clean CC-only corpus.

If you are a creator and want a clip of yours removed, contact **levelbrookteam@gmail.com**.

## Run it locally

```bash
npm install
npm run dev        # local dev server (Vite)
npm run build      # production build -> dist/
npm run preview    # preview the production build
```

The app reads `public/manifest.json` and streams audio from the URLs it contains, so `npm run dev`
gives you the full game with no extra setup. Rebuilding the corpus (the Python pipeline) is a separate,
optional step and requires `yt-dlp` and MLX Whisper on Apple silicon — see `audio_corpus_builder/`.

### Deploy (Cloudflare Pages)

```bash
export CLOUDFLARE_API_TOKEN=...     # never commit — see .env.example
npm run build
npx wrangler pages deploy dist --project-name=linguaguessr --branch=main
```

### Self-hosting the audio

The app reads `clip.url` straight from the manifest, so to host audio yourself: enable Cloudflare R2
(or any bucket / CDN), upload the clips, and rewrite `clip.url` to your domain. No app changes required.

## Tech

React 18 · Vite · Leaflet (CARTO dark tiles) · Cloudflare Pages + R2 · Python · `yt-dlp` · MLX Whisper ·
AWS Translate. Zero-backend SPA.

---

Built by **Levelbrook Consulting**. Questions or takedown requests: **levelbrookteam@gmail.com**.
No secrets are committed — credentials live in gitignored `.env` / `cloudflare-key.local` files.
