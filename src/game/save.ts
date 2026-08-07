/* ============================================================
   HUNGRY HOLE — SaveManager
   localStorage persistence: bests, totals, achievements, dex,
   daily challenge, local leaderboard, settings.
   ============================================================ */

export interface RunEntry {
  score: number;
  combo: number;
  perfects: number;
  time: number; // seconds survived
  date: string;
  daily: boolean;
}

export interface SaveData {
  version: number;
  best: { score: number; combo: number; perfects: number; time: number };
  totals: {
    food: number;
    perfects: number;
    burps: number;
    goldens: number;
    mystery: number;
    milk: number;
    chili: number;
    bombs: number;
    runs: number;
  };
  dex: string[]; // every food id caught at least once
  ach: string[]; // unlocked achievement ids
  daily: { date: string; score: number };
  board: RunEntry[];
  settings: { music: boolean; sfx: boolean };
  /* depth progression — the creature's long dig downward */
  deepest: number;        // deepest depth ever unlocked
  depthProg: number;      // progress toward next depth (perfect feeds)
  discovered: number[];   // depths visited at least once
  secrets: string[];      // secret-room ids found
  storyCompleted: boolean; // has the player finished the initial story?
}

const KEY = "hungryhole.save.v1";

export const defaultSave = (): SaveData => ({
  version: 1,
  best: { score: 0, combo: 0, perfects: 0, time: 0 },
  totals: { food: 0, perfects: 0, burps: 0, goldens: 0, mystery: 0, milk: 0, chili: 0, bombs: 0, runs: 0 },
  dex: [],
  ach: [],
  daily: { date: "", score: 0 },
  board: [],
  settings: { music: true, sfx: true },
  deepest: 1,
  depthProg: 0,
  discovered: [1],
  secrets: [],
  storyCompleted: false,
});

export const SaveManager = {
  load(): SaveData {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const base = defaultSave();
      return {
        ...base,
        ...parsed,
        best: { ...base.best, ...(parsed.best ?? {}) },
        totals: { ...base.totals, ...(parsed.totals ?? {}) },
        daily: { ...base.daily, ...(parsed.daily ?? {}) },
        settings: { ...base.settings, ...(parsed.settings ?? {}) },
        dex: parsed.dex ?? [],
        ach: parsed.ach ?? [],
        board: parsed.board ?? [],
        deepest: parsed.deepest ?? 1,
        depthProg: parsed.depthProg ?? 0,
        discovered: parsed.discovered ?? [1],
        secrets: parsed.secrets ?? [],
        storyCompleted: parsed.storyCompleted ?? false,
      };
    } catch {
      return defaultSave();
    }
  },

  save(data: SaveData) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* storage full / private mode — ignore */
    }
  },

  /** Deterministic seed for the daily challenge (local date). */
  dailySeed(): string {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  },

  /** Push a finished run onto the local leaderboard (top 6). */
  recordRun(data: SaveData, entry: RunEntry) {
    data.board = [...data.board, entry].sort((a, b) => b.score - a.score).slice(0, 6);
    if (entry.daily) {
      if (entry.score > data.daily.score || data.daily.date !== SaveManager.dailySeed()) {
        data.daily = { date: SaveManager.dailySeed(), score: entry.score };
      }
    }
  },
};

/** mulberry32 — tiny fast seeded RNG (daily challenge fairness). */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}
