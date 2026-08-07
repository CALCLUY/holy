# HUNGRY HOLE — Asset Specification

Everything is drawn procedurally today (pixel grids in `src/game/sprites.ts`,
vector-ish canvas in `src/game/world.ts` / `src/game/engine.ts`). This document
defines exact sizes, pivots and naming so any asset can be replaced by
hand-authored pixel art without touching gameplay code.

## Rendering target

| Setting | Value |
|---|---|
| Internal resolution | 640 × 360 (16:9) |
| Scale factor | ×2–×3 integer (CSS, `image-rendering: pixelated`) |
| Pixels-per-art-pixel | 2 (sprites authored at 12 px read as 24 px) |
| Target FPS | 60 |
| Palette | 16-bit era: warm darks `#40240f`, saturated midtones, cream highlights `#ffe9a8` |

## Sprite sheet contract (`src/game/sprites.ts` → `SPRITES`)

| Field | Spec |
|---|---|
| Grid | 12 × 8–13 px per sprite, char-per-pixel |
| Pivot | CENTER (foods), CENTER-bottom (hole/creature) |
| Outline | 1 px, per-sprite dark (warm brown `#40240f`, cold `#1c3a5e`, junk `#2a3a1c`) |
| Highlight | 1–2 px top-left (`w`) |
| Shading | 3 tones minimum: light / mid / dark |
| File convention | `spr_<id>.png` (e.g. `spr_goldenapple.png`) |
| Bake scale | drawn via `drawImage` with smoothing OFF |

### Food sprite IDs (value)
cherry +1 · grape +1 · candy +1 · apple +2 · carrot +2 · egg +2 · cookie +3 ·
donut +3 · cheese +3 · mushroom +3 · bread +5 · honey +5 · pie +5 · milk +5 ·
starfruit +8 · gem +8 · fish +8 · crystal +10 · watermelon +10 · cake +15 ·
pumpkin +15 · moldybread −2 · sourmilk −3 · rottenfish −5 · goldenapple +8✨ ·
mysterybox ? · rainbowfruit ≈ · chili ×2 · magnet 🧲 · clock ⏱ · icecube ❄ ·
clover 🍀 · bombpepper 💣 · meteor ☄️ (event hazard)

## Layer order (back → front)

1. Sky gradient / sun / moon / stars — 0–280
2. Clouds (parallax, 2 depths) — 0–120
3. Far hills (parallax 0.4) — base 296
4. Near hills (parallax 0.7) — base 296
5. Trees — base 296
6. Ground + grass strip — 296+
7. Ground deco (flowers, mushrooms, pebbles) — 296–330
8. Grass blades (sway + hunger bend) — 296±
9. Food shadows — ground plane
10. Falling food + value chips — sky
11. Hole mound (cracks, roots) — center 320, 262
12. Hole mouth (dark gradient, rim, grass overhang)
13. Eyes (deep in mouth, blink/look/moods)
14. Aura + particles + floating text
15. Vignette / night tint / event overlays

## Creature (hole) states — animation spec

| State | Frames | Notes |
|---|---|---|
| Idle breathing | 8 | 1.05 s loop, subtle scale |
| Blink | 2 | every 2–5.5 s, 0.16 s |
| Hungry (shrink) | 6 | grass bends in, cracks widen |
| Happy / perfect | 10 | golden aura pulse, ∪-eyes, ground pulse |
| Overfed | 8 | stretched mouth, wide eyes, jitter |
| Starving | 6 | slits, dry cracks, tiny shake, heartbeat |
| Burp | 8 | puff ring, dust, 0.65 s |
| Scared | 4 | wide eyes + ring |
| Death | 12 | closes over 2.6 s, eyes fade |
| Menu peek | 6 | eyes rise from dark |

Mouth radius formula: `30 + 26 × sizePct` (sizePct 1 → r 56 px).

## UI kit (HTML/CSS, `src/index.css`)

- Font: **Press Start 2P** (fallback monospace), sizes 5–34 px
- Panels: `.panel-wood` (plank gradient + dashed inner border), `.panel-dark`
- Buttons: `.btn-pixel` + color mods (gold/green/red/blue/purple/brown/ghost),
  3 px border + 4 px chunky bottom shadow
- Corners: square (no rounding) for the whole game

## Audio (fully procedural, `src/game/audio.ts`)

| Asset | Synth recipe |
|---|---|
| Pickup | square pluck, pentatonic by value (523–1319 Hz) |
| Perfect | 5-note triangle arp + highpass sparkle |
| Burp | saw 170→45 Hz + lowpassed noise, double puff |
| Growl / sad / scared | low saw slides, minor sine |
| Music | 32-step sequencer, C-major pentatonic, 4 layers (bass/pad → hats → melody → drums) unlocked by combo tier 0–4 |
| Ambient | looping filtered noise wind + random bird chirps |

## Replacement checklist (if hand-drawn art arrives)

- [ ] 35 food sprites, 12 px, centered, outlined
- [ ] Hole mound sprite (120 px wide) + mouth darkness sprite + eye sprites (4 moods)
- [ ] Grass blade 2 px, flower/mushroom/pebble 8 px
- [ ] Cloud 40 px, butterfly 8 px, bee 6 px, bird 8 px, leaf 4 px
- [ ] UI: wooden panel 9-slice 24 px, 6 button skins
- [ ] 10 event banners (text + icon)
- [ ] Audio: replace `tone()`/`noise()` calls with sample triggers (same API surface)
