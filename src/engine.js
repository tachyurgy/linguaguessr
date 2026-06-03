// engine.js — pure game logic: data, rng, geo, scoring, stats, sharing.

export const ROUNDS = 5;
export const MAX_ROUND = 5000; // accuracy ceiling for a round
// Speed bonus: answer fast and a chunk of extra points is yours. It rides on
// top of the accuracy score, so a round is worth up to MAX_ROUND + SPEED_MAX.
export const SPEED_MAX = 1200;
export const SPEED_GRACE_MS = 2500;  // first ~2.5s are free (you're still hearing it)
export const SPEED_SPAN_MS = 18000;  // then the bonus drains to zero over 18s
export const MAX_ROUND_TOTAL = MAX_ROUND + SPEED_MAX;
export const MAX_GAME = ROUNDS * MAX_ROUND_TOTAL;

// ---- Daily Challenge --------------------------------------------------------
// One fixed five-clip puzzle per UTC day that everyone hears the same — the
// Wordle loop. The day number seeds a deterministic pick, so two players on
// opposite sides of the world get identical rounds and can compare emoji cards.
const LAUNCH_DAY = Math.floor(Date.UTC(2026, 4, 28) / 86400000); // 2026-05-28
export function todayDayNumber() { return Math.floor(Date.now() / 86400000); }
export function dailyNumber() { return todayDayNumber() - LAUNCH_DAY + 1; }

// Every Speech Accent Archive speaker reads this same elicitation paragraph,
// so accent clips carry no per-clip transcript — we show the shared passage.
export const ACCENT_PASSAGE =
  "Please call Stella. Ask her to bring these things with her from the store: " +
  "six spoons of fresh snow peas, five thick slabs of blue cheese, and maybe a " +
  "snack for her brother Bob. We also need a small plastic snake and a big toy " +
  "frog for the kids. She can scoop these things into three red bags, and we " +
  "will go meet her Wednesday at the train station.";

// ---- data loading -------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function loadManifest({ retries = 4 } = {}) {
  // IMPORTANT: never force-cache. A force-cached manifest pins the browser to a
  // previous deploy's clip library — which is exactly how stale single-word
  // (pre-FLEURS) data and "no accent rounds" kept surfacing. Always revalidate.
  //
  // Resilience: a transient network blip on first load used to leave the player
  // staring at a dead "Could not load clip library" screen. Retry a few times
  // with exponential backoff before giving up, then fall back to a force-cached
  // copy (a prior good load) if the network is briefly unreachable.
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch("/manifest.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
      return hydrateManifest(await res.json());
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await sleep(Math.min(400 * 2 ** attempt, 4000));
    }
  }
  try {
    const res = await fetch("/manifest.json", { cache: "force-cache" });
    if (res.ok) return hydrateManifest(await res.json());
  } catch {}
  throw new Error("Could not load the clip library. Check your connection and retry.");
}

function hydrateManifest(m) {
  m.byLang = {};
  for (const c of m.clips) (m.byLang[c.lang] ||= []).push(c);
  m.accentLanguages = m.accentLanguages || [];
  // langByCode must cover BOTH the classic FLEURS languages and the accent-mode
  // languages — accent rounds look up the correct answer here too. If it's built
  // from m.languages alone, accent languages absent from the classic set (English,
  // Danish, Finnish, Czech, Yoruba, …) resolve to `undefined`, which crashes the
  // choice buttons (o.code on undefined) and leaves the right answer missing from
  // the options. Classic entries win on overlapping codes.
  m.langByCode = Object.fromEntries(
    [...m.accentLanguages, ...m.languages].map((l) => [l.code, l])
  );
  m.byAccentLang = {};
  for (const c of m.accents || []) (m.byAccentLang[c.lang] ||= []).push(c);
  return m;
}

// ---- background prefetch + broken-clip tracking -------------------------
// As soon as the app loads we warm the browser cache with EVERY clip so a
// round never has to wait on a network round-trip. The same pass tells us
// which clips are missing/broken, so round-building avoids them and the game
// degrades gracefully instead of getting stuck on a dead file.
export const brokenClips = new Set();
const prefetched = new Set();

export function allClipUrls(manifest) {
  const urls = [];
  for (const c of manifest.clips || []) if (c.url) urls.push(c.url);
  for (const c of manifest.accents || []) if (c.url) urls.push(c.url);
  return urls;
}

