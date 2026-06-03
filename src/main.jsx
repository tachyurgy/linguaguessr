import React from "react";
import { createRoot } from "react-dom/client";
// Self-hosted fonts — bundled, so no external Google Fonts request (which strict
// browser tracking-protection can block). Fully offline-capable.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import App from "./App.jsx";

// ---- last-line resilience: never let a stray async error reach the user -----
// Browser extensions, ad/tracking blockers, and aborted background fetches throw
// errors that have nothing to do with the game — the classic one being
// "Could not establish connection. Receiving end does not exist." from an
// extension's content script. Left unhandled these spam the console (and, with
// some error-overlay tooling, flash a scary error). We swallow the known-benign
// ones and keep going; the app already contains its own real failures locally.
const BENIGN = [
  "could not establish connection",      // chrome.runtime extension messaging
  "receiving end does not exist",
  "message channel closed",
  "the operation was aborted",           // AbortController on navigation/cleanup
  "load failed",                          // Safari's wording for an aborted fetch
  "networkerror when attempting to fetch",
  "resizeobserver loop",                  // benign layout-loop warning
];
const isBenign = (msg) => {
  const s = String(msg || "").toLowerCase();
  return BENIGN.some((b) => s.includes(b));
};
addEventListener("unhandledrejection", (e) => {
  const msg = e?.reason?.message ?? e?.reason;
  if (isBenign(msg)) { e.preventDefault(); return; }
  // Real rejections: log once, but don't let them bubble into a page-killer.
  console.warn("[lingua] unhandled rejection:", msg);
  e.preventDefault();
});
addEventListener("error", (e) => {
  if (isBenign(e?.message)) { e.preventDefault?.(); return; }
}, true);

// A single uncaught render error must never blank the whole page (the old
// behaviour, which read as a flicker). Contain it and offer a reload instead.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="app"><div className="wrap"><div className="center">
          <div className="brand pop"><span className="globe">🌍</span></div>
          <p>Something hiccuped. A quick reload usually fixes it.</p>
          <button className="btn" onClick={() => location.reload()}>↻ Reload</button>
        </div></div></div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
