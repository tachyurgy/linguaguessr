#!/usr/bin/env node
// Build the Accent-Mode library from George Mason University's Speech Accent
// Archive (https://accent.gmu.edu): hundreds of speakers reading the SAME English
// passage. The filename prefix is the speaker's NATIVE language — that's the
// answer the player guesses. We store the GMU URLs directly (the <audio> element
// plays them cross-origin fine; no CORS needed), so expanding the corpus just
// means discovering more valid URLs — no downloads, no repo bloat.
//
// SELF-CONTAINED: every accent language's geo/region/family metadata lives in the
// ACCENT_LANGS table below — this script no longer reads it from manifest.languages.
// (That old coupling silently DROPPED every accent language not in the classic
// corpus — English, Danish, Finnish, Czech, Yoruba, … — which left the game's
// langByCode lookup undefined and CRASHED Accent Mode. Keep it self-contained.)
//
// Re-runnable + atomic: replaces ONLY `accents` + `accentLanguages` in the
// manifest, writes via a temp file + rename so a concurrent corpus rebuild can
// never read a half-written manifest. finalize.py preserves these keys.
import fs from "node:fs";

const UA = "LinguaGuessr/1.0 (Levelbrook demo; https://levelbrook.com)";
const PER = Number(process.env.ACCENT_PER || 24);   // target speakers per language
const MAXN = Number(process.env.ACCENT_MAXN || 44); // highest GMU index to probe
const MIN_KEEP = 3;                                  // skip a language with fewer than this
const MIN_BYTES = 40000;                             // guard against truncated/placeholder files
const CONC = Number(process.env.ACCENT_CONC || 6);  // probes in flight per language (polite, fast)
const MANIFEST = "public/manifest.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// prefix = the GMU soundtrack filename stem; the rest is our manifest metadata.
// region/family are used for "near" distractor grouping + the reveal line.
const ACCENT_LANGS = [
  { prefix: "english",    code: "eng", name: "English",          country: "GB", region: "Western Europe",  family: "Germanic",       geo: [54, -2] },
  { prefix: "french",     code: "fra", name: "French",           country: "FR", region: "Western Europe",  family: "Romance",        geo: [46.6, 2.3] },
  { prefix: "german",     code: "deu", name: "German",           country: "DE", region: "Western Europe",  family: "Germanic",       geo: [51.1, 10.4] },
  { prefix: "spanish",    code: "spa", name: "Spanish",          country: "ES", region: "Western Europe",  family: "Romance",        geo: [40.4, -3.7] },
  { prefix: "italian",    code: "ita", name: "Italian",          country: "IT", region: "Southern Europe", family: "Romance",        geo: [41.9, 12.5] },
  { prefix: "portuguese", code: "por", name: "Portuguese",       country: "PT", region: "Western Europe",  family: "Romance",        geo: [39.5, -8] },
  { prefix: "dutch",      code: "nld", name: "Dutch",            country: "NL", region: "Western Europe",  family: "Germanic",       geo: [52.1, 5.3] },
  { prefix: "swedish",    code: "swe", name: "Swedish",          country: "SE", region: "Northern Europe", family: "Germanic",       geo: [60.1, 18.6] },
  { prefix: "norwegian",  code: "nor", name: "Norwegian",        country: "NO", region: "Northern Europe", family: "Germanic",       geo: [60.5, 8.5] },
  { prefix: "danish",     code: "dan", name: "Danish",           country: "DK", region: "Northern Europe", family: "Germanic",       geo: [56, 10] },
  { prefix: "finnish",    code: "fin", name: "Finnish",          country: "FI", region: "Northern Europe", family: "Uralic",         geo: [64, 26] },
  { prefix: "russian",    code: "rus", name: "Russian",          country: "RU", region: "Eastern Europe",  family: "Slavic",         geo: [56, 38] },
  { prefix: "polish",     code: "pol", name: "Polish",           country: "PL", region: "Eastern Europe",  family: "Slavic",         geo: [52, 19] },
  { prefix: "ukrainian",  code: "ukr", name: "Ukrainian",        country: "UA", region: "Eastern Europe",  family: "Slavic",         geo: [49, 32] },
  { prefix: "czech",      code: "ces", name: "Czech",            country: "CZ", region: "Eastern Europe",  family: "Slavic",         geo: [49.8, 15.5] },
  { prefix: "romanian",   code: "ron", name: "Romanian",         country: "RO", region: "Eastern Europe",  family: "Romance",        geo: [45.9, 24.9] },
  { prefix: "hungarian",  code: "hun", name: "Hungarian",        country: "HU", region: "Eastern Europe",  family: "Uralic",         geo: [47.2, 19.5] },
  { prefix: "bulgarian",  code: "bul", name: "Bulgarian",        country: "BG", region: "Eastern Europe",  family: "Slavic",         geo: [42.7, 25.5] },
  { prefix: "serbian",    code: "srp", name: "Serbian",          country: "RS", region: "Eastern Europe",  family: "Slavic",         geo: [44, 21] },
  { prefix: "greek",      code: "ell", name: "Greek",            country: "GR", region: "Southern Europe", family: "Hellenic",       geo: [39, 22] },
  { prefix: "albanian",   code: "sqi", name: "Albanian",         country: "AL", region: "Southern Europe", family: "Albanian",       geo: [41, 20] },
  { prefix: "turkish",    code: "tur", name: "Turkish",          country: "TR", region: "Middle East",     family: "Turkic",         geo: [39, 35] },
  { prefix: "arabic",     code: "ara", name: "Arabic",           country: "SA", region: "Middle East",     family: "Semitic",        geo: [24, 45] },
  { prefix: "hebrew",     code: "heb", name: "Hebrew",           country: "IL", region: "Middle East",     family: "Semitic",        geo: [31, 35] },
  { prefix: "farsi",      code: "fas", name: "Persian",          country: "IR", region: "Middle East",     family: "Iranian",        geo: [32, 53] },
  { prefix: "mandarin",   code: "cmn", name: "Mandarin Chinese", country: "CN", region: "East Asia",       family: "Sinitic",        geo: [35, 103] },
  { prefix: "cantonese",  code: "yue", name: "Cantonese",        country: "HK", region: "East Asia",       family: "Sinitic",        geo: [22.3, 114.2] },
  { prefix: "japanese",   code: "jpn", name: "Japanese",         country: "JP", region: "East Asia",       family: "Japonic",        geo: [36, 138] },
  { prefix: "korean",     code: "kor", name: "Korean",           country: "KR", region: "East Asia",       family: "Koreanic",       geo: [36.5, 128] },
  { prefix: "vietnamese", code: "vie", name: "Vietnamese",       country: "VN", region: "Southeast Asia",  family: "Austroasiatic",  geo: [16, 107] },
  { prefix: "thai",       code: "tha", name: "Thai",             country: "TH", region: "Southeast Asia",  family: "Kra-Dai",        geo: [15, 101] },
  { prefix: "indonesian", code: "ind", name: "Indonesian",       country: "ID", region: "Southeast Asia",  family: "Austronesian",   geo: [-2, 118] },
  { prefix: "tagalog",    code: "tgl", name: "Tagalog",          country: "PH", region: "Southeast Asia",  family: "Austronesian",   geo: [13, 122] },
  { prefix: "hindi",      code: "hin", name: "Hindi",            country: "IN", region: "South Asia",      family: "Indo-Aryan",     geo: [28, 77] },
  { prefix: "urdu",       code: "urd", name: "Urdu",             country: "PK", region: "South Asia",      family: "Indo-Aryan",     geo: [30, 70] },
  { prefix: "bengali",    code: "ben", name: "Bengali",          country: "BD", region: "South Asia",      family: "Indo-Aryan",     geo: [24, 90] },
  { prefix: "punjabi",    code: "pan", name: "Punjabi",          country: "IN", region: "South Asia",      family: "Indo-Aryan",     geo: [30.5, 75.5] },
  { prefix: "gujarati",   code: "guj", name: "Gujarati",         country: "IN", region: "South Asia",      family: "Indo-Aryan",     geo: [22.5, 71.5] },
  { prefix: "nepali",     code: "nep", name: "Nepali",           country: "NP", region: "South Asia",      family: "Indo-Aryan",     geo: [28, 84] },
  { prefix: "tamil",      code: "tam", name: "Tamil",            country: "IN", region: "South Asia",      family: "Dravidian",      geo: [11, 78] },
  { prefix: "telugu",     code: "tel", name: "Telugu",           country: "IN", region: "South Asia",      family: "Dravidian",      geo: [16, 79] },
  { prefix: "malayalam",  code: "mal", name: "Malayalam",        country: "IN", region: "South Asia",      family: "Dravidian",      geo: [10, 76] },
  { prefix: "yoruba",     code: "yor", name: "Yoruba",           country: "NG", region: "Africa",          family: "Niger-Congo",    geo: [8, 4] },
  { prefix: "igbo",       code: "ibo", name: "Igbo",             country: "NG", region: "Africa",          family: "Niger-Congo",    geo: [6, 7] },
  { prefix: "hausa",      code: "hau", name: "Hausa",            country: "NG", region: "Africa",          family: "Afro-Asiatic",   geo: [11, 8] },
  { prefix: "amharic",    code: "amh", name: "Amharic",          country: "ET", region: "Africa",          family: "Semitic",        geo: [9, 40] },
  { prefix: "somali",     code: "som", name: "Somali",           country: "SO", region: "Africa",          family: "Cushitic",       geo: [5, 46] },
];

