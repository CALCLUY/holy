/* ============================================================
   HUNGRY HOLE — Depth / Biome progression
   The creature digs deeper. Every depth is a new underground
   world with its own light, life, food, mood and music.
   The hole never changes — only the world around it.
   ============================================================ */

export type BiomeKind =
  | "meadow" | "cave" | "crystal" | "lake" | "ruins" | "magma"
  | "heaven" | "abyss" | "frozen" | "jungle" | "library" | "star"
  | "void" | "cosmic";

export type MusicMood = "bright" | "mystic" | "calm" | "deep" | "danger" | "cosmic" | "heaven";
export type AmbientMode = "wind" | "cave" | "water" | "lava" | "void";

export interface BiomeDef {
  id: string;
  name: string;
  depth: number;            // 1-based main depth; secrets use 0
  kind: BiomeKind;
  mood: MusicMood;
  ambient: AmbientMode;
  sky: [string, string, string];
  ground: [string, string];
  groundLine: string;
  tint: string;             // rgba ambient light wash
  vignette: string;         // rgba vignette
  accent: string;           // glow accent color
  particle: { color: string; mode: "rise" | "fall" | "drift"; glow: boolean };
  foods: string[];          // biome-exclusive food ids
  mystery: number;          // 0..1 chance-weight of creature hints
  secret?: string;          // secret-room display name
  desc: string;
}

