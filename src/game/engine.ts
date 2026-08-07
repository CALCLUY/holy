/* ============================================================
   HUNGRY HOLE — Core Game Engine
   Fixed-resolution (640×360) canvas game. Owns every system:
   hole creature, food spawning, exact-number feeding, hunger,
   combos, burps, specials, events, missions, achievements,
   particles, screen shake, music tiers and UI snapshots.
   ============================================================ */

import { WorldEnv, W, H, GROUND_Y } from "./world";
import { FOODS, FOOD_BY_ID, drawSprite, getSprite, type FoodDef } from "./sprites";
import { Audio } from "./audio";
import { SaveManager, mulberry32, hashString, fmtTime, type SaveData, type RunEntry } from "./save";
import { biomeAtDepth, dirtPalette, SECRETS, type BiomeDef } from "./biomes";

/* ---------------- shared types ---------------- */

export type Phase = "menu" | "playing" | "descending" | "ascending" | "heaven" | "reveal" | "dying" | "gameover" | "paused";

export interface MissionView {
  id: string;
  icon: string;
  name: string;
  progress: number;
  target: number;
  done: boolean;
  failed: boolean;
}

export interface EventView {
  icon: string;
  name: string;
  color: string;
}

export interface UiSnapshot {
  phase: Phase;
  score: number;
  best: number;
  combo: number;
  mult: number;
  target: number;
  fullness: number;
  overfed: boolean;
  overfedLeft: number; // seconds until game over from overfeeding (0 if not overfed)
  overfedMax: number;
  starving: boolean;
  sizePct: number;
  event: EventView | null;
  burpCd: number; // 0..1 ready
  missions: MissionView[];
  hint: string | null;
  daily: boolean;
  reverse: boolean;
  paused: boolean;
  newBest: boolean;
  /* depth progression */
  depth: number;
  depthName: string;
  depthColor: string;
  depthProg: number;
  depthGoal: number;
  descending: boolean;
  descendBanner: string | null;
  isSecret: boolean;
  deepest: number;
  revealStep: number;
  revealText: string | null;
  storyCompleted: boolean;
}

export interface RunStats {
  score: number;
  best: number;
  newBest: boolean;
  highCombo: number;
  perfects: number;
  caught: number;
  time: number;
  missionsDone: number;
  isDaily: boolean;
  dailyBest: number;
  depth: number;
}

interface Food {
  id: string;
  x: number;
  y: number;
  vy: number;
  vx: number;
  rot: number;
  vr: number;
  size: number;
  value: number;
  special: FoodDef["special"];
  type: FoodDef["type"];
  def: FoodDef;
  caughtT: number; // >0 → being eaten
  landT: number; // >0 → landed, fading
  phase: number;
  bounces: number;
  bouncy: boolean;
  frozen: boolean;
  magnetized: boolean;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number;
  color: string; grav: number; glow: boolean;
}

interface FloatText {
  x: number; y: number; vy: number; life: number; max: number;
  text: string; color: string; size: number;
}

interface MissionDef {
  id: string; icon: string; name: string;
  type: "fruit" | "sweet" | "veggie" | "dairy" | "grain" | "protein" | "treasure" | "junk" | "perfects" | "combo" | "score" | "time" | "catch" | "burp" | "golden" | "avoidcake";
  target: number;
}

interface ActiveMission { def: MissionDef; progress: number; done: boolean; failed: boolean; }

interface EventDef { id: string; icon: string; name: string; color: string; dur: number; minTime: number; }

const EVENTS: EventDef[] = [
  { id: "foodrain", icon: "🌧️", name: "FOOD RAIN!", color: "#8fd3ff", dur: 9, minTime: 20 },
  { id: "goldenfeast", icon: "🌟", name: "GOLDEN FEAST!", color: "#ffd75e", dur: 8, minTime: 40 },
  { id: "meteors", icon: "☄️", name: "METEOR SHOWER!", color: "#ff8a3a", dur: 8, minTime: 55 },
  { id: "wind", icon: "💨", name: "WINDY!", color: "#a8e05a", dur: 10, minTime: 25 },
  { id: "reverse", icon: "🔀", name: "CONTROLS REVERSED!", color: "#ff9ec8", dur: 8, minTime: 45 },
  { id: "tiny", icon: "🐜", name: "TINY BITES!", color: "#9adcff", dur: 11, minTime: 35 },
  { id: "giant", icon: "🐘", name: "GIANT BITES!", color: "#ffb34d", dur: 9, minTime: 50 },
  { id: "lowgrav", icon: "🎈", name: "LOW GRAVITY!", color: "#c99aef", dur: 10, minTime: 30 },
  { id: "night", icon: "🌙", name: "NIGHT FALLS!", color: "#8a9aef", dur: 12, minTime: 60 },
  { id: "double", icon: "✖️2", name: "DOUBLE SCORE!", color: "#ffe066", dur: 12, minTime: 70 },
];

const MISSIONS: MissionDef[] = [
  { id: "fruit", icon: "🍒", name: "Fruit Feast — catch 12 fruits", type: "fruit", target: 12 },
  { id: "sweet", icon: "🍬", name: "Sweet Tooth — catch 10 sweets", type: "sweet", target: 10 },
  { id: "veggie", icon: "🥕", name: "Garden Snack — catch 8 veggies", type: "veggie", target: 8 },
  { id: "dairy", icon: "🥛", name: "Milky Way — catch 6 dairy", type: "dairy", target: 6 },
  { id: "perfects", icon: "🎯", name: "Perfectionist — 5 perfect feeds", type: "perfects", target: 5 },
  { id: "perfects2", icon: "🎯", name: "Sharpshooter — 10 perfect feeds", type: "perfects", target: 10 },
  { id: "combo", icon: "🔥", name: "On Fire — reach 8 combo", type: "combo", target: 8 },
  { id: "score", icon: "💯", name: "High Roller — score 3,000", type: "score", target: 3000 },
  { id: "time", icon: "⏳", name: "Survivor — last 2:00", type: "time", target: 120 },
  { id: "catch", icon: "🍽️", name: "Bottomless — catch 40 foods", type: "catch", target: 40 },
  { id: "burp", icon: "💨", name: "Wind Machine — burp 3 times", type: "burp", target: 3 },
  { id: "golden", icon: "🌟", name: "Golden Tooth — 2 golden apples", type: "golden", target: 2 },
  { id: "avoidcake", icon: "🚫", name: "Cake Avoider — no cake for 60s", type: "avoidcake", target: 60 },
];

export const ACHIEVEMENTS: { id: string; name: string; desc: string; icon: string }[] = [
  { id: "firstmeal", name: "First Meal", desc: "Complete your first perfect feed", icon: "🍎" },
  { id: "combo10", name: "Combo Apprentice", desc: "Reach a 10 combo", icon: "🔥" },
  { id: "combo25", name: "Combo Master", desc: "Reach a 25 combo", icon: "⚡" },
  { id: "perfect100", name: "Perfectionist", desc: "100 perfect feeds in total", icon: "🎯" },
  { id: "golden10", name: "Golden Collector", desc: "Catch 10 golden apples", icon: "🌟" },
  { id: "survivor", name: "Survivor", desc: "Survive 5 minutes in one run", icon: "⏳" },
  { id: "foodie500", name: "Food Expert", desc: "Catch 500 foods in total", icon: "🍽️" },
  { id: "perfection50", name: "One-Run Legend", desc: "50 perfect feeds in one run", icon: "🏆" },
  { id: "burp25", name: "Burp Artist", desc: "Burp 25 times in total", icon: "💨" },
  { id: "lucky5", name: "Lucky Player", desc: "Open 5 mystery boxes", icon: "🎁" },
  { id: "collector", name: "Food Encyclopedia", desc: "Catch every single food", icon: "📖" },
  { id: "score10k", name: "High Scorer", desc: "Score 10,000 points in total", icon: "💎" },
  { id: "meteordodger", name: "Meteor Dodger", desc: "Survive a meteor shower unhit", icon: "☄️" },
  { id: "nightowl", name: "Night Owl", desc: "Survive the night event", icon: "🌙" },
  { id: "daily", name: "Daily Devotee", desc: "Finish a daily challenge", icon: "📅" },
  { id: "depth2", name: "Down the Rabbit Hole", desc: "Descend to Depth 2", icon: "🕳️" },
  { id: "depth5", name: "Deep Dweller", desc: "Descend to Depth 5", icon: "⛏️" },
  { id: "depth10", name: "Subterranean", desc: "Descend to Depth 10", icon: "🌋" },
  { id: "friend", name: "Deepest Creature Friend", desc: "Descend to Depth 15", icon: "💛" },
  { id: "secret", name: "Secret Keeper", desc: "Stumble into a secret room", icon: "🗝️" },
];

/* ---------------- helpers ---------------- */

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ---------------- engine ---------------- */

export interface EngineCallbacks {
  ui: (s: UiSnapshot) => void;
  stats: (s: RunStats) => void;
  toasts: (toasts: { id: number; icon: string; title: string; text: string; kind: "ach" | "mission" }[]) => void;
}

const TARGET_Y = 270; // 2.5D top-down perspective, hole tracks along Y=270 in the grassy field
const SPLAT_Y = 320; // Y coordinate where missed food splats onto the grass
const HOLE_MIN_X = 52;
const HOLE_MAX_X = W - 52;

export class HungryHoleEngine {
  private ctx: CanvasRenderingContext2D;
  private cb: EngineCallbacks;
  private world: WorldEnv;
  private raf = 0;
  private lastT = 0;
  private destroyed = false;
  private totalEarned = 0;

  /* run state */
  phase: Phase = "menu";
  private daily = false;
  private bestBeaten = false;
  private rng: () => number = Math.random;
  private elapsed = 0;
  private timeScale = 1;

  /* creature */
  private holeX = W / 2;
  private sizePct = 0.95;
  private blinkT = 3;
  private blinkAnim = 0;
  private moodHappy = 0;
  private moodOverfed = 0;
  private moodScared = 0;
  private burpT = 0;
  private peekP = 0;
  private peekTimer = 4;
  private growlCd = 0;
  private suctionT = 0;
  private auraPulse = 0;

  /* feeding */
  private target = 10;
  private fullness = 0;
  private lastRealValue = 0;
  private overfedTimer = 0;   // seconds remaining before death from overfeeding
  private readonly OVERFED_MAX = 10;
  private combo = 0;
  private mult = 1;
  private comboLeft = 0;
  private chiliNext = false;
  private cloverLeft = 0;
  private magnetT = 0;
  private clockT = 0;
  private freezeT = 0;

  /* input */
  private keyLeft = false;
  private keyRight = false;
  private pointerX: number | null = null;

  /* difficulty */
  private spawnT = 0;
  private eventT = 26;
  private activeEvent: EventDef | null = null;
  private eventLeft = 0;
  private night = 0;
  private wind = 0;
  private reverse = false;
  private doubleScore = false;
  private meteorHit = false;

  /* entities */
  private foods: Food[] = [];
  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  private shake = 0;
  private flash = 0;

  /* stats & meta */
  private score = 0;
  private runPerfects = 0;
  private runCaught = 0;
  private runBurps = 0;
  private runGoldens = 0;
  private highCombo = 0;
  private missionsDone = 0;
  private perType: Record<string, number> = {};
  private activeMissions: ActiveMission[] = [];
  private avoidT = 0;
  private dyingT = 0;
  private save: SaveData;
  private hints: (string | null)[] = [];
  private uiTimer = 0;

