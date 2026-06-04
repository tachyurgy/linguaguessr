# LinguaGuessr — Release History

"GeoGuessr for the ear." Vite + React + Leaflet. Deployed to Cloudflare Pages
(project `linguaguessr`), live at **https://lingua.levelbrook.com**.

Deploy command: `npm run build && npx wrangler pages deploy dist --project-name=linguaguessr`

> Newest release on top. Append a new entry every deploy.

---

## 2026-06-03 — Mobile: freeze the in-game map view to the viewport (no more scrolling)
- **What deployed:** lingua.levelbrook.com (bundle `index-2smT8cFQ.js`, CSS `index-BlcGOIu3.css`) — a mobile-only layout fix; no corpus change. The in-game Expert/map view no longer overflows the phone screen and forces an awkward scroll to reach the map and the Guess button.
- **Changed:**
  - **Frozen map guess (`styles.css`, `@media(max-width:980px)`):** during the map guess the stage is now a non-scrolling flex column (`overflow:hidden`) — compact listen controls on top, the map flexes to consume ALL remaining height (`flex:1 1 auto` + `min-height:0` replacing the old fixed `46vh` that could overflow), and the Guess button is pinned directly beneath it. One screen, zero scroll.
  - **Reveal still scrolls:** only the longer reveal keeps `overflow-y:auto`, with its Next button still sticky, so it's always one tap away.
  - **Short-phone map polish (`@media(max-width:980px) and (max-height:720px)`):** in map mode, drop the "listen & place it" label and shrink the play button so the map gets the lion's share of the screen.
- **How:** `npm run build && export CLOUDFLARE_API_TOKEN="$LEVELBROOK_CF_DEPLOY_TOKEN" CLOUDFLARE_ACCOUNT_ID="a67eceeb4b89d2d4171ed209e87c9456" && npx wrangler pages deploy dist --project-name=linguaguessr --branch=main --commit-dirty=true`
- **Verified:** Real mobile-viewport browser (cached Playwright Chromium) at 390×844 and 375×667 — document scroll overflow 0px, stage scroll 0px, Guess button in view both sizes; map grew 218px→290px on the SE after the short-phone tweak; map reveal shows with a reachable sticky Next; Casual mode fits with all 4 choices in view. Live domain returns HTTP 200 and serves `index-2smT8cFQ.js`.

