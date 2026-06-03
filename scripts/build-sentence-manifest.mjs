#!/usr/bin/env node
/**
 * Build a sentence-length game corpus from Google FLEURS via Hugging Face.
 *
 * FLEURS row audio URLs are signed and expire, so the app cannot hotlink them
 * directly. This script downloads a small, curated static sample into
 * public/sentence-clips/ and rewrites public/manifest.json to use those
 * same-origin clips for Daily/Classic while preserving Accent Mode.
 */
import fs from "node:fs";
import path from "node:path";

const API = "https://datasets-server.huggingface.co/first-rows";
const UA = "LinguaGuessr/1.0 (Levelbrook demo; https://levelbrook.com)";
const OUT_DIR = "public/sentence-clips";
const MANIFEST = "public/manifest.json";
const CLIPS_PER_LANG = Number(process.env.CLIPS_PER_LANG || 12);
const MIN_DUR = Number(process.env.MIN_DUR || 5);
const MAX_DUR = Number(process.env.MAX_DUR || 10);
const MIN_LANG_CLIPS = Number(process.env.MIN_LANG_CLIPS || 5);

const FLEURS = {
  // English is intentionally excluded from the main language-guessing game: the
  // accent passage everyone reads is English, so it only belongs in Accent Mode.
  fra: "fr_fr",
  deu: "de_de",
  spa: "es_419",
  ita: "it_it",
  por: "pt_br",
  nld: "nl_nl",
  cat: "ca_es",
  gle: "ga_ie",
  ell: "el_gr",
  swe: "sv_se",
  nor: "nb_no",
  dan: "da_dk",
  fin: "fi_fi",
  isl: "is_is",
  rus: "ru_ru",
  pol: "pl_pl",
  ukr: "uk_ua",
  ces: "cs_cz",
  ron: "ro_ro",
  hun: "hu_hu",
  bul: "bg_bg",
  hrv: "hr_hr",
  srp: "sr_rs",
  tur: "tr_tr",
  ara: "ar_eg",
  heb: "he_il",
  fas: "fa_ir",
  cmn: "cmn_hans_cn",
  jpn: "ja_jp",
  kor: "ko_kr",
  vie: "vi_vn",
  tha: "th_th",
  ind: "id_id",
  hin: "hi_in",
  tam: "ta_in",
  ben: "bn_in",
  swh: "sw_ke",
  yor: "yo_ng",
  amh: "am_et",
};

const SPOILER_WORDS = [
  "english", "french", "german", "spanish", "italian", "portuguese", "dutch", "catalan",
  "irish", "greek", "swedish", "norwegian", "danish", "finnish", "icelandic", "russian",
  "polish", "ukrainian", "czech", "romanian", "hungarian", "bulgarian", "croatian",
  "serbian", "turkish", "arabic", "hebrew", "persian", "chinese", "mandarin", "japanese",
  "korean", "vietnamese", "thai", "indonesian", "hindi", "tamil", "bengali", "swahili",
  "yoruba", "amharic",
  "england", "france", "germany", "spain", "italy", "portugal", "netherlands", "ireland",
  "greece", "sweden", "norway", "denmark", "finland", "iceland", "russia", "poland",
  "ukraine", "romania", "hungary", "bulgaria", "croatia", "serbia", "turkey", "egypt",
  "israel", "iran", "china", "japan", "korea", "vietnam", "thailand", "indonesia",
  "india", "bangladesh", "kenya", "nigeria", "ethiopia",
];

function cleanText(row) {
  return String(row.raw_transcription || row.transcription || "").trim();
}

function hasSpoiler(text) {
  const normalized = text.toLowerCase();
  return SPOILER_WORDS.some((word) => normalized.includes(word));
}

function parseTsvLine(line) {
  return line.split("\t");
}

