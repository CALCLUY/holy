/* ============================================================
   HUNGRY HOLE — Sprites & Food Database
   Every sprite is hand-authored pixel art (string grids mapped
   through per-sprite palettes) and baked into offscreen canvases
   at boot. Draw them scaled with imageSmoothing off for that
   crisp 16-bit look. Swapping art later = swap the grids.
   ============================================================ */

export type FoodType = "fruit" | "sweet" | "veggie" | "dairy" | "grain" | "protein" | "treasure" | "junk";
export type SpecialKind =
  | "golden" | "rotten" | "mystery" | "rainbow" | "chili" | "magnet"
  | "clock" | "ice" | "clover" | "bomb" | "meteor" | null;

export interface FoodDef {
  id: string;
  name: string;
  value: number;
  weight: number; // spawn weight (0 = never spawns naturally)
  type: FoodType;
  special: SpecialKind;
  desc: string;
  scale: number; // draw scale vs default
  spin: boolean; // slowly rotates while falling
  glow?: string; // additive glow color behind sprite
  biomes?: string[]; // biome-exclusive; undefined = universal
}

/* ---------- sprite grids ---------- */

interface Spr {
  p: Record<string, string>;
  g: string[];
}

const SPRITES: Record<string, Spr> = {
  cherry: {
    p: { o: "#40240f", a: "#e84a3a", w: "#ffb3a0", s: "#7a2418" },
    g: [
      "...o..o.....",
      "..oa..oa....",
      "..oa..oa....",
      "..oa..oa....",
      ".oaaao.aaao.",
      ".oaaao.aaao.",
      ".oaawao.aaao",
      ".oaaao.aaao.",
      "..oaa..oaa..",
      "...o....o...",
    ],
  },
  grape: {
    p: { o: "#40240f", a: "#9a5fd4", w: "#d9b8f5", d: "#6f3aa8" },
    g: [
      "....o..o....",
      "...oao.o....",
      "...oaao.o...",
      "..oaaaao.o..",
      "..oaaaaao...",
      ".oaaaaaaao..",
      ".oaaaaaaao..",
      ".oawaaaaaao.",
      "oaaaaaaaao..",
      "oadaaaaaao..",
      ".oadaaaaao..",
      "..ooooooo...",
    ],
  },
  candy: {
    p: { o: "#40240f", a: "#f060a0", w: "#ffc2e0", d: "#c23878" },
    g: [
      ".o.......o..",
      "oao.....oao.",
      "oabo...oabo.",
      "oaboo.ooabo.",
      ".oabooobo...",
      "..oaaaaao...",
      ".oawaaaa o..",
      "oabooobo....",
      "oabo...oabo.",
      "oao.....oao.",
      ".o.......o..",
    ],
  },
  apple: {
    p: { o: "#40240f", a: "#e84a3a", w: "#ffb3a0", d: "#a0261c", g: "#58a826" },
    g: [
      ".....o......",
      "....oo......",
      "...og.o.....",
      "...og.o.....",
      "...o.o......",
      "..oaaaaao..",
      ".oaaaaaaao.",
      ".oaaawaaaao.",
      ".oaaaaaaaao.",
      ".oadaaaaaao.",
      "..oadaaaao..",
      "...oooooo...",
    ],
  },
  carrot: {
    p: { o: "#40240f", a: "#f28c28", w: "#ffd9a0", d: "#c96a12", g: "#58a826" },
    g: [
      "..g.........",
      ".g.g........",
      ".g.g........",
      ".o.o........",
      ".oa.o.......",
      ".oaa.o......",
      ".oaaa.o.....",
      ".oaaaa.o....",
      "..oaaaa.o...",
      "...oaaaa.o..",
      "....ooooo...",
    ],
  },
  egg: {
    p: { o: "#40240f", a: "#f8f4ec", w: "#ffffff", d: "#cfc6b0" },
    g: [
      "...ooooo....",
      "..oaaaaao...",
      ".oawaaaaao..",
      ".oaaaaaaao.",
      ".oaaaaaaao.",
      ".oadaaaaao.",
      "..oadaaaao..",
      "...ooooo....",
    ],
  },
  cookie: {
    p: { o: "#40240f", a: "#c99a6b", w: "#ffe9c8", d: "#8a5a2c", c: "#4a2c12" },
    g: [
      "...oooooo...",
      "..oaaaaao..",
      ".oaawacaaao.",
      ".oacaaacaa o.",
      ".oaaacaaaco.",
      ".oaaacaaaao.",
      ".oacaaaaaao.",
      "..oaaaaao..",
      "...ooooo....",
    ],
  },
  donut: {
    p: { o: "#40240f", a: "#a5713f", i: "#ff9ec8", t: "#ffe9c8", s: "#58a826", w: "#ffffff" },
    g: [
      "...oooooo...",
      "..oaiiiio...",
      ".oaisiaiso..",
      ".oaiiitiao..",
      ".oaattttao..",
      ".oaattttao..",
      ".oaaaaaaao.",
      "..oaaaaao..",
      "...ooooo....",
    ],
  },
  cheese: {
    p: { o: "#40240f", a: "#ffd75e", w: "#fff3c0", d: "#e0a020", h: "#c98a3a" },
    g: [
      "...ooooo.....",
      "..oaaaaao...",
      ".oahaaaaao..",
      ".oaaaaaaao..",
      ".oadaaaaao..",
      "..oadaaaa o..",
      "...oadaao....",
      "....oado.....",
      ".....oo......",
    ],
  },
  mushroom: {
    p: { o: "#40240f", a: "#e84a3a", w: "#ffffff", d: "#a0261c", b: "#f0e0c0" },
    g: [
      ".....oo.....",
      "...ooaaoo...",
      ".oaaaaaaao..",
      ".oawaaaaao..",
      ".oaaaaawao..",
      ".oadaaaaao..",
      "..ooooooo...",
      "....oaao....",
      "....oabo....",
      ".....oo.....",
    ],
  },
  bread: {
    p: { o: "#40240f", a: "#e8b860", w: "#ffe9a8", d: "#b07a28", h: "#8a5a1c" },
    g: [
      "....ooooo...",
      "..oaaaaao...",
      ".oahaaaaao..",
      ".oaaaaaaao..",
      ".oaaaaaaao..",
      ".oaaaaaaao..",
      ".oahaaaaao..",
      ".oadaaaaao..",
      "..oooooooo..",
    ],
  },
  honey: {
    p: { o: "#40240f", a: "#ffb31a", w: "#ffe9a8", d: "#c97f0e", l: "#f8f4ec", c: "#8a5a2c" },
    g: [
      ".....oo.....",
      "....occo....",
      "....occo....",
      "...oaaaa o..",
      ".oaaaaaaao..",
      ".oaawaaaaao.",
      ".oaaaaaaaao.",
      ".oadaaaaaao.",
      ".oaaallaaao.",
      "..oaddddddo.",
      "...oooooo...",
    ],
  },
  pie: {
    p: { o: "#40240f", a: "#e8b860", w: "#ffe9a8", d: "#b07a28", h: "#c23878" },
    g: [
      "...oooooo...",
      "..oaaaaao...",
      ".oaahhhaao.",
      ".oahhahhao.",
      ".oahhahhao.",
      ".oahhhaaao.",
      ".oadaaaaao.",
      "..ooooooo...",
    ],
  },
  milk: {
    p: { o: "#1c3a5e", a: "#f8f4ec", w: "#ffffff", d: "#cfc6b0", c: "#4aa8e8" },
    g: [
      "....occc....",
      "...occco....",
      "...occco....",
      "...occco....",
      "..oaaaaao...",
      ".oaaaaaaao..",
      ".oawaaaaao..",
      ".oaaaaaaao..",
      ".oaaaaaaao..",
      ".oaaaaaaao..",
      "..oadaaaao.",
      "...oooooo...",
    ],
  },
  starfruit: {
    p: { o: "#40240f", a: "#ffd75e", w: "#fff8d0", d: "#e8a020" },
    g: [
      ".....o......",
      "....oao.....",
      "....oao.....",
      "....oao.....",
      "..o.ooo.o...",
      ".oaaaaaaao..",
      ".oaaaaaaao..",
      "..oaawaaao..",
      "...oaaaaao..",
      "....oaao....",
      ".....oo.....",
    ],
  },
  gem: {
    p: { o: "#1c3a5e", a: "#4aa8e8", w: "#c8ecff", d: "#2a74b4" },
    g: [
      ".....oo.....",
      "....oaao....",
      "...oaaaao...",
      "..oaaaaaao..",
      ".oaaaaaaao..",
      ".oaaawaaaao.",
      ".oadaaaaao..",
      "..oadaaaao..",
      "...oadaao...",
      "....oado....",
      ".....oo.....",
    ],
  },
  fish: {
    p: { o: "#1c3a5e", a: "#4aa8e8", w: "#ffffff", d: "#2a74b4" },
    g: [
      "..oooooo....",
      ".oaaaaaaao..",
      ".oawaaaaaao.",
      "oaaaaaaaaoo.",
      ".oadaaaaaoo.",
      "..oadaaaaoo.",
      "...ooooooo..",
    ],
  },
  crystal: {
    p: { o: "#2a1c40", a: "#c99aef", w: "#f0e0ff", d: "#7a3ab0" },
    g: [
      ".....o......",
      "....oaoo....",
      "...oaaoo....",
      "..oaaao.o...",
      ".oaaaaooao..",
      ".oaawaaaoao.",
      ".oaaaaaoao..",
      ".oaaaaaoao..",
      "..oaaaooao..",
      "...oaooao...",
      "....ooo.....",
    ],
  },
  watermelon: {
    p: { o: "#40240f", a: "#ff8a7a", w: "#ffc0b0", g: "#3f8f1a", d: "#2a5e10", k: "#2a1c10" },
    g: [
      "..oooooooo..",
      ".oaggggggao.",
      "oagrrrrrrgao",
      "oagrrkrrrgao",
      "oagrrrrkrgao",
      ".oagrrrrgao.",
      "..oagggggao.",
      "...ooooooo..",
    ],
  },
  cake: {
    p: { o: "#40240f", a: "#f8f4ec", w: "#ffffff", i: "#ff9ec8", d: "#d8c8b0", c: "#e84a3a", y: "#ffd75e" },
    g: [
      ".....o......",
      "....oyo.....",
      "....oyo.....",
      "....oyo.....",
      "....ooo.....",
      "...oacao....",
      "..oaaaaaao..",
      ".oaiiiiiio..",
      ".oaaaaaaaao.",
      ".oaiiiiiio..",
      ".oadaaaaao..",
      "..oooooooo..",
    ],
  },
  pumpkin: {
    p: { o: "#40240f", a: "#f28c28", w: "#ffd9a0", d: "#c96a12", g: "#3f8f1a" },
    g: [
      "....og......",
      "....og......",
      "...oaaaao...",
      "..oaadaao...",
      ".oaadaaaao..",
      ".oaadaaaaao.",
      ".oaawadaaao.",
      ".oadadaaaao.",
      ".oadadaaaao.",
      "..oadadaao..",
      "...oooooo...",
    ],
  },
  moldybread: {
    p: { o: "#2a3a1c", a: "#a8b06a", m: "#4a7a2a", d: "#7a8a4a", w: "#e0e8c0" },
    g: [
      "....ooooo...",
      "..oaaaaao...",
      ".oamamaaao.",
      ".oaaaaamaao.",
      ".oamaaaaaao.",
      ".oaaaaamaao.",
      ".oadaaaaao.",
      "..oooooooo..",
    ],
  },
  sourmilk: {
    p: { o: "#2a3a1c", a: "#b8c878", w: "#e8f0c0", d: "#8a9a4a", c: "#5a7a2a" },
    g: [
      "....occc....",
      "...occco....",
      "...occco....",
      "...occco....",
      "..oaaaaao...",
      ".oaaawaao...",
      ".oaaaaaaao..",
      ".oaaaawaaao.",
      ".oaawaaaaao.",
      "..oadaaaaao.",
      "...oooooo...",
    ],
  },
  rottenfish: {
    p: { o: "#2a3a1c", a: "#9aa878", m: "#4a7a2a", d: "#6a7a4a", w: "#d8e0b0" },
    g: [
      "...o..o.....",
      "..oao.oao...",
      "..oooooo....",
      ".oaaaaaaao..",
      ".oamaaaaaao.",
      "oaaaaaaaao..",
      ".oadaaaaaao.",
      "..oadaaaaoo.",
      "...ooooooo..",
    ],
  },
  goldenapple: {
    p: { o: "#5a3a08", a: "#ffb31a", w: "#fff8d0", d: "#c97f0e", g: "#3f8f1a" },
    g: [
      ".....o......",
      "....oo......",
      "...og.o.....",
      "...og.o.....",
      "...o.o......",
      "..oaaaaao..",
      ".oaaawaaao.",
      ".oawaaaaao.",
      ".oaaaaaaaao.",
      ".oadaaaaaao.",
      "..oadaaaao..",
      "...oooooo...",
    ],
  },
  mysterybox: {
    p: { o: "#40240f", a: "#a5713f", w: "#e8c890", d: "#6a3f1c", r: "#e84a3a", q: "#ffd75e" },
    g: [
      "...oooooo...",
      "..oabbbbao..",
      ".oabbrbbbao.",
      ".oabbrbbbao.",
      ".oabbrbbbao.",
      ".oa?rrr?bao.",
      ".oabbrbbbao.",
      ".oabbrbbbao.",
      ".oaddrrddao.",
      "..oooooooo..",
    ],
  },
  rainbowfruit: {
    p: { o: "#40240f", a: "#e84a3a", n: "#f28c28", y: "#ffd75e", g: "#58a826", b: "#4aa8e8", w: "#ffffff" },
    g: [
      ".....o......",
      "....oo......",
      "...og.......",
      "...o........",
      "..oaaaaao..",
      ".oaaaaaaao..",
      ".onnnnnnnao.",
      ".oyyyyyyyao.",
      ".ogggggggao.",
      ".obbbbbbbao.",
      "..obbbbbao..",
      "...oooooo...",
    ],
  },
  chili: {
    p: { o: "#40240f", a: "#e84a3a", w: "#ffb3a0", d: "#a0261c", g: "#3f8f1a" },
    g: [
      "....oo......",
      "...ogo......",
      "...ogo......",
      "..oaaao.....",
      ".oaaaaao....",
      ".oaaaaao....",
      "oaaaawao....",
      "oaaaaao.....",
      ".oaaaao.....",
      "..oaaao.....",
      "...oao......",
    ],
  },
  magnet: {
    p: { o: "#40240f", a: "#e84a3a", w: "#ffffff", d: "#a0261c" },
    g: [
      "ow......wo..",
      "oao....oao..",
      "oao....oao..",
      "oao....oao..",
      "oao....oao..",
      ".oao..oao...",
      "..oao.oao...",
      "...oaaoao...",
      "....oao.....",
      ".....o......",
    ],
  },
  clock: {
    p: { o: "#5a3a08", a: "#ffd75e", w: "#fff8d0", d: "#c97f0e", h: "#40240f" },
    g: [
      ".....oo.....",
      "....oaao....",
      "...oaaaao...",
      "..oaaaaaao..",
      ".oaawaaaa o.",
      ".oaaahaaaa o.",
      ".oaaaahaaa o.",
      ".oadaaaaaao.",
      "..oadaaaao..",
      "...oaaaao...",
      "....ooo.....",
    ],
  },
  icecube: {
    p: { o: "#1c3a5e", a: "#8fd3ff", w: "#ffffff", d: "#4a90c8" },
    g: [
      "..oooooo....",
      ".oaaaaaao...",
      "oaaawaaaao..",
      "oaaaaaaaao..",
      "oaaaadaaaao.",
      "oaaaaaaaao..",
      ".oadaaaaao..",
      "..oadaaao...",
      "...oooooo...",
    ],
  },
  clover: {
    p: { o: "#2a4a14", a: "#58a826", w: "#a8e05a", d: "#3f8f1a" },
    g: [
      "..o....o....",
      ".oa....ao...",
      ".oa....ao...",
      ".oa....ao...",
      "..o....o....",
      "...o..o.....",
      "....oo......",
      "....oa......",
      ".....o......",
    ],
  },
  bombpepper: {
    p: { o: "#2a1410", a: "#8a2a1c", w: "#ffd75e", d: "#5a180e", g: "#3f8f1a" },
    g: [
      "....o.......",
      "...owo......",
      "...o.o......",
      "..oao.......",
      ".oaaao......",
      ".oaaaaao....",
      "oaaadaaao...",
      "oaaaaaao....",
      "oaaaaaao....",
      ".oaaaaao....",
      "..oaaao.....",
      "...ooo......",
    ],
  },
  meteor: {
    p: { o: "#241210", a: "#6a4a3a", w: "#ffd75e", d: "#3a2a20", f: "#ff8a3a" },
    g: [
      "....o.......",
      "...ooo......",
      "..oaaao.....",
      ".oadadaao...",
      ".oaaaaaao...",
      ".oadadaao...",
      "..oaaao.....",
      "..ofoo......",
      ".offo.......",
      ".oo.........",
    ],
  },
};

