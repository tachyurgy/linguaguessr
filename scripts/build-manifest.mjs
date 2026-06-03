#!/usr/bin/env node
/**
 * build-manifest.mjs
 * --------------------------------------------------------------------------
 * Builds public/manifest.json — the game's clip library — by querying the
 * Wikimedia Commons API for Lingua Libre native-speaker recordings.
 *
 * Lingua Libre clips are CC-licensed, hosted on the Wikimedia CDN, and play
 * cross-origin in an <audio> element with no CORS setup. The manifest is just
 * a list of URLs + metadata, so swapping to a self-hosted R2 library later is
 * a one-line change to `url`.
 *
 *   node scripts/build-manifest.mjs
 * --------------------------------------------------------------------------
 */

const API = "https://commons.wikimedia.org/w/api.php";
const UA = "LinguaGuessr/1.0 (Levelbrook demo; https://levelbrook.com)";
const CLIPS_PER_LANG = 34;        // sampled per language
const MIN_DUR = 0.45, MAX_DUR = 6; // seconds — drop too-short / too-long
const FETCH_POOL = 120;            // candidates pulled before sampling

// Curated, well-known languages with geo centroid, family, region, difficulty.
// `iso` is the Lingua Libre category code (ISO-639-3 / Wikidata-aligned).
const LANGS = [
  // code  name             country lat     lng     family         region            diff
  ["eng", "English",        "GB", 54.0,  -2.0,  "Germanic",      "Western Europe", 1],
  ["fra", "French",         "FR", 46.6,   2.3,  "Romance",       "Western Europe", 1],
  ["deu", "German",         "DE", 51.1,  10.4,  "Germanic",      "Western Europe", 1],
  ["spa", "Spanish",        "ES", 40.4,  -3.7,  "Romance",       "Western Europe", 1],
  ["ita", "Italian",        "IT", 41.9,  12.5,  "Romance",       "Western Europe", 1],
  ["por", "Portuguese",     "PT", 39.5,  -8.0,  "Romance",       "Western Europe", 2],
  ["nld", "Dutch",          "NL", 52.1,   5.3,  "Germanic",      "Western Europe", 2],
  ["cat", "Catalan",        "ES", 41.6,   1.6,  "Romance",       "Western Europe", 4],
  ["eus", "Basque",         "ES", 43.0,  -2.6,  "Isolate",       "Western Europe", 4],
  ["gle", "Irish",          "IE", 53.4,  -8.0,  "Celtic",        "Western Europe", 4],
  ["ell", "Greek",          "GR", 39.0,  22.0,  "Hellenic",      "Southern Europe", 2],
  ["swe", "Swedish",        "SE", 60.1,  18.6,  "Germanic",      "Northern Europe", 3],
  ["nor", "Norwegian",      "NO", 60.5,   8.5,  "Germanic",      "Northern Europe", 3],
  ["dan", "Danish",         "DK", 56.0,  10.0,  "Germanic",      "Northern Europe", 3],
  ["fin", "Finnish",        "FI", 64.0,  26.0,  "Uralic",        "Northern Europe", 3],
  ["isl", "Icelandic",      "IS", 64.9, -19.0,  "Germanic",      "Northern Europe", 4],
  ["rus", "Russian",        "RU", 56.0,  38.0,  "Slavic",        "Eastern Europe", 2],
  ["pol", "Polish",         "PL", 52.0,  19.0,  "Slavic",        "Eastern Europe", 2],
  ["ukr", "Ukrainian",      "UA", 49.0,  32.0,  "Slavic",        "Eastern Europe", 3],
  ["ces", "Czech",          "CZ", 49.8,  15.5,  "Slavic",        "Eastern Europe", 3],
  ["ron", "Romanian",       "RO", 45.9,  24.9,  "Romance",       "Eastern Europe", 3],
  ["hun", "Hungarian",      "HU", 47.2,  19.5,  "Uralic",        "Eastern Europe", 3],
  ["bul", "Bulgarian",      "BG", 42.7,  25.5,  "Slavic",        "Eastern Europe", 4],
  ["hrv", "Croatian",       "HR", 45.1,  15.2,  "Slavic",        "Eastern Europe", 4],
  ["srp", "Serbian",        "RS", 44.0,  21.0,  "Slavic",        "Eastern Europe", 4],
  ["tur", "Turkish",        "TR", 39.0,  35.0,  "Turkic",        "Middle East",    2],
  ["ara", "Arabic",         "SA", 24.0,  45.0,  "Semitic",       "Middle East",    2],
  ["heb", "Hebrew",         "IL", 31.0,  35.0,  "Semitic",       "Middle East",    3],
  ["fas", "Persian",        "IR", 32.0,  53.0,  "Iranian",       "Middle East",    3],
  ["cmn", "Mandarin Chinese","CN",35.0, 103.0,  "Sinitic",       "East Asia",      1],
  ["jpn", "Japanese",       "JP", 36.0, 138.0,  "Japonic",       "East Asia",      1],
  ["kor", "Korean",         "KR", 36.5, 128.0,  "Koreanic",      "East Asia",      1],
  ["vie", "Vietnamese",     "VN", 16.0, 107.0,  "Austroasiatic", "Southeast Asia", 2],
  ["tha", "Thai",           "TH", 15.0, 101.0,  "Kra-Dai",       "Southeast Asia", 2],
  ["ind", "Indonesian",     "ID", -2.5, 118.0,  "Austronesian",  "Southeast Asia", 3],
  ["hin", "Hindi",          "IN", 28.0,  77.0,  "Indo-Aryan",    "South Asia",     2],
  ["tam", "Tamil",          "IN", 11.0,  78.0,  "Dravidian",     "South Asia",     3],
  ["ben", "Bengali",        "BD", 24.0,  90.0,  "Indo-Aryan",    "South Asia",     3],
  ["swh", "Swahili",        "KE", -1.0,  38.0,  "Bantu",         "Africa",         3],
  ["yor", "Yoruba",         "NG",  8.0,   4.0,  "Niger-Congo",   "Africa",         4],
  ["amh", "Amharic",        "ET",  9.0,  40.0,  "Semitic",       "Africa",         4],
];

