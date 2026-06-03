// Sends a "this clip's audio is bad" flag to the Levelbrook Rails ingest
// (Hetzner box, demo.levelbrook.com). The API key below is a shared spam
// deterrent, not real auth — it ships in this client bundle by design; the
// server also restricts the endpoint to this origin via CORS.

const ENDPOINT = "https://demo.levelbrook.com/api/v1/bad_audio_reports";
const API_KEY = "lb_lingua_f7ccce410a103c600c4bf1947a93fc9c";

// Fire a report. Resolves on success, throws on any non-2xx / network error so
// the caller can show a "couldn't send" state. Fire-and-forget from the UI.
export async function reportBadAudio(clip, reason = "") {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": API_KEY },
    body: JSON.stringify({
      clip_id: clip?.id || "",
      clip_url: clip?.url || "",
      lang: clip?.lang || "",
      lang_name: clip?.lang_name || "",
      reason: reason || "",
      page_url: location.href,
    }),
  });
  if (!res.ok) throw new Error("report failed: HTTP " + res.status);
  return res.json().catch(() => ({ ok: true }));
}
