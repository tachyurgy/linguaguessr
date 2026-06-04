#!/usr/bin/env node
// Adds an English `text_en` field to every clip in public/manifest.json.
// Primary backend: AWS Translate (auto source detection). For source languages
// AWS Translate doesn't support (e.g. Basque, Galician), or any clip AWS fails
// on, we fall back to the OpenAI API. Idempotent: clips that already have a
// non-empty text_en are skipped, so this is safe to re-run after adding clips.
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
const exec = promisify(execFile);

const MANIFEST = new URL("../public/manifest.json", import.meta.url).pathname;
const REGION = process.env.AWS_REGION || "us-east-1";
const CONCURRENCY = 12;

// ISO 639-3 (manifest) -> AWS Translate codes. Auto-detect works, but passing
// the known source is more reliable. Languages AWS Translate does NOT support
// are mapped to null -> they go straight to the OpenAI fallback.
const AWS_LANG = {
  afr: "af", ara: "ar", ben: "bn", bul: "bg", cat: "ca", ces: "cs", cmn: "zh",
  cym: "cy", dan: "da", deu: "de", ell: "el", eus: null, fas: "fa", fin: "fi",
  fra: "fr", glg: null, heb: "he", hin: "hi", hun: "hu", ind: "id", isl: "is",
  ita: "it", jpn: "ja", kor: "ko", nld: "nl", nor: "no", pol: "pl", por: "pt",
  ron: "ro", rus: "ru", spa: "es", swh: "sw", tam: "ta", tgl: "tl", tha: "th",
  tur: "tr", ukr: "uk", urd: "ur", vie: "vi",
};
const LANG_NAME = {
  afr: "Afrikaans", ara: "Arabic", ben: "Bengali", bul: "Bulgarian",
  cat: "Catalan", ces: "Czech", cmn: "Mandarin Chinese", cym: "Welsh",
  dan: "Danish", deu: "German", ell: "Greek", eus: "Basque", fas: "Persian",
  fin: "Finnish", fra: "French", glg: "Galician", heb: "Hebrew", hin: "Hindi",
  hun: "Hungarian", ind: "Indonesian", isl: "Icelandic", ita: "Italian",
  jpn: "Japanese", kor: "Korean", nld: "Dutch", nor: "Norwegian",
  pol: "Polish", por: "Portuguese", ron: "Romanian", rus: "Russian",
  spa: "Spanish", swh: "Swahili", tam: "Tamil", tgl: "Tagalog", tha: "Thai",
  tur: "Turkish", ukr: "Ukrainian", urd: "Urdu", vie: "Vietnamese",
};

async function awsTranslate(text, lang) {
  const src = AWS_LANG[lang] ?? "auto";
  if (src === null) throw new Error("unsupported-by-aws");
  const { stdout } = await exec("aws", [
    "translate", "translate-text",
    "--region", REGION,
    "--text", text,
    "--source-language-code", src,
    "--target-language-code", "en",
    "--output", "json",
  ], { maxBuffer: 1024 * 1024 });
  const out = JSON.parse(stdout);
  if (!out.TranslatedText) throw new Error("no-translation");
  return out.TranslatedText.trim();
}

async function openaiTranslate(text, lang) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("no-openai-key");
  const name = LANG_NAME[lang] || lang;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: "You are a professional translator. Translate the user's text into natural English. The text is an automatic speech transcript and may be imperfect — translate the meaning faithfully. Reply with ONLY the English translation, no quotes, no notes." },
        { role: "user", content: `Source language: ${name}.\n\n${text}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`openai-${res.status}`);
  const data = await res.json();
  const t = data?.choices?.[0]?.message?.content?.trim();
  if (!t) throw new Error("openai-empty");
  return t;
}

async function translateOne(clip) {
  const text = (clip.text || "").trim();
  if (!text) return { skipped: true };
  try {
    clip.text_en = await awsTranslate(text, clip.lang);
    return { backend: "aws" };
  } catch (e) {
    try {
      clip.text_en = await openaiTranslate(text, clip.lang);
      return { backend: "openai", awsErr: String(e.message) };
    } catch (e2) {
      return { failed: true, err: `${e.message} / ${e2.message}` };
    }
  }
}

async function main() {
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const clips = m.clips || [];
  const todo = clips.filter((c) => (c.text || "").trim() && !(c.text_en || "").trim());
  console.log(`${clips.length} clips total, ${todo.length} need translation.`);

  let done = 0, aws = 0, openai = 0, failed = 0;
  const fails = [];
  let i = 0;
  async function worker() {
    while (i < todo.length) {
      const clip = todo[i++];
      const r = await translateOne(clip);
      done++;
      if (r.backend === "aws") aws++;
      else if (r.backend === "openai") openai++;
      else if (r.failed) { failed++; fails.push(`${clip.id} (${clip.lang}): ${r.err}`); }
      if (done % 50 === 0 || done === todo.length) {
        console.log(`  ${done}/${todo.length}  (aws=${aws} openai=${openai} failed=${failed})`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Backup then write.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(`${MANIFEST}.bak.${stamp}`, readFileSync(MANIFEST));
  writeFileSync(MANIFEST, JSON.stringify(m, null, 0));
  console.log(`\nDone. aws=${aws} openai=${openai} failed=${failed}`);
  if (fails.length) { console.log("FAILURES:"); fails.forEach((f) => console.log("  " + f)); }
}
main().catch((e) => { console.error(e); process.exit(1); });