const AUDIO_MIME = new Set(["audio/wav", "audio/x-wav", "audio/ogg", "audio/mpeg", "audio/flac"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Lingua Libre filenames embed the spoken word/phrase:
//   LL-Q150_(fra)-Speaker-bonjour.wav  ->  "bonjour"
// Used for the optional (score-lowering) "show the word" hint.
function spokenWord(url) {
  try {
    let f = decodeURIComponent(url.split("/").pop() || "");
    f = f.replace(/\.(wav|ogg|mp3|flac)$/i, "");
    const parts = f.split("-");
    if (parts.length < 4) return null;
    let w = parts.slice(3).join("-").trim().replace(/^"+|"+$/g, "").trim();
    if (!w || w.length > 60) return null;
    return w;
  } catch {
    return null;
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function fetchClipsFor(iso) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "categorymembers",
    gcmtitle: `Category:Lingua Libre pronunciation-${iso}`,
    gcmtype: "file",
    gcmlimit: String(FETCH_POOL),
    prop: "imageinfo",
    iiprop: "url|mime|size|duration",
  });
  const res = await fetch(`${API}?${params}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) return [];
  const out = [];
  for (const p of Object.values(pages)) {
    const ii = p.imageinfo?.[0];
    if (!ii || !AUDIO_MIME.has(ii.mime)) continue;
    const dur = ii.duration || 0;
    if (dur && (dur < MIN_DUR || dur > MAX_DUR)) continue;
    if (ii.size && ii.size < 6000) continue; // skip near-empty
    out.push({ id: String(p.pageid), url: ii.url, dur: Math.round((dur || 0) * 100) / 100, text: spokenWord(ii.url) });
  }
  return out;
}

async function main() {
  const languages = [];
  const clips = [];
  const skipped = [];

  for (const [iso, name, country, lat, lng, family, region, diff] of LANGS) {
    process.stdout.write(`  ${iso} ${name} … `);
    let pool = [];
    try {
      pool = await fetchClipsFor(iso);
    } catch (e) {
      console.log(`ERROR ${e.message}`);
      skipped.push(`${name} (${iso}): ${e.message}`);
      await sleep(250);
      continue;
    }
    if (pool.length < 8) {
      console.log(`only ${pool.length} clips — SKIPPED`);
      skipped.push(`${name} (${iso}): only ${pool.length} clips`);
      await sleep(250);
      continue;
    }
    const picked = shuffle(pool).slice(0, CLIPS_PER_LANG);
    languages.push({ code: iso, name, country, region, family, geo: [lat, lng], difficulty: diff });
    for (const c of picked) {
      clips.push({
        id: c.id, url: c.url, dur: c.dur, text: c.text,
        lang: iso, lang_name: name, country, region, family,
        geo: [lat, lng], difficulty: diff,
      });
    }
    console.log(`${picked.length} clips ✓`);
    await sleep(200); // be polite to the API
  }

  shuffle(clips);
  const regions = [...new Set(languages.map((l) => l.region))].sort();
  const families = [...new Set(languages.map((l) => l.family))].sort();

  const manifest = {
    version: 1,
    source: "Wikimedia Commons / Lingua Libre",
    license: "CC BY-SA 4.0 / CC BY 4.0 / CC0 (per recording)",
    note: "Audio served from upload.wikimedia.org. Swap clip.url to migrate to self-hosted R2.",
    languages, regions, families,
    count: clips.length,
    clips,
  };

  const fs = await import("node:fs");
  const url = await import("node:url");
  const path = await import("node:path");
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const outDir = path.join(here, "..", "public");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "manifest.json");
  fs.writeFileSync(outPath, JSON.stringify(manifest));

  console.log("\n────────────────────────────────────────");
  console.log(`Languages: ${languages.length} / ${LANGS.length}`);
  console.log(`Clips:     ${clips.length}`);
  console.log(`Regions:   ${regions.join(", ")}`);
  if (skipped.length) console.log(`Skipped:   ${skipped.length}\n  - ${skipped.join("\n  - ")}`);
  console.log(`Wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