## 2026-06-03 — Menu/routing/modal polish: Expert PRO hero, URL-per-mode, no-scroll modals, audio-bleed fix
- **What deployed:** lingua.levelbrook.com (bundle `index-tOZowhwm.js`) — a UX polish pass on the front-end (no corpus change; still 40 langs / 1,102 clips + 874 accent clips). The mode picker and How-to modals are now roomy desktop rectangles, the URL reflects the active mode, Expert is surfaced as its own PRO hero, leftover audio no longer bleeds between screens, and mobile map mode fits one screen.
- **Changed:**
  - **URL-per-mode routing (`App.jsx`):** hash routes `#/expert #/daily #/explorer #/casual #/accent #/about`. Deep-linkable; browser Back/Forward move between modes; initial load honors a deep link and normalizes the address bar. `ROUTE_BY_SLUG`/`SLUG_BY_KEY`/`slugForGame()`/`parseHash()`; a `hashchange` effect rebuilds the matching game and no-ops when already on it.
  - **Expert "PRO" hero:** pulled map/classic out of the 4-up grid into its own `daily-hero`-styled blurb beside the Daily Challenge; the three lighter modes (Explorer/Casual/Accent) now sit under "or pick a lighter mode" (3-up on desktop).
  - **Modals are rectangles, not phone columns (`styles.css`):** desktop menu → 860px with a 3-up mode grid; How-to → 760px with a two-column tip layout (`.howrows`); `max-height` 86vh→90vh; short-wide windows lift the menu cap to 980px. No scrolling.
  - **Audio bleed fix (`audio.jsx`):** AudioPlayer hard-pauses + detaches its `src` on unmount, so switching modes / opening About / revealing / URL nav stops the previous clip (DOM removal alone didn't reliably halt playback).
  - **Mobile in-game fit (`styles.css`):** map mode on phones compacts the listen panel (64px play button, hidden equalizer), shrinks map heights (46vh/42vh), and pins the Guess button sticky-bottom — player + map + button fit one screen.
  - **Email on the page:** `levelbrookteam@gmail.com` added to the menu footer, site footer, and About CTA.
- **How:** `npm run build && CLOUDFLARE_API_TOKEN=$LEVELBROOK_CF_DEPLOY_TOKEN CLOUDFLARE_ACCOUNT_ID=a67eceeb4b89d2d4171ed209e87c9456 npx wrangler pages deploy dist --project-name=linguaguessr --branch=main --commit-dirty=true`. Source committed as `Levelbrook Consulting` (commit `9dca5f7`), pushed to origin/master.
- **Verified:** home + manifest.json HTTP 200; live `index.html` references `index-tOZowhwm.js` — **byte-for-byte the same hash as the local build**, confirming the new bundle is live (not cached). Pre-deploy, headless-Chromium screenshots confirmed the desktop/mobile menu, game, and How-to layouts fit without scrolling, and interaction tests confirmed routing (`#/expert`→`#/casual`→`#/daily`, Back returns) and audio teardown (clip playing → navigate away → audio element gone).

## 2026-06-03 — Dialect bonus shipped + corpus rebalanced, +3 minority languages (40 langs / 1,102 clips)
- **What deployed:** lingua.levelbrook.com (bundle `index-__YUQb9D.js`) — the **"which variety did you hear?" dialect bonus is now live**, the dialect corpus is **rebalanced** so the bonus is a real choice (no more 29:1 splits), and three connoisseur minority languages — **Welsh, Basque, Galician** — joined the Classic corpus (now **40 languages / 1,102 clips**). Audio served from Cloudflare R2.
- **Changed:**
  - **Dialect bonus (front-end, completed):** after the language reveal, languages with a real regional split offer an optional one-tap "which variety?" guess worth +800; a wrong call never costs points. `engine.js` `dialectOptions()`/`scoreDialect()`/`DIALECT_BONUS`; `App.jsx` `DialectBonus` component + reveal badge + bonus tag + per-round reset (`freshRound` now seeds `dialectPick`/`dialectBonus`); the bonus credits the real game total (verified `next()` commits `lastPts` into `scores`). Added a How-to-play line so it's discoverable. `styles.css` badge + choice-button styling.
  - **Corpus rebalanced (the headline fix):** the old build stopped at 30 clips top-down, so the dominant variety swamped the minority — **por 29:1, fra 29:1, spa 27:3, fas 29:1, tam 13:1**. Rebuilt with a **per-variety quota** (`audio_corpus_builder/balance_dialects.py`): each minority variety is sourced from its actual broadcasters and accepted only when MLX-Whisper confirms the language **and** the source channel classifies to that variety. Result: **Portuguese pt-BR 20 / pt-PT 12**, **French fr-FR 20 / fr-CA 12 / fr-BE 12** (3-way), **Spanish es-ES 20 / es-MX 12 / es-AR 12 / es-CO 12** (4-way), **Persian fa-IR 20 / fa-AF 12**, **Tamil ta-IN 13 / ta-LK 8**. Worst ratio now 1.67:1.
  - **Honesty fix:** the variety gate is now **channel-only** — a YouTube *title* containing "portugal" no longer manufactures a fake European-Portuguese tag (the query injects that word). New European-Portuguese/Quebec/Belgian/Mexican/Argentine/Colombian/Sri-Lankan/Afghan clips all come from named broadcasters (RTP, SIC, TVI, Observador; Radio-Canada; RTBF; Televisa, Milenio; Telefe, C5N; Caracol; Shakthi/News 1st/Ada Derana; TOLOnews, Ariana). Also fixed `dialects.py` channel recognition (it had been missing TOLOnews, ICI RDI / Radio-Canada, 1TV Afghanistan).
  - **+3 minority languages:** Welsh (cym), Basque (eus), Galician (glg) — 12 MLX-Whisper-verified clips each (`cov≈1.00`). Breton/Faroese/Luxembourgish attempted but produced 0 (trilingual / low-resource sources defeat the verify gate); the 9 Whisper-blind langs (Irish/Scottish Gaelic/Sami + 6 Native American) still need a non-Whisper sourcing pass.
- **How:** `audio_corpus_builder/balance_dialects.py por fra spa tam fas` (per-variety build) → `finalize.py` (merge + dialect-tag + R2 upload) → `node scripts/clips-to-r2.mjs` (catch stragglers) → `npm run build` → deployed from an isolated snapshot: `CLOUDFLARE_API_TOKEN=$LEVELBROOK_CF_DEPLOY_TOKEN CLOUDFLARE_ACCOUNT_ID=a67eceeb4b89d2d4171ed209e87c9456 npx wrangler pages deploy /tmp/lg_deploy_snapshot --project-name=linguaguessr --branch=main --commit-dirty=true`.
- **Verified:** home HTTP 200; live `manifest.json` = **40 languages / 1,102 clips** with cym/eus/glg present and the balanced dialect map (fas 20:12, fra 20:12:12, por 12:20, spa 20:12:12:12, tam 13:8); 8 sampled minority-variety clips (fa-AF, fr-BE, fr-CA, pt-PT, es-MX, es-AR, es-CO, ta-LK) all HTTP 200 on R2; live bundle `index-__YUQb9D.js` grep-confirms the dialect UI ("which variety did you hear").

## 2026-06-02 — Corpus 24→37 languages + cross-game variety engine
- **What deployed:** lingua.levelbrook.com (bundle `index-BUW_IftA.js`) — the Classic/listening corpus grew from **24 to 37 languages** (479 → **1,031** native-speech clips), and round selection was reworked so a browser gets *good variety* instead of the same few languages cycling (the recurring "Polish/Russian over and over" complaint). Audio is served from Cloudflare R2.
- **Changed:**
  - **Corpus +13 languages** (YouTube + MLX-Whisper-verified pipeline in `audio_corpus_builder/`): **Scandinavian now complete** — Finnish, Danish, Norwegian, Icelandic (joining Swedish); **more European** — Czech, Hungarian, Romanian, Catalan, Bulgarian; **African** — Swahili, Afrikaans; plus Urdu/Telugu/Tagalog. Most languages carry 24–30 clips.
  - **Honest gaps:** Amharic, Hausa, Somali, Yoruba, Hawaiian, Maori produced **0 clips** — MLX Whisper (`large-v3-turbo`) misdetects these low-resource languages (mostly as Arabic/English), and the verify-gate correctly rejects rather than mislabel a guessing-game clip. They need a manually-curated track, not the auto-verify pipeline. (By design, only Whisper-verifiable indigenous langs were attempted — Hawaiian/Maori — and even those failed verification.)
  - `engine.js` `pickRoundsFrom()` — added a **durable cross-game language cooldown** (persisted to `localStorage` `lg.langhist.v1`, window 14) so recently-heard languages are pushed back *even across page reloads* (the old per-session cooldown reset on every reload, which is why the same few resurfaced), plus **family/region spread** within each game so a round set won't double up on two Slavic/Romance languages while others go unheard. Verified on a 40-language / 60-game simulation: even serve spread (min 7 / max 8), zero consecutive-game language overlap, zero same-family tripling.
  - Audio served from **Cloudflare R2** (`pub-9a48…r2.dev`); manifest clip URLs are absolute R2 links (clips no longer bundled in the Pages deploy).
- **How:** `audio_corpus_builder/build_corpus.py` (discover→download→Whisper-verify) then `finalize.py` merged clips into `manifest.json`; deployed from an **isolated `dist` snapshot** (a concurrent session's `npm run build` clobbered the first attempt's hashed asset mid-upload → `ENOENT`, so the retry copied `dist`→`/tmp/lg_deploy_snapshot` first): `CLOUDFLARE_API_TOKEN=$LEVELBROOK_CF_DEPLOY_TOKEN CLOUDFLARE_ACCOUNT_ID=a67eceeb4b89d2d4171ed209e87c9456 npx wrangler pages deploy /tmp/lg_deploy_snapshot --project-name=linguaguessr --branch=main --commit-dirty=true`.
- **Verified:** home HTTP 200; live `manifest.json` = **37 languages / 1,031 clips** with all new langs present; 12 sampled new-language clips (cat/isl/nor/fin/dan/swh/afr/ces/hun/ron/bul/swe) all HTTP 200 on R2; live bundle `index-BUW_IftA.js` grep-confirms the variety fix (`lg.langhist`). Shares the single live bundle with concurrent UI work (Daily / Hire-us / play-button fix).

---

## 2026-06-02 — Fix: first play-button click was a no-op (double-click bug)
- **What deployed:** lingua.levelbrook.com — fixes the bug where the very first click on the big play button did nothing and you had to click twice to start the game.
- **Changed:**
  - `audio.jsx` — root cause was a double-trigger race: on load the app autoplays, the browser blocks it, and `armUnlock()` arms a global capture-phase `pointerdown` listener to start audio on the next gesture. Clicking the play button fired *both* that global handler (which called `a.play()`, setting `paused=false`) *and* the button's own `toggle()` (which then saw `!paused` and immediately called `a.pause()`) — net no-op on the first click. Fix: the global unlock handler now bails when the gesture lands on `.playbtn` (`e.target.closest('.playbtn')`), and `toggle()` handles the `blocked` state itself by calling `playFromStart()`, making the button the single source of truth.
- **How:** `npm run build && CLOUDFLARE_API_TOKEN=$LEVELBROOK_CF_DEPLOY_TOKEN CLOUDFLARE_ACCOUNT_ID=a67eceeb4b89d2d4171ed209e87c9456 npx wrangler pages deploy dist --project-name=linguaguessr --branch=main --commit-dirty=true`.
- **Verified:** home HTTP 200; production bundle ships the new guard.

---

## 2026-06-02 — "Hire us" button on every page (Levelbrook flywheel)
- **What deployed:** lingua.levelbrook.com (bundle `index-BHZg_kfm.js`) — a persistent **"Hire us" CTA in the top bar of every view** (loading, play, in-game, reveal, summary, about, empty, error), linking to `https://consulting.levelbrook.com/?ref=linguaguessr`. This closes the growth flywheel: game → Hire us → consulting site → the new "Building a Multilingual Speech Corpus" essay (which links back to the game) → contact.
- **Changed:**
  - `App.jsx` — added the `<a className="hire">` button to the `Shell` topbar (renders on every view, both `game` and `page` variants).
  - `styles.css` — `.hire` button style (mint-gradient pill) + `.topnav{align-items:center}`.
  - Note: this deploy shares the single canonical bundle with the concurrent Daily + Accent/corpus work below — one live bundle contains all three.
- **How:** `npm run build && CLOUDFLARE_API_TOKEN=$LEVELBROOK_CF_DEPLOY_TOKEN CLOUDFLARE_ACCOUNT_ID=a67eceeb4b89d2d4171ed209e87c9456 npx wrangler pages deploy dist --project-name=linguaguessr --branch=main --commit-dirty=true`. (Wrangler OAuth was stale; the `$LEVELBROOK_CF_DEPLOY_TOKEN` env token works only with `CLOUDFLARE_ACCOUNT_ID` set, which skips the failing account-list check.)
- **Verified:** home HTTP 200; live production bundle grep confirms `consulting.levelbrook.com/?ref=linguaguessr` and "Hire us" are present; consulting essay it points to is HTTP 200.

## 2026-06-02 — Daily Challenge restored (the Wordle loop)
- **What deployed:** lingua.levelbrook.com (bundle `index-BHZg_kfm.js`) — the **Daily Challenge is back and live**. The same five-clip puzzle for everyone each UTC day, a copy-to-clipboard emoji score card, and streaks. Verified the live JS bundle ships the Daily code ("Daily Challenge", "Daily #", "day streak"). Today is Daily #6.
- **Changed:**
  - `engine.js` — `buildDaily()` builds a deterministic five-clip puzzle seeded by the UTC day number, so every player worldwide hears identical rounds. It deliberately bypasses the durable seen/recency machinery (determinism is the point) and never records its clips as served, so playing the Daily doesn't burn clips out of Classic. Greedy family/region spread keeps the five varied. Added `todayDayNumber`/`dailyNumber`/`dailyDoneToday` + `LAUNCH_DAY` (2026-05-28); `shareText()` gained a daily header + 🔥 streak line; `saveGame()` tracks `streak`/`maxStreak`/`lastDaily`/`dailyDone`/`dailyBest` (only the first daily completion of a day advances the streak).
  - `App.jsx` — `newGame()` handles `mode:'daily'`; the Menu now leads with a prominent **Daily hero** (badge `#N`, played-today/streak chip) above an "or" divider and the free-play modes; Summary is daily-aware (Daily #N complete, streak/best/daily-best stats, daily emoji card, replay routes to free play); HowTo documents the loop.
  - `styles.css` — Daily hero card + divider.
- **How:** `npm run build && CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=$(cfat token from cloudflare-key.local line 5) npx wrangler pages deploy dist --project-name=linguaguessr --branch=main --commit-dirty=true`. (Wrangler OAuth was NOT logged in this session — used the repo's own `cfat_` token, valid through 2026-06-04.)
- **Verified:** home HTTP 200; live bundle grep confirms the Daily markers are present; live manifest healthy (24 languages, all with clips → Daily's 5-pick requirement satisfied). `buildDaily` independently checked against the live manifest: deterministic within a day, fresh the next day, 5 distinct languages. Committed as `42cdd18` (Levelbrook Consulting). Note: a concurrent session deployed accent/corpus work to the same shared `dist/` — the single live bundle contains both changes; the live corpus at deploy time was 479 classic + 874 accent = 1353 clips.

## 2026-06-02 — Accent Mode fix + 3× corpus expansion
- **What deployed:** lingua.levelbrook.com (bundle `index-BHZg_kfm.js`) — Accent Mode no longer crashes, and the accent library grew from **285 clips / 32 languages to 874 clips / 47 languages**.
- **Changed:**
  - **Fixed the Accent Mode crash.** The deployed bundle built the answer-lookup table (`langByCode`) from the classic 24-language set only, so the 10 accent-only languages (English, Danish, Finnish, Czech, Romanian, Hungarian, Bulgarian, Norwegian, Yoruba, Amharic) had no entry → `undefined` answer option → the whole screen crashed to the "Something hiccuped" ErrorBoundary. The source fix (build `langByCode` from `accentLanguages + languages`) existed but had never been redeployed.
  - **Expanded the accent corpus** to up to 24 speakers/language across 47 native languages (added Greek, Albanian, Serbian, Cantonese, Indonesian, Tagalog, Urdu, Punjabi, Gujarati, Nepali, Telugu, Malayalam, Igbo, Hausa, Somali) from the GMU Speech Accent Archive. `build-accents.mjs` is now self-contained (own geo/region/family metadata, no longer coupled to the classic corpus, so it can never silently drop accent-only languages) and probes GMU concurrently.
  - **Kept English out of the main game.** English stays in Accent Mode (everyone reads the same English passage, so it's a valid "place the accent" answer) but is excluded from the language-guessing game: removed `eng` from the FLEURS sentence builder; the active YouTube pipeline has no English target; 0 English clips, English not in `manifest.languages`.
- **How:** `npm run build && npx wrangler pages deploy dist --project-name=linguaguessr` (token `LEVELBROOK_CF_DEPLOY_TOKEN`, account `a67e…`).
- **Verified (headless Chrome on live):** Accent Mode enters without crashing, loads + plays GMU clips (japanese14, somali1, hungarian12, arabic22 — all beyond the old 9-cap), renders correct 4-option choices. Live `manifest.json`: 874 accents / 47 accentLanguages; English in `accentLanguages` but NOT in `languages`; 0 `eng` clips; classic distractor pool excludes English.

## 2026-06-02 — YouTube corpus live
- **What deployed:** lingua.levelbrook.com — live manifest now serves **765 clips** (HTTP 200 verified).
- **Changed:** Replaced the FLEURS / Lingua-Libre open-source corpus with the YouTube-sourced corpus (15–20s native-speech clips, Whisper-verified). Flat clips in `public/sentence-clips/`, indexed by `public/manifest.json`.
- **How:** `npm run build && npx wrangler pages deploy dist --project-name=linguaguessr`.
- **Verified:** homepage HTTP 200; live `manifest.json` clip count = 765. Corpus build pipeline in `audio_corpus_builder/` (`build_corpus.py` + `finalize.py`).

## ~2026-05-30 → 06-01 — Gameplay polish (pre-corpus-swap)
*(Reconstructed from git history — these landed before the corpus swap above.)*
- Never repeat a clip within a session or across future sessions.
- Prefetch only the session's clips (5 rounds ahead), not the whole library.
- Bigger guess map, true pause, background prefetch + broken-clip resilience.
- Reveal: full-screen two-column results on desktop; "Spoken in" line.
- Immersive GeoGuessr-style drop-in: auto-start, autoplay, audio-only clue.
- Reworked game: killed stale-cache bug, dropped Daily, wide map layout, transcript-first reveal.

## 2026-05-28 — Initial release
- **What deployed:** First live version of LinguaGuessr — listening game (React + Vite) with live data pipeline, deployed to Cloudflare Pages at lingua.levelbrook.com.
- **Changed:** Core game loop: hear a clip, guess the language/location on a Leaflet map, scored by geo distance + region/family. Original corpus from Lingua Libre single words.