/* ---------- food database ---------- */

export const FOODS: FoodDef[] = [
  { id: "cherry", name: "Cherry", value: 1, weight: 18, type: "fruit", special: null, desc: "Tiny & sweet. Great for fine-tuning.", scale: 0.85, spin: false },
  { id: "grape", name: "Grape", value: 1, weight: 16, type: "fruit", special: null, desc: "A little bundle of one.", scale: 0.85, spin: false },
  { id: "candy", name: "Candy", value: 1, weight: 14, type: "sweet", special: null, desc: "One point of pure sugar.", scale: 0.85, spin: true },
  { id: "apple", name: "Apple", value: 2, weight: 16, type: "fruit", special: null, desc: "A crisp classic.", scale: 1, spin: false },
  { id: "carrot", name: "Carrot", value: 2, weight: 14, type: "veggie", special: null, desc: "Crunchy. The hole loves it.", scale: 1, spin: false },
  { id: "egg", name: "Egg", value: 2, weight: 12, type: "dairy", special: null, desc: "Farm fresh.", scale: 1, spin: false },
  { id: "cookie", name: "Cookie", value: 3, weight: 13, type: "sweet", special: null, desc: "Three points of comfort.", scale: 1, spin: false },
  { id: "donut", name: "Donut", value: 3, weight: 10, type: "sweet", special: null, desc: "Glazed happiness.", scale: 1, spin: true },
  { id: "cheese", name: "Cheese", value: 3, weight: 10, type: "dairy", special: null, desc: "Aged to perfection.", scale: 1, spin: false },
  { id: "mushroom", name: "Mushroom", value: 3, weight: 9, type: "veggie", special: null, desc: "Grown in the meadow.", scale: 1, spin: false },
  { id: "bread", name: "Bread", value: 5, weight: 11, type: "grain", special: null, desc: "Freshly baked.", scale: 1.1, spin: false },
  { id: "honey", name: "Honey", value: 5, weight: 8, type: "sweet", special: null, desc: "Sticky gold.", scale: 1.05, spin: false },
  { id: "pie", name: "Pie", value: 5, weight: 7, type: "sweet", special: null, desc: "Homemade, still warm.", scale: 1.05, spin: false },
  { id: "milk", name: "Milk", value: 5, weight: 8, type: "dairy", special: null, desc: "Extra creamy.", scale: 1, spin: false },
  { id: "starfruit", name: "Star Fruit", value: 8, weight: 5, type: "fruit", special: null, desc: "Rare and radiant.", scale: 1, spin: true },
  { id: "gem", name: "Gem", value: 8, weight: 4, type: "treasure", special: null, desc: "Shiny! 8 points.", scale: 1, spin: true },
  { id: "fish", name: "Fish", value: 8, weight: 5, type: "protein", special: null, desc: "Grilled to perfection.", scale: 1.1, spin: false },
  { id: "crystal", name: "Crystal", value: 10, weight: 3, type: "treasure", special: null, desc: "Powerful snack.", scale: 1, spin: true },
  { id: "watermelon", name: "Watermelon", value: 10, weight: 3, type: "fruit", special: null, desc: "A big juicy ten.", scale: 1.15, spin: false },
  { id: "cake", name: "Cake", value: 15, weight: 2, type: "sweet", special: null, desc: "The big one. Handle with care!", scale: 1.15, spin: false },
  { id: "pumpkin", name: "Pumpkin", value: 15, weight: 2, type: "veggie", special: null, desc: "Huge and heavy.", scale: 1.15, spin: false },
  { id: "moldybread", name: "Moldy Bread", value: -2, weight: 3, type: "junk", special: null, desc: "Yuck. Removes 2.", scale: 1.05, spin: false },
  { id: "sourmilk", name: "Sour Milk", value: -3, weight: 2, type: "junk", special: null, desc: "Questionable. Removes 3.", scale: 1, spin: false },
  { id: "rottenfish", name: "Rotten Fish", value: -5, weight: 2, type: "junk", special: null, desc: "Toxic! Removes 5. (Useful!)", scale: 1.1, spin: false },
  { id: "goldenapple", name: "Golden Apple", value: 8, weight: 1.2, type: "fruit", special: "golden", desc: "Huge bonus score!", scale: 1.1, spin: false, glow: "#ffd75e" },
  { id: "mysterybox", name: "Mystery Box", value: 0, weight: 1.2, type: "treasure", special: "mystery", desc: "Random value −5…+15!", scale: 1.05, spin: true },
  { id: "rainbowfruit", name: "Rainbow Fruit", value: 0, weight: 0.9, type: "fruit", special: "rainbow", desc: "Copies the last value!", scale: 1.05, spin: false, glow: "#ff9ec8" },
  { id: "chili", name: "Chili Pepper", value: 0, weight: 0.9, type: "veggie", special: "chili", desc: "Doubles the NEXT catch!", scale: 1, spin: false, glow: "#ff8a3a" },
  { id: "magnet", name: "Magnet", value: 0, weight: 0.8, type: "treasure", special: "magnet", desc: "Pulls food toward you!", scale: 1.05, spin: false, glow: "#ff8a7a" },
  { id: "clock", name: "Clock", value: 0, weight: 0.7, type: "treasure", special: "clock", desc: "Slows time briefly.", scale: 1, spin: false, glow: "#ffe066" },
  { id: "icecube", name: "Ice Cube", value: 0, weight: 0.7, type: "treasure", special: "ice", desc: "Freezes falling food!", scale: 1, spin: true, glow: "#8fd3ff" },
  { id: "clover", name: "Lucky Clover", value: 0, weight: 0.7, type: "veggie", special: "clover", desc: "3 catches = double score!", scale: 1, spin: false, glow: "#a8e05a" },
  { id: "bombpepper", name: "Bomb Pepper", value: 0, weight: 0.6, type: "veggie", special: "bomb", desc: "Blasts nearby food away!", scale: 1, spin: false, glow: "#ff8a3a" },
  { id: "meteor", name: "Meteor", value: -6, weight: 0, type: "junk", special: "meteor", desc: "Dodge it!", scale: 1, spin: true, glow: "#ff8a3a" },
  // ---- DEPTH 2 · Mushroom Cavern ----
  { id: "glowshroom", name: "Glow Shroom", value: 3, weight: 10, type: "veggie", special: null, desc: "It glows faintly. Tastes like rain.", scale: 1, spin: false, glow: "#5ad0e8", biomes: ["mushroom"] },
  { id: "berry", name: "Cave Berry", value: 2, weight: 12, type: "fruit", special: null, desc: "Grown without sun, sweet anyway.", scale: 0.85, spin: false, biomes: ["mushroom"] },
  { id: "root", name: "Deep Root", value: 2, weight: 10, type: "veggie", special: null, desc: "Crunchy. Earthy. Ancient.", scale: 1, spin: false, biomes: ["mushroom"] },
  { id: "glowfruit", name: "Glow Fruit", value: 5, weight: 6, type: "fruit", special: null, desc: "Lights the way down.", scale: 1, spin: false, glow: "#4ae0c8", biomes: ["mushroom"] },
  // ---- DEPTH 3 · Crystal Caverns ----
  { id: "crystalfruit", name: "Crystal Fruit", value: 8, weight: 5, type: "fruit", special: null, desc: "Chimes when bitten.", scale: 1, spin: true, glow: "#8ad8ff", biomes: ["crystal"] },
  { id: "energyorb", name: "Energy Orb", value: 5, weight: 6, type: "treasure", special: null, desc: "Pure humming light.", scale: 0.95, spin: true, glow: "#6aff9a", biomes: ["crystal"] },
  { id: "magicflower", name: "Magic Flower", value: 3, weight: 9, type: "fruit", special: null, desc: "Blooms once a century.", scale: 1, spin: false, biomes: ["crystal"] },
  { id: "crystalapple", name: "Crystal Apple", value: 10, weight: 3, type: "fruit", special: null, desc: "Cold, sharp, wonderful.", scale: 1.05, spin: false, glow: "#9ad8ff", biomes: ["crystal"] },
  // ---- DEPTH 4 · Underground Lake ----
  { id: "seaweed", name: "Glow Weed", value: 2, weight: 11, type: "veggie", special: null, desc: "Salty. Sways on its own.", scale: 1, spin: false, biomes: ["lake"] },
  { id: "lotus", name: "Cave Lotus", value: 5, weight: 6, type: "fruit", special: null, desc: "Floats upward, always.", scale: 1, spin: false, glow: "#ffd0e8", biomes: ["lake"] },
  { id: "pearl", name: "Pearl", value: 10, weight: 3, type: "treasure", special: null, desc: "The lake's kept secret.", scale: 0.95, spin: true, glow: "#e8f4ff", biomes: ["lake"] },
  { id: "bluefruit", name: "Blue Fruit", value: 3, weight: 10, type: "fruit", special: null, desc: "Tastes like cold water.", scale: 1, spin: false, biomes: ["lake"] },
  // ---- DEPTH 5 · Ancient Ruins ----
  { id: "relic", name: "Golden Relic", value: 10, weight: 4, type: "treasure", special: null, desc: "A king's breakfast, once.", scale: 1, spin: true, glow: "#ffd75e", biomes: ["ruins", "vault"] },
  { id: "idol", name: "Stone Idol", value: 8, weight: 4, type: "treasure", special: null, desc: "Its eyes follow the hole.", scale: 1, spin: false, biomes: ["ruins"] },
  { id: "tome", name: "Old Tome", value: 5, weight: 6, type: "grain", special: null, desc: "Edible pages. Don't ask.", scale: 1.05, spin: false, biomes: ["ruins", "library"] },
  // ---- DEPTH 6 · Magma Chamber ----
  { id: "lavaberry", name: "Lava Berry", value: 5, weight: 7, type: "fruit", special: null, desc: "Spicy. Extremely spicy.", scale: 0.9, spin: false, glow: "#ff6a2a", biomes: ["magma", "dragon"] },
  { id: "ashcake", name: "Ash Cake", value: 15, weight: 2, type: "sweet", special: null, desc: "Baked by the mountain itself.", scale: 1.1, spin: false, biomes: ["magma"] },
  { id: "emberfruit", name: "Ember Fruit", value: 8, weight: 4, type: "fruit", special: null, desc: "Still warm. Always warm.", scale: 1, spin: true, glow: "#ff9a3a", biomes: ["magma", "dragon"] },
  // ---- DEPTH 7 · Giant Roots ----
  { id: "sapdrop", name: "Angel Nectar", value: 5, weight: 7, type: "sweet", special: null, desc: "Bottled sunlight, sweet as dawn.", scale: 1, spin: false, glow: "#ffe08a", biomes: ["heaven"] },
  { id: "rootfruit", name: "Halo Fruit", value: 3, weight: 10, type: "fruit", special: null, desc: "Grown in a garden above the sky.", scale: 1, spin: false, glow: "#fff2c0", biomes: ["heaven"] },
  // ---- DEPTH 8 · Abyss ----
  { id: "voidfruit", name: "Void Fruit", value: 10, weight: 4, type: "fruit", special: null, desc: "It ate the light around it.", scale: 1, spin: true, glow: "#8a6ae0", biomes: ["abyss"] },
  { id: "shadowberry", name: "Shadow Berry", value: 2, weight: 10, type: "fruit", special: null, desc: "Barely there. Delicious.", scale: 0.85, spin: false, biomes: ["abyss"] },
  // ---- DEPTH 9 · Frozen Caverns ----
  { id: "snowberry", name: "Snow Berry", value: 2, weight: 11, type: "fruit", special: null, desc: "Numbs the tongue. Gently.", scale: 0.85, spin: false, biomes: ["frozen"] },
  { id: "icemelon", name: "Ice Melon", value: 10, weight: 3, type: "fruit", special: null, desc: "A glacier, sliced.", scale: 1.1, spin: false, biomes: ["frozen"] },
  // ---- DEPTH 10 · Underground Jungle ----
  { id: "junglefruit", name: "Jungle Fruit", value: 5, weight: 7, type: "fruit", special: null, desc: "Loud flavor. Very loud.", scale: 1, spin: false, biomes: ["jungle"] },
  { id: "vineberry", name: "Vine Berry", value: 2, weight: 11, type: "fruit", special: null, desc: "The vine let it go reluctantly.", scale: 0.85, spin: false, biomes: ["jungle"] },
  // ---- DEPTH 11 · Ancient Library ----
  { id: "bookcake", name: "Book Cake", value: 8, weight: 4, type: "sweet", special: null, desc: "A thousand layers of story.", scale: 1.05, spin: false, biomes: ["library"] },
  { id: "inkberry", name: "Ink Berry", value: 3, weight: 9, type: "fruit", special: null, desc: "Stains the tongue purple.", scale: 0.85, spin: false, biomes: ["library"] },
  // ---- DEPTH 12 · Star Cavern ----
  { id: "starberry", name: "Star Berry", value: 3, weight: 9, type: "fruit", special: null, desc: "Fell from the buried sky.", scale: 0.85, spin: true, glow: "#ffd75e", biomes: ["star"] },
  { id: "mooncake", name: "Moon Cake", value: 15, weight: 2, type: "sweet", special: null, desc: "Cool, pale, perfect.", scale: 1.1, spin: false, glow: "#e8ecf8", biomes: ["star"] },
  // ---- DEPTH 13 · Void Garden ----
  { id: "voidpetal", name: "Void Petal", value: 5, weight: 7, type: "fruit", special: null, desc: "A flower that chose nothing.", scale: 1, spin: true, glow: "#c08aff", biomes: ["void"] },
  // ---- DEPTH 14 · Cosmic Core ----
  { id: "cosmicore", name: "Cosmic Core", value: 15, weight: 2, type: "treasure", special: null, desc: "A shard of the world's heart.", scale: 1.05, spin: true, glow: "#ff6ae0", biomes: ["cosmic"] },
];

