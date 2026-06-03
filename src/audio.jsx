import { useEffect, useRef, useState } from "react";
import { replayMultiplier } from "./engine.js";

// How many times we silently reload a clip (cache-busted) before declaring it
// broken and asking the parent to swap in a replacement. Transient network
// blips — common right after "Play again" when the next clips aren't warmed
// yet — recover here instead of bouncing the player.
const RETRY_LIMIT = 2;
const bust = (src, n) => (n > 0 ? src + (src.includes("?") ? "&" : "?") + "r=" + n : src);

// Big circular play/pause button with sonar rings + equalizer bars.
// First listen is free; the parent tracks `plays` and the Replay button
// starts a fresh listen (which costs points). The main button toggles
// play/pause so it can actually STOP the audio, and resumes mid-clip
// without charging another listen.
export default function AudioPlayer({ src, plays, onPlay, onError, autoplay = false }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [listenCount, setListenCount] = useState(plays || 0);
  const [failed, setFailed] = useState(false);
  const [blocked, setBlocked] = useState(false); // autoplay denied — waiting for a tap
  const lastReported = useRef(plays || 0);
  const retryRef = useRef(0);
  const unlockRef = useRef(null); // teardown for the first-gesture listener

  const reportListen = () => {
    setListenCount((n) => {
      const next = n + 1;
      lastReported.current = next;
      onPlay?.(next);
      return next;
    });
  };

  const clearUnlock = () => { unlockRef.current?.(); unlockRef.current = null; };

  // Browsers block autoplay-with-sound until the user has interacted with the
  // page. When the initial play() is denied, arm a one-shot listener so the
  // clip fires on the very next tap/key/touch anywhere — the page then "comes
  // alive" the instant the player does anything.
  const armUnlock = (a) => {
    clearUnlock();
    setBlocked(true);
    const go = (e) => {
      // If the gesture landed on the play button, let its own onClick (toggle)
      // drive playback. Otherwise this handler and the click would both fire —
      // we'd start the audio here and the click would immediately pause it,
      // making the first tap look like a no-op.
      if (e?.target?.closest?.(".playbtn")) return;
      clearUnlock();
      a.play().then(() => { setBlocked(false); reportListen(); }).catch(() => {});
    };
    const opts = { capture: true, once: true };
    addEventListener("pointerdown", go, opts);
    addEventListener("keydown", go, opts);
    addEventListener("touchstart", go, opts);
    unlockRef.current = () => {
      removeEventListener("pointerdown", go, opts);
      removeEventListener("keydown", go, opts);
      removeEventListener("touchstart", go, opts);
    };
  };

  // Hard stop on unmount: when the player leaves the screen — switching modes,
  // opening About, hitting the reveal, or navigating via the URL — the clip must
  // go silent immediately. Removing the <audio> node from the DOM doesn't reliably
  // halt in-flight playback across browsers, so we explicitly pause and detach the
  // source. Without this, clicking around leaves the previous page's audio running.
  useEffect(() => {
    return () => {
      const a = audioRef.current;
      clearUnlock();
      try { a?.pause(); if (a) { a.removeAttribute("src"); a.load(); } } catch {}
    };
  }, []);

  // Reset + autoplay when the clip changes.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    setPlaying(false);
    setFailed(false);
    setBlocked(false);
    setListenCount(plays || 0);
    lastReported.current = plays || 0;
    retryRef.current = 0;
    clearUnlock();
    a.src = src;
    a.load();
    if (autoplay) {
      a.play().then(reportListen).catch(() => armUnlock(a));
    }
    return clearUnlock;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // A load error: cache-bust and retry a couple of times before giving up. The
  // retry reuses the current play intent without charging an extra listen.
  const onAudioError = () => {
    const a = audioRef.current;
    if (a && retryRef.current < RETRY_LIMIT) {
      retryRef.current += 1;
      const resume = !a.paused || autoplay;
      a.src = bust(src, retryRef.current);
      a.load();
      if (resume) a.play().catch(() => {});
      return;
    }
    setFailed(true);
    onError?.();
  };

  // Start from the beginning — counts as a listen (Replay + first play).
  const playFromStart = () => {
    const a = audioRef.current;
    if (!a) return;
    setFailed(false);
    clearUnlock();
    setBlocked(false);
    a.currentTime = 0;
    a.play().then(reportListen).catch(() => setFailed(true));
  };

  // Main button: a real toggle. Pause if playing, resume if paused mid-clip
  // (no new listen charged), otherwise start a fresh listen.
  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    // Autoplay was blocked and we're waiting for a gesture — this click IS that
    // gesture, so start a fresh listen from the top.
    if (blocked) { playFromStart(); return; }
    if (!a.paused) { a.pause(); return; }
    if (a.currentTime > 0 && !a.ended) {
      setFailed(false);
      a.play().catch(() => setFailed(true));
    } else {
      playFromStart();
    }
  };

  const nextCost = Math.round((1 - replayMultiplier(listenCount + 1) / replayMultiplier(listenCount)) * 100);

  return (
    <div className="player card">
      <div className="round-label">listen &amp; place it</div>
      <div className={"playwrap" + (blocked ? " blocked" : "")}>
        <button className={"playbtn" + (playing ? " playing" : "") + (blocked ? " nudge" : "")} onClick={toggle} aria-label={playing ? "Pause clip" : "Play clip"}>
          <span className="ring" /><span className="ring r2" /><span className="ring r3" />
          {playing ? "❚❚" : "▶"}
        </button>
        {blocked && (
          <div className="tap-cta" aria-hidden="true">
            <span className="tap-finger">👆</span> Click to play
          </div>
        )}
      </div>

      <div className={"bars" + (playing ? " on" : "")} aria-hidden="true">
        {Array.from({ length: 7 }).map((_, i) => <i key={i} />)}
      </div>

      <button className="replay" onClick={playFromStart}>
        <span>↻ Replay</span>
        <span className="cost">{listenCount === 0 ? "free" : `−${nextCost}%`}</span>
      </button>
      <div className="hint">
        {failed
          ? "That clip wouldn't load — pulling in a fresh one…"
          : blocked
            ? "🔊 Tap anywhere to start the clip"
            : listenCount === 0
              ? "Guess on the first listen for a Golden Ear bonus"
              : `${listenCount} listen${listenCount > 1 ? "s" : ""} so far`}
      </div>

      <audio
        ref={audioRef}
        onPlay={() => setPlaying(true)}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onError={onAudioError}
        preload="auto"
      />
    </div>
  );
}
