#!/usr/bin/env node
// Fills text_en for the clips AWS Translate can't do directly and OpenAI is out
// of quota for: Galician (translated via the highly-mutually-intelligible
// Portuguese model) and Basque (hand-translated best-effort from the noisy
// Whisper transcripts). Idempotent; only touches clips still missing text_en.
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
const exec = promisify(execFile);
const MANIFEST = new URL("../public/manifest.json", import.meta.url).pathname;

const EUS = {
  "yt-eus-huTchmgqv48-30": "Behaviour has to be taken into account; the mayor had to come out to deny what had been published. In emergencies you don't play games. Many people who work in this field… In emergency situations it can't be treated as a joke. It can put other people's lives at risk, he stressed.",
  "yt-eus-9ceHah9weSs-86": "It will have two main parts: on one hand the daily news and current affairs, but then the topics of our own that we'll cover, right? And looking ahead in the week, it has to be said, this week we bring a proposal packed with news, right? Lastly, today we've started with a company from Vitoria-Gasteiz, a company founded by some people from Vitoria-Gasteiz.",
  "yt-eus-njTc2KsUo9M-1115": "I'm heading there, to the Gazpelu viewpoint, and that's where I ended up, together with my partner, my life companion. And we don't even realise how close we are here.",
  "yt-eus--LLIxS0MbrM-140": "In that effort… a systematic diving organization, so that nothing goes undetected. They will carry out systematic archaeological dives to investigate those anomalies — for example, the cannons, cannonballs or anchors connected to sunken ships that appear in the archives…",
  "yt-eus-k5fjlJVVoGE-145": "I was… why is this done? And you do know why it's done. They spent years in the Lapurdi rowing team, and when the team had almost disappeared they took up rowing with some rowers from Hernani and Zarautz.",
  "yt-eus-6ilVsViYj8s-146": "Watch out for the unions' demands, and it isn't the political parties either. I was out on the street first, and even after being an MP, I think it's important to stay close to society, and today a broad majority doesn't…",
  "yt-eus--5IZOA2QkKE-158": "And that you can live in Basque here. The Zuberoan brand that has just made the leap over here gives priority to the Basque dialect, especially in communication. … we do all our work in Basque, because we always want to work in Basque.",
  "yt-eus-q4WmseVAD48-168": "…the entertainment team, a top-class team, on that day in the town's festivities… it will truly be a great event. They've revealed it will be a milestone-anniversary edition full of surprises. The motto, 'urratxak' (footsteps), bridges — because the bridges hold the town together, and…",
  "yt-eus-2UmNac0UMKc-168": "It's a mistake to assume everyone is clever, because only a few are. And that's not how it is: we have very bright people and people who aren't, just like the rest of the population. What's more, in this case it's more closely tied to intellectual disability.",
  "yt-eus-7tXsKVyTLCA-159": "And just as was done before — simply correcting things — I don't know why what was being done seven years ago couldn't be done today; steps backward are being taken. We hear politicians say, 'Yes, Basque, we'll do it,' but in concrete terms nothing moves forward — on the contrary, we're going backwards.",
  "yt-eus-bIU5mmh9A1M-147": "and it will help parents do their job, strengthening their position within families to keep screens and social media in their proper place. That's why the 'screen-free day' initiative began back in 2018. Today there are…",
  "yt-eus-XpOSPqSlVng-138": "One of them is this woman. She told us she watches and reads the news from morning till night. Her husband stayed behind, and she says that physically he is here but his mind is elsewhere. Her family is now in Ukraine, and they will try to…",
};

async function awsPt(text) {
  const { stdout } = await exec("aws", [
    "translate", "translate-text", "--region", process.env.AWS_REGION || "us-east-1",
    "--text", text, "--source-language-code", "pt", "--target-language-code", "en",
    "--output", "json",
  ], { maxBuffer: 1024 * 1024 });
  return JSON.parse(stdout).TranslatedText.trim();
}

const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
let eus = 0, glg = 0;
for (const c of m.clips) {
  if ((c.text_en || "").trim()) continue;
  if (c.lang === "eus" && EUS[c.id]) { c.text_en = EUS[c.id]; eus++; }
  else if (c.lang === "glg" && (c.text || "").trim()) { c.text_en = await awsPt(c.text); glg++; }
}
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
writeFileSync(`${MANIFEST}.bak.${stamp}`, readFileSync(MANIFEST));
writeFileSync(MANIFEST, JSON.stringify(m, null, 0));
const missing = m.clips.filter((c) => (c.text || "").trim() && !(c.text_en || "").trim());
console.log(`Filled eus=${eus} glg=${glg}. Remaining without text_en: ${missing.length}`);
missing.slice(0, 20).forEach((c) => console.log("  still missing:", c.id, c.lang));