async function fetchRows(config) {
  const url = `${API}?dataset=google/fleurs&config=${config}&split=validation`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${config}`);
  const data = await res.json();
  if (!Array.isArray(data.rows)) throw new Error(data.error || `No rows for ${config}`);
  return data.rows.map((entry) => entry.row);
}

async function download(url, file) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 20000) throw new Error(`short audio ${buf.length} bytes`);
  fs.writeFileSync(file, buf);
  return buf.length;
}

function mainManifestBase() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  return {
    manifest,
    metaByCode: Object.fromEntries(manifest.languages.map((l) => [l.code, l])),
    accents: manifest.accents || [],
    accentLanguages: manifest.accentLanguages || [],
  };
}

async function main() {
  const { manifest, metaByCode, accents, accentLanguages } = mainManifestBase();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const languages = [];
  const clips = [];
  const skipped = [];

  for (const [code, config] of Object.entries(FLEURS)) {
    const meta = metaByCode[code];
    if (!meta) continue;
    process.stdout.write(`  ${code} ${meta.name} (${config}) ... `);
    let rows;
    try {
      rows = await fetchRows(config);
    } catch (e) {
      skipped.push(`${meta.name}: ${e.message}`);
      console.log(`ERROR ${e.message}`);
      continue;
    }

    const seenRowIds = new Set();
    const picks = rows
      .map((row) => ({ row, dur: row.num_samples / 16000, text: cleanText(row) }))
      .filter(({ row, dur, text }) => {
        if (seenRowIds.has(row.id)) return false;
        seenRowIds.add(row.id);
        return (
          dur >= MIN_DUR &&
          dur <= MAX_DUR &&
          text.length >= 18 &&
          text.length <= 220 &&
          !hasSpoiler(text) &&
          row.audio?.[0]?.src
        );
      })
      .slice(0, CLIPS_PER_LANG);

    if (picks.length < MIN_LANG_CLIPS) {
      skipped.push(`${meta.name}: only ${picks.length} usable clips`);
      console.log(`only ${picks.length} usable clips`);
      continue;
    }

    languages.push(meta);
    let ok = 0;
    for (const pick of picks) {
      const id = `fleurs-${config}-${pick.row.id}`;
      const file = `${id}.wav`;
      const outPath = path.join(OUT_DIR, file);
      try {
        if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 20000) {
          await download(pick.row.audio[0].src, outPath);
        }
        clips.push({
          id,
          url: `/sentence-clips/${file}`,
          source_url: "https://huggingface.co/datasets/google/fleurs",
          source: "Google FLEURS",
          license: "CC BY 4.0",
          dur: Math.round(pick.dur * 100) / 100,
          text: pick.text,
          lang: code,
          lang_name: meta.name,
          country: meta.country,
          region: meta.region,
          family: meta.family,
          geo: meta.geo,
          difficulty: meta.difficulty,
          sentence: true,
        });
        ok++;
      } catch (e) {
        skipped.push(`${meta.name} ${pick.row.id}: ${e.message}`);
      }
    }
    console.log(`${ok} clips`);
  }

  if (languages.length < 8) {
    throw new Error(`Only ${languages.length} languages built; refusing to overwrite manifest.`);
  }

  const regions = [...new Set(languages.map((l) => l.region))].sort();
  const families = [...new Set(languages.map((l) => l.family))].sort();
  const next = {
    ...manifest,
    version: 2,
    source: "Google FLEURS via Hugging Face dataset-server",
    license: "CC BY 4.0",
    note: "Daily and Classic use self-hosted 5-10 second FLEURS sentence clips. Accent Mode remains Speech Accent Archive.",
    languages,
    regions,
    families,
    count: clips.length,
    clips,
    accents,
    accentLanguages,
  };

  fs.writeFileSync(MANIFEST, JSON.stringify(next));
  console.log("\nSentence corpus built");
  console.log(`Languages: ${languages.length}`);
  console.log(`Clips:     ${clips.length}`);
  console.log(`Output:    ${MANIFEST}`);
  if (skipped.length) {
    console.log(`Skipped/issues: ${skipped.length}`);
    for (const line of skipped.slice(0, 30)) console.log(`  - ${line}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