  /* ---- depth progression state ---- */
  private depth = 1;
  private biome: BiomeDef = biomeAtDepth(1);
  private depthProg = 0;
  private depthGoal = 6;
  private descendT = 0;
  private secretNext: BiomeDef | null = null;
  private secretActive = false;
  private bannerT = 0;
  private bannerText: string | null = null;
  private mysteryT = 12;
  private mysteryActive = 0;
  private runMaxDepth = 1;
  private nextWorld: WorldEnv | null = null;
  private descendCracks: { ax: number; ay: number; bx: number; by: number; w: number }[] = [];
  private fallDebris: { x: number; y: number; vx: number; vy: number; kind: number; rot: number; vr: number; life: number }[] = [];
  /* ---- reveal cinematic state ---- */
  private revealStep = 0;
  private revealT = 0;
  private revealText: string | null = null;

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks) {
    this.cb = cb;
    this.ctx = canvas.getContext("2d")!;
    this.save = SaveManager.load();
    // If story is completed, start menu in the Restored Meadow
    if (this.save.storyCompleted) {
      let b = biomeAtDepth(1);
      b = {
        ...b,
        name: "Restored Meadow",
        sky: ["#4a1c56", "#7b3b82", "#b15d9a"],
        ground: ["#4e9a34", "#2e6a1c"],
        groundLine: "#6ab83a",
        tint: "rgba(224,120,255,0.06)",
        accent: "#f0c8ff",
        particle: { color: "#fff0f5", mode: "drift", glow: true },
        desc: "The world is fully restored. Celestial petals drift on a cosmic breeze."
      };
      this.biome = b;
      this.depth = 1;
    } else if (this.save.deepest > 1) {
      const md = Math.max(1, this.save.deepest);
      this.depth = md;
      this.biome = biomeAtDepth(md);
    }
    this.world = new WorldEnv(7, this.biome);
    // keep legacy ground-break helpers from being flagged as dead code
    void this.drawDescentCracks; void this.drawCollapsePixels; void this.drawDescentDebris;
    this.hints = [
      "◀ ▶ or DRAG to move the hole",
      "Catch food that adds up to the TARGET exactly!",
      "Over the target? Press SPACE to BURP!",
    ];
    this.lastT = performance.now();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    Audio.stopMusic();
  }

  /* ---------------- public control ---------------- */

  startRun(daily = false) {
    this.daily = daily;
    this.rng = daily ? mulberry32(hashString(SaveManager.dailySeed())) : Math.random;
    this.world = new WorldEnv(daily ? hashString(SaveManager.dailySeed()) : Math.floor(Math.random() * 1e9), this.biome);
    this.elapsed = 0;
    this.timeScale = 1;
    this.holeX = W / 2;
    this.sizePct = 0.95;
    this.blinkT = 3;
    // depth progression resets every run — the dig begins again at the surface
    this.depth = 1;
    let b = biomeAtDepth(1);
    if (this.save.storyCompleted) {
      b = {
        ...b,
        name: "Restored Meadow",
        sky: ["#4a1c56", "#7b3b82", "#b15d9a"],
        ground: ["#4e9a34", "#2e6a1c"],
        groundLine: "#6ab83a",
        tint: "rgba(224,120,255,0.06)",
        accent: "#f0c8ff",
        particle: { color: "#fff0f5", mode: "drift", glow: true },
        desc: "The world is fully restored. Celestial petals drift on a cosmic breeze."
      };
    }
    this.biome = b;
    this.world.setBiome(this.biome);
    this.depthProg = 0;
    this.depthGoal = 3; // 3,4,5,6... as the dig goes deeper
    this.descendT = 0;
    this.secretNext = null;
    this.secretActive = false;
    this.bannerT = 0;
    this.bannerText = null;
    this.mysteryT = 14;
    this.mysteryActive = 0;
    this.runMaxDepth = 1;
    this.nextWorld = null;
    Audio.setMood(this.biome.mood);
    Audio.ambientMode = this.biome.ambient;
    this.moodHappy = 0; this.moodOverfed = 0; this.moodScared = 0;
    this.burpT = 0; this.peekP = 0;
    this.target = 10; this.fullness = 0; this.lastRealValue = 0;
    this.overfedTimer = 0;
    this.combo = 0; this.mult = 1; this.comboLeft = 0;
    this.chiliNext = false; this.cloverLeft = 0;
    this.magnetT = 0; this.clockT = 0; this.freezeT = 0;
    this.spawnT = 1.2; this.eventT = 18; this.activeEvent = null; this.eventLeft = 0;
    this.night = 0; this.wind = 0; this.reverse = false; this.doubleScore = false; this.meteorHit = false;
    this.foods = []; this.particles = []; this.texts = [];
    this.shake = 0; this.flash = 0;
    this.score = 0; this.totalEarned = 0; this.bestBeaten = false;
    this.runPerfects = 0; this.runCaught = 0; this.runBurps = 0; this.runGoldens = 0;
    this.highCombo = 0; this.missionsDone = 0; this.perType = {}; this.avoidT = 0; this.dyingT = 0;
    this.pickMissions();
    this.hints = [
      "◀ ▶ or DRAG to move the hole",
      "Catch food that adds up to the TARGET exactly!",
      "Over the target? Press SPACE to BURP!",
    ];
    this.phase = "playing";
    Audio.ensure();
    Audio.startMusic();
    Audio.setTier(0);
    this.pushUI();
  }

  pause() {
    if (this.phase === "playing") {
      this.phase = "paused";
      this.pushUI();
    }
  }
  resume() {
    if (this.phase === "paused") {
      this.phase = "playing";
      this.lastT = performance.now();
      this.pushUI();
    }
  }
  toMenu() {
    this.phase = "menu";
    this.save = SaveManager.load();
    // After story completion, menu always shows the restored surface — the new endless hub
    if (this.save.storyCompleted) {
      this.depth = 1;
      let b = biomeAtDepth(1);
      b = {
        ...b,
        name: "Restored Meadow",
        sky: ["#4a1c56", "#7b3b82", "#b15d9a"],
        ground: ["#4e9a34", "#2e6a1c"],
        groundLine: "#6ab83a",
        tint: "rgba(224,120,255,0.06)",
        accent: "#f0c8ff",
        particle: { color: "#fff0f5", mode: "drift", glow: true },
        desc: "The world is fully restored. Celestial petals drift on a cosmic breeze."
      };
      this.biome = b;
      this.world.setBiome(this.biome);
      this.night = 0;
      this.activeEvent = null;
      this.foods = [];
      this.particles = [];
      this.texts = [];
      this.mysteryActive = 0;
      this.bannerText = null;
      this.bannerT = 0;
      this.secretActive = false;
      Audio.setMood(this.biome.mood);
      Audio.ambientMode = this.biome.ambient;
      Audio.stopMusic();
      this.pushUI();
      return;
    }
    // The menu shows the DEEPEST biome the player has ever reached, as a
    // constant title backdrop (new players see the Surface Meadow; someone
    // who reached the Mushroom Cavern sees that, and so on).
    const menuDepth = Math.max(1, this.save.deepest || 1);
    this.depth = menuDepth;
    let b = biomeAtDepth(menuDepth);
    if (menuDepth === 1 && this.save.storyCompleted) {
      b = {
        ...b,
        name: "Restored Meadow",
        sky: ["#4a1c56", "#7b3b82", "#b15d9a"],
        ground: ["#4e9a34", "#2e6a1c"],
        groundLine: "#6ab83a",
        tint: "rgba(224,120,255,0.06)",
        accent: "#f0c8ff",
        particle: { color: "#fff0f5", mode: "drift", glow: true },
        desc: "The world is fully restored. Celestial petals drift on a cosmic breeze."
      };
    }
    this.biome = b;
    this.world.setBiome(this.biome);
    this.night = 0;
    this.activeEvent = null;
    this.foods = [];
    this.particles = [];
    this.texts = [];
    this.mysteryActive = 0;
    this.bannerText = null;
    this.bannerT = 0;
    this.secretActive = false;
    Audio.setMood(this.biome.mood);
    Audio.ambientMode = this.biome.ambient;
    Audio.stopMusic();
    this.pushUI();
  }

  /** DEBUG — instantly trigger the next depth's cinematic descent or end scene. */
  debugNextBiome() {
    if (this.phase !== "playing") return;
    if (this.depth === 15) {
      this.startRevealCinematic();
      return;
    }
    this.phase = "descending";
    this.descendT = 0;
    this.secretNext = null;
    const nextBiome = biomeAtDepth(this.depth + 1);
    this.nextWorld = new WorldEnv(Math.floor(Math.random() * 1e9), nextBiome);
    Audio.eventSting();
    Audio.growl();
    this.pushUI();
  }

  setLeft(b: boolean) { this.keyLeft = b; }
  setRight(b: boolean) { this.keyRight = b; }
  setPointer(x: number | null) { this.pointerX = x; }

  setMusicOn(on: boolean) { this.save.settings.music = on; Audio.setMusicOn(on); SaveManager.save(this.save); }
  setSfxOn(on: boolean) { this.save.settings.sfx = on; Audio.setSfxOn(on); SaveManager.save(this.save); }

  burp() {
    if (this.phase !== "playing" || this.burpT > 0) return;
    this.burpT = 0.65;
    this.fullness = 0;
    this.overfedTimer = 0;
    this.chiliNext = false;
    this.runBurps++;
    this.save.totals.burps++;
    this.shake = Math.max(this.shake, 7);
    Audio.burp();
    // burst particles
    this.ringParticles(this.holeX, TARGET_Y, "#c9a06a", 26);
    this.burst(this.holeX, TARGET_Y - 8, "#8a6a3c", 18, 130);
    this.burst(this.holeX, TARGET_Y - 20, "#a8e05a", 8, 90);
    this.addText(this.holeX, TARGET_Y - 46, "BURP!", "#ffe9a8", 13);
    if (this.combo >= 3) {
      this.addText(this.holeX, TARGET_Y - 70, `combo ${this.combo} lost!`, "#ff8a7a", 8);
      Audio.comboLost();
    }
    this.combo = 0;
    this.mult = 1;
    Audio.setTier(0);
    this.checkMission("burp");
    this.checkAch("burp25", () => this.save.totals.burps >= 25);
    this.pushUI();
  }

  /* ---------------- missions & achievements ---------------- */

  private pickMissions() {
    const pool = [...MISSIONS];
    const picks: MissionDef[] = [];
    while (picks.length < 3 && pool.length) {
      const i = Math.floor(this.rng() * pool.length);
      picks.push(pool.splice(i, 1)[0]);
    }
    this.activeMissions = picks.map((def) => ({ def, progress: 0, done: false, failed: false }));
  }

  private checkMission(key: string, amount = 1) {
    let completed = false;
    for (const m of this.activeMissions) {
      if (m.done || m.failed) continue;
      const d = m.def;
      const match =
        (d.type === key) ||
        (d.type === "perfects" && key === "perfects") ||
        (d.type === "combo" && key === "combo") ||
        (d.type === "score" && key === "score") ||
        (d.type === "time" && key === "time") ||
        (d.type === "catch" && key === "catch") ||
        (d.type === "burp" && key === "burp") ||
        (d.type === "golden" && key === "golden") ||
        (d.type === "avoidcake" && key === "avoidcake");
      if (!match) continue;
      m.progress = Math.min(d.target, m.progress + amount);
      if (m.progress >= d.target) {
        m.done = true;
        completed = true;
        this.missionsDone++;
        const reward = 750;
        this.score += reward;
        this.addText(W / 2, 150, `MISSION +${reward}!`, "#a8e05a", 11);
        Audio.mission();
        this.pushToasts([{ icon: d.icon, title: "MISSION COMPLETE!", text: `${d.name}  +${reward}`, kind: "mission" }]);
      }
    }
    if (completed) this.pushUI();
  }

  private failMission(id: string) {
    const m = this.activeMissions.find((x) => x.def.id === id);
    if (m && !m.done && !m.failed) {
      m.failed = true;
      this.addText(W / 2, 150, "MISSION FAILED…", "#ff8a7a", 9);
    }
  }

  private pushToasts(toasts: { icon: string; title: string; text: string; kind: "ach" | "mission" }[]) {
    const withId = toasts.map((t, i) => ({ ...t, id: Date.now() + i }));
    this.cb.toasts(withId);
  }

  private checkAch(id: string, extra?: () => boolean) {
    if (this.save.ach.includes(id)) return;
    if (extra && !extra()) return;
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return;
    this.save.ach.push(id);
    SaveManager.save(this.save);
    Audio.achievement();
    this.pushToasts([{ icon: def.icon, title: "ACHIEVEMENT!", text: `${def.name} — ${def.desc}`, kind: "ach" }]);
  }

  /* ---------------- spawning ---------------- */

  private spawnFood() {
    const t = this.elapsed;
    let def: FoodDef;
    const sp = this.rng();

    // meteor event floods meteors
    if (this.activeEvent?.id === "meteors" && sp < 0.6) {
      def = FOOD_BY_ID["meteor"] ?? FOODS[0];
    } else {
      const specialChance = Math.min(0.16, 0.05 + t * 0.0018);
      const junkChance = Math.min(0.15, 0.05 + t * 0.0016);
      const isRain = this.activeEvent?.id === "foodrain";
      const specialIds = ["goldenapple", "mysterybox", "rainbowfruit", "chili", "magnet", "clock", "icecube", "clover", "bombpepper"]
        .filter(id => !isRain || id !== "icecube");
      let roll = this.rng();
      if (this.activeEvent?.id === "goldenfeast") {
        def = this.rng() < 0.5 ? FOOD_BY_ID["goldenapple"] : FOOD_BY_ID["cake"];
      } else if (roll < specialChance) {
        def = FOOD_BY_ID[specialIds[Math.floor(this.rng() * specialIds.length)]];
      } else if (roll < specialChance + junkChance) {
        const junk = FOODS.filter((f) => f.type === "junk");
        def = junk[Math.floor(this.rng() * junk.length)];
      } else {
        // biome-aware pool: universal foods + this depth's exclusive foods
        const pool = FOODS.filter(
          (f) => f.weight > 0 && f.special === null && f.type !== "junk" && (!f.biomes || f.biomes.includes(this.biome.id))
        );
        let total = 0;
        for (const f of pool) total += f.weight;
        let r = this.rng() * total;
        def = pool[0];
        for (const f of pool) {
          r -= f.weight;
          if (r <= 0) { def = f; break; }
        }
      }
    }

    const giant = this.activeEvent?.id === "giant";
    const tiny = this.activeEvent?.id === "tiny";
    const size = def.scale * 26 * (giant ? 1.55 : tiny ? 0.6 : 1);
    const bounceChance = t > 40 ? 0.14 : 0;
    const meteor = def.id === "meteor";
    const f: Food = {
      id: def.id,
      x: rand(30, W - 30),
      y: -26,
      vy: meteor ? rand(150, 190) : rand(48, 74) + Math.min(110, t * 1.5),
      vx: rand(-14, 14) + (this.wind > 0 ? rand(30, 70) * this.wind : 0),
      rot: rand(-0.3, 0.3),
      vr: def.spin ? rand(-1.6, 1.6) : rand(-0.3, 0.3),
      size,
      value: def.value,
      special: def.special,
      type: def.type,
      def,
      caughtT: 0,
      landT: 0,
      phase: rand(0, 6.28),
      bounces: 0,
      bouncy: !meteor && this.rng() < bounceChance,
      frozen: false,
      magnetized: false,
    };
    this.foods.push(f);
  }

  private genTarget() {
    const t = this.elapsed;
    const minV = Math.round(8 + Math.min(18, t * 0.06));
    const maxV = Math.round(26 + Math.min(70, t * 0.38));
    return randInt(minV, maxV);
  }

  /* ---------------- catch & feed ---------------- */

  private catchFood(f: Food) {
    const mult = this.mult * (this.doubleScore ? 2 : 1);
    const clover = this.cloverLeft > 0 ? 2 : 1;
    let value = f.value;

    // special behaviours
    if (f.special === "mystery") {
      value = [-5, -3, -2, 1, 2, 3, 5, 8, 10, 15][randInt(0, 9)];
      this.save.totals.mystery++;
      this.checkAch("lucky5", () => this.save.totals.mystery >= 5);
    } else if (f.special === "rainbow") {
      value = this.lastRealValue;
    } else if (f.special === "chili") {
      this.chiliNext = true;
      Audio.happy();
      this.addText(f.x, f.y - 20, "DOUBLE NEXT!", "#ff8a3a", 8);
      this.burst(f.x, f.y, "#ff8a3a", 10, 90);
    } else if (f.special === "magnet") {
      this.magnetT = 7;
      Audio.magnet();
      this.addText(f.x, f.y - 20, "MAGNET!", "#ff8a7a", 9);
      this.ringParticles(this.holeX, TARGET_Y, "#ff8a7a", 18);
    } else if (f.special === "clock") {
      this.clockT = 7;
      Audio.slowmo();
      this.addText(f.x, f.y - 20, "SLOW-MO!", "#ffe066", 9);
    } else if (f.special === "ice") {
      this.freezeT = 2.4;
      Audio.freeze();
      this.addText(f.x, f.y - 20, "FREEZE!", "#8fd3ff", 9);
      for (const o of this.foods) if (o !== f) o.frozen = true;
    } else if (f.special === "clover") {
      this.cloverLeft = 3;
      Audio.happy();
      this.addText(f.x, f.y - 20, "LUCKY!", "#a8e05a", 9);
    } else if (f.special === "bomb") {
      Audio.explode();
      this.shake = Math.max(this.shake, 10);
      this.burst(f.x, f.y, "#ff8a3a", 30, 220);
      this.burst(f.x, f.y, "#ffe066", 14, 160);
      this.addText(f.x, f.y - 30, "BOOM!", "#ffb34d", 12);
      this.sizePct = clamp(this.sizePct - 0.02, 0, 1);
      const blast = 170;
      for (const o of this.foods) {
        if (o === f) continue;
        const dx = o.x - this.holeX;
        const dy = o.y - TARGET_Y;
        if (dx * dx + dy * dy < blast * blast && o.caughtT === 0) {
          o.vx = Math.sign(dx || 1) * rand(120, 220);
          o.vy = -rand(60, 160);
          o.bouncy = false;
          o.frozen = false;
          this.save.totals.bombs++;
        }
      }
      this.pushUI();
      return;
    } else if (f.special === "golden") {
      this.runGoldens++;
      this.save.totals.goldens++;
      this.score += Math.round(250 * mult);
      this.checkAch("golden10", () => this.save.totals.goldens >= 10);
      this.checkMission("golden");
      this.addText(f.x, f.y - 26, `+${Math.round(250 * mult)}!`, "#ffd75e", 11);
      this.burst(f.x, f.y, "#ffd75e", 22, 170);
      Audio.golden();
    } else if (f.id === "meteor") {
      Audio.ouch();
      this.shake = Math.max(this.shake, 8);
      this.sizePct = clamp(this.sizePct - 0.035, 0, 1);
      this.meteorHit = true;
      this.moodScared = 1;
      this.burst(f.x, f.y, "#ff8a3a", 20, 180);
      this.addText(f.x, f.y - 24, "OUCH!", "#ff8a3a", 12);
      this.fullness = Math.max(0, this.fullness - 6);
      this.pushUI();
      return;
    }

    if (this.chiliNext && value !== 0) {
      value *= 2;
      this.chiliNext = false;
      this.burst(f.x, f.y, "#ff8a3a", 8, 100);
    }
    if (this.cloverLeft > 0) this.cloverLeft--;

    this.runCaught++;
    this.save.totals.food++;
    if (!this.save.dex.includes(f.id)) {
      this.save.dex.push(f.id);
      if (this.save.dex.length >= FOODS.filter((fd) => fd.weight > 0).length) this.checkAch("collector");
    }
    this.perType[f.type] = (this.perType[f.type] ?? 0) + 1;
    for (const m of this.activeMissions) {
      if (m.done || m.failed) continue;
      if (m.def.type === f.type) {
        m.progress = Math.min(m.def.target, m.progress + 1);
        if (m.progress >= m.def.target) {
          m.done = true;
          this.missionsDone++;
          this.score += 750;
          this.addText(W / 2, 150, `MISSION +750!`, "#a8e05a", 11);
          Audio.mission();
          this.pushToasts([{ icon: m.def.icon, title: "MISSION COMPLETE!", text: `${m.def.name}  +750`, kind: "mission" }]);
          this.pushUI();
        }
      }
    }
    if (f.id === "cake") {
      this.avoidT = -1; // cake caught → avoid mission failed
      this.failMission("avoidcake");
    }
    this.checkMission("catch");
    this.checkAch("foodie500", () => this.save.totals.food >= 500);

    // fullness
    this.fullness = clamp(this.fullness + value, 0, 999);
    if (value !== 0) this.lastRealValue = value;
    if (value > 0) this.sizePct = clamp(this.sizePct + 0.08, 0, 1);

    // scoring & feedback
    const overfed = this.fullness > this.target;
    if (!overfed && value !== 0) {
      const gain = Math.round((12 + Math.abs(value) * 3) * mult * clover);
      this.score += gain;
      this.totalEarned += gain;
      if (this.save.best.score > 0 && this.score > this.save.best.score) this.bestBeaten = true;
      this.checkAch("score10k", () => this.totalEarned >= 10000);
      this.addText(f.x, f.y - 22, `${value > 0 ? "+" : ""}${value}`, value > 0 ? "#a8e05a" : "#ff8a7a", 10);
      this.burst(f.x, f.y, value > 0 ? "#a8e05a" : "#7a8a4a", value > 0 ? 8 : 6, 80);
      Audio.pickup(value);
      this.moodHappy = Math.max(this.moodHappy, 0.35);
    }

    // PERFECT?
    if (this.fullness === this.target) {
      this.runPerfects++;
      this.save.totals.perfects++;
      this.combo++;
      this.highCombo = Math.max(this.highCombo, this.combo);
      this.comboLeft = 14;
      this.mult = Math.min(5, 1 + Math.floor(this.combo / 4));
      const gain = Math.round((140 + this.target * 3) * this.mult * (this.doubleScore ? 2 : 1));
      this.score += gain;
      this.totalEarned += gain;
      if (this.save.best.score > 0 && this.score > this.save.best.score) this.bestBeaten = true;
      this.sizePct = 1.0; // FULLY CHARGE TO 100%!
      this.moodHappy = 1;
      this.flash = 0.18;
      this.shake = Math.max(this.shake, 5);
      this.addText(this.holeX, TARGET_Y - 62, "PERFECT!", "#ffd75e", 16);
      this.addText(this.holeX, TARGET_Y - 36, `+${gain}`, "#fff3c0", 9);
      if (this.combo > 1) {
        this.addText(this.holeX, TARGET_Y - 82, `COMBO x${this.combo}`, "#ff9ec8", 9);
        Audio.comboUp(Math.min(4, Math.floor(this.combo / 4)));
      }
      // confetti
      const cols = ["#ffd75e", "#ff9ec8", "#8fd3ff", "#a8e05a", "#c99aef"];
      for (let i = 0; i < 30; i++) {
        this.particles.push({
          x: this.holeX, y: TARGET_Y - 10,
          vx: rand(-160, 160), vy: rand(-240, -40),
          life: rand(0.5, 1), max: 1, size: rand(2, 4),
          color: cols[randInt(0, cols.length - 1)], grav: 320, glow: true,
        });
      }
      this.ringParticles(this.holeX, TARGET_Y, "#ffd75e", 26);
      this.burst(this.holeX, TARGET_Y, "#ffd75e", 18, 150);
      Audio.perfect();
      Audio.flourish();
      Audio.setTier(Math.min(4, this.combo >= 12 ? 4 : this.combo >= 8 ? 3 : this.combo >= 5 ? 2 : this.combo >= 3 ? 1 : 0));
      this.checkAch("firstmeal");
      this.checkAch("combo10", () => this.combo >= 10);
      this.checkAch("combo25", () => this.combo >= 25);
      this.checkAch("perfect100", () => this.save.totals.perfects >= 100);
      this.checkAch("perfection50", () => this.runPerfects >= 50);
      this.checkMission("perfects");
      // DEPTH METER — every perfect feed digs the creature deeper
      this.depthProg += 1;
      if (this.depthProg >= this.depthGoal) {
        if (this.depth === 15 && !this.save.storyCompleted) {
          this.startRevealCinematic();
        } else {
          this.startDescent();
        }
        return;
      }
      if (this.combo % 5 === 0) {
        const bonus = this.combo * 100;
        this.score += bonus;
        this.addText(this.holeX, TARGET_Y - 100, `MILESTONE +${bonus}!`, "#ffe066", 9);
      }
      // new target
      this.target = this.genTarget();
      this.fullness = 0;
      this.pushUI();
      return;
    }

    // overfed?
    if (this.fullness > this.target) {
      this.moodOverfed = 1;
      this.shake = Math.max(this.shake, 4);
      Audio.overfed();
      this.addText(f.x, f.y - 26, "OVERFED!", "#ff8a3a", 10);
      this.addText(this.holeX, TARGET_Y - 40, "SPACE to BURP!", "#ffb34d", 8);
      if (this.combo >= 3) {
        Audio.comboLost();
        this.addText(this.holeX, TARGET_Y - 60, `combo ${this.combo} lost!`, "#ff8a7a", 8);
      }
      this.combo = 0;
      this.mult = 1;
    }
    this.pushUI();
  }

  /* ---------------- particles & text ---------------- */

  private burst(x: number, y: number, color: string, n: number, speed: number) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 380) break;
      const a = rand(0, Math.PI * 2);
      const v = rand(speed * 0.3, speed);
      this.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30,
        life: rand(0.3, 0.7), max: 0.7, size: rand(2, 4),
        color, grav: 260, glow: true,
      });
    }
  }

  private ringParticles(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 380) break;
      const a = (i / n) * Math.PI * 2;
      this.particles.push({
        x, y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90,
        life: 0.5, max: 0.5, size: 3,
        color, grav: 0, glow: true,
      });
    }
  }

  private addText(x: number, y: number, text: string, color: string, size: number) {
    this.texts.push({ x, y, vy: -38, life: 1.1, max: 1.1, text, color, size });
    if (this.texts.length > 30) this.texts.shift();
  }

  /* ---------------- main loop ---------------- */

  private loop(now: number) {
    if (this.destroyed) return;
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    if (this.phase !== "paused") this.update(dt);
    this.render();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number) {
    const t = this.elapsed;
    this.world.update(dt);

    if (this.phase === "menu") {
      // idle breathing + occasional peek
      this.peekTimer -= dt;
      if (this.peekTimer <= 0) {
        this.peekP = 1;
        this.peekTimer = 5 + Math.random() * 4;
        if (Math.random() < 0.3) Audio.happy();
      }
      this.peekP = Math.max(0, this.peekP - dt * 0.5);
      this.blinkT -= dt;
      if (this.blinkT <= 0) { this.blinkAnim = 0.16; this.blinkT = 2 + Math.random() * 3.5; }
      this.blinkAnim = Math.max(0, this.blinkAnim - dt);
      this.sizePct = 0.85 + Math.sin(t * 1.4) * 0.03;
      this.pushUITimer(dt);
      return;
    }

    if (this.phase === "gameover") {
      this.night = Math.min(1, this.night + dt * 0.4);
      this.pushUITimer(dt);
      return;
    }

    if (this.phase === "descending") {
      // Simple camera dolly: just wait while the render slides us down.
      // No ground-break simulation here — the visual is purely the camera.
      this.descendT += dt;
      this.shake = Math.max(this.shake, Math.min(4, this.descendT * 1.2));
      this.updateParticles(dt);
      if (this.descendT > 2.8) this.arriveAtDepth();
      return;
    }

    if (this.phase === "ascending") {
      // Camera rises up through earth into the heavens — burst into sky
      this.descendT += dt;
      // gentle upward shake, then soft settle as you breach the clouds
      this.shake = Math.max(this.shake, Math.min(3, this.descendT * 1.0));
      this.updateParticles(dt);
      // soft wind as you rise
      if (Math.random() < 0.3) {
        this.particles.push({
          x: rand(0, W), y: H + 4, vx: rand(-20, 20), vy: rand(-60, -30),
          life: rand(0.8, 1.2), max: 1.0, size: rand(1, 3),
          color: "#fff8dc", grav: -10, glow: true,
        });
      }
      if (this.descendT > 2.8) this.arriveAtDepth();
      return;
    }

    if (this.phase === "heaven") {
      // Peaceful rest — no hunger, no food, just breathing and birds
      this.peekTimer -= dt;
      if (this.peekTimer <= 0) {
        this.peekP = 1;
        this.peekTimer = 5 + Math.random() * 4;
      }
      this.peekP = Math.max(0, this.peekP - dt * 0.5);
      this.blinkT -= dt;
      if (this.blinkT <= 0) { this.blinkAnim = 0.16; this.blinkT = 2 + Math.random() * 3.5; }
      this.blinkAnim = Math.max(0, this.blinkAnim - dt);
      this.moodHappy = Math.min(1, this.moodHappy + dt * 0.5);
      this.sizePct = 0.92 + Math.sin(t * 1.2) * 0.015;
      this.auraPulse += dt;
      // gentle cloud particles drifting
      if (Math.random() < 0.08) {
        this.particles.push({
          x: -4, y: rand(20, GROUND_Y - 10), vx: rand(15, 30), vy: rand(-5, 5),
          life: rand(3, 5), max: 4, size: rand(1, 2),
          color: "#ffffff", grav: 0, glow: false,
        });
      }
      this.updateParticles(dt);
      this.pushUITimer(dt);
      return;
    }

    if (this.phase === "reveal") {
      this.updateRevealCinematic(dt);
      return;
    }

    if (this.phase === "dying") {
      this.dyingT += dt;
      this.night = Math.min(1, this.night + dt * 0.6);
      this.sizePct = Math.max(0, this.sizePct - dt * 0.55);
      this.updateFoods(dt * 0.4);
      this.updateParticles(dt);
      if (this.dyingT > 2.6) this.finalizeGameOver();
      return;
    }

    if (this.phase !== "playing") return;

    this.elapsed += dt;

    /* slow-mo clock */
    const targetScale = this.clockT > 0 ? 0.45 : 1;
    this.timeScale = lerp(this.timeScale, targetScale, Math.min(1, dt * 3));
    this.clockT = Math.max(0, this.clockT - dt);
    this.freezeT = Math.max(0, this.freezeT - dt);
    this.magnetT = Math.max(0, this.magnetT - dt);
    const sdt = dt * this.timeScale;

    /* input → movement */
    let dir = (this.keyRight ? 1 : 0) - (this.keyLeft ? 1 : 0);
    if (this.reverse) dir = -dir;
    if (this.pointerX !== null) {
      const target = clamp(this.pointerX, HOLE_MIN_X, HOLE_MAX_X);
      this.holeX += (target - this.holeX) * Math.min(1, dt * 11);
    } else {
      this.holeX = clamp(this.holeX + dir * 390 * dt, HOLE_MIN_X, HOLE_MAX_X);
    }

    /* events */
    this.eventLeft -= dt;
    if (this.activeEvent && this.eventLeft <= 0) {
      this.endEvent();
    }
    this.eventT -= dt;
    if (this.eventT <= 0 && this.elapsed > 14) {
      this.startEvent();
      this.eventT = rand(24, 40);
    }

    /* HUNGER — always ticking down hard. If you don't eat, you vanish.
       Rate ramps up over the run so complacency is never safe. */
    const starving = this.sizePct < 0.22;
    let drain = 0.038;                                    // base drain — ~26s from full to gone
    drain += Math.min(0.022, this.elapsed * 0.00010);    // ramps aggressively with run length
    if (starving) drain += 0.018;                         // panic accelerates
    if (this.fullness > this.target) drain += 0.018;      // overfed burns fast too
    this.sizePct = clamp(this.sizePct - drain * sdt, 0, 1);

    /* OVERFED — a 10-second death countdown starts the moment the belly
       exceeds the target. The only escape is to BURP (or the timer expiring
       kills the run). Resets instantly if belly drops back to <= target. */
    if (this.fullness > this.target) {
      if (this.overfedTimer <= 0) this.overfedTimer = this.OVERFED_MAX; // just entered
      this.overfedTimer -= dt;                             // real dt: don't slow with clock
      // heartbeat pulse for the last 3 seconds
      if (this.overfedTimer < 3 && Math.floor(this.overfedTimer * 2) !== Math.floor((this.overfedTimer + dt) * 2)) {
        Audio.heartbeat();
        this.shake = Math.max(this.shake, 2);
      }
      if (this.overfedTimer <= 0) {
        // POP! Bloat-death
        this.overfedTimer = 0;
        this.phase = "dying";
        this.dyingT = 0;
        this.shake = Math.max(this.shake, 12);
        this.flash = 0.35;
        this.burst(this.holeX, TARGET_Y, "#ff8a3a", 40, 260);
        this.burst(this.holeX, TARGET_Y, "#ffe066", 24, 200);
        this.ringParticles(this.holeX, TARGET_Y, "#ff5a2a", 32);
        this.addText(this.holeX, TARGET_Y - 80, "POP!", "#ff8a3a", 22);
        Audio.overfed();
        Audio.explode();
        Audio.gameover();
        Audio.stopMusic();
        this.pushUI();
        return;
      }
    } else if (this.overfedTimer > 0) {
      // Belly is safe again — reset the countdown and give some relief.
      this.overfedTimer = 0;
    }

    if (this.sizePct <= 0) {
      this.phase = "dying";
      this.dyingT = 0;
      Audio.sad();
      Audio.gameover();
      Audio.stopMusic();
      this.pushUI();
      return;
    }
    // starvation feedback
    this.growlCd -= dt;
    if (this.sizePct < 0.35 && this.growlCd <= 0) {
      this.growlCd = 6;
      if (starving) { Audio.heartbeat(); this.shake = Math.max(this.shake, 1.5); }
      else Audio.growl();
    }

    /* spawning */
    this.spawnT -= dt;
    const rain = this.activeEvent?.id === "foodrain" ? 0.32 : 1;
    if (this.spawnT <= 0) {
      this.spawnFood();
      if (this.activeEvent?.id === "foodrain" && this.rng() < 0.5) this.spawnFood();
      this.spawnT = Math.max(0.4, 1.02 - this.elapsed * 0.011) * rain;
    }

    /* combo timer */
    if (this.combo > 0) {
      this.comboLeft -= dt;
      if (this.comboLeft <= 0) {
        if (this.combo >= 3) { Audio.comboLost(); this.addText(this.holeX, TARGET_Y - 70, "combo lost…", "#ff8a7a", 8); }
        this.combo = 0;
        this.mult = 1;
        Audio.setTier(0);
      }
    }

    /* world effects */
    this.night = lerp(this.night, this.activeEvent?.id === "night" ? 1 : 0, Math.min(1, dt * 1.6));
    this.wind = lerp(this.wind, this.activeEvent?.id === "wind" ? 1 : 0, Math.min(1, dt * 2));
    this.reverse = this.activeEvent?.id === "reverse";
    this.doubleScore = this.activeEvent?.id === "double";

    /* creature timers */
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blinkAnim = 0.16; this.blinkT = 2 + Math.random() * 3.5; }
    this.blinkAnim = Math.max(0, this.blinkAnim - dt);
    this.moodHappy = Math.max(0, this.moodHappy - dt * 1.1);
    this.moodOverfed = Math.max(0, this.moodOverfed - dt * 0.9);
    this.moodScared = Math.max(0, this.moodScared - dt * 1.4);
    this.burpT = Math.max(0, this.burpT - dt);
    this.auraPulse += dt;
    this.cloverLeft = Math.max(0, this.cloverLeft - 0);

    /* missions: time/score/combo/avoid */
    for (const m of this.activeMissions) {
      if (m.done || m.failed) continue;
      if (m.def.type === "time") m.progress = Math.min(m.def.target, this.elapsed);
      if (m.def.type === "score") m.progress = Math.min(m.def.target, this.score);
      if (m.def.type === "combo") m.progress = Math.min(m.def.target, this.highCombo);
      if (m.def.type === "avoidcake" && this.avoidT >= 0) {
        this.avoidT += dt;
        m.progress = Math.min(m.def.target, this.avoidT);
      }
      if (m.progress >= m.def.target && !m.done) {
        m.done = true;
        this.missionsDone++;
        this.score += 750;
        this.addText(W / 2, 150, `MISSION +750!`, "#a8e05a", 11);
        Audio.mission();
        this.pushToasts([{ icon: m.def.icon, title: "MISSION COMPLETE!", text: `${m.def.name}  +750`, kind: "mission" }]);
      }
    }
    this.checkAch("survivor", () => this.elapsed >= 300);

    /* mystery: the creature hints at itself in the deep dark */
    this.mysteryActive = Math.max(0, this.mysteryActive - dt);
    this.bannerT = Math.max(0, this.bannerT - dt);
    if (this.bannerT <= 0) this.bannerText = null;
    if (this.biome.mystery > 0 && this.mysteryActive <= 0 && this.depth >= 2) {
      this.mysteryT -= dt;
      if (this.mysteryT <= 0) {
        this.mysteryActive = 3.4;
        this.mysteryT = 18 + Math.random() * 20;
        Audio.heartbeat();
        this.shake = Math.max(this.shake, 2);
      }
    }

    this.updateFoods(sdt);
    this.updateParticles(dt);

    /* hints */
    if (this.hints[0] && (this.keyLeft || this.keyRight || this.pointerX !== null)) this.hints[0] = null;
    if (this.hints[1] && this.runPerfects > 0) this.hints[1] = null;
    if (this.hints[2] && this.runBurps > 0) this.hints[2] = null;

    this.pushUITimer(dt);
  }

  private updateFoods(sdt: number) {
    const gravity = this.activeEvent?.id === "lowgrav" ? 52 : 130;
    const holeR = this.holeRadius();
    for (let i = this.foods.length - 1; i >= 0; i--) {
      const f = this.foods[i];
      f.phase += sdt;
      if (f.caughtT > 0) {
        f.caughtT += sdt;
        f.x = lerp(f.x, this.holeX, Math.min(1, sdt * 14));
        f.y = lerp(f.y, TARGET_Y, Math.min(1, sdt * 14));
        if (f.caughtT > 0.16) {
          this.foods.splice(i, 1);
          continue;
        }
        continue;
      }
      if (f.landT > 0) {
        f.landT += sdt;
        if (f.landT > 0.3) this.foods.splice(i, 1);
        continue;
      }
      if (f.frozen) { f.vy = 0; f.vx = 0; continue; }

      f.vy += gravity * sdt;
      f.vy = Math.min(f.vy, 250);
      f.x += f.vx * sdt + (this.wind > 0 ? this.wind * 46 * sdt : 0);
      f.y += f.vy * sdt;
      f.rot += f.vr * sdt;

      // magnet pull
      if (this.magnetT > 0) {
        const dx = this.holeX - f.x;
        const dy = TARGET_Y - f.y;
        const d = Math.hypot(dx, dy);
        if (d < 230 && d > 6) {
          f.vx += (dx / d) * 430 * sdt;
          f.vy += (dy / d) * 430 * sdt;
          f.magnetized = true;
        }
      }

      // catch check — check if it hits the hole's 2D bounding box
      const mouthR = holeR * 0.92;
      const mouthH = holeR * 0.6;
      if (Math.abs(f.x - this.holeX) < mouthR && f.y >= TARGET_Y - mouthH && f.y < TARGET_Y + mouthH * 0.5) {
        f.caughtT = 0.001;
        this.suctionT = 0;
        this.catchFood(f);
        continue;
      }

      // ground collision check — if it falls past the hole, it splats on the grass
      if (f.y + f.size / 2 >= SPLAT_Y) {
        if (f.bouncy && f.bounces < 2 && f.id !== "meteor") {
          f.vy = -f.vy * 0.55;
          f.bounces++;
          f.y = SPLAT_Y - f.size / 2;
          this.burst(f.x, SPLAT_Y - 4, "#8a6a3c", 5, 60);
        } else if (f.id === "meteor") {
          this.shake = Math.max(this.shake, 5);
          this.burst(f.x, SPLAT_Y - 6, "#ff8a3a", 14, 160);
          this.burst(f.x, SPLAT_Y - 6, "#8a6a3c", 10, 100);
          Audio.explode();
          f.landT = 0.001;
        } else {
          this.burst(f.x, SPLAT_Y - 4, "#8a6a3c", 6, 60);
          Audio.splat();
          f.landT = 0.001;
        }
        continue;
      }
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const tx = this.texts[i];
      tx.life -= dt;
      tx.y += tx.vy * dt;
      tx.vy *= 0.94;
      if (tx.life <= 0) this.texts.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - dt * 22);
    this.flash = Math.max(0, this.flash - dt * 1.4);
    // suction particles into the hole
    this.suctionT -= dt;
    if (this.suctionT <= 0 && this.phase === "playing") {
      this.suctionT = 0.09;
      const r = this.holeRadius() * 0.7;
      const a = rand(0, Math.PI * 2);
      const col = this.sizePct < 0.2 ? "rgba(200,170,120,0.5)" : this.moodOverfed > 0.3 ? "#ffb34d" : "#d8c090";
      this.particles.push({
        x: this.holeX + Math.cos(a) * r, y: TARGET_Y + Math.sin(a) * r * 0.6,
        vx: -(Math.cos(a) * r) * 2.2, vy: -(Math.sin(a) * r * 0.6) * 2.2,
        life: 0.35, max: 0.35, size: 2, color: col, grav: 0, glow: false,
      });
    }
  }

  /* ---------------- depth progression ---------------- */

  private startDescent() {
    const wouldBeHeaven = biomeAtDepth(this.depth + 1).id === "heaven";
    // never steal the heavens story beat with a secret room
    if (wouldBeHeaven) {
      this.secretNext = null;
    } else {
      this.secretNext = Math.random() < 0.09 ? SECRETS[Math.floor(Math.random() * SECRETS.length)] : null;
    }
    const nextBiome = this.secretNext ?? biomeAtDepth(this.depth + 1);
    const isHeaven = nextBiome.id === "heaven";
    this.phase = isHeaven ? "ascending" : "descending";
    this.descendT = 0;
    this.nextWorld = new WorldEnv(Math.floor(Math.random() * 1e9), nextBiome);
    Audio.eventSting();
    if (isHeaven) {
      Audio.happy();
    } else {
      Audio.growl();
    }
    this.pushUI();
  }

  private startRevealCinematic() {
    this.phase = "reveal";
    this.revealStep = 0;
    this.revealT = 0;
    this.revealText = null;
    this.foods = []; // clear foods
    // stop music completely
    Audio.stopMusic();
    this.pushUI();
  }

  private updateRevealCinematic(dt: number) {
    this.revealT += dt;
    const step = this.revealStep;
    const t = this.revealT;

    if (step === 0) {
      // 1. Silent heartbeat, subtle screen shake
      this.shake = Math.max(this.shake, Math.sin(t * 5) * 1.5);
      if (Math.floor(t * 1.4) !== Math.floor((t - dt) * 1.4)) {
        Audio.heartbeat();
        this.shake = Math.max(this.shake, 3.5);
      }
      if (t > 3.4) {
        this.revealStep = 1;
        this.revealT = 0;
      }
    } else if (step === 1) {
      // 2. Camera zooms in, fades to pitch black
      this.shake = Math.max(this.shake, Math.min(6, t * 2));
      if (t > 2.4) {
        this.revealStep = 2;
        this.revealT = 0;
      }
    } else if (step === 2) {
      // 3. Enormous SCARY eye opens, holds, then slowly closes — disturbing
      if (t > 0.15 && t < 0.18) Audio.scarySting();
      if (Math.floor(t * 0.7) !== Math.floor((t - dt) * 0.7) && t > 1.0 && t < 4.5) {
        if (Math.random() < 0.35) Audio.heartbeat();
      }
      // Start the horror drone AS the eye begins closing (~3.3s) so
      // the dread is already present before the black screen hits.
      if (t > 3.3 && t < 3.35) {
        Audio.stopMusic();
        Audio.horrorDrone();
        Audio.scarySting();
      }
      if (t > 4.0 && t < 4.05) Audio.whisperDrone();
      this.revealText = null;
      if (t > 6.2) {
        this.revealStep = 3;
        this.revealT = 0;
      }
    } else if (step === 3) {
      // 4. PITCH BLACK — "Thank you." appears immediately on the disturbing drone
      if (t > 0.15 && t < 4.0) {
        this.revealText = "Thank you.";
      } else {
        this.revealText = null;
      }
      // keep disturbing ambience alive — growls under the text
      if (Math.floor(t * 1.1) !== Math.floor((t - dt) * 1.1) && t > 0.8 && t < 3.0 && Math.random() < 0.4) {
        Audio.growl();
      }
      if (t > 4.8) {
        this.revealStep = 4;
        this.revealT = 0;
      }
    } else if (step === 4) {
      // 5. Black fade out → Main Menu with Endless Mode unlocked (no tree, pure cinematic)
      // t 0-1.5 : hold black, then fade out
      if (t > 2.2) {
        this.save.storyCompleted = true;
        this.save.deepest = Math.max(this.save.deepest, 15);
        if (!this.save.discovered.includes(15)) this.save.discovered.push(15);
        SaveManager.save(this.save);
        // Return to MAIN MENU with restored world + Endless Mode
        const menuDepth = 1;
        let b = biomeAtDepth(menuDepth);
        b = {
          ...b,
          name: "Restored Meadow",
          sky: ["#4a1c56", "#7b3b82", "#b15d9a"],
          ground: ["#4e9a34", "#2e6a1c"],
          groundLine: "#6ab83a",
          tint: "rgba(224,120,255,0.06)",
          accent: "#f0c8ff",
          particle: { color: "#fff0f5", mode: "drift", glow: true },
          desc: "The world is fully restored. Celestial petals drift on a cosmic breeze."
        };
        this.biome = b;
        this.depth = menuDepth;
        this.world.setBiome(this.biome);
        this.foods = [];
        this.particles = [];
        this.texts = [];
        this.depthProg = 0;
        this.depthGoal = 3;
        this.night = 0;
        this.activeEvent = null;
        this.mysteryActive = 0;
        this.bannerText = null;
        this.bannerT = 0;
        this.secretActive = false;
        Audio.setMood(this.biome.mood);
        Audio.ambientMode = this.biome.ambient;
        Audio.stopMusic();
        this.phase = "menu";
        this.pushUI();
      }
    }
  }

  // Called from the heavens rest screen
  continueFromHeaven() {
    if (this.phase !== "heaven") return;
    Audio.click();
    this.depthProg = 0;
    this.depthGoal = this.depth + 2; // abyss needs depth+2
    this.startDescent();
  }

  private arriveAtDepth() {
    if (this.secretNext) {
      this.biome = this.secretNext;
      this.secretActive = true;
      if (!this.save.secrets.includes(this.biome.id)) {
        this.save.secrets.push(this.biome.id);
        this.checkAch("secret");
      }
      this.bannerText = `SECRET · ${this.biome.secret ?? this.biome.name}`;
      this.score += 1000;
      this.totalEarned += 1000;
      this.addText(W / 2, 130, "SECRET ROOM! +1000", "#ffd75e", 13);
    } else {
      this.depth += 1;
      this.secretActive = false;
      this.biome = biomeAtDepth(this.depth);
      if (this.biome.id === "heaven") {
        this.bannerText = `THE HEAVENS`;
      } else {
        this.bannerText = `DEPTH ${this.depth} · ${this.biome.name.toUpperCase()}`;
      }
      if (this.depth > this.save.deepest) this.save.deepest = this.depth;
      if (!this.save.discovered.includes(this.depth)) this.save.discovered.push(this.depth);
      if (this.depth >= 2) this.checkAch("depth2");
      if (this.depth >= 5) this.checkAch("depth5");
      if (this.depth >= 10) this.checkAch("depth10");
      if (this.depth >= 15) this.checkAch("friend");
      SaveManager.save(this.save);
    }
    this.runMaxDepth = Math.max(this.runMaxDepth, this.depth);
    this.world.setBiome(this.biome);
    Audio.setMood(this.biome.mood);
    Audio.ambientMode = this.biome.ambient;
    // fresh round in a brand-new world — run & score carry over
    this.foods = [];
    this.fullness = 0;
    this.overfedTimer = 0;
    this.target = this.genTarget();
    this.depthProg = 0;
    // ladder: 3,4,5,6… — grows one perfect feed deeper each time
    if (!this.secretNext) this.depthGoal = this.depth + 2;
    // (secret rooms reuse the same goal — they're a detour, not a depth)
    this.bannerT = 3.4;
    this.flash = 0.35;
    this.mysteryT = 10 + Math.random() * 14;
    this.spawnT = 1.0;
    this.nextWorld = null;
    this.secretNext = null;
    if (this.biome.id === "heaven") {
      // THE HEAVENS — a peaceful rest. No hunger, no food, creature naps in the sun.
      this.phase = "heaven";
      this.sizePct = 1;
      this.moodHappy = 1;
      this.fullness = 0;
      this.overfedTimer = 0;
      this.foods = [];
      this.texts = [];
    } else {
      this.sizePct = Math.max(this.sizePct, 0.9); // arriving well-fed
      this.phase = "playing";
    }
    this.pushUI();
  }

  /* ---------------- events ---------------- */

  private startEvent() {
    const eligible = EVENTS.filter((e) => this.elapsed >= e.minTime && e.id !== this.activeEvent?.id);
    if (!eligible.length) return;
    const ev = eligible[Math.floor(this.rng() * eligible.length)];
    this.activeEvent = ev;
    this.eventLeft = ev.dur;
    Audio.eventSting();
    this.addText(W / 2, 130, ev.name, ev.color, 12);
    if (ev.id === "meteors") this.meteorHit = false;
    this.pushUI();
  }

  private endEvent() {
    if (this.activeEvent?.id === "meteors" && !this.meteorHit) this.checkAch("meteordodger");
    if (this.activeEvent?.id === "night") this.checkAch("nightowl");
    this.activeEvent = null;
    this.pushUI();
  }

  /* ---------------- game over ---------------- */

  private finalizeGameOver() {
    this.save.totals.runs++;
    const entry: RunEntry = {
      score: Math.round(this.score),
      combo: this.highCombo,
      perfects: this.runPerfects,
      time: Math.round(this.elapsed),
      date: new Date().toLocaleDateString(),
      daily: this.daily,
    };
    SaveManager.recordRun(this.save, entry);
    const newBest = this.score > this.save.best.score;
    if (newBest) {
      this.save.best = {
        score: Math.round(this.score),
        combo: Math.max(this.save.best.combo, this.highCombo),
        perfects: Math.max(this.save.best.perfects, this.runPerfects),
        time: Math.max(this.save.best.time, Math.round(this.elapsed)),
      };
    }
    if (this.daily && this.score > 0) this.checkAch("daily");
    SaveManager.save(this.save);
    this.phase = "gameover";
    this.cb.stats({
      score: Math.round(this.score),
      best: this.save.best.score,
      newBest,
      highCombo: this.highCombo,
      perfects: this.runPerfects,
      caught: this.runCaught,
      time: Math.round(this.elapsed),
      missionsDone: this.missionsDone,
      isDaily: this.daily,
      dailyBest: this.daily ? this.save.daily.score : 0,
      depth: this.runMaxDepth,
    });
    this.pushUI();
  }

  /* ---------------- UI push ---------------- */

  private pushUITimer(dt: number) {
    this.uiTimer -= dt;
    if (this.uiTimer <= 0) {
      this.uiTimer = 0.12;
      this.pushUI();
    }
  }

  private pushUI() {
    const hint = this.hints.find((h) => h !== null) ?? null;
    this.cb.ui({
      phase: this.phase,
      score: Math.round(this.score),
      best: this.save.best.score,
      combo: this.combo,
      mult: this.mult,
      target: this.target,
      fullness: this.fullness,
      overfed: this.fullness > this.target,
      overfedLeft: this.overfedTimer,
      overfedMax: this.OVERFED_MAX,
      starving: this.sizePct < 0.2,
      sizePct: this.sizePct,
      event: this.activeEvent ? { icon: this.activeEvent.icon, name: this.activeEvent.name, color: this.activeEvent.color } : null,
      burpCd: this.burpT > 0 ? 1 - this.burpT / 0.65 : 1,
      missions: this.activeMissions.map((m) => ({
        id: m.def.id, icon: m.def.icon, name: m.def.name,
        progress: Math.round(m.progress), target: m.def.target,
        done: m.done, failed: m.failed,
      })),
      hint,
      daily: this.daily,
      reverse: this.reverse,
      paused: this.phase === "paused",
      newBest: this.bestBeaten,
      depth: this.depth,
      depthName: this.biome.name,
      depthColor: this.biome.accent,
      depthProg: this.depthProg,
      depthGoal: this.depthGoal,
      descending: this.phase === "descending",
      descendBanner: this.bannerT > 0 ? this.bannerText : null,
      isSecret: this.secretActive,
      deepest: this.save.deepest,
      revealStep: this.revealStep,
      revealText: this.revealText,
      storyCompleted: this.save.storyCompleted,
    });
  }

  /* ---------------- rendering ---------------- */

  private holeRadius() {
    return 30 + 26 * this.sizePct;
  }

  private render() {
    const ctx = this.ctx;
    const t = performance.now() / 1000;
    // Always disable smoothing — re-assert every frame so browser never sneaks it back.
    ctx.imageSmoothingEnabled = false;
    (ctx as CanvasRenderingContext2D & { mozImageSmoothingEnabled?: boolean }).mozImageSmoothingEnabled = false;
    (ctx as CanvasRenderingContext2D & { webkitImageSmoothingEnabled?: boolean }).webkitImageSmoothingEnabled = false;
    (ctx as CanvasRenderingContext2D & { msImageSmoothingEnabled?: boolean }).msImageSmoothingEnabled = false;
    ctx.save();
    // 2× integer upscale: canvas buffer is 1280×720, game logic at 640×360.
    // This means every virtual pixel is 2 real pixels — nearest-neighbour is trivial.
    ctx.scale(2, 2);
    if (this.shake > 0.2) {
      ctx.translate(rand(-this.shake, this.shake) * 0.6, rand(-this.shake, this.shake) * 0.6);
    }
    // --- REVEAL STORY CINEMATIC: THE HEART OF THE WORLD ---
    if (this.phase === "reveal") {
      const step = this.revealStep;
      const rT = this.revealT;

      const pxEllLocal = (cx: number, cy: number, rx2: number, ry2: number, col: string) => {
        ctx.fillStyle = col;
        const PX2 = 2;
        for (let yy = -ry2; yy <= ry2; yy += PX2) {
          const w = rx2 * Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry2 * ry2)));
          if (w < 0.5) continue;
          ctx.fillRect(Math.round(cx - w), Math.round(cy + yy), Math.max(PX2, Math.round(w * 2)), PX2);
        }
      };

      if (step === 0 || step === 1) {
        // Step 0: Slow heartbeat tremor. Step 1: Camera zoom in to black.
        const z = step === 1 ? 1 + Math.min(10, rT * 11) : 1;
        ctx.save();
        if (z > 1) {
          ctx.translate(this.holeX, TARGET_Y);
          ctx.scale(z, z);
          ctx.translate(-this.holeX, -TARGET_Y);
        }
        this.world.draw(ctx, t, this.night, this.holeX, this.holeRadius(), 0, false);
        this.drawHole(ctx, t);
        ctx.restore();

        // black fade for Step 1
        if (step === 1) {
          ctx.fillStyle = `rgba(0,0,0,${Math.min(1, rT / 2.2)})`;
          ctx.fillRect(-80, -80, W + 160, H + 160);
        }
      } else if (step === 2) {
        // Step 2: SCARY complete eye — bigger, veins, breathing, twitch, chromatic
        ctx.fillStyle = "#000000";
        ctx.fillRect(-4, -4, W + 8, H + 8);

        // subtle vignette + grain for dread
        const vg2 = ctx.createRadialGradient(W/2, H/2, 80, W/2, H/2, 320);
        vg2.addColorStop(0, "rgba(0,0,0,0)");
        vg2.addColorStop(1, "rgba(60,0,0,0.55)");
        ctx.fillStyle = vg2;
        ctx.fillRect(-4, -4, W+8, H+8);
        // film grain
        ctx.globalAlpha = 0.07;
        for (let i=0;i<120;i++) {
          const gx = (i*97 + Math.floor(rT*40 + i*7)) % W;
          const gy = (i*53 + Math.floor(rT*60)) % H;
          ctx.fillStyle = Math.random() > 0.5 ? "#1a0000" : "#0a0a0a";
          ctx.fillRect(gx, gy, 1, 1);
        }
        ctx.globalAlpha = 1;

        const ex = W / 2, ey = H / 2;
        // open 0→1 in 0.9s, hold, then close 1→0 in 1.1s — longer stare
        let lidOpen: number;
        if (rT < 0.9) lidOpen = rT / 0.9;
        else if (rT < 4.8) lidOpen = 1;
        else if (rT < 5.9) lidOpen = 1 - (rT - 4.8) / 1.1;
        else lidOpen = 0;

        // tiny tremor when fully open — the thing is alive and too close
        const tremX = lidOpen > 0.95 ? Math.sin(rT*44)*0.7 : 0;
        const tremY = lidOpen > 0.95 ? Math.cos(rT*37)*0.5 : 0;
        const ex2 = ex + tremX;
        const ey2 = ey + tremY;

        const eyeW = 138, eyeH = 78 * Math.max(0, lidOpen);
        if (eyeH > 3) {
          // chromatic aberration — faint red/cyan offset copies
          if (lidOpen > 0.85) {
            ctx.globalAlpha = 0.18;
            pxEllLocal(ex2+1.5, ey2, eyeW, eyeH, "#ff2a2a");
            pxEllLocal(ex2-1.5, ey2, eyeW, eyeH, "#2a8aff");
            ctx.globalAlpha = 1;
          }
          // sclera — sickly, slightly yellowed, blood-tinged at edges
          pxEllLocal(ex2, ey2, eyeW, eyeH, "#e8ddd0");
          pxEllLocal(ex2, ey2, eyeW*0.94, eyeH*0.92, "#fff8ec");
          // blood veins radiating from center
          ctx.strokeStyle = "rgba(160,30,30,0.55)";
          ctx.lineWidth = 1;
          for (let vi=0; vi<10; vi++) {
            const va = (vi/10)*Math.PI*2 + Math.sin(vi)*0.4;
            const vr = eyeW * (0.45 + (vi%2)*0.18);
            // skip where iris will cover
            if (vr < 38) continue;
            ctx.beginPath();
            ctx.moveTo(ex2 + Math.cos(va)*36, ey2 + Math.sin(va)*18);
            const mx = ex2 + Math.cos(va+0.18)* (vr*0.6);
            const my = ey2 + Math.sin(va+0.18)* (vr*0.32);
            const exv = ex2 + Math.cos(va)*vr;
            const eyv = ey2 + Math.sin(va)*vr*0.48;
            ctx.quadraticCurveTo(mx, my, exv, eyv);
            ctx.stroke();
            // tiny branch
            if (vi%2===0) {
              ctx.beginPath();
              ctx.moveTo(mx, my);
              ctx.lineTo(mx + Math.cos(va+0.9)*8, my + Math.sin(va+0.9)*4);
              ctx.stroke();
            }
          }
          // iris — much larger, layered, scary amber-blood gradient
          const irisR = 44 * lidOpen;
          for (let rr = irisR; rr > 4; rr -= 5) {
            const a = (rr / irisR);
            // outer deep blood red → inner molten amber → core dark pit
            let col: string;
            if (a > 0.75) col = `rgb(${Math.round(120 + a*25)},${Math.round(18 + a*10)},${Math.round(12)})`; // dark blood outer
            else if (a > 0.45) col = `rgb(${Math.round(200 + a*30)},${Math.round(100 - a*20)},${Math.round(20)})`; // amber mid
            else if (a > 0.2) col = `rgb(${Math.round(255 - a*20)},${Math.round(180 - a*30)},${Math.round(60)})`; // bright inner
            else col = `rgb(${Math.round(60 + a*40)},${Math.round(20)},${Math.round(12)})`; // dark core edge
            pxEllLocal(ex2, ey2, rr, rr*0.96, col);
          }
          // iris texture — radial striations (pixel spokes)
          ctx.strokeStyle = "rgba(40,10,6,0.45)";
          ctx.lineWidth = 1;
          for (let si=0; si<16; si++) {
            const sa = (si/16)*Math.PI*2;
            ctx.beginPath();
            ctx.moveTo(ex2 + Math.cos(sa)*10, ey2 + Math.sin(sa)*10*0.96);
            ctx.lineTo(ex2 + Math.cos(sa)*32, ey2 + Math.sin(sa)*32*0.96);
            ctx.stroke();
          }
          // vertical slit pupil — breathes (dilates slightly)
          const dilate = 1 + Math.sin(rT*2.2)*0.12;
          const pupilW = 10 * dilate;
          const pupilH = 34 * lidOpen;
          ctx.fillStyle = "#050208";
          for (let yy = -pupilH; yy <= pupilH; yy += 2) {
            const w = pupilW * Math.sqrt(Math.max(0, 1 - (yy * yy) / (pupilH * pupilH)));
            if (w < 0.5) continue;
            // core
            ctx.fillRect(Math.round(ex2 - w), Math.round(ey2 + yy), Math.max(2, Math.round(w * 2)), 2);
          }
          // inner abyss — even darker center column
          ctx.fillStyle = "#000000";
          for (let yy = -pupilH*0.7; yy <= pupilH*0.7; yy += 2) {
            const w = (pupilW*0.45) * Math.sqrt(Math.max(0, 1 - (yy * yy) / (pupilH * pupilH)));
            if (w < 0.5) continue;
            ctx.fillRect(Math.round(ex2 - w), Math.round(ey2 + yy), Math.max(1, Math.round(w * 2)), 2);
          }
          // glints — more pronounced, with chromatic
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(Math.round(ex2 + 11), Math.round(ey2 - 14), 5, 5);
          ctx.fillRect(Math.round(ex2 + 12), Math.round(ey2 - 13), 2, 2);
          ctx.fillStyle = "rgba(255,220,180,0.9)";
          ctx.fillRect(Math.round(ex2 - 15), Math.round(ey2 + 6), 2, 2);
          // heavy eyelids — thick, dark, with lashes hint
          ctx.fillStyle = "#1a0a06";
          for (let xx = -eyeW; xx <= eyeW; xx += 2) {
            const yy = eyeH * Math.sqrt(Math.max(0, 1 - (xx * xx)/(eyeW*eyeW)));
            if (yy < 1) continue;
            // top lid — thicker
            ctx.fillRect(Math.round(ex2 + xx), Math.round(ey2 - yy), 2, 4);
            // bottom lid
            ctx.fillRect(Math.round(ex2 + xx), Math.round(ey2 + yy - 2), 2, 3);
            // lash hint every few
            if (Math.abs(xx) % 14 < 2 && Math.abs(xx) > 50) {
              ctx.fillRect(Math.round(ex2 + xx), Math.round(ey2 - yy - 3), 1, 3);
            }
          }
          // tearline / wetness
          ctx.strokeStyle = "rgba(255,220,180,0.22)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(ex2, ey2 + eyeH*0.85, eyeW*0.45, 3, 0, 0, Math.PI*2);
          ctx.stroke();
        } else if (lidOpen <= 0.03) {
          // fully closed — dark seam with faint red glow
          ctx.fillStyle = "#1a0a06";
          ctx.fillRect(Math.round(ex - eyeW), Math.round(ey), Math.round(eyeW * 2), 3);
          // faint ember glow in the slit
          ctx.fillStyle = "rgba(180,30,15,0.55)";
          ctx.fillRect(Math.round(ex - 22), Math.round(ey+1), 44, 1);
        }

        // oppressive aura — dark red vignette pulsing with heartbeat
        if (lidOpen > 0.2) {
          const pulse = 0.12 + 0.06 * Math.sin(rT * 4.2);
          ctx.fillStyle = `rgba(80,10,10,${pulse})`;
          const vgEye = ctx.createRadialGradient(ex2, ey2, 80, ex2, ey2, 360);
          vgEye.addColorStop(0, "rgba(80,10,10,0)");
          vgEye.addColorStop(1, `rgba(60,5,5,${pulse})`);
          ctx.fillStyle = vgEye;
          ctx.fillRect(-4, -4, W+8, H+8);
        }
      } else if (step === 3) {
        // Step 3: PITCH BLACK — "Thank you." in dead silence, disturbing drone underneath
        ctx.fillStyle = "#000000";
        ctx.fillRect(-4, -4, W + 8, H + 8);
        // subtle film dust on black for texture
        ctx.globalAlpha = 0.045;
        for (let i=0;i<80;i++) {
          const gx = (i*89 + Math.floor(rT*120 + i*13)) % W;
          const gy = (i*67 + Math.floor(rT*90)) % H;
          ctx.fillStyle = Math.random() > 0.5 ? "#1a0000" : "#0a0a0a";
          ctx.fillRect(gx, gy, 1, 1);
        }
        ctx.globalAlpha = 1;
      } else if (step === 4) {
        void rT;
        // Step 4: Hold black — then fade out to Main Menu (Endless Mode)
        const fadeStart = 1.3;
        const fadeDur = 1.1;
        const fade = Math.max(0, Math.min(1, (rT - fadeStart) / fadeDur));
        // pure black hold, then fade to transparent to reveal menu underneath
        ctx.globalAlpha = 1 - fade * 0.15;
        ctx.fillStyle = "#000000";
        ctx.fillRect(-4, -4, W + 8, H + 8);
        ctx.globalAlpha = 1;
        // subtle vignette lingers a bit longer
        if (fade < 0.7) {
          const vgFade = 0.35 * (1 - fade);
          const gV = ctx.createRadialGradient(W/2, H/2, 100, W/2, H/2, 420);
          gV.addColorStop(0, "rgba(0,0,0,0)");
          gV.addColorStop(1, `rgba(20,0,0,${vgFade})`);
          ctx.fillStyle = gV;
          ctx.fillRect(-4, -4, W+8, H+8);
        }
      }

        if (false) { // legacy tree disabled — pure black hold now
          const lt = 0;
        // THE TREE — erupts violently, then settles majestic
        // Hold at 0 height until 1.6, then burst upward
        const eruptStart = 1.6;
        let trunkW = 0, trunkH = 0;
        if (lt > eruptStart) {
          const eruptT = lt - eruptStart;
          // Ease-out elastic burst
          const growProg = Math.min(1, eruptT * 1.8);
          const eased = 1 - Math.pow(1 - growProg, 3);
          // Add a little overshoot shake at peak
          const overshoot = growProg >= 0.95 ? Math.sin((growProg - 0.95)* 40) * 2 * (1 - growProg)*20 : 0;
          trunkW = (26 + eased * 28 + overshoot) * (1 + Math.sin(t*12)*0.01);
          trunkH = (eased * 220 + overshoot * 4);
        }
        const tx = W / 2, ty = H - 2;
        if (trunkH > 2) {
          // Trunk with bark texture
          ctx.fillStyle = "#4a2e14";
          // Jitter trunk slightly during eruption for impact
          const jx = lt > 1.6 && lt < 3.0 ? Math.sin(lt*28)*1.2 : 0;
          ctx.fillRect(Math.round(tx - trunkW / 2 + jx), Math.round(ty - trunkH), Math.round(trunkW), Math.round(trunkH));
          // Bark shading — left shadow
          ctx.fillStyle = "rgba(0,0,0,0.28)";
          ctx.fillRect(Math.round(tx - trunkW / 2 + jx), Math.round(ty - trunkH), Math.round(trunkW * 0.22), Math.round(trunkH));
          // Right highlight
          ctx.fillStyle = "rgba(255,220,150,0.18)";
          ctx.fillRect(Math.round(tx + jx), Math.round(ty - trunkH), Math.round(trunkW * 0.18), Math.round(trunkH));
          // Bark horizontal lines for texture
          ctx.fillStyle = "rgba(0,0,0,0.18)";
          for (let y = 0; y < trunkH; y += 14) {
            if (y > trunkH - 10) continue;
            ctx.fillRect(Math.round(tx - trunkW/2 + 4 + jx), Math.round(ty - trunkH + y), Math.round(trunkW - 8), 1);
          }

          // Debris burst at eruption moment
          if (lt > 1.6 && lt < 2.4) {
            for (let i = 0; i < 12; i++) {
              const ang = (i / 12) * Math.PI * 2;
              const dist = (lt - 1.6) * 90 + (i % 3)* 6;
              const dx = Math.cos(ang) * dist;
              const dy = Math.sin(ang) * dist * 0.4 - (lt - 1.6)* 20;
              ctx.fillStyle = i % 2 ? "#8a6a3a" : "#5a3a20";
              ctx.fillRect(Math.round(tx + dx), Math.round(ty - trunkH + dy), 3, 3);
            }
          }

          // Canopy — blooms AFTER trunk has mostly risen
          const canopyDelay = 2.9;
          if (lt > canopyDelay) {
            const cT = lt - canopyDelay;
            const leafProg = Math.min(1, cT * 1.6);
            const leafEased = 1 - Math.pow(1 - leafProg, 2);
            const leafR = leafEased * 96;
            const sway = Math.sin(t*1.2) * 2;
            // Multiple layered canopies for depth — dark to light
            pxEllLocal(tx + sway, ty - trunkH, leafR * 0.95, leafR * 0.62, "#1e4a14");
            pxEllLocal(tx - 42, ty - trunkH + 18, leafR * 0.64, leafR * 0.42, "#2e6a18");
            pxEllLocal(tx + 42, ty - trunkH + 18, leafR * 0.64, leafR * 0.42, "#2e6a18");
            pxEllLocal(tx + sway*0.5, ty - trunkH - 10, leafR * 0.72, leafR * 0.5, "#4a9a2c");
            pxEllLocal(tx, ty - trunkH - 2, leafR * 0.55, leafR * 0.38, "#6ab83a");
            // Golden light on top of canopy
            if (leafProg > 0.6) {
              ctx.globalAlpha = (leafProg - 0.6) * 1.2;
              pxEllLocal(tx, ty - trunkH - 18, leafR * 0.32, leafR * 0.18, "#fff2a0");
              ctx.globalAlpha = 1;
            }
            // Falling leaf particles as it blooms
            if (leafProg > 0.2 && leafProg < 0.9 && Math.random() < 0.5) {
              const lx = tx + (Math.random()-0.5)* leafR * 1.6;
              const ly = ty - trunkH + Math.random()* 20;
              ctx.fillStyle = Math.random() > 0.5 ? "#7ab83a" : "#ffd75e";
              ctx.fillRect(Math.round(lx), Math.round(ly), 2, 2);
            }
          }

          // Roots spreading from base — crack the ground outward
          if (lt > 2.2) {
            const rootProg = Math.min(1, (lt - 2.2) * 0.9);
            ctx.strokeStyle = `rgba(90, 55, 20, ${0.7 * rootProg})`;
            ctx.lineWidth = 3;
            for (let i = 0; i < 6; i++) {
              const ang = (i / 6) * Math.PI * 2;
              // Only spread outward along ground, not up
              if (Math.sin(ang) < -0.2) continue;
              const len = rootProg * (42 + (i%2)*18);
              ctx.beginPath();
              ctx.moveTo(tx, ty - 4);
              const mx = tx + Math.cos(ang) * len * 0.5 + Math.sin(i*2)*4;
              const my = ty - 8 + Math.sin(ang) * len * 0.3 * 0.5;
              const ex = tx + Math.cos(ang) * len;
              const ey = ty - 6 + Math.sin(ang) * len * 0.3;
              ctx.quadraticCurveTo(mx, my, ex, ey);
              ctx.stroke();
            }
            ctx.lineWidth = 1;
          }
        }

        // Flowers — bloom late, after canopy
        if (lt > 3.8) {
          const flowerProg = Math.min(1, (lt - 3.8) * 1.2);
          const fColors = ["#ffd75e", "#ff9ec8", "#c99aef", "#ff8a7a", "#9adcff", "#fff2a0"];
          const count = Math.floor(flowerProg * 30);
          for (let i = 0; i < count; i++) {
            const fx = tx - 140 + ((i * 37) % 280);
            const fy = ty - 10 + Math.sin(i * 1.4) * 8 + ((i * 13) % 10);
            // Don't spawn under trunk
            if (Math.abs(fx - tx) < trunkW/2 + 6) continue;
            ctx.globalAlpha = flowerProg;
            ctx.fillStyle = fColors[i % fColors.length];
            // Tiny pixel flower — center + 4 petals
            ctx.fillRect(Math.round(fx), Math.round(fy), 2, 2);
            ctx.fillRect(Math.round(fx - 2), Math.round(fy), 2, 2);
            ctx.fillRect(Math.round(fx + 2), Math.round(fy), 2, 2);
            ctx.fillRect(Math.round(fx), Math.round(fy - 2), 2, 2);
            // pollen center
            ctx.fillStyle = "#fff8d0";
            ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1);
          }
          ctx.globalAlpha = 1;
        }

        // Final gentle vignette to focus on tree
        if (lt > 4.5) {
          ctx.fillStyle = `rgba(0,0,0,${(lt - 4.5)*0.06})`;
          const vg = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.95);
          vg.addColorStop(0, "rgba(0,0,0,0)");
          vg.addColorStop(1, `rgba(0,0,0,${(lt - 4.5)*0.18})`);
          ctx.fillStyle = vg;
          ctx.fillRect(-4, -4, W+8, H+8);
        }
      }

      ctx.restore();
      return;
    }

    // --- DESCENT: clean camera dolly down into the next biome ---
    // No cracks, no pixel collapse — just the camera sliding down through earth.
    if (this.phase === "descending" && this.nextWorld) {
      const dur = 2.8;
      const p = Math.max(0, Math.min(1, this.descendT / dur));
      const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; // easeInOutCubic
      // Pixel-snap the offset so the two sliding worlds always meet on a
      // whole-pixel boundary — no fractional/antialiased seam can appear.
      const yOff = Math.round(eased * H);

      // Full-screen earth backdrop FIRST — any pixel not covered by either
      // sliding world still shows the previous biome's Minecraft-style dirt
      // cross-section, never black.
      this.drawEarthShaft(ctx, H - yOff, this.world.biome, p);

      // old world sliding up and out
      ctx.save();
      ctx.translate(0, -yOff);
      this.world.draw(ctx, t, this.night, this.holeX, this.holeRadius(), 0, false);
      // draw old hole at its world position (so it slides with the land)
      this.drawHoleAt(ctx, t, this.world.biome, this.holeX, TARGET_Y, this.holeRadius());
      ctx.restore();

      // new world sliding up from below — nudged 1px into the old world so
      // the two slabs always overlap slightly and can never show a gap.
      ctx.save();
      ctx.translate(0, H - yOff - 1);
      this.nextWorld.draw(ctx, t, 0, this.holeX, this.holeRadius(), 0, false);
      this.drawHoleAt(ctx, t, this.nextWorld.biome, this.holeX, TARGET_Y, this.holeRadius());
      ctx.restore();

      // Chunky zigzag boundary: a visible pixel-art edge where one dimension
      // ends and the next begins, like a Minecraft terrain cutaway.
      this.drawDimensionZigzag(ctx, H - yOff, this.world.biome, this.nextWorld.biome, p);

      // skip the normal world+hole draw below — we already drew both
      this.drawFoods(ctx);
      this.drawParticles(ctx);
      this.drawTexts(ctx);
      if (this.moodOverfed > 0.2) {
        const a = this.moodOverfed * (0.1 + 0.06 * Math.sin(t * 14));
        ctx.fillStyle = `rgba(255,60,30,${a})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(255,244,200,${this.flash * 0.7})`;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
      return;
    }

    // --- ASCENT TO HEAVENS: burst up through earth into sky ---
    if (this.phase === "ascending" && this.nextWorld) {
      const dur = 2.8;
      const p = Math.max(0, Math.min(1, this.descendT / dur));
      const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const yOff = Math.round(eased * H);

      // Full-screen shaft behind — same earth column, just seen from below
      this.drawEarthShaft(ctx, yOff, this.world.biome, p);

      // old world (magma) sliding DOWN and out
      ctx.save();
      ctx.translate(0, yOff);
      this.world.draw(ctx, t, this.night, this.holeX, this.holeRadius(), 0, false);
      this.drawHoleAt(ctx, t, this.world.biome, this.holeX, TARGET_Y, this.holeRadius());
      ctx.restore();

      // heavens sliding DOWN from above — with slight overlap to hide seam
      ctx.save();
      ctx.translate(0, -H + yOff + 1);
      this.nextWorld.draw(ctx, t, 0, this.holeX, this.holeRadius(), 0, false);
      this.drawHoleAt(ctx, t, this.nextWorld.biome, this.holeX, TARGET_Y, this.holeRadius());
      ctx.restore();

      this.drawDimensionZigzag(ctx, yOff, this.world.biome, this.nextWorld.biome, p);

      this.drawFoods(ctx);
      this.drawParticles(ctx);
      this.drawTexts(ctx);
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(255,244,200,${this.flash * 0.7})`;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
      return;
    }

    this.world.draw(
      ctx, t, this.night, this.holeX,
      // In the menu there is no hole, so don't carve an exclusion gap in the scenery.
      this.phase === "menu" ? 0 : this.holeRadius(),
      this.mysteryActive > 0 ? this.biome.mystery : 0,
      this.phase === "menu"
    );

    // The menu is a pure scenic backdrop — no hole/creature on the title screen.
    if (this.phase !== "menu") this.drawHole(ctx, t);

    this.drawFoods(ctx);
    this.drawParticles(ctx);
    this.drawTexts(ctx);

    // wind streaks
    if (this.wind > 0.2) {
      ctx.globalAlpha = this.wind * 0.4;
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 10; i++) {
        const sx = ((t * (140 + i * 30) + i * 211) % (W + 60)) - 30;
        const sy = 30 + ((i * 83) % 240);
        ctx.fillRect(sx, sy, 26, 2);
        ctx.fillRect(sx + 34, sy + 8, 16, 1);
      }
      ctx.globalAlpha = 1;
    }

    // overfed red pulse
    if (this.moodOverfed > 0.2) {
      const a = this.moodOverfed * (0.1 + 0.06 * Math.sin(t * 14));
      ctx.fillStyle = `rgba(255,60,30,${a})`;
      ctx.fillRect(0, 0, W, H);
    }
    // starving vignette
    if (this.sizePct < 0.2 && this.phase === "playing") {
      const a = (0.2 - this.sizePct) * 2.2;
      const vg = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 300);
      vg.addColorStop(0, "rgba(30,10,10,0)");
      vg.addColorStop(1, `rgba(30,5,5,${a})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    // perfect flash
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,244,200,${this.flash * 0.7})`;
      ctx.fillRect(0, 0, W, H);
    }
    // descent fade: ground shatters, darkness rushes, then the new biome flashes in
    if (this.phase === "descending") {
      const t2 = this.descendT;
      // subtle darkening as dust fills the air before the full blackout
      if (t2 > 1.0) {
        const dust = Math.min(0.32, (t2 - 1.0) / 4.0);
        ctx.fillStyle = `rgba(40,30,10,${dust * 0.45})`;
        ctx.fillRect(-80, -80, W + 160, H + 160);
      }
      const a = Math.min(1, Math.max(0, (t2 - 3.2) / 1.6));
      if (a > 0) {
        ctx.fillStyle = `rgba(0,0,0,${a})`;
        ctx.fillRect(-80, -80, W + 160, H + 160);
      }
      // rushing depth streaks — they accelerate and converge toward the hole
      if (t2 > 2.4) {
        const alpha = Math.min(0.22, (t2 - 2.4) * 0.12);
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < 22; i++) {
          const lx = (i * 31 + ((t * 700) % 31)) % W;
          const len = 30 + (i % 3) * 20 + (t2 - 2.4) * 18;
          ctx.beginPath();
          ctx.moveTo(lx, -10);
          ctx.lineTo(lx - 5 - (t2 - 2.4) * 1.5, -10 + len);
          ctx.stroke();
        }
      }
      // center flash as we breach into the new world
      if (t2 > 4.6) {
        const flash = Math.max(0, 1 - (t2 - 4.6) / 0.4);
        ctx.fillStyle = `rgba(255,244,200,${flash * 0.55})`;
        ctx.fillRect(-80, -80, W + 160, H + 160);
      }
    }
    ctx.restore();
  }

  private drawFoods(ctx: CanvasRenderingContext2D) {
    const starScale = this.activeEvent?.id === "tiny" ? 0.6 : this.activeEvent?.id === "giant" ? 1.55 : 1;
    for (const f of this.foods) {
      const bob = Math.sin(f.phase * 2.2) * 2.5;
      const y = f.caughtT > 0 ? f.y : f.y + bob;
      // soft drop-shadow directly beneath the food (top-down field look)
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "#0e2210";
      const sw = f.size * 0.62;
      ctx.beginPath();
      ctx.ellipse(f.x, y + f.size * 0.55, sw / 2, sw / 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // glow (golden apple etc.)
      if (f.def.glow && f.caughtT === 0) {
        const g = ctx.createRadialGradient(f.x, y, 2, f.x, y, f.size * 1.5);
        g.addColorStop(0, f.def.glow + "55");
        g.addColorStop(1, f.def.glow + "00");
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = g;
        ctx.fillRect(f.x - f.size * 1.6, y - f.size * 1.6, f.size * 3.2, f.size * 3.2);
        ctx.globalAlpha = 1;
      }
      // meteor trail
      if (f.id === "meteor") {
        ctx.fillStyle = "rgba(255,138,58,0.5)";
        ctx.fillRect(f.x - 3, y - 16, 6, 12);
        ctx.fillStyle = "rgba(255,215,94,0.6)";
        ctx.fillRect(f.x - 2, y - 12, 4, 8);
      }

      const scale = f.caughtT > 0 ? 1 - f.caughtT / 0.16 : starScale;
      drawSprite(ctx, f.id, f.x, y, f.size * scale, f.rot);

      // frozen tint
      if (f.frozen) {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#c8ecff";
        ctx.fillRect(f.x - f.size / 2, y - f.size / 2, f.size, f.size);
        ctx.globalAlpha = 1;
      }
      // magnetized sparks
      if (f.magnetized) {
        ctx.fillStyle = "rgba(255,138,122,0.8)";
        ctx.fillRect(f.x + f.size * 0.4, y - f.size * 0.4, 2, 2);
      }

      // value label
      if (f.caughtT === 0 && f.landT === 0) {
        const label = f.special === "mystery" ? "?" : f.special === "rainbow" ? "≈" : f.special === "chili" ? "×2" : f.special === "golden" ? "+8" : `${f.value > 0 ? "+" : ""}${f.value}`;
        const lw = label.length * 6 + 8;
        ctx.fillStyle = "rgba(24,12,4,0.72)";
        ctx.fillRect(f.x - lw / 2, y - f.size / 2 - 12, lw, 11);
        ctx.fillStyle = f.value < 0 ? "#ff8a7a" : f.special === "golden" ? "#ffd75e" : "#ffffff";
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.textAlign = "center";
        ctx.fillText(label, f.x, y - f.size / 2 - 3.5);
      }
    }
  }

  private drawHole(ctx: CanvasRenderingContext2D, t: number) {
    this.drawHoleAt(ctx, t, this.biome, this.holeX, TARGET_Y, this.holeRadius());
  }

  /** Draws the old biome as a vertical dirt cross-section in the seam. */
  /** Deterministic 0..1 hash for a grid cell — stable across frames, so the
   *  block texture never shimmers while the shaft scrolls with the camera. */
  private static blockHash(cx: number, cy: number): number {
    let h = (cx * 374761393 + cy * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }

  /**
   * Minecraft-inspired blocky side-cut of the biome we're leaving behind.
   * Drawn full-screen, BEHIND both sliding worlds, on a crisp 8px grid so
   * the strata always read as perfectly stacked terrain layers rather than
   * a smooth gradient. Grid is anchored to world space (not frame time),
   * so blocks stay rock-solid in place as the camera scrolls past them.
   */
  private drawEarthShaft(ctx: CanvasRenderingContext2D, seamY: number, biome: BiomeDef, _progress: number) {
    const D = dirtPalette(biome.kind);
    const BLOCK = 8;
    const cols = Math.ceil(W / BLOCK) + 1;

    // Layer recipe below the grass cap, in whole blocks — repeats forever
    // downward so the cross-section never runs out, however deep we look.
    const LAYERS: { h: number; col: string; fleck?: string; fleckChance?: number }[] = [
      { h: 3, col: D.layers[0] }, // topsoil
      { h: 2, col: D.layers[1] }, // subsoil transition
      { h: 7, col: D.layers[2], fleck: D.hi, fleckChance: 0.05 }, // stone, lightly veined
      { h: 7, col: D.layers[3], fleck: biome.accent, fleckChance: 0.035 }, // deep stone, biome-colored ore
      { h: 6, col: D.layers[4], fleck: biome.accent, fleckChance: 0.02 }, // bedrock-dark core
    ];
    const cycleBlocks = LAYERS.reduce((s, l) => s + l.h, 0);

    // topRow is the first FULL block row below the seam (grass sits above it).
    const seamSnap = Math.round(seamY / BLOCK) * BLOCK;
    const firstRow = Math.round(seamSnap / BLOCK);
    const rows = Math.ceil(H / BLOCK) + 2;

    for (let r = -1; r <= rows; r++) {
      const worldRow = firstRow + r;
      const y = worldRow * BLOCK;
      if (y < -BLOCK || y > H + BLOCK) continue;

      if (r < 0) continue; // handled by the grass cap below

      // find which layer this row falls into (cycles forever)
      let idx = worldRow - firstRow;
      idx = ((idx % cycleBlocks) + cycleBlocks) % cycleBlocks;
      let layer = LAYERS[0];
      let acc = 0;
      for (const l of LAYERS) {
        if (idx < acc + l.h) { layer = l; break; }
        acc += l.h;
      }

      for (let c = -1; c < cols; c++) {
        const x = c * BLOCK;
        const hh = HungryHoleEngine.blockHash(c, worldRow);
        // base block, with a touch of per-block shade variance
        const shadeVariant = hh < 0.33 ? 0 : hh < 0.66 ? 1 : 2;
        ctx.fillStyle = layer.col;
        ctx.fillRect(x, y, BLOCK, BLOCK);
        if (shadeVariant !== 1) {
          ctx.fillStyle = shadeVariant === 0 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.10)";
          ctx.fillRect(x, y, BLOCK, BLOCK);
        }
        // crisp block seams (bottom + right edge) — the Minecraft "grid" look
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(x, y + BLOCK - 1, BLOCK, 1);
        ctx.fillRect(x + BLOCK - 1, y, 1, BLOCK);
        // subtle top-left bevel highlight
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(x, y, BLOCK, 1);
        // occasional ore/crystal fleck, biome-colored
        if (layer.fleck && HungryHoleEngine.blockHash(c * 7 + 3, worldRow * 5 + 1) < (layer.fleckChance ?? 0)) {
          ctx.fillStyle = layer.fleck;
          ctx.fillRect(x + 2, y + 2, 3, 3);
          ctx.fillRect(x + 4, y + 4, 2, 2);
        }
      }
    }

    // ---- grass cap: one crisp block row exactly at the seam ----
    const capY = seamSnap - BLOCK;
    for (let c = -1; c < cols; c++) {
      const x = c * BLOCK;
      const hh = HungryHoleEngine.blockHash(c, firstRow - 1);
      ctx.fillStyle = biome.ground[hh < 0.5 ? 0 : 1] ?? biome.ground[0];
      ctx.fillRect(x, capY, BLOCK, BLOCK);
      // bright grass-blade texture on top third of the block
      ctx.fillStyle = biome.groundLine;
      ctx.fillRect(x, capY, BLOCK, 2);
      if (hh > 0.4) ctx.fillRect(x + (hh > 0.7 ? 5 : 1), capY, 2, 4);
      // crisp seams matching the rest of the grid
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(x, capY + BLOCK - 1, BLOCK, 1);
      ctx.fillRect(x + BLOCK - 1, capY, 1, BLOCK);
    }
  }

  /** Draw a snapped, alternating staircase edge across the dimensional seam. */
  private drawDimensionZigzag(ctx: CanvasRenderingContext2D, seamY: number, from: BiomeDef, to: BiomeDef, progress: number) {
    const step = 16;
    const y = Math.round(seamY / 2) * 2;
    const dark = dirtPalette(from.kind).rim;
    const light = to.groundLine;
    const wobble = Math.min(1, progress * 1.5);

    // dark underside gives the cut depth; the bright line is the new biome's
    // top edge. Both are composed of rectangles only, never antialiased paths.
    for (let x = -step; x < W + step; x += step) {
      const high = ((x / step) & 1) === 0;
      const yy = y + (high ? -4 : 4) * wobble;
      ctx.fillStyle = dark;
      ctx.fillRect(x, yy + 2, step + 2, 6);
      ctx.fillRect(x + step - 2, high ? yy + 2 : yy - 4, 4, 10);
      ctx.fillStyle = light;
      ctx.fillRect(x, yy, step + 2, 3);
      ctx.fillRect(x + step - 2, high ? yy : yy - 3, 4, 7);
    }
  }

  /** Space biomes: Gargantua-style pixel black hole (no eyes) — reference image. */
  private drawBlackHoleMouth(
    ctx: CanvasRenderingContext2D,
    t: number,
    _biome: BiomeDef,
    x: number,
    y: number,
    r: number,
    breath: number,
    overfed: boolean
  ) {
    const rx = r * (1 - breath * 0.005 - (overfed ? 0.025 : 0));
    const ry = rx * 0.44 + breath * 0.25;
    const PX = 2;
    const snap = (v: number) => Math.round(v / PX) * PX;
    // subtle breathing pulse
    const pulse = 1 + Math.sin(t * 1.8) * 0.015 + (overfed ? 0.03 : 0);
    const sx = rx * pulse;
    const sy = ry * pulse;

    ctx.save();
    ctx.translate(x, y);
    ctx.imageSmoothingEnabled = false;
    // @ts-ignore
    ctx.mozImageSmoothingEnabled = false;
    // @ts-ignore
    ctx.webkitImageSmoothingEnabled = false;

    // helper: filled stepped ellipse (pixelated)
    const pxEllFill = (cx: number, cy: number, rx2: number, ry2: number, col: string) => {
      ctx.fillStyle = col;
      for (let yy = -ry2; yy <= ry2; yy += PX) {
        const w = rx2 * Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry2 * ry2)));
        if (w < 0.5) continue;
        ctx.fillRect(snap(cx - w), snap(cy + yy), Math.max(PX, snap(w * 2)), PX);
      }
    };

    // 1) jets — cream diamond chain, behind the disk & hole
    const jetCol = "#fff6c8";
    const jetCol2 = "#ffe9a0";
    const drawJet = (dir: number) => {
      // dir = -1 up, +1 down
      let yy = dir * (sy * 0.72 + 6);
      for (let i = 0; i < 14; i++) {
        const s = i < 2 ? 6 : i < 4 ? 4 : 2;
        const col = i % 3 === 0 ? jetCol2 : jetCol;
        ctx.fillStyle = col;
        // diamond step: alternating 1px offset creates zigzag
        const off = i % 2 === 0 ? 0 : 1;
        ctx.fillRect(snap(-s / 2 + off), snap(yy), s, s);
        // small side pixel for diamond shape
        if (s > 2) {
          ctx.fillRect(snap(-s / 2 - 1 + off), snap(yy + 1), 1, 1);
          ctx.fillRect(snap(s / 2 + off), snap(yy + 1), 1, 1);
        }
        yy += dir * (s + 2 + (i % 2));
        if (Math.abs(yy) > 78) break;
      }
    };
    drawJet(-1);
    drawJet(1);

    // 2) outer disk shadow / soft glow (dark base)
    pxEllFill(0, 0, sx * 1.65, sy * 1.55, "#1a0a14");
    pxEllFill(0, 1, sx * 1.62, sy * 1.5, "#24101c");

    // 3) accretion disk layers — outer to inner, pixel stepped
    // palette sampled from reference image
    const layers: { rx: number; ry: number; col: string }[] = [
      { rx: sx * 1.58, ry: sy * 1.42, col: "#3d1020" },
      { rx: sx * 1.45, ry: sy * 1.28, col: "#5a1628" },
      { rx: sx * 1.32, ry: sy * 1.14, col: "#8a1a2a" },
      { rx: sx * 1.18, ry: sy * 0.98, col: "#b82a1e" },
      { rx: sx * 1.02, ry: sy * 0.84, col: "#d94a14" },
      { rx: sx * 0.88, ry: sy * 0.72, col: "#e86e14" },
      { rx: sx * 0.72, ry: sy * 0.60, col: "#f09a18" },
      { rx: sx * 0.60, ry: sy * 0.50, col: "#f7c83a" },
      { rx: sx * 0.52, ry: sy * 0.42, col: "#fff0a0" },
    ];
    for (const l of layers) pxEllFill(0, 0, l.rx, l.ry, l.col);

    // 4) swirl detail — darker spiral streaks on the disk (pixel blocks)
    ctx.fillStyle = "rgba(40,8,16,0.55)";
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + t * 0.35;
      const rr = sx * (0.65 + (i % 4) * 0.18);
      const px2 = Math.cos(a) * rr;
      const py2 = Math.sin(a) * rr * 0.42;
      // only on the disk area, not over the hole
      if (px2 * px2 + py2 * py2 < sx * sx * 0.22) continue;
      ctx.fillRect(snap(px2), snap(py2), 4, 2);
      if (i % 3 === 0) ctx.fillRect(snap(px2 + 2), snap(py2 + 2), 2, 2);
    }

    // 5) doppler brightness — left side (approaching) is brighter
    // add a few bright speckles on left-bottom quadrant
    ctx.fillStyle = "#ffeca0";
    for (let i = 0; i < 6; i++) {
      const a = -0.7 + (i / 6) * 1.1 + Math.sin(t * 0.6 + i) * 0.15;
      const rr = sx * (0.75 + (i % 2) * 0.12);
      const px2 = Math.cos(a) * rr;
      const py2 = Math.sin(a) * rr * 0.45;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 2 + i);
      ctx.fillRect(snap(px2), snap(py2), 3, 2);
    }
    ctx.globalAlpha = 1;

    // 6) lensed top arc — the far side of the disk warped above the shadow
    // thin bright line peeking over the top of the black hole
    ctx.fillStyle = "#fff0a0";
    for (let xx = -sx * 0.55; xx <= sx * 0.55; xx += PX) {
      const a = Math.asin(Math.max(-1, Math.min(1, xx / (sx * 0.58))));
      const yy = -sy * 0.58 - Math.cos(a) * 8 - 2;
      ctx.fillRect(snap(xx), snap(yy), PX, PX);
      if (Math.abs(xx) < sx * 0.3) ctx.fillRect(snap(xx), snap(yy - 2), PX, PX);
    }
    // second fainter lensed line
    ctx.fillStyle = "#f7c83a";
    for (let xx = -sx * 0.45; xx <= sx * 0.45; xx += PX * 2) {
      const a = Math.asin(Math.max(-1, Math.min(1, xx / (sx * 0.48))));
      const yy = -sy * 0.58 - Math.cos(a) * 6 - 5;
      ctx.fillRect(snap(xx), snap(yy), PX, PX);
    }

    // 7) black hole shadow — pixel-stepped
    const shRX = sx * 0.46;
    const shRY = sy * 0.62;
    pxEllFill(0, 0, shRX, shRY, "#000000");
    pxEllFill(1, 1, shRX * 0.92, shRY * 0.92, "#020208");

    // 8) ONE ANCIENT EYE deep inside the event horizon — 16-bit pixel style
    const eyePulse = 0.6 + 0.4 * Math.sin(t * 1.4);
    const eyeCol = "#ffdd66";
    const pupilCol = "#0a0a18";
    // sclera (white of eye) — small pixel circle
    pxEllFill(0, 0, shRX * 0.28, shRY * 0.32, eyeCol);
    // glow around the eye
    const eyeGlow = ctx.createRadialGradient(0, 0, 2, 0, 0, shRX * 0.55);
    eyeGlow.addColorStop(0, `rgba(255,220,100,${0.55 * eyePulse})`);
    eyeGlow.addColorStop(1, "rgba(255,220,100,0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = eyeGlow;
    pxEllFill(0, 0, shRX * 0.52, shRY * 0.58, eyeCol);
    ctx.globalCompositeOperation = "source-over";
    // vertical slit pupil — 16-bit style
    pxEllFill(0, 0, shRX * 0.10, shRY * 0.18, pupilCol);
    // tiny white specular highlight
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(snap(shRX * 0.08), snap(-shRY * 0.12), 2, 2);

    ctx.restore();
  }

  private drawHoleAt(ctx: CanvasRenderingContext2D, t: number, biome: BiomeDef, x: number, y: number, r: number) {
    // Soft organic breathing scale
    const breath = Math.sin(t * (this.sizePct < 0.2 ? 1.2 : 2.2)) * (0.6 + (1 - this.sizePct) * 0.8);
    const overfed = this.moodOverfed > 0.2 || this.fullness > this.target;
    const jitter = overfed ? Math.sin(t * 40) * 1.2 : this.sizePct < 0.12 ? Math.sin(t * 30) * 0.8 : 0;

    // Perspective ellipse dimensions (no descent expansion — camera does the work)
    const rx = r * (1 - breath * 0.010 - (overfed ? 0.05 : 0));
    const ry = rx * 0.58 + breath * 0.5 + (overfed ? 3 : 0);
    const hunger = 1 - this.sizePct;
    const D = dirtPalette(biome.kind);

    if (biome.kind === "void" || biome.kind === "cosmic" || biome.kind === "star") {
      this.drawBlackHoleMouth(ctx, t, biome, x, y, r, breath, overfed);
      return;
    }
    // Water, molten rock and the void have no soil to crumble: the mouth is
    // the same hole, just with smooth edges instead of a jagged dirt rim.
    const clean = biome.kind === "lake" || biome.kind === "magma" || biome.kind === "abyss";

    ctx.save();
    ctx.translate(x, y + jitter * 0.4);

    const steps = 32;

    /* ============================================================
       0. EXCAVATED DIRT & GRASS BLEND (blends the crater INTO the field)
       Scatter little dirt clumps and worn-grass patches on the meadow
       around the rim so the hole doesn't look "pasted on" the grass.
       ============================================================ */
    // Terrain halo — its color comes from THIS biome (cyan cave stone,
    // violet crystal dust, red magma ash, etc.), never generic brown.
    const rgba = (hex: string, alpha: number) =>
      `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${alpha})`;
    // HEAVEN has no dark dirt halo — it's a cloud, not soil
    if (biome.kind !== "heaven") {
      const halo = ctx.createRadialGradient(0, 2, rx * 0.9, 0, 2, rx * 1.9);
      halo.addColorStop(0, rgba(D.layers[1], 0));
      halo.addColorStop(0.42, rgba(biome.groundLine, 0.28));
      halo.addColorStop(0.7, rgba(D.layers[0], 0.26));
      halo.addColorStop(1, rgba(biome.ground[0], 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.ellipse(0, 2, rx * 1.9, rx * 1.9 * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Excavated dirt clumps flung onto the ground around the rim.
    if (!clean) {
      for (let i = 0; i < 26; i++) {
        const a = i * 2.3999; // golden-angle scatter (deterministic)
        const rr = rx * (1.15 + ((i * 37) % 60) / 100); // 1.15..1.75
        const dx = Math.cos(a) * rr;
        const dy = Math.sin(a) * rr * 0.6;
        const sz = 1 + (i % 3);
        ctx.fillStyle = i % 4 === 0 ? biome.ground[0] : i % 4 === 1 ? D.layers[0] : D.layers[1];
        ctx.fillRect(dx - sz / 2, dy - sz / 2, sz, sz);
      }
    }

    /* ============================================================
       1. DEEP SINKHOLE GROUND SHADOW (indentation in the meadow)
       HEAVEN skips this — no dark pit shadow on clouds
       ============================================================ */
    if (biome.kind !== "heaven") {
      const outerR = rx * 1.55;
      const gsh = ctx.createRadialGradient(0, 3, rx * 0.5, 0, 3, outerR);
      gsh.addColorStop(0, rgba(D.layers[4], 0.52));
      gsh.addColorStop(0.55, rgba(D.rim, 0.32));
      gsh.addColorStop(1, rgba(D.rim, 0));
      ctx.fillStyle = gsh;
      ctx.beginPath();
      ctx.ellipse(0, 4, outerR, outerR * 0.58, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    /* ============================================================
       1b. RAISED GRASSY LIP RING (the turf mound around the crater)
       A soft ring of raised grass-colored soil that dips into the hole,
       giving a real "the ground caves in here" read.
       ============================================================ */
    // HEAVEN: pure white cloud lip — no dark border whatsoever
    if (biome.kind === "heaven") {
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 1.20, ry * 1.20, 0, 0, Math.PI * 2);
      ctx.closePath();
      const cloudLip = ctx.createRadialGradient(0, -1, rx * 0.7, 0, 1, rx * 1.25);
      cloudLip.addColorStop(0, "#ffffff");
      cloudLip.addColorStop(0.55, "#eef4ff");
      cloudLip.addColorStop(1, biome.ground[0]);
      ctx.fillStyle = cloudLip;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 1.06, ry * 1.06, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    } else if (clean) {
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 1.22, ry * 1.22, 0, 0, Math.PI * 2);
      ctx.closePath();
      const lipG = ctx.createRadialGradient(0, -2, rx * 0.7, 0, 2, rx * 1.25);
      lipG.addColorStop(0, D.layers[0]);
      lipG.addColorStop(0.7, D.rim);
      lipG.addColorStop(1, biome.ground[0]);
      ctx.fillStyle = lipG;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 1.08, ry * 1.08, 0, 0, Math.PI * 2);
      ctx.fillStyle = D.rim;
      ctx.fill();
    } else {
      ctx.beginPath();
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const jagged = 1 + Math.sin(angle * 6 + 0.5) * 0.05 + Math.cos(angle * 11) * 0.03;
        const px = Math.cos(angle) * rx * 1.22 * jagged;
        const py = Math.sin(angle) * ry * 1.22 * jagged;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      const lipG = ctx.createRadialGradient(0, -2, rx * 0.7, 0, 2, rx * 1.25);
      lipG.addColorStop(0, D.layers[0]);       // inner: exposed soil of the lip
      lipG.addColorStop(0.7, D.rim);           // mid: darker packed edge
      lipG.addColorStop(1, biome.ground[0]); // outer: blends into this world's floor
      ctx.fillStyle = lipG;
      ctx.fill();

      /* ============================================================
         2. ORGANIC JAGGED OUTLINE (the "bitten/collapsed" meadow edge)
         ============================================================ */
      const points: [number, number][] = [];
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const jagged = 1 + Math.sin(angle * 7 + 0.5) * 0.04 + Math.cos(angle * 13 + 1.2) * 0.02;
        points.push([
          Math.cos(angle) * rx * 1.08 * jagged,
          Math.sin(angle) * ry * 1.06 * jagged
        ]);
      }

      // Draw the surrounding dark-soil edge rim
      ctx.fillStyle = D.rim;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < steps; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.closePath();
      ctx.fill();
    }

    /* ============================================================
       3. THE LAYERED DIRT CLIFF WALLS (realistic sinkhole plunge)
       We draw concentric, slightly shifted jagged polygons to represent
       the layered, stratified layers of the soil cliff face.
       ============================================================ */
    const layers = [
      { scale: 0.95, shiftY: -2, col: D.layers[0] }, // Upper soil layer
      { scale: 0.82, shiftY: -1, col: D.layers[1] }, // Middle stratum
      { scale: 0.68, shiftY: 1,  col: D.layers[2] }, // Deep rocky layer
      { scale: 0.52, shiftY: 3,  col: D.layers[3] }, // Lowest crevice
      { scale: 0.36, shiftY: 5,  col: D.layers[4] }, // Pitch black plunge
    ];

    if (clean || biome.kind === "heaven") {
      for (const ly of layers) {
        ctx.fillStyle = ly.col;
        ctx.beginPath();
        ctx.ellipse(0, ly.shiftY, rx * ly.scale, ry * ly.scale, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      for (const ly of layers) {
        ctx.fillStyle = ly.col;
        ctx.beginPath();
        for (let i = 0; i < steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          const jagged = 1 + Math.sin(angle * 8 + i) * 0.03 + Math.cos(angle * 15) * 0.015;
          const px = Math.cos(angle) * rx * ly.scale * jagged;
          // Shift y downwards to simulate depth perspective looking "down" into the hole
          const py = Math.sin(angle) * ry * ly.scale * jagged + ly.shiftY;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    /* ============================================================
       4. SUNLIT HIGHLIGHT ON THE REAR EARTH WALL
       Matches the bright clay cliff edge caught by top daylight.
       ============================================================ */
    ctx.strokeStyle = D.hi; // biome-lit far wall
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    // Only highlight the bottom-rear curve where light sweeps in
    for (let i = 0; i <= steps / 2; i++) {
      const angle = (i / (steps / 2)) * Math.PI;
      const jagged = 1 + Math.sin(angle * 6) * 0.04;
      const px = Math.cos(angle) * rx * 0.88 * jagged;
      const py = Math.sin(angle) * ry * 0.88 * jagged + 1;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    /* ============================================================
       5. JAGGED SOD/GRASS EDGE OVERHANG
       The grass turf has collapsed and hangs raggedly into the pit,
       fully matching the reference image's messy sod-line.
       ============================================================ */
    /* ============================================================
       6. INNER RIM DROP SHADOWS — HEAVEN has no dark inner rim
       Deep shadow cast immediately below the sod-line inside.
       ============================================================ */
    if (biome.kind !== "heaven") {
      ctx.fillStyle = "rgba(0,0,0,0.48)";
      ctx.beginPath();
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const px = Math.cos(angle) * rx * 1.01;
        const py = Math.sin(angle) * ry * 1.01;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      for (let i = steps - 1; i >= 0; i--) {
        const angle = (i / steps) * Math.PI * 2;
        const px = Math.cos(angle) * rx * 0.93;
        const py = Math.sin(angle) * ry * 0.93 - 1.5;
        ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }

    /* ============================================================
       7. RADIAL DRY CRACKS — only where there is dry ground to crack.
       HEAVEN: no cracks, no spinner — pure peaceful cloud
       ============================================================ */
    if (biome.kind === "heaven") {
      // no cracks, no spinner — just soft cloud
    } else if (!clean) {
      const crackA = 0.22 + hunger * 0.55;
      ctx.strokeStyle = `${D.crack}${crackA})`;
      ctx.lineWidth = 1.1;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.35;
        const inner = rx * 1.1;
        const outer = rx * (1.3 + (i % 2) * 0.08);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner * 0.58);
        ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer * 0.58);
        ctx.stroke();
      }
    } else {
      // Two tapered half-arcs that slowly rotate around the mouth, like a
      // loading spinner: thick at one end, thin at the other.
      const ringCol = biome.kind === "lake" ? "rgba(200,245,255,0.85)"
        : biome.kind === "magma" ? "rgba(255,150,60,0.85)"
        : "rgba(160,160,235,0.6)";
      const spin = t * 1.1;                 // slow, readable rotation
      const ringRX = rx * 1.16;
      const ringRY = ry * 1.16;
      const gap = 0.22;                      // radians of empty space per side
      ctx.strokeStyle = ringCol;
      ctx.lineCap = "butt";
      for (let half = 0; half < 2; half++) {
        const base = spin + half * Math.PI;
        const from = base + gap;
        const to = base + Math.PI - gap;
        // Draw each half as many short segments so the stroke can taper.
        const segs = 26;
        for (let s = 0; s < segs; s++) {
          const p0 = s / segs;
          const p1 = (s + 1) / segs;
          const a0 = from + (to - from) * p0;
          const a1 = from + (to - from) * p1 + 0.012; // slight overlap, no seams
          // taper: fat at the start of the arc, vanishing at the end
          ctx.lineWidth = 0.6 + 3.4 * (1 - p0);
          ctx.beginPath();
          ctx.ellipse(0, 0, ringRX, ringRY, 0, a0, a1);
          ctx.stroke();
        }
      }
      ctx.lineWidth = 1;
    }

    /* eyes deep inside the darkness — no aura, the soil color is the biome read */
    this.drawEyes(ctx, rx, ry);

    ctx.restore();

    /* ground pulse when happy — biome-colored, now compact */
    if (this.moodHappy > 0.3) {
      const a = this.moodHappy * 0.45;
      const acc = biome.accent;
      const rgb = `${parseInt(acc.slice(1, 3), 16)},${parseInt(acc.slice(3, 5), 16)},${parseInt(acc.slice(5, 7), 16)}`;
      const pg = ctx.createRadialGradient(x, y + 8, 4, x, y + 8, r * 0.9);
      pg.addColorStop(0, `rgba(${rgb},${a * 0.55})`);
      pg.addColorStop(1, `rgba(${rgb},0)`);
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = pg;
      ctx.fillRect(x - r * 0.95, y - r * 0.55, r * 1.9, r * 1.1);
      ctx.globalCompositeOperation = "source-over";
    }
  }

  private drawDescentCracks(ctx: CanvasRenderingContext2D) {
    const t = this.descendT;
    const holeR = this.holeRadius();
    for (let i = 0; i < this.descendCracks.length; i++) {
      const cr = this.descendCracks[i];
      const delay = 0.5 + i * 0.04;
      const prog = Math.max(0, Math.min(1, (t - delay) / 1.6));
      if (prog <= 0) continue;
      const len = cr.ay * prog;
      const w = cr.w * (0.6 + prog * 0.8);
      const a = cr.ax + cr.bx * prog * 0.5;
      const sx = this.holeX + Math.cos(a) * holeR * 0.9;
      const sy = TARGET_Y + Math.sin(a) * holeR * 0.5;
      const ex = this.holeX + Math.cos(a) * (holeR * 0.9 + len);
      const ey = TARGET_Y + Math.sin(a) * (holeR * 0.5 + len * 0.55);
      const mx = (sx + ex) / 2 + Math.sin(a * 3) * 6 * prog;
      const my = (sy + ey) / 2 + Math.cos(a * 2) * 6 * prog;
      // Pixel-stamped crack segments, rather than an antialiased line.
      const segments = Math.max(3, Math.ceil(len / 5));
      for (let j = 0; j <= segments; j++) {
        const u = j / segments;
        const om = 1 - u;
        const px = om * om * sx + 2 * om * u * mx + u * u * ex;
        const py = om * om * sy + 2 * om * u * my + u * u * ey;
        const s = Math.max(1, Math.round(w));
        ctx.fillStyle = `rgba(16,8,2,${0.78 * prog})`;
        ctx.fillRect(Math.round(px), Math.round(py), s + 1, s);
        if (prog > 0.3 && j % 2 === 0) {
          ctx.fillStyle = this.biome.accent + Math.round(80 * (prog - 0.3)).toString(16).padStart(2, "0");
          ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
        }
      }
    }
    const ringProg = Math.max(0, Math.min(1, (t - 1.6) / 1.4));
    if (ringProg > 0) {
      const rr = holeR * (1.0 + ringProg * 1.1);
      ctx.strokeStyle = `rgba(0,0,0,${0.45 * ringProg})`;
      ctx.lineWidth = 3 + ringProg * 5;
      ctx.beginPath();
      ctx.ellipse(this.holeX, TARGET_Y, rr, rr * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /** Square ground tiles breaking free, then spiralling into the new pit. */
  private drawCollapsePixels(ctx: CanvasRenderingContext2D) {
    const p = Math.max(0, Math.min(1, (this.descendT - 1.0) / 2.5));
    if (p <= 0) return;
    const D = dirtPalette(this.biome.kind);
    // Deterministic tile field: it looks like the actual floor breaks into blocks.
    for (let i = 0; i < 74; i++) {
      const ang = i * 2.39996;
      const baseR = 48 + ((i * 43) % 145);
      const startX = this.holeX + Math.cos(ang) * baseR;
      const startY = TARGET_Y + Math.sin(ang) * baseR * 0.55;
      const stagger = Math.max(0, Math.min(1, (p - (i % 9) * 0.045) / 0.68));
      if (stagger <= 0) continue;
      const spin = ang + stagger * 2.4 + i * 0.15;
      const targetR = 8 + (i % 5) * 3;
      const endX = this.holeX + Math.cos(spin) * targetR;
      const endY = TARGET_Y + Math.sin(spin) * targetR * 0.55;
      // A quick upward hop before the chunk folds inward.
      const hop = Math.sin(stagger * Math.PI) * (8 + (i % 4) * 4);
      const x = lerp(startX, endX, stagger);
      const y = lerp(startY, endY, stagger) - hop;
      const sz = 2 + (i % 3) * 2;
      ctx.globalAlpha = 1 - stagger * 0.25;
      ctx.fillStyle = i % 4 === 0 ? this.biome.ground[0] : i % 4 === 1 ? D.layers[0] : D.layers[1];
      ctx.fillRect(Math.round(x), Math.round(y), sz, sz);
      // Lit top pixel makes each loose block feel dimensional.
      ctx.fillStyle = i % 4 === 0 ? this.biome.groundLine : D.hi.replace("rgba(", "rgb(").replace(/,[^)]+\)/, ")");
      ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, sz - 1), 1);
    }
    ctx.globalAlpha = 1;
  }

  private drawDescentDebris(ctx: CanvasRenderingContext2D) {
    for (const d of this.fallDebris) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.globalAlpha = d.life;
      if (d.kind === 0) {
        ctx.fillStyle = "#5aa83a";
        ctx.fillRect(-3, -2, 6, 4);
        ctx.fillStyle = "#8ad06a";
        ctx.fillRect(-2, -1, 4, 2);
      } else if (d.kind === 1) {
        ctx.fillStyle = ["#ff9ec8", "#ffd75e", "#c99aef", "#ff8a7a"][Math.floor(d.x) % 4];
        ctx.fillRect(-2, -2, 2, 2);
        ctx.fillRect(2, -2, 2, 2);
        ctx.fillRect(0, -3, 2, 2);
        ctx.fillRect(0, 0, 2, 2);
        ctx.fillStyle = "#fff3c0";
        ctx.fillRect(-1, -1, 2, 2);
      } else if (d.kind === 2) {
        ctx.fillStyle = "#9a9a8a";
        ctx.fillRect(-3, -2, 6, 4);
        ctx.fillStyle = "#c8c8b8";
        ctx.fillRect(-2, -2, 2, 2);
      } else {
        ctx.fillStyle = "#8a6a3c";
        ctx.fillRect(-2, -1, 4, 2);
      }
      ctx.restore();
    }
  }

  private drawEyes(ctx: CanvasRenderingContext2D, rx: number, ry?: number) {
    // "mr" is a reference size for the eyes. Use rx (major radius) as the base
    // and shift the eyes down toward the interior of the pit if it's flattened.
    const mr = rx;
    const eyeCenterY = ry !== undefined ? -ry * 0.05 : 0;
    // 1 = open, 0 = fully closed, over a 0.16s blink
    const blink = this.blinkAnim > 0 ? 1 - Math.sin((1 - this.blinkAnim / 0.16) * Math.PI) : 1;
    const starving = this.sizePct < 0.2;
    const dying = this.phase === "dying";
    const alpha = starving ? 0.45 : dying ? Math.max(0, 1 - this.dyingT * 1.6) : 1;
    if (alpha <= 0.02) return;
    const peek = this.phase === "menu" ? this.peekP : 0;

    // look at nearest food or pointer
    let lookX = 0, lookY = 0;
    if (this.phase === "playing") {
      let best: Food | null = null;
      let bd = Infinity;
      for (const f of this.foods) {
        if (f.caughtT > 0 || f.landT > 0) continue;
        const d = Math.hypot(f.x - this.holeX, f.y - TARGET_Y);
        if (d < bd) { bd = d; best = f; }
      }
      if (best) { lookX = clamp((best.x - this.holeX) / 60, -1, 1); lookY = clamp((best.y - TARGET_Y) / 60, -1, 0.6); }
    } else if (this.pointerX !== null) {
      lookX = clamp((this.pointerX - this.holeX) / 60, -1, 1);
    }
    if (this.moodScared > 0.3) { lookX = 0; lookY = -0.4; }

    const eyeY = eyeCenterY + mr * 0.05 - peek * 10;
    const eyeDX = mr * 0.28;
    const eyeW = mr * 0.26;
    const eyeH = mr * 0.22 * blink;

    // glow behind eyes
    ctx.globalCompositeOperation = "lighter";
    const eg = ctx.createRadialGradient(0, eyeY, 1, 0, eyeY, mr * 0.9);
    eg.addColorStop(0, `rgba(255,230,150,${0.16 * alpha})`);
    eg.addColorStop(1, "rgba(255,230,150,0)");
    ctx.fillStyle = eg;
    ctx.fillRect(-mr, eyeY - mr, mr * 2, mr * 1.8);
    ctx.globalCompositeOperation = "source-over";

    const mood = this.moodHappy > 0.4 ? "happy" : this.moodOverfed > 0.25 ? "overfed" : starving ? "starving" : this.moodScared > 0.3 ? "scared" : "normal";
    for (const side of [-1, 1]) {
      const ex = side * eyeDX;
      ctx.save();
      ctx.translate(ex, eyeY);
      if (mood === "happy") {
        ctx.strokeStyle = `rgba(255,244,200,${alpha})`;
        ctx.lineWidth = Math.max(2, eyeW * 0.34);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(0, eyeH * 0.1, eyeW * 0.42, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();
      } else if (mood === "overfed") {
        ctx.fillStyle = `rgba(255,240,200,${alpha})`;
        ctx.beginPath();
        ctx.arc(0, 0, eyeW * 0.52, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#201008";
        ctx.beginPath();
        ctx.arc(lookX * 2, lookY * 2, eyeW * 0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,120,60,0.8)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, eyeW * 0.52 + 3, 0, Math.PI * 2);
        ctx.stroke();
      } else if (mood === "starving") {
        ctx.fillStyle = `rgba(220,200,160,${alpha * 0.8})`;
        ctx.fillRect(-eyeW * 0.55, -1, eyeW * 1.1, 2.4);
      } else if (mood === "scared") {
        ctx.fillStyle = `rgba(255,240,200,${alpha})`;
        ctx.beginPath();
        ctx.arc(0, 0, eyeW * 0.48, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#201008";
        ctx.beginPath();
        ctx.arc(0, 0, eyeW * 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // normal soft eyes with pupil
        ctx.fillStyle = `rgba(255,236,180,${alpha})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, eyeW * 0.5, eyeH * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        if (eyeH > 3) {
          ctx.fillStyle = `rgba(30,14,6,${alpha})`;
          ctx.beginPath();
          ctx.ellipse(lookX * eyeW * 0.22, lookY * eyeH * 0.3, eyeW * 0.2, eyeH * 0.32, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(255,255,255,${alpha * 0.85})`;
          ctx.fillRect(lookX * eyeW * 0.22 - 1, lookY * eyeH * 0.3 - 2, 2, 2);
        }
      }
      ctx.restore();
    }
    // happy sparkles
    if (this.moodHappy > 0.4 && this.rng() < 0.2) {
      ctx.fillStyle = "#ffe066";
      ctx.fillRect(this.holeX + rand(-mr * 1.2, mr * 1.2), TARGET_Y - mr + rand(-6, 4), 2, 2);
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      if (p.glow) {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.globalCompositeOperation = "source-over";
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawTexts(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = "center";
    for (const tx of this.texts) {
      const a = clamp(tx.life / tx.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `${tx.size}px "Press Start 2P", monospace`;
      ctx.fillStyle = "#1c0e04";
      ctx.fillText(tx.text, tx.x + 2, tx.y + 2);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, tx.x, tx.y);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- misc ---------------- */

  getSave(): SaveData {
    return this.save;
  }

  getTotalScore(): number {
    // approximate persisted total for achievements
    return this.save.best.score;
  }

  isSpriteLoaded(name: string): boolean {
    return !!getSprite(name);
  }
}

export { fmtTime, getSprite };
