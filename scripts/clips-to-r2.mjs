#!/usr/bin/env node
// Push the sentence-clip corpus to Cloudflare R2 and repoint the manifest at the
// R2 public URL, so the audio lives in object storage instead of being committed
// to git / shipped inside the Cloudflare Pages bundle.
//
//   node scripts/clips-to-r2.mjs              # upload missing clips + rewrite manifest URLs
//   node scripts/clips-to-r2.mjs --no-upload  # only rewrite manifest URLs
//
// Auth: a Cloudflare API token with R2 write, in CLOUDFLARE_API_TOKEN (falls back
// to LEVELBROOK_CF_DEPLOY_TOKEN). Uses the bearer-token R2 object API (no S3 keys).
// Bucket `linguaguessr-clips` has public access enabled, so objects serve straight
// from the r2.dev URL; <audio> plays them cross-origin with no CORS needed.
//
// Idempotent: HEADs the public URL first and skips clips already in R2, so re-runs
// after a corpus rebuild only upload the new files.
import fs from "node:fs";

const ACCOUNT = "a67eceeb4b89d2d4171ed209e87c9456";
const BUCKET = "linguaguessr-clips";
const PUBLIC_BASE = "https://pub-9a4845be63e04f32b9b11b62f9aa2075.r2.dev";
const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects`;
const LOCAL = "public/sentence-clips";
const MANIFEST = "public/manifest.json";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.LEVELBROOK_CF_DEPLOY_TOKEN;
const doUpload = !process.argv.includes("--no-upload");
const CONC = 12;

if (doUpload && !TOKEN) { console.error("No CLOUDFLARE_API_TOKEN / LEVELBROOK_CF_DEPLOY_TOKEN — cannot upload."); process.exit(1); }

async function head(file) {
  try { const r = await fetch(`${PUBLIC_BASE}/${file}`, { method: "HEAD" }); return r.ok; } catch { return false; }
}
async function put(file) {
  const body = fs.readFileSync(`${LOCAL}/${file}`);
  const r = await fetch(`${API}/${file}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=31536000, immutable" },
    body,
  });
  if (!r.ok) throw new Error(`PUT ${file} -> ${r.status}`);
}
// minimal concurrency pool
async function pool(items, n, fn) {
  let i = 0, done = 0;
  const next = async () => { while (i < items.length) { const k = i++; await fn(items[k]); if (++done % 100 === 0) process.stdout.write(`  ${done}/${items.length}\n`); } };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, next));
}

if (doUpload) {
  const files = fs.readdirSync(LOCAL).filter((f) => f.endsWith(".mp3"));
  console.log(`Checking ${files.length} clips against R2 …`);
  const present = await Promise.all(files.map((f) => head(f).then((ok) => [f, ok])));
  const missing = present.filter(([, ok]) => !ok).map(([f]) => f);
  console.log(`${files.length - missing.length} already in R2, uploading ${missing.length} …`);
  let failed = 0;
  await pool(missing, CONC, async (f) => { try { await put(f); } catch (e) { failed++; console.error("  " + e.message); } });
  console.log(`Uploaded ${missing.length - failed}/${missing.length}${failed ? ` (${failed} failed)` : ""}.`);
}

// Repoint every sentence-clip URL to R2. Accent clips (absolute GMU URLs) untouched.
const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
let rewritten = 0;
for (const c of m.clips || []) {
  if (!c.url) continue;
  if (/^https?:\/\//.test(c.url) && !c.url.includes("/sentence-clips/") && !c.url.includes("r2.dev")) continue;
  const file = c.url.split("/").pop();
  const next = `${PUBLIC_BASE}/${file}`;
  if (c.url !== next) { c.url = next; rewritten++; }
}
const tmp = MANIFEST + ".tmp." + process.pid;
fs.writeFileSync(tmp, JSON.stringify(m));
fs.renameSync(tmp, MANIFEST);
console.log(`Rewrote ${rewritten} clip URLs -> ${PUBLIC_BASE}/… | clips:${m.clips.length} accents:${(m.accents || []).length}`);
