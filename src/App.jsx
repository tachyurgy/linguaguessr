import { useEffect, useMemo, useRef, useState } from "react";
import * as E from "./engine.js";
import { FACTS, fallbackFact } from "./facts.js";
import { burst } from "./confetti.js";
import AudioPlayer from "./audio.jsx";
import MapGuess from "./map.jsx";
import About from "./about.jsx";
import { reportBadAudio } from "./report.js";

const REGION_EMOJI = {
  "Western Europe": "🏰", "Northern Europe": "❄️", "Southern Europe": "🏛️", "Eastern Europe": "⛪",
  "Middle East": "🕌", "East Asia": "🏯", "Southeast Asia": "🌴", "South Asia": "🛕", "Africa": "🦒",
};
const freshRound = () => ({ plays: 0, guess: null, picked: null, region: null, revealed: false, lastPts: 0, dialectPick: null, dialectBonus: 0 });

// Country name from its ISO code (built-in, no data table needed) for "Spoken in …".
const REGION_NAMES = (() => { try { return new Intl.DisplayNames(["en"], { type: "region" }); } catch { return null; } })();
const countryName = (cc) => { try { return REGION_NAMES?.of(cc) || cc; } catch { return cc; } };

// All the ways to play. Expert (map) is the default drop-in, GeoGuessr-style.
const MODES = [
  { key: "map", mode: "classic", emoji: "🎯", t: "Expert", d: "Drop a pin on the world map" },
  { key: "region", mode: "classic", emoji: "🧭", t: "Explorer", d: "Pick the world region" },
  { key: "choice", mode: "classic", emoji: "🎧", t: "Casual", d: "Choose from four languages" },
  { key: "accent", mode: "accent", emoji: "🗣️", t: "Accent", d: "Same English passage — place the accent" },
];

function newGame(manifest, key, mode) {
  // Daily Challenge: a fixed, everyone-hears-the-same five-clip map game.
  if (mode === "daily") {
    return { mode: "daily", guessMode: "map", modeKey: "daily", rounds: E.buildDaily(manifest), idx: 0, scores: [], ...freshRound() };
  }
  const guessMode = mode === "accent" ? "choice" : key;
  const rounds = mode === "accent" ? E.buildAccent(manifest) : E.buildClassic(manifest);
  return { mode, guessMode, modeKey: key, rounds, idx: 0, scores: [], ...freshRound() };
}