function isSameOrigin(url) {
  try { return new URL(url, location.href).origin === location.origin; } catch { return false; }
}

// Warm the browser cache with the clips a session actually needs. By default
// this is ONLY the `priority` urls — the current game's five rounds — so a round
// never waits on the network without downloading the whole multi-hundred-MB
// library. Pass { all: true } to also warm every other same-origin clip in the
// background (not used in normal play).
//
// Cross-origin audio (the external Speech Accent Archive) is warmed with a
// no-cors request: a plain cors fetch to that host REJECTS (no CORS headers),
// which would wrongly flag accent clips as broken. The <audio> element plays
// cross-origin media fine regardless, so a prefetch miss there is never "broken".
//
// Idempotent: each url is fetched at most once per session. Never throws.
export async function prefetchAll(manifest, { concurrency = 6, priority = [], all = false, onProgress } = {}) {
  const seen = new Set();
  const queue = [];
  for (const u of priority) if (u && !seen.has(u)) { seen.add(u); queue.push(u); }
  if (all) {
    for (const u of allClipUrls(manifest)) if (!seen.has(u) && isSameOrigin(u)) { seen.add(u); queue.push(u); }
  }

  let done = 0, i = 0;
  const total = queue.length;
  async function worker() {
    while (i < queue.length) {
      const url = queue[i++];
      if (!prefetched.has(url)) {
        if (isSameOrigin(url)) {
          try {
            // Immutable static audio — force-cache warms the HTTP cache the
            // <audio> element later reads from.
            const res = await fetch(url, { cache: "force-cache" });
            if (!res.ok) brokenClips.add(url);
            else { await res.blob(); prefetched.add(url); } // pull the body so it's fully cached
          } catch {
            brokenClips.add(url);
          }
        } else {
          // Cross-origin: opaque warm only; a failure here is NOT "broken".
          try { await fetch(url, { mode: "no-cors", cache: "force-cache" }); } catch {}
          prefetched.add(url);
        }
      }
      onProgress?.(++done, total);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, total) || 1 }, worker));
  return { total, broken: brokenClips.size };
}

// A stand-in clip when one fails to load mid-game: another clip in the same
// language if possible, otherwise a fresh language not already in this game.
export function replacementClip(manifest, game, badClip) {
  const accent = game.mode === "accent";
  const byLang = accent ? manifest.byAccentLang : manifest.byLang;
  const langs = accent ? manifest.accentLanguages : manifest.languages;
  const sameLang = (byLang[badClip.lang] || []).find(
    (c) => c.url !== badClip.url && !brokenClips.has(c.url)
  );
  if (sameLang) return sameLang;
  const usedLangs = new Set(game.rounds.map((c) => c.lang));
  for (const l of shuffle(langs)) {
    if (usedLangs.has(l.code)) continue;
    const alt = (byLang[l.code] || []).find((c) => !brokenClips.has(c.url));
    if (alt) return alt;
  }
  return null;
}

// ---- seeded RNG (mulberry32) -------------------------------------------
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- repeat avoidance (durable across sessions) -------------------------
// Don't repeat questions. `sessionSeen` covers this session and includes clips
// merely *served* (so a mid-game restart won't bring the same clip back).
// `seen` is persisted to localStorage and recorded once a clip is *revealed*,
// so future sessions stay fresh too. When everything has been seen, the durable
// cycle resets so play never gets stuck.
const SEEN_KEY = "lg.seen.v1";
function loadSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY)) || []); } catch { return new Set(); }
}
let seen = loadSeen();
const sessionSeen = new Set();
// How many times each language has been *served* this play session. Used to
// space the same language out across consecutive games — within one game a
// language never repeats, but without this the same handful of languages could
// resurface game after game. Resets when the tab/app is reloaded (a new session).
const sessionLangCount = new Map();
function isSeen(id) { return seen.has(id) || sessionSeen.has(id); }
export function markSeen(clip) {
  if (!clip?.id) return;
  seen.add(clip.id);
  sessionSeen.add(clip.id);
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])); } catch {}
}

