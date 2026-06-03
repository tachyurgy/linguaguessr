import { useEffect, useRef } from "react";
import L from "leaflet";

const pinIcon = (emoji) =>
  L.divIcon({ className: "", html: `<div class="pin">${emoji}</div>`, iconSize: [30, 30], iconAnchor: [15, 28] });

const WORLD_CENTER = [22, 0];
const WORLD_ZOOM = 2;
// Keep the world framed and stop the player from panning off into grey void.
const MAX_BOUNDS = L.latLngBounds([-72, -180], [84, 180]);

// Normalise any longitude into [-180, 180]. Leaflet hands back wrapped values
// (e.g. 430 or -260) when you click on a repeated copy of the world; storing
// those raw is what made a guess "right on top of" the answer draw a line
// clear across the planet. Canonicalise at click time so every stored guess
// is in one frame.
const normLng = (lng) => (((lng + 180) % 360) + 360) % 360 - 180;

// Shift `lng` by whole turns so it lands within 180° of `refLng` — i.e. draw
// the SHORT way round. Used only for display (the polyline + fitBounds) so a
// Tokyo answer and a Los Angeles guess connect across the Pacific, not Eurasia.
function unwrapLng(refLng, lng) {
  let out = lng;
  while (out - refLng > 180) out -= 360;
  while (out - refLng < -180) out += 360;
  return out;
}

// World map. Tap to drop a guess; on reveal, shows the true location + a line.
//
// ONE Leaflet instance lives for the whole map-mode session — we reset markers
// and recenter on each new round rather than remounting. Remounting per round
// (the old approach) let an in-flight zoom/scroll animation fire its transition
// callback on an already-removed map, which is exactly the
// "Cannot read properties of undefined (reading '_leaflet_pos')" crash. For the
// same reason all animations are disabled and we map.stop() before teardown.
export default function MapGuess({ round, onPick, guess, answer, revealed, homeland }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const guessMarker = useRef(null);
  const extras = useRef([]);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // Create the map exactly once.
  useEffect(() => {
    if (!elRef.current) return;
    let map;
    try {
      map = L.map(elRef.current, {
        center: WORLD_CENTER, zoom: WORLD_ZOOM, minZoom: 2, maxZoom: 12,
        // worldCopyJump OFF: with it on, clicks on a repeated world copy return
        // out-of-range longitudes. We constrain to one world + normalise clicks.
        worldCopyJump: false, maxBounds: MAX_BOUNDS, maxBoundsViscosity: 1.0,
        zoomControl: true, attributionControl: true, trackResize: true,
        zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false,
      });
    } catch {
      return;
    }
    mapRef.current = map;
    map.zoomControl?.setPosition("topright");
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO", subdomains: "abcd",
      maxZoom: 12, noWrap: true, keepBuffer: 4,
    }).addTo(map);
    map.on("click", (e) => {
      if (!onPickRef.current) return;
      onPickRef.current([e.latlng.lat, normLng(e.latlng.lng)]);
    });

    // Size correction once, after layout — guarded so a torn-down map can't throw.
    const raf = requestAnimationFrame(() => {
      if (mapRef.current !== map) return;
      try { map.invalidateSize(false); } catch {}
    });

    return () => {
      cancelAnimationFrame(raf);
      // Kill interaction handlers and any *pending* debounced zoom before teardown.
      // map.stop() only cancels in-flight animations — it does NOT clear the
      // scroll-wheel zoom's setTimeout. A queued _performZoom firing after
      // remove() (when _mapPane is gone) is the "_leaflet_pos of undefined" crash.
      try {
        clearTimeout(map.scrollWheelZoom?._timer);
        map.scrollWheelZoom?.disable();
        map.doubleClickZoom?.disable();
        map.touchZoom?.disable();
        map.boxZoom?.disable();
        map.keyboard?.disable();
      } catch {}
      try { map.stop(); } catch {}
      try { map.off(); map.remove(); } catch {}
      if (mapRef.current === map) mapRef.current = null;
      guessMarker.current = null;
      extras.current = [];
    };
  }, []);

  // New round: clear the previous guess/answer/line and snap back to the world.
  // The container also shrinks back to the corner here, so re-measure.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      if (guessMarker.current) { map.removeLayer(guessMarker.current); guessMarker.current = null; }
      for (const layer of extras.current) map.removeLayer(layer);
      extras.current = [];
      map.invalidateSize(false);
      map.setView(WORLD_CENTER, WORLD_ZOOM, { animate: false });
    } catch {}
  }, [round]);

  // Place / move the guess marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !guess) return;
    try {
      if (!guessMarker.current) guessMarker.current = L.marker(guess, { icon: pinIcon("📍") }).addTo(map);
      else guessMarker.current.setLatLng(guess);
    } catch {}
  }, [guess]);

  // On reveal: drop the true location, draw the line, fit both in view.
  // Both points are pulled into a single longitude frame first so the line and
  // the fitted bounds take the short way round the globe — never wrapping the
  // whole map when the answer sits near the antimeridian.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !revealed || !answer) return;
    try {
      map.invalidateSize(false);
      const am = L.marker(answer, { icon: pinIcon("🎯") }).addTo(map);
      extras.current.push(am);
      // Historical-territory overlay for languages with no modern nation-state
      // (the Native American set carries a `homeland` polygon) — shade the actual
      // area the language was spoken in, longitude-unwrapped to the answer's frame.
      let homelandBounds = null;
      if (homeland && homeland.length >= 3) {
        const ring = homeland.map(([la, ln]) => [la, unwrapLng(answer[1], ln)]);
        const poly = L.polygon(ring, {
          color: "#ff5a3c", weight: 1.5, opacity: 0.9,
          fillColor: "#ff5a3c", fillOpacity: 0.12, dashArray: "4 4", interactive: false,
        }).addTo(map);
        extras.current.push(poly);
        homelandBounds = poly.getBounds();
      }
      if (guess) {
        const gAdj = [guess[0], unwrapLng(answer[1], guess[1])];
        if (guessMarker.current) guessMarker.current.setLatLng(gAdj);
        const line = L.polyline([gAdj, answer], { color: "#5ef2c0", weight: 2.5, dashArray: "6 6" }).addTo(map);
        extras.current.push(line);
        // maxZoom caps how far it zooms when the guess is nearly perfect, so a
        // close call still reads as "close" instead of slamming to street level.
        const b = L.latLngBounds([gAdj, answer]);
        if (homelandBounds) b.extend(homelandBounds);
        map.fitBounds(b.pad(0.35), { animate: false, maxZoom: 6 });
      } else if (homelandBounds) {
        map.fitBounds(homelandBounds.pad(0.4), { animate: false, maxZoom: 6 });
      } else {
        map.setView(answer, 4, { animate: false });
      }
    } catch {}
  }, [revealed, answer, homeland]);

  return <div className="mapwrap" ref={elRef} />;
}
