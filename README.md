# ✦ EVERYWHEN — Finance, terraformed

A FinTech landing page built as a surreal, scroll-driven 3D world instead of a dashboard.
You don't read feature sections — you travel through them.

## The journey

| Progress | Chapter | World event | Product story |
|---|---|---|---|
| 0% | **Arrival** | Dusk over the valley, floating islands | Brand promise |
| 25% | **Grow** | Teal dawn, crystal terraces bloom | 4.2% APY savings |
| 48% | **Flow** | Deep night, the luminous river pulses | Instant global payments |
| 70% | **Guard** | Aurora over the obsidian Citadel | Custody & insurance |
| 96% | **Ascend** | Sunrise above the clouds | CTA |

## How it works

- **Single Three.js scene, fully procedural** — terrain from fBm value noise carved
  along a winding valley centerline (`pathX`), vertex-colored and flat-shaded for a
  painterly look. No model or texture files; gradients are generated on `<canvas>`.
- **Scroll = camera dolly.** Page scroll maps to a `CatmullRomCurve3` camera path plus
  a separate look-target path; the value is exponentially smoothed so the ride feels
  like flight, with mouse parallax sway on top.
- **Mood engine.** Five color palettes (sky, fog, lights, sun, stars) are lerped by
  scroll progress, so each chapter has its own time-of-day.
- **Living world.** Instanced birds with shader-flapped wings, three sky mantas on a
  closed loop with banking turns, bobbing islands, pulsing crystals, 400+ fireflies,
  an animated aurora and a flowing river of light (additive tube shaders).
- **DOM overlay storytelling.** Oversized Unbounded type fades/slides per chapter;
  a progress rail and nav links scroll-to-anchor; "Watch the flight" auto-pilots
  the whole journey in ~40s (cancelled by any user input).

## Run

Any static server works:

```sh
python3 -m http.server 8741 --directory everywhen
# open http://localhost:8741
```

Three.js r170 is loaded from the jsDelivr CDN via an import map — no build step.