export const FOOD_BY_ID: Record<string, FoodDef> = Object.fromEntries(FOODS.map((f) => [f.id, f]));

export const TYPE_ICON: Record<FoodType, string> = {
  fruit: "🍒",
  sweet: "🍬",
  veggie: "🥕",
  dairy: "🥛",
  grain: "🍞",
  protein: "🐟",
  treasure: "💎",
  junk: "☠️",
};

/* ---------- palette variants (biome-exclusive foods) ----------
   Reuses a base grid with a swapped palette — cheap, consistent art. */

const VARIANTS: Record<string, { base: string; p: Record<string, string> }> = {
  glowshroom:    { base: "mushroom",   p: { a: "#5ad0e8", w: "#d8fbff", d: "#2a8aa8", b: "#c8f0f8" } },
  berry:         { base: "cherry",     p: { a: "#b06ae0", w: "#e8ccff", d: "#7a3aa8", s: "#4a8f2c" } },
  root:          { base: "carrot",     p: { a: "#a06a3a", w: "#e0c090", d: "#6a4020", g: "#6aff9a" } },
  glowfruit:     { base: "apple",      p: { a: "#4ae0c8", w: "#d0fff4", d: "#1a9a88", g: "#3aff9a" } },
  crystalfruit:  { base: "starfruit",  p: { a: "#8ad8ff", w: "#eafaff", d: "#4a90c8" } },
  energyorb:     { base: "gem",        p: { a: "#6aff9a", w: "#eafff0", d: "#2ab85a" } },
  magicflower:   { base: "mushroom",   p: { a: "#ff9ec8", w: "#ffe0f0", d: "#c2588a", b: "#f8e0ea" } },
  crystalapple:  { base: "apple",      p: { a: "#9ad8ff", w: "#f0faff", d: "#5a90c8", g: "#b8ecff" } },
  seaweed:       { base: "carrot",     p: { a: "#2a9a5a", w: "#a0e8b8", d: "#1a6a3a", g: "#6affb0" } },
  lotus:         { base: "candy",      p: { a: "#ffd0e8", w: "#ffffff", d: "#e08ab8" } },
  pearl:         { base: "egg",        p: { a: "#e8f4ff", w: "#ffffff", d: "#a8c8e0" } },
  bluefruit:     { base: "apple",      p: { a: "#4aa8e8", w: "#c8ecff", d: "#2a74b4", g: "#3a8f2c" } },
  relic:         { base: "gem",        p: { a: "#ffd75e", w: "#fff8d0", d: "#c99a20" } },
  idol:          { base: "crystal",    p: { a: "#d8a850", w: "#f8e8b8", d: "#9a6a20" } },
  tome:          { base: "bread",      p: { a: "#8a3a2a", w: "#e8c8a0", d: "#5a1e14", h: "#3a1208" } },
  lavaberry:     { base: "cherry",     p: { a: "#ff6a2a", w: "#ffd0a0", d: "#c23a0a", s: "#4a2a0a" } },
  ashcake:       { base: "cake",       p: { a: "#c8c0b0", w: "#f0ece0", i: "#ff8a5a", d: "#8a8272", c: "#ff6a2a", y: "#ffd75e" } },
  emberfruit:    { base: "starfruit",  p: { a: "#ff9a3a", w: "#ffe8c0", d: "#c85a10" } },
  sapdrop:       { base: "honey",      p: { a: "#ffd75e", w: "#fffdf0", d: "#d8a020", l: "#fff8dc", c: "#b8862a" } },
  rootfruit:     { base: "apple",      p: { a: "#fff2c0", w: "#ffffff", d: "#e0c060", g: "#ffd75e" } },
  voidfruit:     { base: "starfruit",  p: { a: "#8a6ae0", w: "#e0d8ff", d: "#5a3aa8" } },
  shadowberry:   { base: "cherry",     p: { a: "#4a3a6a", w: "#a890d0", d: "#2a1e40", s: "#1a1228" } },
  snowberry:     { base: "cherry",     p: { a: "#e8f4ff", w: "#ffffff", d: "#a8c8e0", s: "#7ab8d8" } },
  icemelon:      { base: "watermelon", p: { a: "#c8ecff", w: "#f4fbff", g: "#7ab8d8", d: "#4a8ab0", k: "#2a5a7a" } },
  junglefruit:   { base: "starfruit",  p: { a: "#a8e05a", w: "#f0ffc8", d: "#6aa82a" } },
  vineberry:     { base: "grape",      p: { a: "#5ab84a", w: "#c8f0b8", d: "#2a8a2a" } },
  bookcake:      { base: "cake",       p: { a: "#f0e0c0", w: "#fff8e8", i: "#8a5a2c", d: "#c0a878", c: "#c23878", y: "#ffd75e" } },
  inkberry:      { base: "grape",      p: { a: "#2a2a4a", w: "#8a8ab0", d: "#14142a" } },
  starberry:     { base: "grape",      p: { a: "#ffd75e", w: "#fff8d0", d: "#c99a20" } },
  mooncake:      { base: "pie",        p: { a: "#e8ecf8", w: "#ffffff", d: "#a8b0c8", h: "#8a90b0" } },
  voidpetal:     { base: "candy",      p: { a: "#c08aff", w: "#f0e0ff", d: "#8a4ad0" } },
  cosmicore:     { base: "gem",        p: { a: "#ff6ae0", w: "#ffd8f8", d: "#c22aa8" } },
};