export default function App() {
  const [manifest, setManifest] = useState(null);
  const [err, setErr] = useState(null);
  const [route, setRoute] = useState(() => (location.hash === "#/about" ? "about" : "play"));
  const [menuOpen, setMenuOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [stats, setStats] = useState(() => E.loadStats());
  const [game, setGame] = useState(null);
  // A speculative next game, built and cache-warmed while the player is still
  // finishing the current one, so "Play again" starts instantly with no load
  // wait. Holds { key, mode, game }; consumed by start() on a matching mode.
  const nextGameRef = useRef(null);

  // Load the world and drop the player straight into a game — no intro screen.
  // Then warm the cache with EVERY clip in the background (this game's rounds
  // first) so rounds never stall on a network fetch. Fire-and-forget; it never
  // blocks the UI and quietly records any broken clips for graceful fallback.
  useEffect(() => {
    E.loadManifest()
      .then((m) => {
        setManifest(m);
        const g = newGame(m, "map", "classic");
        setGame(g);
        E.prefetchAll(m, { priority: g.rounds.map((c) => c.url) }).catch(() => {});
      })
      .catch((e) => setErr(e.message));
  }, []);
  useEffect(() => {
    const onHash = () => setRoute(location.hash === "#/about" ? "about" : "play");
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1700); };
  const goAbout = () => { location.hash = "#/about"; setMenuOpen(false); };
  const goPlay = () => { location.hash = "#/"; setRoute("play"); };
  const start = (key, mode) => {
    // Reuse the speculative game we built during the last round if it matches the
    // requested mode — its clips are already warmed, so play begins instantly.
    const pre = nextGameRef.current;
    const g = pre && pre.key === key && pre.mode === mode ? pre.game : newGame(manifest, key, mode);
    nextGameRef.current = null;
    setGame(g); setMenuOpen(false); goPlay();
    // Warm this game's clips immediately (covers Accent Mode's cross-origin audio).
    E.prefetchAll(manifest, { priority: g.rounds.map((c) => c.url) }).catch(() => {});
  };

  // Build and cache-warm the next same-mode game ahead of time. Idempotent for a
  // given mode so it runs at most once per game-end. Called when the player
  // reaches the final round, so the clips are already downloaded by the time they
  // hit "Play again" — eliminating the perceived load between games.
  const prepareNext = (key, mode) => {
    if (!manifest) return;
    const pre = nextGameRef.current;
    if (pre && pre.key === key && pre.mode === mode) return;
    const g = newGame(manifest, key, mode);
    nextGameRef.current = { key, mode, game: g };
    E.prefetchAll(manifest, { priority: g.rounds.map((c) => c.url) }).catch(() => {});
  };

  // The moment the player lands on the last round (question 5) or the summary,
  // pre-warm the next game so replaying never stalls on a network fetch.
  useEffect(() => {
    if (game && game.idx >= E.ROUNDS - 1) prepareNext(game.modeKey, game.mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.idx, game?.modeKey, game?.mode]);

  if (err) return <Shell variant="page"><div className="center"><p>😕 {err}</p></div></Shell>;
  if (!manifest || !game) {
    return <Shell variant="game"><div className="center"><div className="brand pop"><span className="globe">🌍</span></div><p className="muted">Tuning in to the world…</p></div></Shell>;
  }

  const complete = game.idx >= Math.min(E.ROUNDS, game.rounds.length);
  const empty = game.rounds.length === 0;
  const inGame = route !== "about" && !complete && !empty;

  return (
    <Shell
      variant={inGame ? "game" : "page"}
      onBrand={() => { goPlay(); setMenuOpen(true); }}
      onMenu={() => setMenuOpen(true)}
      onHow={() => setHowOpen(true)}
      onAbout={goAbout}
    >
      {route === "about" ? (
        <div className="narrow"><About onHome={goPlay} /></div>
      ) : empty ? (
        <div className="narrow center"><EmptyMode onMenu={() => setMenuOpen(true)} /></div>
      ) : complete ? (
        <div className="narrow"><Summary game={game} stats={stats}
          onAgain={() => game.mode === "daily" ? start("map", "classic") : start(game.modeKey, game.mode)}
          onMenu={() => setMenuOpen(true)} onShare={showToast} /></div>
      ) : (
        <GameView manifest={manifest} game={game} setGame={setGame} stats={stats} setStats={setStats} />
      )}

      {menuOpen && <Menu manifest={manifest} current={game} stats={stats} onPick={start} onAbout={goAbout} onHow={() => { setHowOpen(true); setMenuOpen(false); }} onClose={() => setMenuOpen(false)} />}
      {howOpen && <HowTo onClose={() => setHowOpen(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </Shell>
  );
}

// ===== Menu (replaces the old home screen) =====
function Menu({ manifest, current, stats, onPick, onAbout, onHow, onClose }) {
  const dailyDone = E.dailyDoneToday(stats);
  const streak = stats.streak || 0;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="display">Play a round</h2>
          <button className="iconbtn x" onClick={onClose}>✕</button>
        </div>

        <button className={"daily-hero" + (dailyDone ? " done" : "") + (current.mode === "daily" ? " on" : "")} onClick={() => onPick("daily", "daily")}>
          <span className="dh-cal">📅</span>
          <span className="dh-text">
            <span className="dh-title">Daily Challenge <span className="dh-badge">#{E.dailyNumber()}</span></span>
            <span className="dh-sub">
              {dailyDone
                ? `✓ Played today${streak ? ` · ${streak} 🔥 streak` : ""} — tap to replay`
                : "Five clips. Everyone hears the same. Build a streak, share your card."}
            </span>
          </span>
          <span className="dh-go">{dailyDone ? "↻" : "▶"}</span>
        </button>

        <div className="menu-or"><span>or pick a free-play mode</span></div>

        <div className="menu-modes">
          {MODES.map((m) => (
            <button key={m.key} className={"menu-mode" + (current.modeKey === m.key ? " on" : "")} onClick={() => onPick(m.key, m.mode)}>
              <span className="mm-emoji">{m.emoji}</span>
              <span className="mm-text"><span className="mm-t">{m.t}</span><span className="mm-d">{m.d}</span></span>
            </button>
          ))}
        </div>
        <div className="menu-foot">
          <button className="linklike" onClick={onHow}>How to play</button>
          <span className="dotsep">·</span>
          <button className="linklike" onClick={onAbout}>About — a demo by Levelbrook</button>
        </div>
        <p className="faint" style={{ textAlign: "center", fontSize: 12.5, margin: "10px 0 0" }}>
          {manifest.languages.length} languages · {(manifest.count + (manifest.accents?.length || 0)).toLocaleString()} clips
        </p>
      </div>
    </div>
  );
}

function EmptyMode({ onMenu }) {
  return (
    <div className="card" style={{ padding: 28, textAlign: "center", maxWidth: 460 }}>
      <div style={{ fontSize: 40 }}>🎧</div>
      <h2 className="display" style={{ margin: "10px 0 6px" }}>Nothing to play here yet</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        This mode's clip library didn't load. Try a hard refresh (⌘⇧R), then pick a mode again.
      </p>
      <button className="btn" onClick={onMenu} style={{ marginTop: 8 }}>Choose a mode →</button>
    </div>
  );
}

// ===== Summary =====
function Summary({ game, stats, onAgain, onMenu, onShare }) {
  const total = game.scores.reduce((a, b) => a + b, 0);
  const rank = E.rankFor(total);
  const daily = game.mode === "daily";
  const streak = stats.streak || 0;
  const fired = useRef(false);
  useEffect(() => {
    if (!fired.current && total >= 18000) { fired.current = true; setTimeout(() => burst({ count: 180, power: 1.15 }), 150); }
  }, []);
  const share = E.shareText({ scores: game.scores, total, daily, streak });
  const copy = async () => {
    try { await navigator.clipboard.writeText(share); onShare(daily ? "Daily card copied — go flex 🌍" : "Score copied — go flex 🌍"); }
    catch { onShare("Press and hold to copy"); }
  };
  return (
    <div className="summary card fadein">
      <div className="round-label">{daily ? `Daily #${E.dailyNumber()} complete` : "Game complete"}</div>
      <div className="bigscore">{total.toLocaleString()}</div>
      <div className="muted">out of {E.MAX_GAME.toLocaleString()}</div>
      <div className="ranklabel">{rank.icon} {rank.name}</div>
      {daily && (
        <div className="statgrid">
          <div className="stat"><div className="n">{streak} 🔥</div><div className="l">Day streak</div></div>
          <div className="stat"><div className="n">{stats.maxStreak || 0}</div><div className="l">Best streak</div></div>
          <div className="stat"><div className="n">{(stats.dailyBest || 0).toLocaleString()}</div><div className="l">Daily best</div></div>
        </div>
      )}
      <div className="sharecard">{share}</div>
      <div className="row">
        <button className="btn" onClick={copy}>📋 {daily ? "Copy daily card" : "Copy score"}</button>
        <button className="btn ghost" onClick={onAgain}>{daily ? "Play free mode →" : "↻ Play again"}</button>
      </div>
      <button className="linklike" style={{ display: "block", margin: "14px auto 0", color: "var(--accent2)" }} onClick={onMenu}>
        {daily ? "Choose another mode →" : "Try a different mode →"}
      </button>
    </div>
  );
}

function GameView({ manifest, game, setGame, stats, setStats }) {
  const clip = game.rounds[game.idx];
  const playsRef = useRef(game.plays);
  const roundStartRef = useRef(0); // set when the clip first starts — the speed clock
  const stageRef = useRef(null);
  // Every new round / reveal starts at the top of the stage so the player and
  // the sticky action button are immediately in view — never a scroll-hunt.
  useEffect(() => {
    stageRef.current?.scrollTo({ top: 0 });
    scrollTo({ top: 0 });
  }, [clip?.id, game.revealed]);
  const options = useMemo(
    () => (clip && game.guessMode === "choice" ? E.buildOptions(manifest, clip, game.mode === "accent" ? manifest.accentLanguages : manifest.languages) : []),
    [clip, game.guessMode, game.mode, manifest]
  );
  useEffect(() => { playsRef.current = game.plays || 0; }, [clip?.id, game.plays]);
  useEffect(() => { roundStartRef.current = 0; }, [clip?.id]); // reset the speed clock each round

  if (!clip) return null;
  const truth = manifest.langByCode[clip.lang];
  const isMap = game.guessMode === "map";
  // First listen of the round starts the speed clock; replays don't reset it.
  const onPlay = (count) => {
    playsRef.current = count;
    if (!roundStartRef.current) roundStartRef.current = performance.now();
  };

  // Resilience: if this round's audio file is missing/broken, mark it and
  // hot-swap in a working clip so the player never gets stuck on a dead file.
  function onAudioError() {
    E.brokenClips.add(clip.url);
    setGame((g) => {
      if (g.revealed || g.rounds[g.idx]?.url !== clip.url) return g;
      const alt = E.replacementClip(manifest, g, clip);
      if (!alt) return g;
      const rounds = g.rounds.slice();
      rounds[g.idx] = alt;
      return { ...g, rounds, ...freshRound() };
    });
  }

  function submit(payload) {
    if (game.revealed) return;
    E.markSeen(clip); // durably remember this clip so it won't repeat in future sessions
    let acc = 0;
    const plays = playsRef.current;
    if (game.guessMode === "map") acc = E.scoreMap(E.haversine(payload, clip.geo), plays);
    else if (game.guessMode === "choice") acc = E.scoreChoice(payload, clip, plays);
    else acc = E.scoreRegion(payload, clip, plays);
    // Reward speed: the bonus drains over the round and is scaled by accuracy.
    const elapsed = roundStartRef.current ? performance.now() - roundStartRef.current : 0;
    const bonus = E.speedBonus(elapsed, acc / E.MAX_ROUND);
    const pts = acc + bonus;
    if (pts >= 4000) burst({ count: pts >= 5200 ? 160 : 110, power: 1 });
    setGame((g) => ({
      ...g, revealed: true, lastPts: pts, lastBonus: bonus, plays,
      picked: game.guessMode === "choice" ? payload : g.picked,
      region: game.guessMode === "region" ? payload : g.region,
      guess: game.guessMode === "map" ? payload : g.guess,
    }));
  }

  function next() {
    setGame((g) => {
      const scores = [...g.scores, g.lastPts];
      const idx = g.idx + 1;
      if (idx >= E.ROUNDS) {
        const total = scores.reduce((a, b) => a + b, 0);
        setStats(E.saveGame(stats, { total, daily: g.mode === "daily" }));
      }
      return { ...g, scores, idx, ...freshRound() };
    });
  }

  const hit = isHit(game, clip);
  const totalNow = game.scores.reduce((a, b) => a + b, 0);

  return (
    <div ref={stageRef} className={"stage" + (isMap ? " has-map" : "") + (game.revealed ? " revealing" : "")}>
      <div className="stage-inner fadein" key={clip.id}>
        <div className="progress">
          <div className="dots">
            {Array.from({ length: E.ROUNDS }).map((_, i) => (
              <span key={i} className={"dot" + (i < game.idx ? " done" : i === game.idx ? " cur" : "")} />
            ))}
          </div>
          <div className="score-now">{totalNow.toLocaleString()} <span>pts</span></div>
        </div>

        {!game.revealed && <SpeedMeter startRef={roundStartRef} />}

        {!game.revealed && <AudioPlayer src={clip.url} plays={game.plays} onPlay={onPlay} onError={onAudioError} autoplay />}

        {!game.revealed && <ReportAudio clip={clip} />}

        {!game.revealed && !isMap && (
          <GuessArea game={game} options={options} regions={manifest.regions} onSubmit={submit} />
        )}

        {game.revealed && (
          <>
            <Reveal clip={clip} truth={truth} hit={hit} pts={game.lastPts} game={game} />
            <DialectBonus manifest={manifest} clip={clip} game={game} setGame={setGame} />
            <button className="btn next-btn" onClick={next}>
              {game.idx + 1 >= E.ROUNDS ? "See results →" : "Next round →"}
            </button>
          </>
        )}
      </div>

      {isMap && (
        <div className={"map-overlay" + (game.revealed ? " revealed" : "")}>
          <MapGuess
            round={game.idx}
            guess={game.guess}
            answer={clip.geo}
            homeland={game.revealed ? clip.homeland : undefined}
            revealed={game.revealed}
            onPick={game.revealed ? undefined : (ll) => setGame((g) => ({ ...g, guess: ll }))}
          />
          {!game.revealed && (
            <button className="btn" disabled={!game.guess} onClick={() => submit(game.guess)}>
              {game.guess ? "Guess →" : "Tap the map to drop a pin"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Live, draining "lock it in fast" meter — the competitive heartbeat of a round.
// It sits full until the clip actually starts, then ticks down in real time.
function SpeedMeter({ startRef }) {
  const [frac, setFrac] = useState(1);
  useEffect(() => {
    let raf;
    const tick = () => {
      const s = startRef.current;
      setFrac(s ? E.speedFrac(performance.now() - s) : 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const pts = Math.round(E.SPEED_MAX * frac);
  return (
    <div className={"speed" + (frac <= 0 ? " spent" : frac > 0.66 ? " hot" : "")} aria-hidden="true">
      <span className="speed-ico">⚡</span>
      <div className="speed-track"><div className="speed-fill" style={{ width: frac * 100 + "%" }} /></div>
      <span className="speed-val">{pts > 0 ? `+${pts}` : "no bonus"}</span>
    </div>
  );
}

// A discreet "this clip is bad" flag under the player. Posts the clip's id +
// metadata to the Levelbrook Rails ingest so dead-air / garbled / mislabeled
// clips can be reviewed and pruned from the corpus. Self-contained: it owns its
// own idle → sending → done/error state and never blocks gameplay.
function ReportAudio({ clip }) {
  const [state, setState] = useState("idle"); // idle | sending | done | error
  // New clip ⇒ reset back to a fresh flag control.
  useEffect(() => { setState("idle"); }, [clip?.id]);

  if (state === "done") {
    return <div className="report-audio done">🚩 Thanks — flagged for review</div>;
  }

  const send = () => {
    if (state === "sending") return;
    setState("sending");
    reportBadAudio(clip)
      .then(() => setState("done"))
      .catch(() => setState("error"));
  };

  return (
    <button
      className="report-audio linklike"
      onClick={send}
      disabled={state === "sending"}
      title="Report a clip with no sound, dead air, or the wrong language"
    >
      {state === "sending" ? "Sending…" : state === "error" ? "Couldn't send — tap to retry" : "🚩 Report bad audio"}
    </button>
  );
}

function GuessArea({ game, options, regions, onSubmit }) {
  if (game.guessMode === "choice") {
    return (
      <div className="choices input-panel">
        {options.map((o) => (
          <button key={o.code} className="choice" onClick={() => onSubmit(o)}>{o.name}</button>
        ))}
      </div>
    );
  }
  if (game.guessMode === "region") {
    return (
      <div className="regions input-panel">
        {regions.map((r) => (
          <button key={r} className="region" onClick={() => onSubmit(r)}>
            <span style={{ marginRight: 8 }}>{REGION_EMOJI[r] || "🌍"}</span>{r}
          </button>
        ))}
      </div>
    );
  }
  return null;
}

function Reveal({ clip, truth, hit, pts, game }) {
  const f = FACTS[clip.lang] || fallbackFact;
  const accent = game.mode === "accent";
  const dist = game.guessMode === "map" && game.guess ? E.haversine(game.guess, clip.geo) : null;
  const golden = game.plays === 1;
  const said = accent ? E.ACCENT_PASSAGE : clip.text;
  return (
    <div className="reveal card pop">
      <div className={"res " + (hit ? "hit" : "miss")}>
        {hit
          ? (golden ? "🦻 Golden Ear!" : accent ? "✓ Great ear for accents" : "✓ Nicely heard")
          : (accent ? "This speaker grew up speaking…" : "That one was…")}
      </div>

      {said && (
        <div className="said">
          <div className="said-label">{accent ? "Everyone read this passage" : "What you just heard"}</div>
          <p className="said-text">“{said}”</p>
        </div>
      )}

      <div className="answerline">
        <span className="answerline-flag">{E.flag(clip.country)}</span>
        <span>
          <div className="ans display">
            {clip.lang_name}
            {clip.dialect && <span className="dialect-badge">{clip.dialect_short}</span>}
          </div>
          <div className="sub">
            {clip.dialect ? clip.dialect : (accent ? "native language" : clip.region)}
            {" · "}{accent ? clip.region : clip.family}
          </div>
        </span>
      </div>

      <div className="factbox">
        <div><b style={{ color: "var(--ink)" }}>Spoken in {countryName(clip.country)}</b> · {f.speakers} speakers</div>
        <div style={{ marginTop: 6 }}>{f.note}</div>
        {accent && <div style={{ marginTop: 6 }} className="faint">In Accent Mode the words are identical — only the accent gives the speaker away.</div>}
      </div>

      <div className="pts">+{pts.toLocaleString()} <small>pts</small></div>
      {game.lastBonus > 0 && <div className="speed-tag">⚡ +{game.lastBonus.toLocaleString()} speed bonus</div>}
      {game.dialectBonus > 0 && <div className="speed-tag">🎯 +{game.dialectBonus.toLocaleString()} dialect bonus</div>}
      {dist != null && <div className="dist-tag">📍 {dist.toLocaleString()} km from a heartland of the language</div>}
    </div>
  );
}

// The dialect bonus: once the language is revealed, languages with a real
// regional split invite a second, optional one-tap guess — which *variety* was
// it? Correct picks add DIALECT_BONUS to the round. It only renders when the clip
// carries a dialect and the corpus has ≥2 varieties of that language to choose
// between, so it never appears as a trivial single-option "guess".
function DialectBonus({ manifest, clip, game, setGame }) {
  const opts = useMemo(() => E.dialectOptions(manifest, clip), [manifest, clip]);
  if (!opts.length) return null;
  const picked = game.dialectPick;
  const right = picked === clip.dialect_code;
  return (
    <div className="dialect-bonus card pop">
      <div className="db-label">🎯 Bonus — which variety did you hear?</div>
      {!picked ? (
        <div className="db-choices">
          {opts.map((o) => (
            <button
              key={o.code}
              className="db-choice"
              onClick={() =>
                setGame((g) => {
                  if (g.dialectPick) return g;
                  const bonus = E.scoreDialect(o.code, clip);
                  return { ...g, dialectPick: o.code, dialectBonus: bonus, lastPts: g.lastPts + bonus };
                })
              }
            >
              <span className="db-flag">{E.flag(o.country)}</span> {o.short}
            </button>
          ))}
        </div>
      ) : (
        <div className={"db-result " + (right ? "hit" : "miss")}>
          {right
            ? `✓ Right — ${clip.dialect} (+${E.DIALECT_BONUS.toLocaleString()})`
            : `✗ It was ${clip.dialect}`}
        </div>
      )}
    </div>
  );
}

// ===== chrome =====
function Shell({ children, variant = "page", onBrand, onMenu, onHow, onAbout }) {
  const game = variant === "game";
  return (
    <div className={"app" + (game ? " app-game" : "")}>
      <div className="topbar">
        <div className="brand display" onClick={onBrand}><span className="globe">🌍</span> Lingua<b>Guessr</b></div>
        <div className="topnav">
          {onHow && <button className="iconbtn" title="How to play" onClick={onHow}>?</button>}
          {onMenu && <button className="menubtn" onClick={onMenu}>Menu</button>}
          {!onMenu && onAbout && <button className="iconbtn" title="About" onClick={onAbout}>ⓘ</button>}
          <a className="hire" href="https://consulting.levelbrook.com/?ref=linguaguessr" target="_blank" rel="noreferrer" title="Levelbrook builds software like this — hire our team">Hire us</a>
        </div>
      </div>
      {children}
      {!game && (
        <div className="foot narrow">
          <div className="by">A demo by <b>Levelbrook</b>, a senior software consulting practice · <a href="#/about" onClick={(e) => { e.preventDefault(); onAbout?.(); }}>who we are</a> · <a href="https://levelbrook.com" target="_blank" rel="noreferrer">levelbrook.com</a></div>
          <div style={{ marginTop: 4 }}>Audio: Google FLEURS (CC BY 4.0) · Accent Mode: The Speech Accent Archive</div>
        </div>
      )}
    </div>
  );
}

function HowTo({ onClose }) {
  const rows = [
    ["▶", "The clip plays automatically — go by ear alone. The words stay hidden until you guess. Replaying costs points."],
    ["🌍", "Guess where it's spoken: drop a pin, pick a region, or choose a language."],
    ["🔎", "After you guess, see exactly what the speaker said and where the language lives."],
    ["🦻", "Nail it on the first listen for a Golden Ear bonus. Five rounds make a game."],
    ["🎯", "Dialect bonus: for languages with a big regional split (Spanish, Portuguese, French…), name the variety you heard after the reveal for bonus points — a wrong call never costs you."],
    ["📅", "Daily Challenge: everyone hears the same five clips. Build a streak and share your emoji card."],
    ["🗣️", "Accent Mode: every speaker reads the same English passage — guess where they grew up."],
  ];
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="display">How to play</h2>
          <button className="iconbtn x" onClick={onClose}>✕</button>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>A celebration of how the world sounds. Be curious, not perfect.</p>
        {rows.map(([n, t]) => (
          <div className="howrow" key={t}><span className="n">{n}</span><span>{t}</span></div>
        ))}
        <button className="btn" onClick={onClose} style={{ marginTop: 8 }}>Let's go</button>
      </div>
    </div>
  );
}

function isHit(game, clip) {
  if (game.guessMode === "choice") return game.picked?.code === clip.lang;
  if (game.guessMode === "region") return game.region === clip.region;
  if (game.guessMode === "map") return game.guess && E.haversine(game.guess, clip.geo) < 800;
  return false;
}