export const BIOMES: BiomeDef[] = [
  {
    id: "surface", name: "Surface Meadow", depth: 1, kind: "meadow", mood: "bright", ambient: "wind",
    sky: ["#54addd", "#91d9e8", "#e2f0c5"], ground: ["#6ab83a", "#4a8f2c"], groundLine: "#7ab85c",
    tint: "rgba(255,240,180,0)", vignette: "rgba(20,10,0,0.32)", accent: "#ffd75e",
    particle: { color: "#fff3c0", mode: "drift", glow: false }, foods: [], mystery: 0.02,
    desc: "Bright grass, bees and birdsong. Where it all began.",
  },
  {
    id: "mushroom", name: "Mushroom Cavern", depth: 2, kind: "cave", mood: "mystic", ambient: "cave",
    sky: ["#0a1830", "#12294a", "#1c3a5c"], ground: ["#2a4a5a", "#16303e"], groundLine: "#3a6a7a",
    tint: "rgba(60,140,220,0.10)", vignette: "rgba(4,10,24,0.5)", accent: "#5ad0e8",
    particle: { color: "#7ae0f0", mode: "drift", glow: true }, foods: ["glowshroom", "berry", "root", "glowfruit"],
    mystery: 0.06, desc: "Glowing caps, drifting spores, dripping stone.",
  },
  {
    id: "crystal", name: "Crystal Caverns", depth: 3, kind: "crystal", mood: "mystic", ambient: "cave",
    sky: ["#101038", "#1c1c5c", "#2c2a78"], ground: ["#3a3a7a", "#22224e"], groundLine: "#5a5aae",
    tint: "rgba(120,120,255,0.10)", vignette: "rgba(8,6,30,0.5)", accent: "#b8a0ff",
    particle: { color: "#d8c8ff", mode: "drift", glow: true }, foods: ["crystalfruit", "energyorb", "magicflower", "crystalapple"],
    mystery: 0.08, desc: "Singing shards that hum with old light.",
  },
  {
    id: "lake", name: "Underground Lake", depth: 4, kind: "lake", mood: "calm", ambient: "water",
    sky: ["#06202a", "#0c3a46", "#14586a"], ground: ["#1c5a66", "#0e3a44"], groundLine: "#2a7a8a",
    tint: "rgba(80,220,220,0.08)", vignette: "rgba(2,16,20,0.5)", accent: "#7af0e0",
    particle: { color: "#aef8f0", mode: "rise", glow: true }, foods: ["seaweed", "lotus", "pearl", "bluefruit"],
    mystery: 0.1, desc: "Still black water. Something large moves beneath.",
  },
  {
    id: "ruins", name: "Ancient Ruins", depth: 5, kind: "ruins", mood: "deep", ambient: "cave",
    sky: ["#1c1408", "#2e2210", "#4a3818"], ground: ["#5a4a2a", "#3a2e18"], groundLine: "#6a5836",
    tint: "rgba(255,180,80,0.07)", vignette: "rgba(20,12,2,0.55)", accent: "#ffb84d",
    particle: { color: "#e8c890", mode: "fall", glow: false }, foods: ["relic", "idol", "tome"],
    mystery: 0.14, desc: "Who built these halls… this far below the world?",
  },
  {
    id: "magma", name: "Magma Chamber", depth: 6, kind: "magma", mood: "danger", ambient: "lava",
    sky: ["#1a0602", "#3a0e04", "#5c1a06"], ground: ["#4a1a08", "#2a0e04"], groundLine: "#7a2a0c",
    tint: "rgba(255,110,40,0.10)", vignette: "rgba(30,6,0,0.55)", accent: "#ff7a2a",
    particle: { color: "#ff9a4a", mode: "rise", glow: true }, foods: ["lavaberry", "ashcake", "emberfruit"],
    mystery: 0.16, desc: "Rivers of fire. The dark below breathes heat.",
  },
  {
    id: "heaven", name: "The Heavens", depth: 7, kind: "heaven", mood: "heaven", ambient: "wind",
    sky: ["#7ec8f0", "#b8e2f8", "#fdf2d8"], ground: ["#f2ecdc", "#cfd8ea"], groundLine: "#fff8ea",
    tint: "rgba(255,240,200,0.10)", vignette: "rgba(120,150,200,0.28)", accent: "#ffd75e",
    particle: { color: "#fff6d8", mode: "drift", glow: true }, foods: ["sapdrop", "rootfruit"],
    mystery: 0.08, desc: "A floating sanctuary above the deep. Time stands still here.",
  },
  {
    id: "abyss", name: "The Abyss", depth: 8, kind: "abyss", mood: "deep", ambient: "void",
    sky: ["#020204", "#06060c", "#0a0a14"], ground: ["#14141e", "#0a0a10"], groundLine: "#22223a",
    tint: "rgba(80,80,140,0.05)", vignette: "rgba(0,0,4,0.7)", accent: "#8a8aff",
    particle: { color: "#9a9aff", mode: "drift", glow: true }, foods: ["voidfruit", "shadowberry"],
    mystery: 0.34, desc: "Almost total dark. Eyes. A heartbeat, far below.",
  },
  {
    id: "frozen", name: "Frozen Caverns", depth: 9, kind: "frozen", mood: "calm", ambient: "cave",
    sky: ["#0c1e30", "#1a3a52", "#2c5a78"], ground: ["#7ab8d8", "#4a8ab0"], groundLine: "#9ad8f0",
    tint: "rgba(160,220,255,0.08)", vignette: "rgba(4,14,26,0.5)", accent: "#b8ecff",
    particle: { color: "#ffffff", mode: "fall", glow: false }, foods: ["snowberry", "icemelon"],
    mystery: 0.2, desc: "Blue ice that remembers the surface sun.",
  },
  {
    id: "jungle", name: "Underground Jungle", depth: 10, kind: "jungle", mood: "mystic", ambient: "cave",
    sky: ["#08180c", "#103018", "#1a4a24"], ground: ["#2a6a34", "#184a22"], groundLine: "#3a8a44",
    tint: "rgba(120,255,160,0.07)", vignette: "rgba(2,14,6,0.55)", accent: "#6aff9a",
    particle: { color: "#a8ffb8", mode: "drift", glow: true }, foods: ["junglefruit", "vineberry"],
    mystery: 0.24, desc: "Life found a way down here. Loud, green life.",
  },
  {
    id: "library", name: "Ancient Library", depth: 11, kind: "library", mood: "deep", ambient: "cave",
    sky: ["#180e06", "#2a1a0c", "#3e2812"], ground: ["#4e3418", "#30200e"], groundLine: "#5e4424",
    tint: "rgba(255,200,120,0.07)", vignette: "rgba(18,10,2,0.55)", accent: "#ffd080",
    particle: { color: "#f0d8a8", mode: "fall", glow: false }, foods: ["bookcake", "inkberry"],
    mystery: 0.26, desc: "Shelves of forgotten things. Some pages are still warm.",
  },
  {
    id: "star", name: "Star Cavern", depth: 12, kind: "star", mood: "cosmic", ambient: "void",
    sky: ["#02020c", "#0a0a24", "#14143e"], ground: ["#24244e", "#14142e"], groundLine: "#3a3a6e",
    tint: "rgba(140,140,255,0.06)", vignette: "rgba(0,0,8,0.6)", accent: "#c8c8ff",
    particle: { color: "#ffffff", mode: "drift", glow: true }, foods: ["starberry", "mooncake"],
    mystery: 0.28, desc: "A sky buried underground. The stars blink back.",
  },
  {
    id: "void", name: "Void Garden", depth: 13, kind: "void", mood: "cosmic", ambient: "void",
    sky: ["#0c0214", "#180428", "#26083e"], ground: ["#2c1046", "#1a0828"], groundLine: "#3e1a5e",
    tint: "rgba(200,120,255,0.06)", vignette: "rgba(6,0,12,0.62)", accent: "#e0a0ff",
    particle: { color: "#f0c8ff", mode: "rise", glow: true }, foods: ["voidpetal"],
    mystery: 0.32, desc: "Flowers that grow from nothing, toward nothing.",
  },
  {
    id: "cosmic", name: "Cosmic Core", depth: 14, kind: "cosmic", mood: "cosmic", ambient: "void",
    sky: ["#08020e", "#180620", "#2e0a38"], ground: ["#3a1248", "#22082c"], groundLine: "#4e1a5e",
    tint: "rgba(255,120,220,0.07)", vignette: "rgba(8,0,10,0.6)", accent: "#ff8ae0",
    particle: { color: "#ffb8f0", mode: "rise", glow: true }, foods: ["cosmicore"],
    mystery: 0.4, desc: "A radioactive, shimmering core humming with raw space dust.",
  },
  {
    id: "heart", name: "The Heart of the World", depth: 15, kind: "cosmic", mood: "cosmic", ambient: "void",
    sky: ["#020004", "#0f010f", "#18031a"], ground: ["#140216", "#09010f"], groundLine: "#ff4a7a",
    tint: "rgba(255,40,90,0.11)", vignette: "rgba(12,0,16,0.72)", accent: "#ff3a6a",
    particle: { color: "#ff8aae", mode: "rise", glow: true }, foods: ["cosmicore"],
    mystery: 0.6, desc: "Everything is silent. You feel a slow, colossal heartbeat beneath you.",
  },
];

