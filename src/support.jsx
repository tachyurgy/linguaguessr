import { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Support / "buy me a coffee" — the indie-maker monetization layer.
//
// Voice: anonymous, first-person, warm. This is the *player-facing* ask ("if you
// like this little game, keep me fueled"), and it lives alongside the B2B
// "Hire us → Levelbrook" funnel without stepping on it: companies hire; players
// chip in. No personal name anywhere (brand-anonymity rule).
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  EDIT THESE FOUR VALUES once the real accounts + wallet exist.            │
// │  Everything else (copy, tiers, layout) is already wired to them.          │
// └──────────────────────────────────────────────────────────────────────────┘
export const SUPPORT = {
  coffee:  "https://buymeacoffee.com/tachyurgy",       // Buy Me a Coffee (one-time)
  patreon: "https://www.patreon.com/cw/tachyurgy",     // Patreon (recurring)
  btc:     "bc1qhspfxlknat3hza2uwe8e4xe9q5sm42j258m3zvwhg42ms64ns9nq3fxzcp", // Bitcoin receive address
};

// Patreon tiers — the recurring ladder. Keep these in sync with the actual
// tiers you create on Patreon (same names + prices) so the on-site pitch matches
// what people see at checkout.
const TIERS = [
  {
    emoji: "☕", name: "Espresso", price: "$3", per: "/mo",
    line: "You literally keep the lights on. Your name in the credits, plus the dev log where I post what I'm building next.",
  },
  {
    emoji: "🗺️", name: "Cartographer", price: "$7", per: "/mo",
    line: "Everything above — and you get a vote on which languages and game modes I add next, with work-in-progress peeks before anyone else.",
  },
  {
    emoji: "🎧", name: "Polyglot", price: "$15", per: "/mo", featured: true,
    line: "Everything above — plus early access to every new game I ship, and I'll genuinely chase down any language or clip you want added to the corpus.",
  },
  {
    emoji: "💎", name: "Patron", price: "$35", per: "/mo",
    line: "Everything above — your name on the supporters wall, a real thank-you from me, and a direct line to request a feature and have it actually happen.",
  },
];

export default function Support({ onClose }) {
  const [copied, setCopied] = useState(false);
  const copyBtc = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT.btc);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal card support-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="display">Keep me building ☕</h2>
          <button className="iconbtn x" onClick={onClose}>✕</button>
        </div>

        <p className="sup-lede">
          I make small, strange, lovingly-built browser games — LinguaGuessr is one of them.
          No ads, no trackers, no investors breathing down my neck. Just me, a code editor,
          and an unreasonable amount of coffee. If this game made your day a little better,
          you can keep me fueled and chasing the next one.
        </p>

        {/* One-time: Buy Me a Coffee */}
        <a className="sup-coffee" href={SUPPORT.coffee} target="_blank" rel="noreferrer">
          <span className="sc-emoji">☕</span>
          <span className="sc-text">
            <b>Buy me a coffee</b>
            <small>One-time, no strings. Every cup turns straight into more clips, more languages, more weird little games.</small>
          </span>
          <span className="sc-go">→</span>
        </a>

        {/* Recurring: Patreon ladder */}
        <div className="sup-section-label">…or ride along on Patreon</div>
        <p className="sup-sub">
          Recurring support is what actually lets me keep doing this instead of going back to billing by the hour.
          Pick a seat — cancel anytime.
        </p>
        <div className="sup-tiers">
          {TIERS.map((t) => (
            <a
              key={t.name}
              className={"sup-tier" + (t.featured ? " featured" : "")}
              href={SUPPORT.patreon}
              target="_blank"
              rel="noreferrer"
            >
              {t.featured && <span className="tier-flag">most popular</span>}
              <div className="tier-top">
                <span className="tier-emoji">{t.emoji}</span>
                <span className="tier-name">{t.name}</span>
                <span className="tier-price">{t.price}<small>{t.per}</small></span>
              </div>
              <p className="tier-line">{t.line}</p>
            </a>
          ))}
        </div>
        <a className="btn sup-patreon-btn" href={SUPPORT.patreon} target="_blank" rel="noreferrer">
          Become a patron on Patreon →
        </a>

        {/* Crypto: Bitcoin — only shown once a real address is set */}
        {SUPPORT.btc && (
          <>
            <div className="sup-section-label">…or, if you're that kind of person — Bitcoin</div>
            <p className="sup-sub">Prefer to send a few sats? Same gratitude, fewer middlemen.</p>
            <button className="sup-btc" onClick={copyBtc} title="Click to copy the Bitcoin address">
              <span className="btc-mark">₿</span>
              <code className="btc-addr">{SUPPORT.btc}</code>
              <span className="btc-copy">{copied ? "✓ copied" : "copy"}</span>
            </button>
          </>
        )}

        <p className="faint sup-foot">
          Thank you — genuinely. Even a coffee tells me someone out there is listening. 🌍
        </p>
      </div>
    </div>
  );
}

// Compact "enjoyed this?" strip for the end-of-game Summary — the warmest moment
// to ask, right after someone just had fun. Opens the full Support modal.
export function SupportStrip({ onOpen }) {
  return (
    <button className="support-strip" onClick={onOpen}>
      <span className="ss-emoji">☕</span>
      <span className="ss-text">
        <b>Enjoying LinguaGuessr?</b>
        <small>It's made by one person. Buy me a coffee or ride along on Patreon.</small>
      </span>
      <span className="ss-go">Support →</span>
    </button>
  );
}