// ---- durable language variety (anti "same few languages every game") --------
// Repeat-avoidance above only stops the same *clip* coming back. It did nothing
// to stop the same handful of *languages* (the classic complaint: Polish/Russian
// over and over) resurfacing game after game — because the per-session cooldown
// (`sessionLangCount`) resets on every page reload, and a fresh reload then picks
// languages with no memory at all. We fix that by persisting a short history of
// recently-served languages to localStorage, so the cooldown survives reloads and
// genuinely spreads play across the whole corpus for this browser.
const LANGHIST_KEY = "lg.langhist.v1";
const RECENCY_WINDOW = 14; // remember ~the last few games' worth of served langs
function loadLangHist() {
  try { return JSON.parse(localStorage.getItem(LANGHIST_KEY)) || []; } catch { return []; }
}
// Map code -> recency index (0 = most recently served). Absent = not recent.
function langRecency() {
  const m = new Map();
  loadLangHist().forEach((code, i) => { if (!m.has(code)) m.set(code, i); });
  return m;
}
function recordLangServe(codes) {
  try {
    const next = [...codes, ...loadLangHist()].slice(0, RECENCY_WINDOW);
    localStorage.setItem(LANGHIST_KEY, JSON.stringify(next));
  } catch {}
}

// ---- round building -----------------------------------------------------
// One round per distinct language (a game never repeats a language). Two goals
// drive selection, both aimed at "good variety, not raw randomness":
//   1. Cooldown — languages served recently (this session AND in recent games,
//      via the durable history above) are pushed back, so the corpus is swept
//      broadly instead of the same few resurfacing every reload.
//   2. Family/region spread — within a single game the five rounds are spread
//      across distinct language families/regions, so a round set rarely doubles
//      up on two Slavic (Polish+Russian) or two Romance languages while other
//      families go unheard.
// Served clips/languages are reserved immediately so a mid-game restart won't
// repeat them.
function pickRoundsFrom(langList, byLang, n, rand) {
  const usable = langList.filter((l) => byLang[l.code]?.length);
  // If everything playable has already been seen, reset the durable cycle so
  // play never stalls on "nothing fresh left".
  const anyUnseen = usable.some((l) => byLang[l.code].some((c) => !isSeen(c.id)));
  if (!anyUnseen && usable.length) {
    seen = new Set();
    try { localStorage.removeItem(SEEN_KEY); } catch {}
  }
  // Base desirability (lower = picked sooner). Session usage dominates; durable
  // recency pushes back languages heard in the last few games (this is what makes
  // the fix survive a page reload); "fully seen" is only a final tiebreak.
  const recency = langRecency();
  const baseScore = (l) => {
    const used = sessionLangCount.get(l.code) || 0;
    const r = recency.get(l.code);
    const recencyPenalty = r == null ? 0 : RECENCY_WINDOW - r; // more recent => bigger
    const fullySeen = byLang[l.code].some((c) => !isSeen(c.id)) ? 0 : 1;
    return used * 6 + recencyPenalty + fullySeen * 0.5;
  };
  // Greedy pick: each step takes the lowest-scoring language, where any family/
  // region already chosen THIS game adds a clash penalty — so the set spreads
  // across families. Random shuffle order makes ties break randomly.
  let pool = shuffle(usable, rand);
  const chosen = [];
  const usedFamilies = new Set();
  const usedRegions = new Set();
  while (chosen.length < n && pool.length) {
    let best = null, bestScore = Infinity;
    for (const l of pool) {
      const clash =
        (usedFamilies.has(l.family) ? 6 : 0) + (usedRegions.has(l.region) ? 1.5 : 0);
      const s = baseScore(l) + clash;
      if (s < bestScore) { bestScore = s; best = l; }
    }
    chosen.push(best);
    usedFamilies.add(best.family);
    usedRegions.add(best.region);
    pool = pool.filter((l) => l !== best);
  }
  const picks = chosen.map((l) => {
    const choice = pickFromPool(byLang[l.code], rand);
    sessionSeen.add(choice.id); // reserve so a restart this session won't repeat it
    sessionLangCount.set(l.code, (sessionLangCount.get(l.code) || 0) + 1);
    return choice;
  });
  recordLangServe(chosen.map((l) => l.code)); // persist cross-game cooldown
  return picks;
}