/* ---------- secret rooms (rare detours) ---------- */
export const SECRETS: BiomeDef[] = [
  {
    id: "vault", name: "Treasure Vault", depth: 0, kind: "ruins", mood: "deep", ambient: "cave",
    sky: ["#1c1408", "#3a2a0c", "#5c4410"], ground: ["#6a5424", "#463614"], groundLine: "#7a6230",
    tint: "rgba(255,215,94,0.12)", vignette: "rgba(24,16,2,0.5)", accent: "#ffd75e",
    particle: { color: "#ffe9a8", mode: "drift", glow: true }, foods: ["relic", "idol", "pearl"],
    mystery: 0.1, secret: "TREASURE VAULT", desc: "Gold older than the surface.",
  },
  {
    id: "dragon", name: "Sleeping Dragon", depth: 0, kind: "magma", mood: "danger", ambient: "lava",
    sky: ["#140404", "#2c0a08", "#48120c"], ground: ["#3e1410", "#240a08"], groundLine: "#5e2016",
    tint: "rgba(255,90,60,0.1)", vignette: "rgba(24,4,2,0.6)", accent: "#ff6a4a",
    particle: { color: "#ff8a5a", mode: "rise", glow: true }, foods: ["emberfruit", "lavaberry"],
    mystery: 0.5, secret: "SLEEPING DRAGON", desc: "Shhh. It is only dreaming.",
  },
  {
    id: "cathedral", name: "Crystal Cathedral", depth: 0, kind: "crystal", mood: "cosmic", ambient: "cave",
    sky: ["#0e0e30", "#1e1e58", "#34348a"], ground: ["#4646a0", "#2c2c66"], groundLine: "#6a6ac8",
    tint: "rgba(180,170,255,0.12)", vignette: "rgba(8,6,30,0.5)", accent: "#d8ccff",
    particle: { color: "#efe8ff", mode: "rise", glow: true }, foods: ["crystalfruit", "crystalapple", "energyorb"],
    mystery: 0.12, secret: "CRYSTAL CATHEDRAL", desc: "Every shard rings one held note.",
  },
];

/** Main-line biome for a 1-based depth. Past the authored list the
 *  descent continues forever through "Unknown Depths" that reuse
 *  kinds but grow darker and stranger. */
export function biomeAtDepth(depth: number): BiomeDef {
  if (depth <= BIOMES.length) return BIOMES[depth - 1];
  const base = BIOMES[((depth - 1) % BIOMES.length)];
  const tier = Math.floor((depth - 1) / BIOMES.length);
  return {
    ...base,
    id: `unknown-${depth}`,
    name: `Unknown Depth ${depth}`,
    depth,
    mystery: Math.min(0.5, base.mystery + tier * 0.04),
    desc: "No map goes this far. The creature does.",
  };
}