/* ---------- baking ---------- */

const cache = new Map<string, HTMLCanvasElement>();

function bakeOne(name: string, spr: Spr) {
  const w = spr.g[0].length;
  const h = spr.g.length;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { alpha: true })!;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < h; y++) {
    const row = spr.g[y];
    for (let x = 0; x < row.length && x < w; x++) {
      const ch = row[x];
      if (ch === "." || ch === " ") continue;
      const col = spr.p[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  cache.set(name, c);
}

export function bakeSprites(): Map<string, HTMLCanvasElement> {
  for (const [name, spr] of Object.entries(SPRITES)) {
    bakeOne(name, spr);
  }
  // palette-swapped biome foods
  for (const [name, v] of Object.entries(VARIANTS)) {
    const base = SPRITES[v.base];
    if (!base) continue;
    bakeOne(name, { p: { ...base.p, ...v.p }, g: base.g });
  }
  return cache;
}

export function getSprite(name: string): HTMLCanvasElement | undefined {
  if (cache.size === 0) bakeSprites();
  return cache.get(name);
}

/** Draw a sprite centered at (x,y) with pixel-perfect scaling. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  size: number,
  rot = 0,
  alpha = 1
) {
  const spr = getSprite(name);
  if (!spr) return;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spr, -size / 2, -size / 2, size, size);
  ctx.restore();
}