// Pick a clip from a language pool: prefer unseen AND not-broken, then unseen,
// then not-broken, then anything.
function pickFromPool(pool, rand) {
  const ok = (c) => !brokenClips.has(c.url);
  const freshOk = pool.filter((c) => ok(c) && !isSeen(c.id));
  const fresh = pool.filter((c) => !isSeen(c.id));
  const good = pool.filter(ok);
  const arr = freshOk.length ? freshOk : fresh.length ? fresh : good.length ? good : pool;
  return arr[Math.floor(rand() * arr.length)];
}

export function buildClassic(manifest, filter) {
  const rand = rng((Math.random() * 2 ** 31) >>> 0);
  const langs = manifest.languages.filter((l) => (filter ? filter(l) : true));
  return pickRoundsFrom(langs, manifest.byLang, ROUNDS, rand);
}
// The daily puzzle: the SAME five clips for everyone on a given UTC day.
// Deliberately bypasses the durable "seen"/recency machinery that buildClassic
// uses — determinism (everyone hears the identical puzzle) is the whole point,
// and the pick must not depend on this browser's local play history. It also
// never records the clips as served, so playing the Daily doesn't burn them out
// of your Classic rotation. Within a day the result is stable; a greedy
// family/region spread keeps the five varied, all driven purely by the seed.
export function buildDaily(manifest) {
  const rand = rng((todayDayNumber() * 2654435761) >>> 0);
  let pool = shuffle(
    manifest.languages.filter((l) => manifest.byLang[l.code]?.length),
    rand
  );
  const chosen = [];
  const usedFamilies = new Set();
  const usedRegions = new Set();
  while (chosen.length < ROUNDS && pool.length) {
    let best = pool[0], bestScore = Infinity;
    for (const l of pool) {
      const clash =
        (usedFamilies.has(l.family) ? 6 : 0) + (usedRegions.has(l.region) ? 1.5 : 0);
      if (clash < bestScore) { bestScore = clash; best = l; }
    }
    chosen.push(best);
    usedFamilies.add(best.family);
    usedRegions.add(best.region);
    pool = pool.filter((l) => l !== best);
  }
  return chosen.map((l) => {
    const p = manifest.byLang[l.code];
    return p[Math.floor(rand() * p.length)];
  });
}
// Accent mode: everyone reads the same English passage — guess the native language.
export function buildAccent(manifest) {
  const rand = rng((Math.random() * 2 ** 31) >>> 0);
  return pickRoundsFrom(manifest.accentLanguages, manifest.byAccentLang, ROUNDS, rand);
}

// Multiple-choice options: correct + 3 distractors, biased toward same
// region/family so it's a real discrimination test. `pool` defaults to all langs.
export function buildOptions(manifest, clip, pool) {
  const others = (pool || manifest.languages).filter((l) => l.code !== clip.lang);
  const near = shuffle(
    others.filter((l) => l.region === clip.region || l.family === clip.family)
  );
  const far = shuffle(others.filter((l) => !near.includes(l)));
  const picks = [...near, ...far].slice(0, 3);
  const correct = manifest.langByCode[clip.lang];
  return shuffle([correct, ...picks]);
}

// ---- geography ----------------------------------------------------------
export function haversine([lat1, lon1], [lat2, lon2]) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

// ---- scoring ------------------------------------------------------------
// First listen is free; each extra play scales the round cap by 0.85.
export function replayMultiplier(plays) {
  return Math.pow(0.85, Math.max(0, plays - 1));
}
export function scoreMap(distKm, plays) {
  const base = MAX_ROUND * Math.exp(-distKm / 1800);
  return Math.round(base * replayMultiplier(plays));
}
export function scoreChoice(picked, clip, plays) {
  const mult = replayMultiplier(plays);
  if (picked.code === clip.lang) return Math.round(MAX_ROUND * mult);
  if (picked.family === clip.family) return Math.round(1500 * mult); // same family consolation
  return 0;
}
export function scoreRegion(region, clip, plays) {
  const mult = replayMultiplier(plays);
  return region === clip.region ? Math.round(4000 * mult) : 0;
}

// ---- dialect bonus ------------------------------------------------------
// After the main language guess, languages with a big regional split (Spanish,
// Portuguese, Arabic, …) offer a one-tap bonus: name the *variety* you heard.
// It rides on top of the round, so a Brazilian-vs-European ear is rewarded.
export const DIALECT_BONUS = 800;