export const TOTAL_AUTHORED = BIOMES.length;

/* ============================================================
   DIRT PALETTES — the hole itself is recolored per biome so the
   creature's mouth always looks carved out of THIS world's earth.
   Same creature, same shape — only the soil changes.
   ============================================================ */

export interface DirtPalette {
  rim: string;       // dark lip right at the edge
  layers: string[];  // 5 strata, light → pitch black
  hi: string;        // sunlit far-wall highlight
  clump: string;     // broken rim clumps
  crack: string;     // radial dry cracks
}

const DIRT: Record<BiomeKind, DirtPalette> = {
  meadow:  { rim: "#3e240c", layers: ["#6a401c", "#502f10", "#351e06", "#1d1002", "#050200"], hi: "rgba(186,140,90,0.44)", clump: "#3a2010", crack: "rgba(28,14,6," },
  cave:    { rim: "#123040", layers: ["#2a5a6a", "#1e4452", "#143038", "#0c1c22", "#030808"], hi: "rgba(120,220,240,0.40)", clump: "#0e2632", crack: "rgba(8,26,34," },
  crystal: { rim: "#241a4a", layers: ["#463a86", "#342a68", "#241c4a", "#16102e", "#050208"], hi: "rgba(200,180,255,0.42)", clump: "#1e163e", crack: "rgba(18,12,40," },
  lake:    { rim: "#0a2e38", layers: ["#1c6070", "#14485a", "#0e3442", "#08222c", "#020a0e"], hi: "rgba(150,245,235,0.40)", clump: "#08262e", crack: "rgba(4,22,28," },
  ruins:   { rim: "#2e2010", layers: ["#6a5230", "#52401f", "#3a2c14", "#221a0c", "#060402"], hi: "rgba(255,200,120,0.40)", clump: "#281c0e", crack: "rgba(24,16,6," },
  magma:   { rim: "#2a0c04", layers: ["#6a2408", "#501a06", "#380f04", "#200802", "#060100"], hi: "rgba(255,150,70,0.45)", clump: "#240a04", crack: "rgba(255,90,20," },
  heaven:  { rim: "#a8b8d8", layers: ["#ffffff", "#e8eefa", "#c0cfe8", "#8fa3c8", "#4a5a80"], hi: "rgba(255,250,230,0.55)", clump: "#d8e2f4", crack: "rgba(160,175,210," },
  abyss:   { rim: "#0a0a16", layers: ["#1e1e34", "#161628", "#0e0e1c", "#080810", "#010104"], hi: "rgba(150,150,255,0.30)", clump: "#0a0a14", crack: "rgba(10,10,26," },
  frozen:  { rim: "#2a4a60", layers: ["#6a9ab8", "#52809c", "#3a6078", "#244050", "#08141c"], hi: "rgba(220,245,255,0.46)", clump: "#24425a", crack: "rgba(20,50,70," },
  jungle:  { rim: "#0e2410", layers: ["#2e5a2a", "#234620", "#1a3418", "#10200e", "#030802"], hi: "rgba(160,255,170,0.36)", clump: "#0c1e0e", crack: "rgba(8,22,8," },
  library: { rim: "#2a1a08", layers: ["#6a4a20", "#523818", "#3a2810", "#221808", "#060402"], hi: "rgba(255,208,128,0.40)", clump: "#241608", crack: "rgba(22,14,4," },
  star:    { rim: "#14143a", layers: ["#2e2e6a", "#242452", "#1a1a3a", "#101024", "#020208"], hi: "rgba(200,200,255,0.36)", clump: "#121232", crack: "rgba(12,12,40," },
  void:    { rim: "#200a30", layers: ["#4a1c66", "#3a1450", "#280e38", "#180820", "#040108"], hi: "rgba(224,160,255,0.38)", clump: "#1c0828", crack: "rgba(24,6,38," },
  cosmic:  { rim: "#2a0a28", layers: ["#5c1a52", "#481440", "#340e2e", "#20081c", "#050106"], hi: "rgba(255,170,235,0.40)", clump: "#240822", crack: "rgba(30,6,28," },
};

export function dirtPalette(kind: BiomeKind): DirtPalette {
  return DIRT[kind] ?? DIRT.meadow;
}