async function exists(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Range: "bytes=0-1" } });
    if (!(r.status === 200 || r.status === 206)) return false;
    const len = Number(r.headers.get("content-range")?.split("/")?.[1] || r.headers.get("content-length") || 0);
    return len === 0 || len >= MIN_BYTES;
  } catch { return false; }
}

const accents = [];
const accentLanguages = [];
let scanned = 0;
console.log(`Discovering up to ${PER} speakers/language across ${ACCENT_LANGS.length} languages (GMU Speech Accent Archive)…\n`);

for (const L of ACCENT_LANGS) {
  process.stdout.write(`  ${L.name.padEnd(18)} `);
  const found = [];
  // Probe indices in concurrent batches of CONC, early-stopping once we have PER.
  // GMU numbers speakers contiguously from 1, so the first batches usually fill PER.
  for (let base = 1; base <= MAXN && found.length < PER; base += CONC) {
    const batch = [];
    for (let i = base; i < base + CONC && i <= MAXN; i++) batch.push(i);
    scanned += batch.length;
    const hits = await Promise.all(
      batch.map(async (i) => ((await exists(`https://accent.gmu.edu/soundtracks/${L.prefix}${i}.mp3`))
        ? { i, url: `https://accent.gmu.edu/soundtracks/${L.prefix}${i}.mp3` } : null))
    );
    for (const h of hits) if (h) found.push(h);
  }
  found.sort((a, b) => a.i - b.i);
  found.length = Math.min(found.length, PER);
  if (found.length < MIN_KEEP) { console.log(`only ${found.length} — skipped`); continue; }
  accentLanguages.push({ code: L.code, name: L.name, country: L.country, region: L.region, family: L.family, geo: L.geo });
  for (const { i, url } of found) {
    accents.push({
      id: `acc-${L.prefix}${i}`, url,
      lang: L.code, lang_name: L.name, country: L.country,
      region: L.region, family: L.family, geo: L.geo, accent: true,
    });
  }
  console.log(`${found.length} ✓`);
}

// Replace ONLY the accent keys; preserve everything else. Atomic write.
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
manifest.accents = accents;
manifest.accentLanguages = accentLanguages;
const tmp = MANIFEST + ".tmp." + process.pid;
fs.writeFileSync(tmp, JSON.stringify(manifest));
fs.renameSync(tmp, MANIFEST);

console.log(`\nProbed ${scanned} GMU URLs.`);
console.log(`Accent clips: ${accents.length} across ${accentLanguages.length} native languages`);
console.log(`Wrote ${MANIFEST} (${(fs.statSync(MANIFEST).size / 1024).toFixed(0)} KB)`);