// The variety options for a clip's bonus guess: the correct variety + up to 3
// sibling varieties as distractors. Empty when the clip carries no dialect or the
// language has fewer than two varieties present in the corpus (nothing to pick).
export function dialectOptions(manifest, clip) {
  const set = manifest.dialects && manifest.dialects[clip.lang];
  if (!set || set.length < 2 || !clip.dialect_code) return [];
  const correct = set.find((d) => d.code === clip.dialect_code);
  if (!correct) return [];
  const others = shuffle(set.filter((d) => d.code !== clip.dialect_code));
  return shuffle([correct, ...others.slice(0, 3)]);
}
export function scoreDialect(pickedCode, clip) {
  return pickedCode === clip.dialect_code ? DIALECT_BONUS : 0;
}

// ---- speed bonus --------------------------------------------------------
// Fraction of the speed bonus still on the table at `elapsedMs` after the round
// started: full through the grace window, then a linear drain to zero. This is
// the live meter the player watches tick down.
export function speedFrac(elapsedMs) {
  const t = (elapsedMs || 0) - SPEED_GRACE_MS;
  if (t <= 0) return 1;
  return Math.max(0, 1 - t / SPEED_SPAN_MS);
}
// Bonus actually awarded: the time fraction scaled by how good the guess was
// (qualityFrac = accuracyPts / MAX_ROUND), so a fast wild stab earns little but
// a fast bullseye earns the lot.
export function speedBonus(elapsedMs, qualityFrac) {
  const q = Math.max(0, Math.min(1, qualityFrac || 0));
  return Math.round(SPEED_MAX * speedFrac(elapsedMs) * q);
}

// ---- ranks --------------------------------------------------------------
// Thresholds scaled to the speed-bonus era (max game is now 31,000).
const TIERS = [
  [30000, "Golden Ear", "🦻"],
  [26000, "Linguist", "🧠"],
  [21000, "Polyglot", "🗣️"],
  [15000, "Traveler", "🧳"],
  [8500, "Tourist", "📸"],
  [0, "Tin Ear", "🎧"],
];
export function rankFor(score) {
  for (const [min, name, icon] of TIERS) if (score >= min) return { name, icon };
  return { name: "Tin Ear", icon: "🎧" };
}

// ---- share card ---------------------------------------------------------
export function roundSquare(points) {
  if (points >= 4800) return "🟩";
  if (points >= 2400) return "🟨";
  if (points >= 700) return "🟧";
  return "🟥";
}
export function shareText({ scores, total, daily, streak }) {
  const squares = scores.map(roundSquare).join("");
  const head = daily ? `🌍 LinguaGuessr Daily #${dailyNumber()}` : "🌍 LinguaGuessr";
  const r = rankFor(total);
  const lines = [
    head,
    `🔊 ${total.toLocaleString()} / ${MAX_GAME.toLocaleString()} · ${r.name} ${r.icon}`,
    squares,
  ];
  if (daily && streak > 0) lines.push(`🔥 ${streak}-day streak`);
  lines.push("lingua.levelbrook.com");
  return lines.join("\n");
}

// ---- stats (localStorage) ----------------------------------------------
const KEY = "lg.stats.v1";
export function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || base();
  } catch {
    return base();
  }
}
function base() {
  return { played: 0, totalPoints: 0, best: 0, streak: 0, maxStreak: 0, lastDaily: 0, dailyDone: 0, dailyBest: 0 };
}
export function saveGame(stats, { total, daily }) {
  const s = { ...stats };
  s.played += 1;
  s.totalPoints += total;
  s.best = Math.max(s.best || 0, total);
  if (daily) {
    const today = todayDayNumber();
    s.dailyBest = Math.max(s.dailyBest || 0, total);
    // Only the FIRST daily completion of a given day advances the streak —
    // replaying the same puzzle later doesn't inflate it. Yesterday → +1,
    // any gap → reset to 1.
    if (s.lastDaily !== today) {
      s.streak = s.lastDaily === today - 1 ? (s.streak || 0) + 1 : 1;
      s.lastDaily = today;
      s.dailyDone = today;
      s.maxStreak = Math.max(s.maxStreak || 0, s.streak);
    }
  }
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  return s;
}
// Has today's daily already been completed in this browser?
export function dailyDoneToday(stats) {
  return stats.dailyDone === todayDayNumber();
}

export const flag = (cc) =>
  cc.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
