# LinguaGuessr — In-Game Rotating Background Prompts

Backgrounds that cycle *behind an active play session* (one per round, or rotating on a timer). These are a **different brief** from the splash hero:

- **Quieter than the splash.** They sit behind a live listening game, so they must never pull focus from the audio player, the map, or the answer controls. Think ambient, not hero.
- **Built to rotate.** A set that shares one palette and mood so swapping between rounds feels like one cohesive system, not a slideshow of mismatched photos.
- **⚠️ Spoiler-safe.** During a round the player is *guessing* a language/region — so the background must **not depict a recognizable, guessable place** (no Eiffel Tower, no clearly-Japanese street, no obvious flag). Keep it abstract, global, or generic-worldly. Save the recognizable-landmark imagery for the *reveal* screen (see Set E below).

## Shared style spec (append to every prompt)

> *"Subtle ambient background, heavily desaturated, darkened, soft blur / shallow focus, low contrast, lots of empty negative space, no text or logos, no recognizable landmarks or flags, cinematic, calm, designed to sit quietly behind UI elements."*

**Negative prompt:** `recognizable landmark, national flag, identifiable city, text, watermark, logo, sharp busy detail, high saturation, bright focal point that competes with UI`.

**Technical:** request `16:9` (and a `9:16` mobile cut), max resolution, then apply in CSS:
```css
filter: grayscale(35%) brightness(0.5) blur(1px);
/* + a dark gradient overlay so foreground UI always wins */
```
Aim for a consistent **luminance** across the whole set so the UI's text contrast never breaks when the image rotates.

---

## Set A — Abstract Atmospheric (the safest rotation; use as the default pool)

These never reference a place, so they're spoiler-proof and tonally consistent. Vary the *hue* per image for gentle visual change between rounds.

1. Soft out-of-focus bokeh field in deep teal drifting to charcoal, faint floating light orbs, slow and ambient, near-black base, no focal point.
2. The same composition in muted indigo → midnight blue.
3. The same in dusty amber → deep brown, warm and quiet.
4. The same in faded plum → slate grey, cool dusk feel.
5. The same in mossy green → charcoal, earthy and calm.
6. A slow gradient mesh of twilight colors with faint film grain and a barely-visible topographic line texture, no objects, endless negative space.
7. Drifting ink-in-water clouds, heavily desaturated, blurred, dark surround — abstract and slow.
8. Faint particle constellation on near-black, sparse drifting motes of light, minimal and spacious.

## Set B — Generic-Worldly (worldly mood, but no guessable location)

Evokes "somewhere out in the world" without naming where — safe to show mid-round.

9. A hazy, heavily-blurred horizon line where land meets sky at dusk, indistinct silhouette, no identifiable features, muted grey-gold, vast empty sky.
10. Out-of-focus generic city lights at night reduced to soft bokeh — could be anywhere — deep dark base, warm specks, no signage.
11. A blurred crowd of anonymous silhouettes in motion, desaturated, no faces or details, a sense of "the world is busy" without place.
12. Abstract aerial of an anonymous patchwork landscape — fields and roads as soft geometric shapes — overcast muted light, blurred, no landmarks.
13. Soft-focus generic coastline / open water meeting fog, no distinguishing coast features, cool muted palette, calm.
14. Indistinct distant mountain ridgelines fading layer by layer into atmospheric haze, monochrome blue-grey, serene.

## Set C — Map / Cartography Texture (on-theme, abstract, spoiler-safe)

Reinforces the guessing theme without revealing the answer.

15. Extreme close-up of an antique map's paper texture — faint grid lines and ink fragments, no readable place names, warm sepia-grey, soft and tactile.
16. Abstract longitude/latitude lines and faint compass-rose arcs drifting on a dark canvas, thin luminous strokes, minimal, no continents identifiable.
17. Stylized topographic contour lines flowing across deep slate, muted glow, abstract terrain that maps to nowhere real.
18. A blurred spinning globe reduced to soft grey landmass shapes and a single rim-light edge, continents not clearly resolvable, premium and dark.

## Set D — Language / Sound (ties to the listening mechanic, fully abstract)

19. Gentle audio waveforms rippling like a quiet horizon, muted teal peaks on near-black, ambient and rhythmic, lots of dark space.
20. Concentric soundwave rings emanating softly from scattered points on a dark abstract field, no map detail, calm and minimal.
21. Unreadable script-like glyphs from imaginary writing systems dissolving into light particles, abstract, muted jewel tones on dark — beautiful but illegible (so it can't spoil).
22. A soft analog tuning-dial glow blurred into bokeh, warm amber on dark, evoking "tuning in" without any place reference.

## Set E — Reveal-Screen Backgrounds (spoiler-OK — use ONLY after the answer is shown)

Once the round is over and the answer is revealed, you *can* lean into recognizable, celebratory, place-evoking imagery. Generate a matching-region image per answer, or use these generic-festive ones:

23. A warm celebratory burst of soft confetti-light and bokeh in muted jewel tones over a darkened world map, festive but restrained — good "round complete" mood.
24. A gentle wash of golden light sweeping across a faded globe, triumphant and warm, slightly darkened, room for a score readout.
25. Soft fireworks light-trails arcing over a dark stylized horizon, muted gold and rose, exciting but not garish.
26. *(Dynamic idea)* For a correct/known answer, fade in a heavily-stylized, desaturated impression of that region's landscape — but keep it painterly and abstract enough to stay on-brand with the rest of the set.

---

## Rotation & implementation notes

- **Pool to rotate from:** draw the live-play background from **Sets A–D only**. Reserve **Set E** for the reveal/results state.
- **Pick strategy:** randomize per round but avoid immediate repeats; or assign deterministically by round index so a given seed always looks the same (nice for shareable results).
- **Crossfade, don't cut:** a 600–1000ms opacity crossfade between rounds keeps it ambient instead of jarring.
- **Pin the luminance:** because text/UI overlays these, keep every image at a similar darkness. Easiest path — generate them, then normalize all in CSS with one shared filter + dark gradient (see top), so any image in the pool guarantees readable foreground.
- **Performance:** preload the next round's image during the current round; serve appropriately-sized variants (desktop vs mobile) and consider WebP/AVIF since these are large full-bleed images.
- **Don't compete with the map.** If a round uses the interactive map prominently, prefer **Set A** (pure abstract) for that round so two "busy" layers never stack.

## Quick-grab starter pool (8 images = one full rotation)

A1 (teal), A2 (indigo), A3 (amber), A6 (gradient mesh), B9 (hazy horizon), C16 (lat/long lines), D19 (waveforms), D20 (soundwave rings) — one cohesive dark/ambient set that's fully spoiler-safe and visually varied.
