# LinguaGuessr — Splash Background Image Prompts

A library of AI image-generation prompts for the splash/hero background. These are tuned to be **large, worldly, and atmospheric** — meant to sit *behind* text, so they read well when darkened, desaturated, or overlaid with a gradient.

## How to use these

- **Aspect ratio:** ask for `16:9` or `21:9` (ultra-wide) for desktop hero; `3:4` or `9:16` for a mobile variant.
- **Resolution:** request the largest the model allows (e.g. 2560×1440 or higher), then downscale.
- **Make it text-friendly:** most of these already specify negative space, muted tone, and a darkened/vignette look. If the model ignores that, append:
  > *"muted desaturated color grade, slightly darkened, soft vignette, generous empty negative space in the center-left for overlaid white text, no text or logos in the image, cinematic, high detail."*
- **Greyed-out trick:** if the raw output is too vibrant, add `desaturated, low saturation, faded film look, 30% opacity overlay of charcoal grey` — or just do it in CSS with a `filter: grayscale(40%) brightness(0.55)` and a dark gradient.
- **Negative prompt (where supported):** `text, watermark, logo, signature, busy clutter in center, oversaturated, lens flare blowout, distorted faces, extra limbs`.

---

## 1. Global / Map-Inspired (most on-theme for a "guess the language/place" game)

1. A vast antique world map rendered in muted sepia and slate-grey, soft topographic shading, faint compass roses and longitude lines, gently faded at the edges, cinematic low light, generous negative space, no text — a sense of exploration and discovery.

2. A glowing globe of softly connected light-points across every continent, network lines arcing between cities, deep navy-to-charcoal background, bokeh, desaturated and slightly darkened, room for a headline in the upper third.

3. Overhead satellite view of Earth at night, warm city lights scattered like constellations across dark continents, subtle cloud cover, muted contrast, cinematic and quiet, wide ultra-panoramic framing.

4. A weathered vintage map table: rolled parchment maps, a brass compass, faded ink coastlines, warm dim lamplight from one side, the rest in shadow, shallow depth of field, moody and scholarly.

5. Abstract topographic contour lines flowing across a dark slate canvas like a stylized terrain, thin luminous lines in muted teal and amber, minimal, lots of breathing room, elegant and modern.

6. A spinning globe frozen mid-motion, continents in soft grey relief, a thin band of golden light catching one edge, deep matte black surround, premium and understated.

## 2. Travel / Worldly Atmosphere

7. A montage-feel single frame of iconic world horizons blended into mist — distant rooftops, domes, towers, and ridgelines layered into a hazy panorama, desaturated dawn palette of grey-blue and pale gold, dreamlike, lots of sky for text.

8. A lone traveler silhouette on a hilltop overlooking an endless layered mountain range at dawn, heavy atmospheric haze, muted cool tones, vast empty sky, cinematic and aspirational.

9. Aerial drone shot over a patchwork of world landscapes stitched together — terraced fields, coastline, desert dunes, dense city grid — soft overcast light, faded color grade, sweeping and expansive.

10. A busy international airport departure board reimagined as soft abstract light, blurred destination names dissolving into bokeh, deep charcoal background, warm amber glints, motion and wanderlust without any legible text.

11. Old steamer-trunk travel collage feel: faded passport stamps, ticket stubs, and map fragments arranged loosely on dark weathered wood, dim warm light, vignette, nostalgic and worldly.

12. A panoramic sweep of rooftops at golden hour fading into grey fog — terracotta, stone, and slate roofs layered to the horizon, muted and soft, painterly, generous empty sky.

## 3. Language / Sound / Listening (ties to the game's listening mechanic)

13. Abstract visualization of sound waves rippling across a dark world map, glowing concentric circles emanating from points on different continents, muted teal and violet on near-black, elegant and minimal.

14. Soft floating speech-bubble and waveform shapes drifting over a faded globe, each a different muted hue, deep matte background, lots of negative space, calm and modern, no readable text.

15. A field of subtle audio waveforms layered like a horizon line, gradient from charcoal to deep indigo, faint golden peaks, minimalist, wide cinematic banner, plenty of room above for a title.

16. Stylized script characters from many writing systems dissolving into mist and light particles across a dark canvas — abstract, unreadable, beautiful, muted jewel tones, a sense of many languages becoming one.

17. A vintage radio dial and analog tuning needle glowing softly in the dark, warm amber backlight, blurred frequency markings, nostalgic, shallow focus, evocative of tuning in to the world.

## 4. Abstract / Texture (safest for text overlay)

18. A moody dark gradient mesh from deep teal to charcoal with faint topographic line textures and scattered soft light specks, ultra-minimal, premium app hero background, endless negative space.

19. Soft grainy film texture over a muted twilight gradient — slate blue, dusty rose, faded gold bands like a far-off horizon, no objects, calm and atmospheric, designed to sit behind white text.

20. Faded antique paper texture with the ghost of map coastlines and grid lines barely visible, warm grey tones, subtle vignette, tactile and scholarly, lots of clean space.

21. Deep navy night sky fading to charcoal at the base, faint constellation lines forming abstract continent shapes, sparse stars, quiet and expansive, room for a headline.

22. Liquid ink swirling in water — indigo, teal, and amber clouds blooming through dark space, desaturated and slow, abstract and worldly, generous empty regions for text.

## 5. Festive / Exciting (matches the "festive home redesign" vibe)

23. A celebratory burst of soft confetti-light and bokeh in muted jewel tones drifting across a dark globe, festive but restrained, slightly darkened, premium and joyful, no text.

24. Warm string-lights and lantern glow blurred into bokeh over a hazy world-rooftop silhouette at dusk, cozy and inviting, desaturated golden palette, lots of dark sky for a headline.

25. Fireworks reimagined as gentle light-trails arcing over a dark stylized world map, muted gold and rose sparks, atmospheric haze, exciting yet calm, ultra-wide.

26. An energetic but soft motion-blur of travel imagery — trains, planes, coastlines, crowds — swept into abstract streaks of muted color on a dark base, dynamic and worldly, cinematic.

---

## Quick-grab favorites (if you just want 3 to try first)

- **Most on-theme:** #1 (antique world map, sepia/slate) and #2 (glowing connected globe).
- **Easiest to overlay text on:** #18 and #19 (abstract gradients/textures).
- **Most "exciting/festive":** #23 and #25.

## Suggested CSS overlay (once you pick an image)

```css
.splash-hero {
  background: linear-gradient(
      rgba(15, 20, 30, 0.55),
      rgba(15, 20, 30, 0.75)
    ),
    url("/assets/splash-bg.jpg") center / cover no-repeat;
  filter: saturate(0.85);
}
```

Drop the image at full size, let the gradient + slight desaturation do the "greyed-out" work, and keep your headline in the lighter region of whichever composition you choose.
