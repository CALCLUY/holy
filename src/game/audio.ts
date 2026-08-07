/* ============================================================
   HUNGRY HOLE — AudioManager (with Heavens Sanctuary)
   Fully procedural WebAudio: no samples, everything synthesized.
   - Music: 4-layer chiptune step sequencer that evolves with combo
   - Heavens: dedicated warm sanctuary composition (72 BPM)
   - SFX: one-shot synth helpers for every game event
   - Ambient: wind loop + random birdsong
   ============================================================ */

type OscType = OscillatorType;

class AudioMgr {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  musicOn = true;
  sfxOn = true;

  // music sequencer state
  private seqTimer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private tier = 0;
  private musicPlaying = false;

  private static _inst: AudioMgr | null = null;
  static get i(): AudioMgr {
    if (!AudioMgr._inst) AudioMgr._inst = new AudioMgr();
    return AudioMgr._inst;
  }

  /* ---------- lifecycle ---------- */

  /** Must be called from a user gesture (button click). */
  ensure() {
    if (this.ac) {
      if (this.ac.state === "suspended") this.ac.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ac = new AC();
      this.master = this.ac.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ac.destination);
      this.musicGain = this.ac.createGain();
      this.musicGain.gain.value = this.musicOn ? 0.75 : 0;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ac.createGain();
      this.sfxGain.gain.value = this.sfxOn ? 0.9 : 0;
      this.sfxGain.connect(this.master);
      this.ambGain = this.ac.createGain();
      this.ambGain.gain.value = 0.5;
      this.ambGain.connect(this.master);
      // white noise buffer (shared)
      const len = this.ac.sampleRate * 2;
      this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.startAmbient();
    } catch {
      this.ac = null;
    }
  }

  setMusicOn(on: boolean) {
    this.musicOn = on;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(on ? 0.75 : 0, this.ac?.currentTime ?? 0, 0.1);
  }
  setSfxOn(on: boolean) {
    this.sfxOn = on;
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(on ? 0.9 : 0, this.ac?.currentTime ?? 0, 0.05);
  }

  /* ---------- low-level helpers ---------- */

  private tone(freq: number, dur: number, type: OscType, vol: number, opts: { slide?: number; delay?: number; attack?: number } = {}) {
    if (!this.ac || !this.sfxGain) return;
    const t0 = this.ac.currentTime + (opts.delay ?? 0);
    const osc = this.ac.createOscillator();
    const g = this.ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slide !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t0 + dur);
    const atk = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol: number, filterFreq: number, type: BiquadFilterType = "lowpass", opts: { slide?: number; delay?: number; q?: number } = {}) {
    if (!this.ac || !this.sfxGain || !this.noiseBuf) return;
    const t0 = this.ac.currentTime + (opts.delay ?? 0);
    const src = this.ac.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ac.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(filterFreq, t0);
    if (opts.slide !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(30, opts.slide), t0 + dur);
    f.Q.value = opts.q ?? 0.8;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  /* ---------- SFX ---------- */

  click() {
    this.tone(700, 0.06, "square", 0.25, { slide: 500 });
  }
  hover() {
    this.tone(900, 0.04, "square", 0.12);
  }

  /** Pickup pitch maps food value onto a happy pentatonic scale. */
  pickup(value: number) {
    if (value < 0) {
      // gross
      this.tone(140, 0.22, "sawtooth", 0.3, { slide: 70 });
      this.noise(0.15, 0.12, 500, "bandpass");
      return;
    }
    const scale = [523, 587, 659, 784, 880, 1047, 1175, 1319];
    const idx = Math.min(scale.length - 1, Math.abs(value) - 1);
    const f = scale[Math.max(0, idx)];
    this.tone(f, 0.09, "square", 0.22);
    this.tone(f * 2, 0.07, "sine", 0.14, { delay: 0.02 });
  }

  perfect() {
    const n = [659, 784, 988, 1319, 1568];
    n.forEach((f, i) => this.tone(f, 0.16, "triangle", 0.3, { delay: i * 0.055 }));
    this.tone(2093, 0.3, "sine", 0.12, { delay: 0.28 });
    this.noise(0.4, 0.08, 6000, "highpass", { delay: 0.02 });
  }

  comboUp(tier: number) {
    const base = 523 + tier * 110;
    this.tone(base, 0.09, "square", 0.2);
    this.tone(base * 1.5, 0.12, "square", 0.2, { delay: 0.07 });
  }

  comboLost() {
    this.tone(400, 0.18, "sawtooth", 0.16, { slide: 200 });
    this.tone(300, 0.24, "sawtooth", 0.14, { slide: 150, delay: 0.12 });
  }

  burp() {
    this.tone(170, 0.32, "sawtooth", 0.4, { slide: 45 });
    this.noise(0.3, 0.3, 400, "lowpass", { slide: 80 });
    this.tone(120, 0.22, "sawtooth", 0.26, { slide: 60, delay: 0.24 });
    this.noise(0.18, 0.16, 250, "lowpass", { delay: 0.24, slide: 90 });
  }

  growl() {
    this.tone(95, 0.3, "sawtooth", 0.2, { slide: 70 });
    this.tone(80, 0.26, "square", 0.12, { slide: 60, delay: 0.18 });
  }
  sad() {
    this.tone(330, 0.3, "sine", 0.2, { slide: 210 });
    this.tone(250, 0.4, "sine", 0.16, { slide: 160, delay: 0.16 });
  }
  happy() {
    this.tone(500, 0.1, "triangle", 0.22, { slide: 700 });
    this.tone(750, 0.14, "triangle", 0.18, { delay: 0.09, slide: 1000 });
  }
  scared() {
    this.tone(800, 0.2, "square", 0.22, { slide: 350 });
    this.tone(900, 0.18, "square", 0.18, { delay: 0.08, slide: 420 });
  }
  overfed() {
    this.tone(180, 0.3, "square", 0.3, { slide: 260 });
    this.noise(0.2, 0.15, 300, "lowpass");
  }
  gameover() {
    const n = [392, 311, 262, 196];
    n.forEach((f, i) => this.tone(f, 0.42, "triangle", 0.26, { delay: i * 0.28 }));
    this.tone(98, 1.4, "sine", 0.18, { delay: 0.2, slide: 60 });
  }
  achievement() {
    const n = [523, 659, 784, 1047, 1319, 1568];
    n.forEach((f, i) => this.tone(f, 0.14, "square", 0.2, { delay: i * 0.07 }));
  }
  mission() {
    this.tone(659, 0.1, "triangle", 0.24);
    this.tone(880, 0.18, "triangle", 0.24, { delay: 0.09 });
  }
  eventSting() {
    this.tone(440, 0.1, "square", 0.2);
    this.tone(587, 0.12, "square", 0.2, { delay: 0.08 });
    this.tone(880, 0.2, "square", 0.18, { delay: 0.16 });
  }
  golden() {
    [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.2, "sine", 0.2, { delay: i * 0.05 }));
    this.noise(0.5, 0.06, 8000, "highpass");
  }
  magnet() {
    this.tone(300, 0.35, "sine", 0.2, { slide: 900 });
  }
  freeze() {
    this.tone(1200, 0.3, "sine", 0.2, { slide: 2400 });
    this.noise(0.12, 0.08, 9000, "highpass");
  }
  slowmo() {
    this.tone(800, 0.4, "sine", 0.18, { slide: 200 });
  }
  explode() {
    this.noise(0.35, 0.4, 900, "lowpass", { slide: 90 });
    this.tone(130, 0.3, "sine", 0.35, { slide: 40 });
  }
  splat() {
    this.noise(0.09, 0.18, 700, "lowpass", { slide: 200 });
  }
  whoosh() {
    this.noise(0.25, 0.14, 1200, "bandpass", { slide: 300 });
  }
  ouch() {
    this.tone(220, 0.2, "sawtooth", 0.28, { slide: 110 });
  }
  uiOpen() {
    this.tone(523, 0.07, "square", 0.16);
    this.tone(784, 0.1, "square", 0.14, { delay: 0.06 });
  }
  uiClose() {
    this.tone(523, 0.08, "square", 0.14, { slide: 400 });
  }
  heartbeat() {
    this.tone(70, 0.12, "sine", 0.3);
    this.tone(60, 0.1, "sine", 0.22, { delay: 0.16 });
  }

  /** Disturbing low drone for the final reveal — dissonant, beating, endless */
  horrorDrone() {
    if (!this.ac || !this.sfxGain) return;
    const t0 = this.ac!.currentTime;
    const sfxGain = this.sfxGain!;
    // two detuned saw oscillators beating slowly
    [44, 46.5].forEach((freq, i) => {
      const osc = this.ac!.createOscillator();
      const g = this.ac!.createGain();
      const f = this.ac!.createBiquadFilter();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, t0);
      // slow detune drift
      osc.frequency.linearRampToValueAtTime(freq + (i === 0 ? -1.2 : 1.2), t0 + 4);
      f.type = "lowpass";
      f.frequency.setValueAtTime(380, t0);
      f.Q.value = 0.7;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.18, t0 + 1.2);
      g.gain.setValueAtTime(0.18, t0 + 4.5);
      g.gain.linearRampToValueAtTime(0.0001, t0 + 6);
      osc.connect(f).connect(g).connect(sfxGain);
      osc.start(t0);
      osc.stop(t0 + 6);
    });
    // sub rumble
    this.tone(22, 5.5, "sine", 0.25, { attack: 0.8 });
    this.noise(5.5, 0.035, 180, "lowpass", { slide: 90 });
  }

  scarySting() {
    // sudden dissonant stab
    this.tone(180, 0.4, "sawtooth", 0.35, { slide: 88 });
    this.tone(95, 0.5, "triangle", 0.22, { slide: 48, delay: 0.05 });
    this.noise(0.45, 0.22, 400, "bandpass", { slide: 180 });
  }

  /** Glitchy whisper-like texture */
  whisperDrone() {
    if (!this.ac || !this.sfxGain) return;
    const t0 = this.ac.currentTime;
    for (let i = 0; i < 4; i++) {
      const osc = this.ac.createOscillator();
      const g = this.ac.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220 + i * 37, t0);
      osc.frequency.linearRampToValueAtTime(180 + i * 22, t0 + 2.5);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.06, t0 + 0.3 + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.5);
      osc.connect(g).connect(this.sfxGain);
      osc.start(t0 + i * 0.07);
      osc.stop(t0 + 2.6);
    }
  }

  /* ---------- ambient ---------- */

  private startAmbient() {
    if (!this.ac || !this.noiseBuf || !this.ambGain) return;
    // gentle wind loop
    const src = this.ac.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ac.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 420;
    const g = this.ac.createGain();
    g.gain.value = 0.028;
    src.connect(f).connect(g).connect(this.ambGain);
    src.start();
    // biome ambience — birds / drips / bubbles / rumble / breath
    window.setInterval(() => {
      if (!this.ac) return;
      const r = Math.random();
      // heaven gets more frequent gentle birds + soft wind shimmer
      if (this.style.mood === "heaven") {
        if (r > 0.35) {
          const f = 2600 + Math.random() * 600;
          this.tone(f, 0.09, "sine", 0.035);
          this.tone(f * 1.5, 0.07, "sine", 0.02, { delay: 0.09 });
        }
        if (r < 0.22) {
          // soft cloud shimmer - airy pad wash
          this.tone(880 + Math.random()*120, 1.2, "sine", 0.015, { attack: 0.3 });
        }
        return;
      }
      switch (this.ambientMode) {
        case "wind":
          if (r > 0.5) {
            const f = 2400 + Math.random() * 500;
            this.tone(f, 0.07, "sine", 0.05);
            this.tone(f * 1.35, 0.06, "sine", 0.04, { delay: 0.08 });
          }
          break;
        case "cave":
          if (r > 0.35) {
            // water drip with a faint echo
            const f = 1500 + Math.random() * 900;
            this.tone(f, 0.05, "sine", 0.07, { slide: f * 0.5 });
            this.tone(f * 0.8, 0.08, "sine", 0.025, { delay: 0.18 });
          }
          break;
        case "water":
          if (r > 0.4) {
            this.tone(300 + Math.random() * 150, 0.06, "sine", 0.05, { slide: 500 });
            this.tone(240, 0.05, "sine", 0.04, { delay: 0.1, slide: 420 });
          }
          break;
        case "lava":
          if (r > 0.55) this.noise(0.5, 0.05, 200, "lowpass", { slide: 80 });
          if (r < 0.2) this.tone(60, 0.4, "sine", 0.08, { slide: 40 });
          break;
        case "void":
          if (r > 0.5) this.tone(55, 1.1, "sine", 0.06, { slide: 70 }); // far breathing
          break;
      }
    }, 5200);
  }

  /* ---------- music sequencer ---------- */

  startMusic() {
    if (!this.ac || this.musicPlaying) return;
    this.musicPlaying = true;
    this.step = 0;
    this.nextTime = this.ac.currentTime + 0.1;
    this.seqTimer = window.setInterval(() => this.schedule(), 60);
  }
  stopMusic() {
    this.musicPlaying = false;
    if (this.seqTimer !== null) {
      clearInterval(this.seqTimer);
      this.seqTimer = null;
    }
  }
  setTier(t: number) {
    this.tier = t;
  }

  /** Musical flourish response to a perfect feed — sparkles that resolve
   *  cleanly to the tonic. Also briefly ducks the music so it shines. */
  flourish() {
    if (!this.ac || !this.musicGain) return;
    const g = this.musicGain.gain;
    const now = this.ac.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(this.musicOn ? 0.25 : 0, now);
    g.linearRampToValueAtTime(this.musicOn ? 0.75 : 0, now + 0.9);
    // C major arpeggio going up two octaves, ending on high C
    const notes = [523, 659, 784, 1047, 1319, 1568, 2093];
    notes.forEach((f, i) => {
      this.tone(f, 0.14, "triangle", 0.09, { delay: i * 0.04 });
      this.tone(f * 2, 0.1, "sine", 0.04, { delay: i * 0.04 + 0.01 });
    });
  }

  // ---------- musical data ----------
  // Each biome selects a MOOD: its own progression, tempo, register and
  // instruments. The deeper you go, the darker and slower it becomes.
  private style = {
    mood: "bright" as string,
    chords: [0, -5, -3, -7],
    minors: [false, false, true, false],
    step: 0.107,
    pad: "sine" as OscType,
    bassWave: "triangle" as OscType,
    leadWave: "square" as OscType,
    bassOct: -24,
    drums: true,
  };

  setMood(mood: "bright" | "mystic" | "calm" | "deep" | "danger" | "cosmic" | "heaven") {
    interface Style {
      mood: string;
      chords: number[]; minors: boolean[]; step: number;
      pad: OscType; bassWave: OscType; leadWave: OscType; bassOct: number; drums: boolean;
    }
    const S: Record<string, Style> = {
      bright: { mood:"bright", chords: [0, -5, -3, -7], minors: [false, false, true, false], step: 0.107, pad: "sine", bassWave: "triangle", leadWave: "square", bassOct: -24, drums: true },
      mystic: { mood:"mystic", chords: [-3, -7, 0, -5], minors: [true, true, false, false], step: 0.126, pad: "sine", bassWave: "triangle", leadWave: "triangle", bassOct: -24, drums: true },
      calm:   { mood:"calm", chords: [-7, 0, -3, -5], minors: [false, false, true, false], step: 0.142, pad: "sine", bassWave: "sine", leadWave: "triangle", bassOct: -24, drums: false },
      deep:   { mood:"deep", chords: [-3, -7, 0, -5], minors: [true, true, false, false], step: 0.132, pad: "sine", bassWave: "triangle", leadWave: "sine", bassOct: -36, drums: true },
      danger: { mood:"danger", chords: [0, -7, -6, -5], minors: [true, true, true, true], step: 0.104, pad: "triangle", bassWave: "square", leadWave: "square", bassOct: -24, drums: true },
      cosmic: { mood:"cosmic", chords: [0, -4, -7, -9], minors: [true, true, true, true], step: 0.15, pad: "sine", bassWave: "sine", leadWave: "triangle", bassOct: -36, drums: true },
      heaven: { mood:"heaven", chords: [0, 7, 9, 5], minors: [false, false, true, false], step: 0.208, pad: "sine", bassWave: "sine", leadWave: "triangle", bassOct: -24, drums: false },
    };
    this.style = { ...S[mood] };
    // reset sequencer phase for seamless mood switch
    this.step = 0;
    this.nextTime = this.ac ? this.ac.currentTime + 0.12 : 0;
  }

  // Ambient soundscape mode (wind / cave drips / water / lava / void breath)
  ambientMode: "wind" | "cave" | "water" | "lava" | "void" = "wind";

  // Melody written RELATIVE to each chord root (root/fifth/octave based)
  // so it stays consonant over every mood's progression.
  private MELODY = [
    0, -1, 7, -1,  12, -1, 7, -1,   0, 7, 12, 7,   0, -1, -1, -1,
    7, -1, 12, -1, 19, -1, 12, -1,  7, 12, 19, 12, 7, -1, -1, -1,
    12, -1, 7, -1, 0, -1, 7, -1,    12, 7, 0, 7,   12, -1, -1, -1,
    7, -1, 0, -1,  7, -1, 12, -1,   7, 0, 7, 12,   7, -1, -1, -1,
  ];
  private COUNTER = [
    -1, -1, -1, 12, -1, -1, 19, -1,  -1, -1, 12, -1, -1, -1, -1, -1,
    -1, -1, -1, 19, -1, -1, 24, -1,  -1, -1, 19, -1, -1, -1, -1, -1,
    -1, -1, -1, 24, -1, -1, 19, -1,  -1, -1, 12, -1, -1, -1, -1, -1,
    -1, -1, -1, 19, -1, -1, 24, -1,  -1, -1, 19, -1, -1, -1, 12, -1,
  ];

  // Heaven sanctuary — warm, nostalgic, hopeful loop (72 BPM, 4 bars, 64 steps)
  // Uses pure pentatonic + maj7 dream tones, very sparse and airy.
  private HEAVEN_LEAD = [
    // Bar 1 C (Cmaj7) :  E . . G . A . C5 . . G . E . . .
     4, -1, -1,  7, -1,  9, -1, 12, -1, -1,  7, -1,  4, -1, -1, -1,
    // Bar 2 G (G) : D5 . . B . A . G . . . A . B . . .
    14, -1, -1, 11, -1,  9, -1,  7, -1, -1,  9, -1, 11, -1, -1, -1,
    // Bar 3 Am (Am7) : C5 . . E . G . A . . G . E . . .
    12, -1, -1, 16, -1, 19, -1, 21, -1, -1, 19, -1, 16, -1, -1, -1,
    // Bar 4 F (Fmaj7) : A . . C5 . E5 . F5 E5 C5 . A . . . (resolve, dreamy)
     9, -1, -1, 12, -1, 16, -1, 17, -1, -1, 16, -1, 12, -1, -1, -1,
  ];

  private NOTE = (semi: number) => 261.63 * Math.pow(2, semi / 12);

  private schedule() {
    if (!this.ac || !this.musicPlaying || !this.musicGain) return;
    const STEP = this.style.step;
    while (this.nextTime < this.ac.currentTime + 0.25) {
      if (this.style.mood === "heaven") this.playHeavenStep(this.step, this.nextTime, STEP);
      else this.playStep(this.step, this.nextTime, STEP);
      this.nextTime += STEP;
      this.step = (this.step + 1) % 64;
    }
  }

  // --- Heaven sanctuary sequencer: warm, airy, no drums, seamless loop ---
  private playHeavenStep(s: number, t: number, stepDur: number) {
    if (!this.musicOn) return;
    const bar = Math.floor(s / 16);
    const chord = this.style.chords[bar];
    const isMinor = this.style.minors[bar];
    const inBar = s % 16;

    // 1) AIRY PAD — warm Cmaj7 / Gmaj / Am7 / Fmaj7 sustained all bar (choir+strings)
    if (inBar === 0) {
      const voicing = isMinor ? [0,3,7,10] : [0,4,7,11]; // m7 / maj7 dream
      for (const iv of voicing) {
        // main pad (strings)
        this.mtone(this.NOTE(chord + iv - 12), stepDur*15.5, "sine", 0.045, t);
        // choir halo - detuned second voice +2 cents approx (add 0.15 semitone via freq multiply)
        this.mtone(this.NOTE(chord + iv - 12 + 0.07), stepDur*15.5, "sine", 0.018, t+0.02);
      }
      // also a low root octave for warmth
      this.mtone(this.NOTE(chord -24), stepDur*15.5, "sine", 0.035, t);
    }

    // 2) LIGHT BASS — soft, round, only on downbeat and beat 3, no aggression
    if (inBar === 0) this.mtone(this.NOTE(chord -24), stepDur*6.2, "sine", 0.11, t);
    else if (inBar === 8) this.mtone(this.NOTE(chord -24 + (isMinor?7:7)), stepDur*3.8, "sine", 0.07, t);

    // 3) DELICATE HARP ARPEGGIO — rolling 16ths, bell-like triangle, very soft
    // pattern: 0,4,7,11,12,7,4,0 ... but sparser: every 2 steps (8th)
    if (inBar % 2 === 0) {
      const arpDeg = isMinor ? [0,3,7,10,12] : [0,4,7,11,12];
      // create a gentle up-down roll: 0,4,7,11,12,11,7,4 ... across the bar
      const pos = Math.floor(inBar/2);
      const seq = [0,1,2,3,4,3,2,1]; // indexes into arpDeg
      const deg = arpDeg[seq[pos % 8]];
      // harp is higher octave
      this.mtone(this.NOTE(chord + deg), stepDur*1.9, "triangle", 0.032, t);
      // add a faint octave sparkle for bell character
      if (pos % 4 === 0) this.mtone(this.NOTE(chord + deg + 12), stepDur*1.2, "sine", 0.015, t+0.02);
    }

    // 4) WARM FLUTE / BELL LEAD — sparse, memorable, nostalgic
    const lead = this.HEAVEN_LEAD[s];
    if (lead >= 0) {
      // determine note length: if next step is rest, hold longer (legato)
      const nextLead = this.HEAVEN_LEAD[(s+1)%64];
      const dur = nextLead < 0 ? stepDur*2.8 : stepDur*0.95;
      // flute body (triangle, warm)
      this.mtone(this.NOTE(lead), dur, "triangle", 0.068, t);
      // bell overtone (sine octave + fifth) for shimmer
      this.mtone(this.NOTE(lead+12), dur*0.7, "sine", 0.022, t);
      // very soft marimba attack transient (square blip)
      this.mtone(this.NOTE(lead), 0.08, "sine", 0.06, t);
    }

    // 5) LIGHT PIANO / GUITAR ACCENT — soft chord pluck at bar 2 and 4
    if (inBar === 4 || inBar === 12) {
      const voicing = isMinor ? [0,3,7] : [0,4,7];
      const pluckDeg = voicing[(inBar===4?0:1)];
      this.mtone(this.NOTE(chord + pluckDeg), stepDur*2.2, "triangle", 0.022, t);
      this.mtone(this.NOTE(chord + pluckDeg +12), stepDur*1.4, "sine", 0.012, t);
    }

    // 6) AIRY CHOIR SWELL — long held note at phrase peak (bar 2 beat 3)
    if (s === 24) { // Bar2 middle — emotional lift
      this.mtone(this.NOTE(14), stepDur*7, "sine", 0.025, t); // D5 choir
      this.mtone(this.NOTE(14+0.08), stepDur*7, "sine", 0.012, t+0.03);
    }
    if (s === 56) { // Bar4 peak — resolve
      this.mtone(this.NOTE(17), stepDur*6, "sine", 0.022, t); // F5
      this.mtone(this.NOTE(17+0.07), stepDur*6, "sine", 0.01, t+0.02);
    }

    // 7) VERY SOFT PERCUSSION — only a feather-light shimmer, never a kick
    if (s % 16 === 0) {
      // soft marimba wood tick on downbeat
      this.mnoise(0.06, 0.015, 3200, t, "highpass");
    }
    if (s % 32 === 16) {
      // even softer offbeat
      this.mnoise(0.04, 0.008, 5000, t, "highpass");
    }
  }

  private playStep(s: number, t: number, stepDur: number) {
    if (!this.musicOn) return;
    const st = this.style;
    const tier = this.tier;
    const bar = Math.floor(s / 16);
    const chord = st.chords[bar];
    const isMinor = st.minors[bar];
    const third = isMinor ? 3 : 4;
    const inBar = s % 16;
    const inBeat = inBar % 4;

    /* ---- BASS — 8th-note octave bounce (deep moods: root only) ---- */
    if (inBar % 2 === 0) {
      const octave = inBeat === 0 ? 0 : st.bassOct <= -36 ? 0 : 12;
      this.mtone(this.NOTE(chord + st.bassOct + octave), stepDur * 1.2, st.bassWave, 0.17, t);
    }

    /* ---- PAD — slow breathing chord ---- */
    if (inBar === 0 || inBar === 8) {
      [0, third, 7].forEach((iv) => this.mtone(this.NOTE(chord + iv - 12), stepDur * 7.5, st.pad, 0.05, t));
    }

    /* ---- ARPEGGIO (tier 1+) ---- */
    if (tier >= 1) {
      const arp = [0, third, 7, 12];
      this.mtone(this.NOTE(chord + arp[inBar % 4]), stepDur * 0.8, "triangle", 0.04, t);
    }

    /* ---- PERCUSSION ---- */
    if (st.drums) {
      if (tier >= 1) this.mnoise(0.015, 0.025, 9000, t, "highpass");
      if (tier >= 3) {
        if (inBar % 4 === 0) {
          this.mtone(120, 0.12, "sine", 0.45, t, 0.6);
          this.mnoise(0.015, 0.08, 400, t, "lowpass");
        }
        if (inBar === 4 || inBar === 12) {
          this.mnoise(0.08, 0.16, 2000, t, "highpass");
          this.mtone(200, 0.05, "triangle", 0.1, t);
        }
        if (bar === 3 && (inBar === 14 || inBar === 15)) this.mnoise(0.05, 0.15, 3000, t, "highpass");
      }
    } else if (tier >= 2 && inBar % 8 === 4) {
      // calm moods: a single soft shimmer instead of a kit
      this.mnoise(0.12, 0.03, 7000, t, "highpass");
    }

    /* ---- MELODY (tier 2+) ---- */
    if (tier >= 2) {
      const m = this.MELODY[s];
      if (m >= 0) {
        const dur = stepDur * (this.MELODY[(s + 1) % 64] < 0 ? 1.5 : 0.85);
        this.mtone(this.NOTE(chord + m), dur, st.leadWave, 0.075, t);
        this.mtone(this.NOTE(chord + m - 12), dur, "triangle", 0.05, t);
      }
    }

    /* ---- COUNTER-MELODY (tier 4+) ---- */
    if (tier >= 4) {
      const c = this.COUNTER[s];
      if (c >= 0) this.mtone(this.NOTE(chord + c), stepDur * 1.5, "sine", 0.055, t);
    }
  }

  private mtone(freq: number, dur: number, type: OscType, vol: number, t: number, slideTo?: number) {
    if (!this.ac || !this.musicGain) return;
    const osc = this.ac.createOscillator();
    const g = this.ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * (1 - slideTo * 0.6)), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.setValueAtTime(vol, t + Math.max(0.02, dur - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private mnoise(dur: number, vol: number, freq: number, t: number, type: BiquadFilterType = "lowpass") {
    if (!this.ac || !this.musicGain || !this.noiseBuf) return;
    const src = this.ac.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.musicGain);
    src.start(t);
    src.stop(t + dur + 0.05);
  }
}

export const Audio = AudioMgr.i;

