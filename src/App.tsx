/* ============================================================
   HUNGRY HOLE — React shell
   Canvas mount + input wiring, pixel-art HUD, main menu,
   game-over stats, pause, and modal screens.
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HungryHoleEngine, ACHIEVEMENTS, type UiSnapshot, type RunStats } from "./game/engine";
import { FOODS, getSprite } from "./game/sprites";
import { Audio } from "./game/audio";
import { SaveManager, fmtNum, fmtTime } from "./game/save";
import { BIOMES, TOTAL_AUTHORED } from "./game/biomes";

/* ---------------- tiny components ---------------- */

function SpriteIcon({ id, size = 26 }: { id: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const spr = getSprite(id);
    if (!spr) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(spr, (c.width - size) / 2, (c.height - size) / 2, size, size);
  }, [id, size]);
  return <canvas ref={ref} width={size + 6} height={size + 6} className="pixelated" />;
}

function useCountUp(value: number, dur = 1000) {
  const [disp, setDisp] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setDisp(Math.round(value * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, dur]);
  return disp;
}

function WoodPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`panel-wood font-pixel ${className}`}>{children}</div>;
}

/* ---------------- toast types ---------------- */

interface Toast {
  id: number;
  icon: string;
  title: string;
  text: string;
  kind: "ach" | "mission";
}

/* ---------------- main app ---------------- */

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engRef = useRef<HungryHoleEngine | null>(null);
  const [ui, setUi] = useState<UiSnapshot | null>(null);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [modal, setModal] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const dragging = useRef(false);

  const isTouch = useMemo(() => (typeof window !== "undefined" && "ontouchstart" in window) || navigator.maxTouchPoints > 0, []);

  /* ---- engine lifecycle ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const eng = new HungryHoleEngine(canvas, {
      ui: (s) => setUi(s),
      stats: (s) => setStats(s),
      toasts: (ts) => setToasts((prev) => [...prev, ...ts].slice(-4)),
    });
    engRef.current = eng;
    // warm up the pixel font for canvas text
    if (document.fonts?.load) {
      document.fonts.load('7px "Press Start 2P"').catch(() => undefined);
      document.fonts.load('16px "Press Start 2P"').catch(() => undefined);
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const eng2 = engRef.current;
      if (!eng2) return;
      switch (e.code) {
        case "ArrowLeft":
        case "KeyA":
          eng2.setLeft(true);
          e.preventDefault();
          break;
        case "ArrowRight":
        case "KeyD":
          eng2.setRight(true);
          e.preventDefault();
          break;
        case "ArrowUp":
        case "ArrowDown":
          e.preventDefault(); // never let arrows scroll the portal iframe
          break;
        case "Space":
          if (eng2.phase === "playing") {
            eng2.burp();
            e.preventDefault();
          } else {
            e.preventDefault(); // stop space scrolling the page on menus too
          }
          break;
        case "KeyP":
        case "Escape":
          if (eng2.phase === "playing") eng2.pause();
          else if (eng2.phase === "paused") eng2.resume();
          break;
        case "KeyM":
          toggleMute();
          break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const eng2 = engRef.current;
      if (!eng2) return;
      if (e.code === "ArrowLeft" || e.code === "KeyA") eng2.setLeft(false);
      if (e.code === "ArrowRight" || e.code === "KeyD") eng2.setRight(false);
    };
    const onVis = () => {
      if (document.hidden) engRef.current?.pause();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVis);
      eng.destroy();
      engRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- toast auto-dismiss ---- */
  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((prev) => prev.slice(1)), 3600);
    return () => clearTimeout(t);
  }, [toasts]);

  const eng = () => engRef.current;

  const click = useCallback((fn?: () => void) => {
    Audio.ensure();
    Audio.click();
    fn?.();
  }, []);

  const toggleMute = useCallback(() => {
    Audio.ensure();
    const save = SaveManager.load();
    save.settings.music = !save.settings.music;
    Audio.setMusicOn(save.settings.music);
    SaveManager.save(save);
  }, []);

  const startGame = useCallback((daily: boolean) => {
    Audio.ensure();
    Audio.click();
    (document.activeElement as HTMLElement | null)?.blur?.();
    setStats(null);
    setModal(null);
    setShowGuide(false);
    eng()?.startRun(daily);
  }, []);

  const pauseGame = useCallback(() => {
    Audio.click();
    eng()?.pause();
  }, []);
  const resumeGame = useCallback(() => {
    Audio.click();
    eng()?.resume();
  }, []);
  const openSettings = useCallback(() => {
    const game = eng();
    if (game?.phase === "playing") game.pause();
    setShowGuide(false);
    setModal("settings");
  }, []);
  const toMenu = useCallback(() => {
    Audio.ensure();
    Audio.click();
    setStats(null);
    setModal(null);
    eng()?.toMenu();
    Audio.startMusic();
  }, []);

  const continueHeaven = useCallback(() => {
    Audio.ensure();
    Audio.click();
    eng()?.continueFromHeaven();
  }, []);

  /* ---- pointer input (drag to move) ---- */
  const mapPointer = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return ((e.clientX - rect.left) / rect.width) * 640;
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (ui?.phase !== "playing") return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    eng()?.setPointer(mapPointer(e));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    eng()?.setPointer(mapPointer(e));
  };
  const onPointerUp = () => {
    dragging.current = false;
    eng()?.setPointer(null);
  };

  const save = eng()?.getSave();
  const isDepthTransition = ui?.phase === "descending" || ui?.phase === "ascending";
  const showGameplayHud =
    !!ui && ui.phase !== "menu" && ui.phase !== "heaven" && ui.phase !== "gameover" && ui.phase !== "reveal";
  const exitUp = isDepthTransition ? "ui-exit-up" : "";
  const exitDown = isDepthTransition ? "ui-exit-down" : "";

  /* ---------------- render ---------------- */

  return (
    <div
      className="h-full w-full flex items-center justify-center select-none"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 10%, #2e4a34 0%, #223a28 45%, #14241a 100%)",
      }}
    >
      <div className="relative w-full" style={{ maxWidth: "min(100vw, calc(100vh * 16 / 9))", aspectRatio: "16 / 9" }}>
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="pixelated absolute inset-0 w-full h-full"
          style={{ imageRendering: "pixelated" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        {/* ============ HUD (in-game) ============ */}
        {showGameplayHud && (
          <div className="absolute inset-0 pointer-events-none">
            {/* score — top left */}
            <WoodPanel className={`absolute top-2 left-2 px-3 py-2 text-center ${isDepthTransition ? "ui-exit-up" : "anim-slide-down"}`}>
              <div className="text-[7px] text-amber-200/90">SCORE</div>
              <div key={ui.score} className="text-sm text-yellow-100 anim-combo mt-1" style={{ textShadow: "0 2px 0 #6a3a12" }}>
                {fmtNum(ui.score)}
              </div>
              <div className="text-[6px] text-amber-200/70 mt-1">
                BEST {fmtNum(Math.max(ui.best, ui.score))}
              </div>
              {ui.daily && (
                <div className="font-pixel text-[6px] text-emerald-300 bg-emerald-500/20 border border-emerald-400/50 px-1.5 py-0.5 mt-1">
                  📅 DAILY
                </div>
              )}
              {ui.newBest && (
                <div className="font-pixel text-[6px] text-yellow-300 bg-yellow-500/20 border border-yellow-400/60 px-1.5 py-0.5 mt-1 anim-wiggle">
                  ★ NEW BEST!
                </div>
              )}
            </WoodPanel>

            {/* combo — top right */}
            {ui.combo > 0 && (
              <div className={`absolute top-2 right-2 flex flex-col items-end gap-1 ${exitUp}`}>
                <WoodPanel className="px-3 py-2 text-center anim-pop">
                  <div className="text-[7px] text-amber-200/90">COMBO</div>
                  <div key={ui.combo} className="text-sm text-orange-300 anim-combo mt-1" style={{ textShadow: "0 2px 0 #6a3a12" }}>
                    {ui.combo}
                    <span className="text-[9px] text-amber-200 ml-1">×{ui.mult}</span>
                  </div>
                </WoodPanel>
              </div>
            )}

            {/* target — top center */}
            <div className={`absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center ${exitUp}`}>
              {/* current depth */}
              <div
                className="font-pixel text-[7px] px-2 py-1 mb-1 bg-black/55 border anim-slide-down"
                style={{ color: ui.depthColor, borderColor: ui.depthColor + "66" }}
              >
                {ui.isSecret ? "🗝️ " : "⛏️ "}DEPTH {ui.depth} · {ui.depthName.toUpperCase()}
              </div>
              <WoodPanel className={`px-4 py-2 text-center anim-slide-down ${ui.overfed ? "!border-red-900" : ""}`}>
                <div className="text-[7px] text-amber-200/90">{ui.overfed ? "TOO MUCH!" : "FEED ME"}</div>
                <div
                  key={ui.target}
                  className={`text-xl mt-1 anim-pop ${ui.overfed ? "text-red-300" : "text-yellow-100"}`}
                  style={{ textShadow: "0 3px 0 #6a3a12, 0 0 14px rgba(255,215,94,0.35)" }}
                >
                  {ui.target}
                </div>
                <div className="text-[6px] text-amber-200/70 mt-1">exactly!</div>
              </WoodPanel>
              {/* event banner */}
              {ui.event && (
                <div
                  key={ui.event.name}
                  className="anim-banner mt-2 font-pixel text-[11px] px-3 py-1.5 panel-dark text-center"
                  style={{ color: ui.event.color, borderColor: ui.event.color }}
                >
                  {ui.event.icon} {ui.event.name}
                </div>
              )}
              {ui.reverse && (
                <div className="mt-1 font-pixel text-[8px] text-pink-300 text-stroke-dark anim-pulse-soft">⚠ REVERSED ⚠</div>
              )}
            </div>

            {/* OVERFED — 10s countdown to death, burp to escape (bottom-left) */}
            {ui.overfed && ui.overfedLeft > 0 && (
              <div
                className={`absolute bottom-2 left-2 pointer-events-none panel-dark px-3 py-2 border-2 anim-pop ${exitDown} ${
                  ui.overfedLeft < 3 ? "anim-wiggle" : ""
                }`}
                style={{
                  borderColor: ui.overfedLeft < 3 ? "#ff3020" : "#ff8a3a",
                  boxShadow: ui.overfedLeft < 3 ? "0 0 24px rgba(255,60,40,0.6)" : "0 0 14px rgba(255,140,60,0.4)",
                }}
              >
                <div className="font-pixel text-[7px] text-red-300">⚠ TOO FULL — BURP!</div>
                <div
                  key={Math.ceil(ui.overfedLeft)}
                  className={`font-pixel mt-1 anim-combo ${ui.overfedLeft < 3 ? "text-red-400" : "text-orange-300"}`}
                  style={{
                    fontSize: ui.overfedLeft < 3 ? "26px" : "20px",
                    textShadow: "0 3px 0 #000, 0 0 12px rgba(255,80,40,0.7)",
                  }}
                >
                  {Math.ceil(ui.overfedLeft)}
                </div>
                <div className="w-36 h-2 mt-1 bg-black/60 border border-red-900 overflow-hidden">
                  <div
                    className={ui.overfedLeft < 3 ? "h-full bg-red-500" : "h-full bg-orange-400"}
                    style={{ width: `${(ui.overfedLeft / ui.overfedMax) * 100}%`, transition: "width 0.1s linear" }}
                  />
                </div>
                <div className="font-pixel text-[6px] text-amber-200/80 mt-1">SPACE = BURP</div>
              </div>
            )}

            {/* ============ DESCENT BANNER ============ */}
            {(ui.descending || ui.descendBanner) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  key={ui.descendBanner ?? "desc"}
                  className="anim-banner font-pixel text-[16px] sm:text-[20px] px-6 py-4 panel-dark text-center leading-relaxed"
                  style={{ color: ui.depthColor, borderColor: ui.depthColor, boxShadow: `0 0 40px ${ui.depthColor}55` }}
                >
                  {ui.descending && !ui.descendBanner ? " DESCENDING… ⬇" : ui.descendBanner}
                </div>
              </div>
            )}

            {/* Danger-red pulsing vignette on the last 3 seconds */}
            {ui.overfed && ui.overfedLeft > 0 && ui.overfedLeft < 3 && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "radial-gradient(120% 90% at 50% 50%, transparent 40%, rgba(255,30,10,0.35) 100%)",
                  animation: "pulseSoft 0.4s ease-in-out infinite",
                }}
              />
            )}

            {/* belly — bottom center */}
            <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 flex items-end gap-2 ${exitDown}`}>
              <div className="flex flex-col items-center gap-1 w-60">
                {ui.hint && (
                  <div className="font-pixel text-[7px] text-yellow-100/95 bg-black/55 px-2 py-1 border border-yellow-200/30 text-center anim-rise w-full">
                    {ui.hint}
                  </div>
                )}
                <WoodPanel className="px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[7px] text-amber-200/90">BELLY</span>
                    <span className={`text-[9px] ${ui.overfed ? "text-red-300 anim-wiggle" : "text-yellow-100"}`}>
                      {ui.fullness} / {ui.target}
                    </span>
                  </div>
                  <div className="w-44 h-3 mt-1 bg-black/60 border-2 border-[#4a2c12] relative overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${
                        ui.overfed ? "bg-red-500" : ui.fullness === ui.target ? "bg-yellow-300" : "bg-gradient-to-r from-lime-500 to-green-400"
                      }`}
                      style={{ width: `${Math.min(100, (ui.fullness / ui.target) * 100)}%` }}
                    />
                    {ui.fullness === ui.target && <div className="absolute inset-0 bg-yellow-200/40 animate-pulse" />}
                  </div>
                  {/* HOLE size — always shrinking, feed to stay alive */}
                  <div className="flex items-center justify-between gap-3 mt-1.5">
                    <span className={`text-[7px] ${ui.starving ? "text-red-400 anim-wiggle" : "text-amber-200/90"}`}>
                      {ui.starving ? "STARVING!" : "HOLE"}
                    </span>
                    <span className={`text-[7px] ${ui.starving ? "text-red-300" : "text-amber-100/80"}`}>
                      {Math.round(ui.sizePct * 100)}%
                    </span>
                  </div>
                  <div className="w-44 h-2 mt-1 bg-black/60 border border-[#4a2c12] relative overflow-hidden">
                    <div
                      className={`h-full ${ui.starving ? "bg-red-500 anim-pulse-soft" : ui.sizePct < 0.4 ? "bg-orange-400" : "bg-gradient-to-r from-amber-500 to-yellow-300"}`}
                      style={{ width: `${Math.max(2, ui.sizePct * 100)}%`, transition: "width 0.25s ease-out" }}
                    />
                    {/* tick marks so shrinkage is visible */}
                    <div className="absolute inset-0 flex justify-between pointer-events-none opacity-40">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="w-px h-full bg-black" />
                      ))}
                    </div>
                  </div>
                  {/* DIG meter — perfect feeds dig the creature deeper */}
                  <div className="flex items-center justify-between gap-3 mt-1.5">
                    <span className="text-[7px]" style={{ color: ui.depthColor }}>DIG</span>
                    <span className="text-[7px] text-amber-100/80">{ui.depthProg}/{ui.depthGoal}</span>
                  </div>
                  <div className="w-44 h-1.5 mt-1 bg-black/60 border border-[#4a2c12] overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(100, (ui.depthProg / ui.depthGoal) * 100)}%`,
                        background: ui.depthColor,
                        transition: "width 0.3s ease-out",
                        boxShadow: `0 0 6px ${ui.depthColor}`,
                      }}
                    />
                  </div>
                </WoodPanel>
              </div>
              {/* burp button */}
              <button
                className="btn-pixel btn-red !px-3 !py-2 !text-[9px] pointer-events-auto relative overflow-hidden"
                onClick={() => click(() => eng()?.burp())}
                disabled={ui.burpCd < 1}
                style={{ opacity: ui.burpCd < 1 ? 0.7 : 1 }}
                title="Burp (SPACE)"
              >
                💨 BURP
                {ui.burpCd < 1 && (
                  <span className="absolute bottom-0 left-0 bg-white/25" style={{ width: "100%", height: `${(1 - ui.burpCd) * 100}%` }} />
                )}
              </button>
            </div>

            {/* missions — left middle */}
            <div className={`absolute left-2 top-24 flex flex-col gap-1 max-w-[150px] ${exitUp}`}>
              {ui.missions.map((m) => (
                <div
                  key={m.id}
                  className={`panel-dark font-pixel text-[6px] px-2 py-1.5 anim-rise ${
                    m.done ? "text-lime-300" : m.failed ? "text-red-400 opacity-60" : "text-amber-100/90"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px]">{m.done ? "✅" : m.failed ? "❌" : m.icon}</span>
                    <span className="truncate">{m.name}</span>
                  </div>
                  <div className="h-1 bg-black/50 mt-1 border border-black/40">
                    <div
                      className={`h-full ${m.done ? "bg-lime-400" : "bg-amber-400"}`}
                      style={{ width: `${Math.min(100, (m.progress / m.target) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* guide toggle + DEBUG — bottom right */}
            <div className={`absolute bottom-2 right-2 flex flex-col items-end gap-1.5 pointer-events-auto ${exitDown}`}>
              <div className="flex gap-1.5 flex-wrap justify-end">
                <button
                  className="btn-pixel !px-2 !py-1.5 !text-[7px] !border-yellow-400"
                  style={{ background: "linear-gradient(180deg, #ffd75e, #ffb31a 55%, #e08c0a)", color: "#40240f", textShadow: "none" }}
                  onClick={() => click(() => eng()?.debugNextBiome())}
                  title="DEBUG: jump to next biome"
                >
                  ⏭️ NEXT BIOME
                </button>
                <button className="btn-pixel btn-brown !px-2 !py-1.5 !text-[8px]" onClick={() => click(() => setShowGuide((v) => !v))}>
                  🍽️ FOODS
                </button>
                <button className="btn-pixel btn-ghost !px-2 !py-1.5 !text-[8px]" onClick={() => click(pauseGame)} title="Pause (P)">
                  ⏸
                </button>
                <button className="btn-pixel btn-ghost !px-2 !py-1.5 !text-[8px]" onClick={() => click(openSettings)}>
                  ⚙️
                </button>
              </div>
              {showGuide && save && (
                <div className="panel-dark p-2 w-52 max-h-64 overflow-y-auto no-scrollbar anim-pop">
                  <div className="text-[6px] text-amber-200 mb-1.5 text-center">FOOD COLLECTION</div>
                  <CollectionGuide dex={save.dex} />
                </div>
              )}
            </div>

            {/* toasts */}
            <div className={`absolute right-2 top-16 flex flex-col gap-2 items-end pointer-events-none ${exitUp}`}>
              {toasts.map((t) => (
                <div key={t.id} className="panel-dark px-3 py-2 anim-toast max-w-[240px] border-l-4 border-l-yellow-400">
                  <div className={`font-pixel text-[8px] ${t.kind === "ach" ? "text-yellow-300" : "text-lime-300"}`}>
                    {t.icon} {t.title}
                  </div>
                  <div className="font-pixel text-[6px] text-amber-100/85 mt-1 leading-relaxed">{t.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ PAUSE ============ */}
        {ui?.phase === "paused" && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-auto anim-rise">
            <WoodPanel className="px-8 py-6 flex flex-col items-center gap-3 text-center">
              <div className="text-sm text-yellow-100" style={{ textShadow: "0 3px 0 #6a3a12" }}>PAUSED</div>
              <div className="text-[7px] text-amber-200/80">the hole is waiting…</div>
              <button className="btn-pixel btn-gold !text-[10px] w-44 justify-center" onClick={resumeGame}>▶ RESUME</button>
              <button className="btn-pixel btn-brown !text-[10px] w-44 justify-center" onClick={() => click(openSettings)}>⚙️ SETTINGS</button>
              <button className="btn-pixel btn-ghost !text-[9px] w-44 justify-center" onClick={toMenu}>🏠 MENU</button>
            </WoodPanel>
          </div>
        )}

        {/* ============ HEAVENS — PEACEFUL REST ============ */}
        {ui?.phase === "heaven" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-3">
            {/* soft sky vignette behind the panel — keeps heavens bright but readable */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/5 pointer-events-none" />
            <div className="panel-wood px-5 py-4 sm:px-7 sm:py-5 flex flex-col items-center gap-3 pointer-events-auto max-w-[92%] sm:max-w-[460px] anim-pop text-center">
              <div className="font-pixel text-[10px] sm:text-[13px] text-yellow-100 tracking-widest" style={{ textShadow: "0 3px 0 #6a3a12" }}>
                ☁️ THE HEAVENS ☁️
              </div>
              <div className="font-pixel text-[6px] sm:text-[7px] text-amber-900/70 leading-relaxed -mt-1">
                You burst through the earth into open sky.<br />
                The creature rests in the sunshine. Take a breath.
              </div>

              {/* creature resting hint */}
              <div className="font-pixel text-[6px] text-amber-900/60 bg-white/45 border border-amber-900/15 px-2 py-1.5 flex items-center gap-2">
                <span className="text-[10px] animate-pulse">💤</span>
                <span>The hole is napping in the clouds… · Hovering at {fmtNum(ui.score)} pts</span>
              </div>

              {/* quick stats */}
              <div className="grid grid-cols-3 gap-1.5 w-full">
                <div className="bg-black/10 border border-amber-900/20 px-2 py-2">
                  <div className="font-pixel text-[5px] text-amber-900/60">SCORE</div>
                  <div className="font-pixel text-[9px] text-amber-950 mt-1">{fmtNum(ui.score)}</div>
                </div>
                <div className="bg-black/10 border border-amber-900/20 px-2 py-2">
                  <div className="font-pixel text-[5px] text-amber-900/60">PERFECTS</div>
                  <div className="font-pixel text-[9px] text-amber-950 mt-1">{save ? fmtNum(save.totals.perfects) : "—"}</div>
                </div>
                <div className="bg-black/10 border border-amber-900/20 px-2 py-2">
                  <div className="font-pixel text-[5px] text-amber-900/60">DEEPEST</div>
                  <div className="font-pixel text-[9px] text-amber-950 mt-1">{save ? `Depth ${save.deepest}` : "—"}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 w-full">
                <button className="btn-pixel btn-brown !text-[7px] justify-center" onClick={() => click(() => setModal("collection"))}>
                  📖 COLLECTION
                </button>
                <button className="btn-pixel btn-purple !text-[7px] justify-center" onClick={() => click(() => setModal("achievements"))}>
                  ⭐ ACHIEVE
                </button>
                <button className="btn-pixel btn-blue !text-[7px] justify-center" onClick={() => click(() => setModal("cosmetics"))}>
                  🎨 COSMETICS
                </button>
                <button className="btn-pixel btn-ghost !text-[7px] justify-center" onClick={() => click(() => setModal("map"))}>
                  🗺️ WORLD MAP
                </button>
              </div>

              <div className="w-full h-px bg-amber-900/15 my-1" />

              <button className="btn-pixel btn-gold !text-[10px] w-full justify-center anim-pulse-soft" onClick={continueHeaven}>
                ⬇ CONTINUE DEEPER ⬇
              </button>
              <div className="font-pixel text-[5px] text-amber-900/50">
                No falling food here. Choose when you're ready.
              </div>
              <button className="btn-pixel btn-ghost !text-[6px] px-3 py-1" onClick={toMenu}>
                🏠 RETURN TO SURFACE
              </button>
            </div>
          </div>
        )}

        {/* ============ THE REVEAL — STORY FINALE CINEMATIC ============ */}
        {ui?.phase === "reveal" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-4">
            {ui.revealStep === 3 && ui.revealText && (
              <div className="font-pixel text-[14px] sm:text-[22px] tracking-wide leading-relaxed px-3 py-2"
                style={{
                  color: "#f0e6c8",
                  textShadow: "0 0 12px rgba(255,80,40,0.7), 0 3px 0 #000, 0 0 30px rgba(180,20,10,0.5)",
                  animation: "pulseSoft 2.2s ease-in-out infinite",
                  letterSpacing: "0.12em",
                }}
              >
                {ui.revealText}
              </div>
            )}
            {ui.revealStep === 4 && (
              <div className="flex flex-col items-center gap-3 anim-rise">
                <div className="font-pixel text-[11px] sm:text-[15px] text-yellow-100 bg-black/60 px-5 py-3 border border-lime-400/30 tracking-wider">
                  🌱 RESTORING THE WORLD 🌱
                </div>
                <div className="font-pixel text-[6px] sm:text-[7px] text-lime-200 bg-black/50 px-3 py-2 border border-lime-500/20 max-w-[85%] leading-relaxed">
                  The ancient being gathers all the energy you gave it... <br />
                  A World Tree surges skyward. Stars spill across the heavens. <br />
                  Flowers bloom where there was only dust.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============ MAIN MENU ============ */}
        {ui?.phase === "menu" && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between py-3 menu-atmosphere">
            <div className="flex flex-col items-center mt-1">
              <div className="title-sign font-pixel px-5 sm:px-8 py-3 sm:py-4 text-center anim-bob">
                <div className="text-[22px] sm:text-[34px] text-yellow-100 tracking-tight">HUNGRY</div>
                <div className="text-[22px] sm:text-[34px] text-yellow-100 tracking-tight mt-1">HOLE</div>
              </div>
              {ui?.storyCompleted && (
                <div className="font-pixel text-[6px] sm:text-[7px] text-yellow-300 bg-yellow-500/15 border border-yellow-400/40 px-3 py-1 mt-2.5 anim-wiggle uppercase tracking-wider">
                  🌌 ENDLESS MODE UNLOCKED 🌌
                </div>
              )}
              <div className="font-pixel text-[8px] sm:text-[9px] text-emerald-100/90 mt-3 text-stroke-dark anim-floaty">
                🕳️ feed the hungry hole… exactly! 🍎
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 pointer-events-auto">
              <button className="btn-pixel btn-gold !text-[12px] w-56 justify-center anim-pop" onClick={() => startGame(false)}>
                {ui?.storyCompleted ? "♾️ ENDLESS MODE" : "▶ PLAY"}
              </button>
              <button className="btn-pixel btn-green !text-[9px] w-56 justify-center" onClick={() => startGame(true)}>
                📅 DAILY CHALLENGE
              </button>
              <div className="flex gap-2">
                <button className="btn-pixel btn-green !text-[8px] w-[106px] justify-center" onClick={() => click(() => setModal("map"))}>
                  🗺️ MAP
                </button>
                <button className="btn-pixel btn-purple !text-[8px] w-[106px] justify-center" onClick={() => click(() => setModal("achievements"))}>
                  ⭐ ACHIEVE
                </button>
                <button className="btn-pixel btn-blue !text-[8px] w-[106px] justify-center" onClick={() => click(openSettings)}>
                  ⚙️ SETTINGS
                </button>
              </div>
              <button className="btn-pixel btn-ghost !text-[7px] px-4 py-1.5" onClick={() => click(() => setModal("leaderboard"))}>
                🏆 TOP SCORES
              </button>
              <button className="btn-pixel btn-ghost !text-[7px] px-4 py-1.5" onClick={() => click(() => setModal("credits"))}>
                CREDITS
              </button>
              {save && save.best.score > 0 && (
                <div className="font-pixel text-[7px] text-amber-200/90 text-stroke-dark mt-1">
                  BEST {fmtNum(save.best.score)} · DEEPEST {save.deepest} · {save.totals.perfects} PERFECTS
                </div>
              )}
            </div>

            <div className="font-pixel text-[6px] text-emerald-100/60 text-center leading-relaxed">
              ◀ ▶ / A D move · SPACE burp · P pause
              {isTouch ? " · drag to move" : ""}
            </div>
          </div>
        )}

        {/* ============ GAME OVER ============ */}
        {ui?.phase === "gameover" && stats && (
          <GameOverPanel
            stats={stats}
            isTouch={isTouch}
            onRetry={() => startGame(stats.isDaily)}
            onMenu={toMenu}
          />
        )}

        {/* ============ MODALS ============ */}
        {modal && (ui?.phase === "menu" || ui?.phase === "paused" || ui?.phase === "heaven") && (
          <ModalShell title={modalTitle(modal)} onClose={() => click(() => setModal(null))}>
            {modal === "leaderboard" && <Leaderboard />}
            {modal === "map" && <WorldMap />}
            {modal === "collection" && <CollectionModal />}
            {modal === "cosmetics" && <CosmeticsModal />}
            {modal === "achievements" && <Achievements />}
            {modal === "settings" && (
              <Settings
                resetArmed={resetArmed}
                setResetArmed={setResetArmed}
                onReset={() => {
                  if (!resetArmed) {
                    setResetArmed(true);
                    setTimeout(() => setResetArmed(false), 2600);
                    return;
                  }
                  localStorage.removeItem("hungryhole.save.v1");
                  window.location.reload();
                }}
              />
            )}
            {modal === "credits" && <Credits />}
          </ModalShell>
        )}
      </div>
    </div>
  );
}

/* ---------------- game over panel ---------------- */

function GameOverPanel({ stats, onRetry, onMenu }: { stats: RunStats; isTouch: boolean; onRetry: () => void; onMenu: () => void }) {
  const score = useCountUp(stats.score);
  const combo = useCountUp(stats.highCombo, 700);
  const perfects = useCountUp(stats.perfects, 700);
  const caught = useCountUp(stats.caught, 700);
  const missions = useCountUp(stats.missionsDone, 700);
  return (
    <div className="absolute inset-0 bg-black/55 flex items-center justify-center pointer-events-auto">
      <div className="panel-dark px-5 py-4 sm:px-8 sm:py-6 flex flex-col items-center anim-pop max-w-[92%] sm:max-w-none">
        <div className="font-pixel text-[9px] sm:text-[11px] text-amber-200/90">THE HOLE CLOSED…</div>
        <div className="font-pixel text-[9px] sm:text-[11px] text-red-300 mt-1 mb-3">it was so hungry 🥺</div>

        {stats.newBest && (
          <div className="font-pixel text-[9px] text-yellow-300 bg-yellow-500/15 border border-yellow-400/50 px-3 py-1.5 mb-3 anim-wiggle">
            ★ NEW BEST! ★
          </div>
        )}

        <div className="flex items-end gap-2 mb-3">
          <span className="font-pixel text-[8px] text-amber-200/80 mb-1.5">SCORE</span>
          <span className="font-pixel text-2xl sm:text-3xl text-yellow-100 shimmer-gold" style={{ textShadow: "0 4px 0 #6a3a12" }}>
            {fmtNum(score)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4 w-full">
          <Stat label="HIGH COMBO" value={fmtNum(combo)} />
          <Stat label="PERFECT FEEDS" value={fmtNum(perfects)} />
          <Stat label="OBJECTS EATEN" value={fmtNum(caught)} />
          <Stat label="SURVIVED" value={fmtTime(stats.time)} />
          <Stat label="MISSIONS" value={fmtNum(missions)} />
          <Stat label="DEPTH REACHED" value={`⛏️ ${stats.depth}`} />
        </div>

        <div className="flex gap-2">
          <button className="btn-pixel btn-gold !text-[10px] px-5 justify-center anim-pulse-soft" onClick={onRetry}>
            ▶ PLAY AGAIN
          </button>
          <button className="btn-pixel btn-ghost !text-[9px] px-4 justify-center" onClick={onMenu}>
            🏠 MENU
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/35 border border-[#3a2a14] px-2 py-2 text-center">
      <div className="font-pixel text-[5.5px] text-amber-200/70">{label}</div>
      <div className="font-pixel text-[10px] text-yellow-50 mt-1.5">{value}</div>
    </div>
  );
}

/* ---------------- modals ---------------- */

function modalTitle(m: string) {
  switch (m) {
    case "leaderboard": return "🏆 TOP SCORES";
    case "map": return "🗺️ WORLD MAP";
    case "achievements": return "⭐ ACHIEVEMENTS";
    case "settings": return "⚙️ SETTINGS";
    case "credits": return "📜 CREDITS";
    case "collection": return "📖 COLLECTION";
    case "cosmetics": return "🎨 COSMETICS";
    default: return "";
  }
}

function WorldMap() {
  const save = SaveManager.load();
  return (
    <div className="w-full flex flex-col items-center">
      {BIOMES.map((b) => {
        const found = save.discovered.includes(b.depth);
        return (
          <div key={b.id} className="flex flex-col items-center w-full">
            <div
              className={`flex items-center gap-2 w-full px-2 py-1.5 border ${found ? "bg-black/35" : "bg-black/20 opacity-55"}`}
              style={{ borderColor: found ? b.accent + "88" : "#2a1c10" }}
            >
              <span className="font-pixel text-[8px] w-7 text-center" style={{ color: found ? b.accent : "#5a4a3a" }}>{b.depth}</span>
              <span
                className="w-3 h-3 shrink-0 border"
                style={{ background: found ? b.accent : "#14100a", borderColor: found ? b.accent : "#3a2a14", boxShadow: found ? `0 0 6px ${b.accent}88` : "none" }}
              />
              <span className={`font-pixel text-[7px] flex-1 ${found ? "text-amber-100" : "text-amber-100/35"}`}>
                {found ? b.name.toUpperCase() : "? ? ?"}
              </span>
              {found && <span className="font-pixel text-[5px] text-amber-200/45 text-right">{b.desc.slice(0, 24)}…</span>}
            </div>
            <div className="text-amber-200/40 text-[8px] leading-tight">▼</div>
          </div>
        );
      })}
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-2 w-full px-2 py-1.5 bg-black/20 border border-[#2a1c10] opacity-45">
          <span className="font-pixel text-[8px] w-7 text-center text-amber-100/30">{TOTAL_AUTHORED + i}</span>
          <span className="font-pixel text-[7px] text-amber-100/30">? ? ?</span>
        </div>
      ))}
      <div className="font-pixel text-[6px] text-amber-200/60 mt-3 text-center leading-relaxed">
        Deepest reached: {save.deepest}<br />
        Secret rooms found: {save.secrets.length}
      </div>
    </div>
  );
}

function CollectionGuide({ dex }: { dex: string[] }) {
  const save = SaveManager.load();
  const Tile = ({ id, val }: { id: string; val: string }) => {
    const got = dex.includes(id);
    return (
      <div className="flex flex-col items-center bg-black/30 border border-black/40 py-1" title={got ? undefined : "Undiscovered"}>
        {got ? (
          <>
            <SpriteIcon id={id} size={18} />
            <span className="text-[6px] mt-0.5 text-white/90">{val}</span>
          </>
        ) : (
          <>
            <div className="w-6 h-6 bg-black/70 border border-black/50 flex items-center justify-center text-[8px] text-amber-100/25">?</div>
            <span className="text-[6px] mt-0.5 text-amber-100/30">???</span>
          </>
        )}
      </div>
    );
  };
  const label = (f: { special: string | null; value: number }) =>
    f.special === "mystery" ? "?" : f.special === "chili" ? "×2" : f.value > 0 ? `+${f.value}` : `${f.value}`;
  return (
    <div className="flex flex-col gap-2">
      <div>
        <div className="font-pixel text-[5.5px] text-lime-300/80 mb-1">SURFACE · EVERYWHERE</div>
        <div className="grid grid-cols-4 gap-1">
          {FOODS.filter((f) => f.weight > 0 && !f.biomes).map((f) => (
            <Tile key={f.id} id={f.id} val={label(f)} />
          ))}
        </div>
      </div>
      {BIOMES.filter((b) => b.foods.length > 0).map((b) => {
        const found = save.discovered.includes(b.depth);
        return (
          <div key={b.id}>
            <div className="font-pixel text-[5.5px] mb-1" style={{ color: found ? b.accent : "#6a5a44" }}>
              DEPTH {b.depth} · {found ? b.name.toUpperCase() : "? ? ?"}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {b.foods.map((id) => {
                const def = FOODS.find((f) => f.id === id);
                if (!def) return null;
                return found ? <Tile key={id} id={id} val={label(def)} /> : <Tile key={id} id={id} val="" />;
              })}
            </div>
          </div>
        );
      })}
      <div className="font-pixel text-[5.5px] text-amber-200/50 text-center mt-1">
        {dex.length} / {FOODS.filter((f) => f.weight > 0).length} discovered
      </div>
    </div>
  );
}

function CollectionModal() {
  const save = SaveManager.load();
  return <CollectionGuide dex={save.dex} />;
}

function CosmeticsModal() {
  const save = SaveManager.load();
  const deepest = save.deepest;
  const cosmetics = [
    { id: "classic", name: "Classic Hole", desc: "The original", unlock: 1, icon: "🕳️", color: "#8a5a2c" },
    { id: "golden", name: "Golden Maw", desc: "Shines like treasure", unlock: 3, icon: "✨", color: "#ffd75e" },
    { id: "crystal", name: "Crystal Vein", desc: "Geode-lined", unlock: 5, icon: "💎", color: "#b8a0ff" },
    { id: "lava", name: "Molten Rim", desc: "Still warm", unlock: 6, icon: "🌋", color: "#ff6a2a" },
    { id: "angel", name: "Halo Ring", desc: "Blessed by the heavens", unlock: 7, icon: "😇", color: "#fff8dc" },
    { id: "void", name: "Void Eye", desc: "Stares back", unlock: 10, icon: "👁️", color: "#8a8aff" },
  ];
  return (
    <div className="w-full flex flex-col gap-2">
      <div className="font-pixel text-[6px] text-amber-200/70 text-center mb-1">Unlocked by reaching depths — equipped automatically</div>
      <div className="grid grid-cols-2 gap-2">
        {cosmetics.map((c) => {
          const unlocked = deepest >= c.unlock;
          return (
            <div key={c.id} className={`flex items-center gap-2 px-2 py-2 border ${unlocked ? "bg-white/10" : "bg-black/20 opacity-50"}`} style={{ borderColor: unlocked ? c.color + "88" : "#2a1c10" }}>
              <span className="text-[16px]">{c.icon}</span>
              <div className="flex-1">
                <div className={`font-pixel text-[6px] ${unlocked ? "text-amber-100" : "text-amber-100/40"}`}>{c.name.toUpperCase()}</div>
                <div className="font-pixel text-[5px] text-amber-200/50">{unlocked ? c.desc : `Reach Depth ${c.unlock}`}</div>
              </div>
              <span className="font-pixel text-[7px]">{unlocked ? "✅" : "🔒"}</span>
            </div>
          );
        })}
      </div>
      <div className="font-pixel text-[5px] text-amber-200/40 text-center mt-2">More cosmetics coming soon — keep digging!</div>
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-auto z-20">
      <div className="panel-dark px-4 py-4 sm:px-6 sm:py-5 flex flex-col items-center anim-pop max-w-[92%] sm:max-w-md w-full max-h-[85%]">
        <div className="font-pixel text-[10px] text-yellow-100 mb-3" style={{ textShadow: "0 2px 0 #000" }}>{title}</div>
        <div className="w-full overflow-y-auto no-scrollbar">{children}</div>
        <button className="btn-pixel btn-brown !text-[8px] px-6 py-2 mt-4 justify-center" onClick={onClose}>
          ✖ CLOSE
        </button>
      </div>
    </div>
  );
}

function Leaderboard() {
  const save = SaveManager.load();
  const entries = save.board;
  return (
    <div className="w-full">
      {entries.length === 0 && (
        <div className="font-pixel text-[7px] text-amber-100/70 text-center py-6 leading-relaxed">
          No scores yet…<br />go feed the hole!
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        {entries.map((e, i) => (
          <div key={i} className="flex items-center gap-2 bg-black/35 border border-[#3a2a14] px-2 py-1.5">
            <span className="font-pixel text-[9px] w-6 text-center" style={{ color: i === 0 ? "#ffd75e" : i === 1 ? "#d8d8d8" : i === 2 ? "#e8a05a" : "#8a7a5a" }}>
              {i + 1}
            </span>
            <span className="font-pixel text-[10px] text-yellow-100 flex-1">{fmtNum(e.score)}</span>
            {e.daily && <span className="font-pixel text-[5px] text-emerald-300 border border-emerald-500/40 px-1 py-0.5">DAILY</span>}
            <span className="font-pixel text-[5.5px] text-amber-200/60">×{e.combo} · {e.perfects}P · {fmtTime(e.time)}</span>
            <span className="font-pixel text-[5.5px] text-amber-200/40 w-12 text-right">{e.date}</span>
          </div>
        ))}
      </div>
      <div className="font-pixel text-[6px] text-amber-200/50 text-center mt-3">scores are saved on this device</div>
    </div>
  );
}

function Achievements() {
  const save = SaveManager.load();
  const unlocked = save.ach;
  const count = unlocked.length;
  return (
    <div className="w-full">
      <div className="font-pixel text-[7px] text-amber-200/80 text-center mb-3">
        {count} / {ACHIEVEMENTS.length} unlocked
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {ACHIEVEMENTS.map((a) => {
          const got = unlocked.includes(a.id);
          return (
            <div key={a.id} className={`flex items-center gap-2 px-2 py-1.5 border ${got ? "bg-yellow-500/10 border-yellow-500/40" : "bg-black/25 border-[#2a1c10] opacity-55"}`}>
              <span className={`text-[14px] ${got ? "" : "grayscale"}`}>{a.icon}</span>
              <div>
                <div className={`font-pixel text-[6px] ${got ? "text-yellow-200" : "text-amber-100/50"}`}>{a.name}</div>
                <div className="font-pixel text-[5px] text-amber-100/50 mt-0.5 leading-relaxed">{a.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Settings({ resetArmed, setResetArmed, onReset }: { resetArmed: boolean; setResetArmed: (b: boolean) => void; onReset: () => void }) {
  const [music, setMusic] = useState(SaveManager.load().settings.music);
  const [sfx, setSfx] = useState(SaveManager.load().settings.sfx);
  const save = SaveManager.load();
  return (
    <div className="w-full flex flex-col gap-2">
      <button
        className="btn-pixel btn-blue !text-[8px] w-full justify-between !px-3"
        onClick={() => {
          Audio.ensure();
          const m = !music;
          setMusic(m);
          Audio.setMusicOn(m);
          const s = SaveManager.load();
          s.settings.music = m;
          SaveManager.save(s);
          Audio.click();
        }}
      >
        <span>🎵 MUSIC</span><span>{music ? "ON" : "OFF"}</span>
      </button>
      <button
        className="btn-pixel btn-blue !text-[8px] w-full justify-between !px-3"
        onClick={() => {
          Audio.ensure();
          const s = !sfx;
          setSfx(s);
          Audio.setSfxOn(s);
          const d = SaveManager.load();
          d.settings.sfx = s;
          SaveManager.save(d);
          Audio.click();
        }}
      >
        <span>🔊 SFX</span><span>{sfx ? "ON" : "OFF"}</span>
      </button>
      <button
        className={`btn-pixel ${resetArmed ? "btn-red" : "btn-ghost"} !text-[8px] w-full justify-center`}
        onClick={() => {
          Audio.click();
          onReset();
          setResetArmed(true);
        }}
      >
        {resetArmed ? "⚠️ TAP AGAIN TO WIPE" : "🗑️ RESET PROGRESS"}
      </button>
      <div className="font-pixel text-[6px] text-amber-200/60 text-center mt-1">
        {fmtNum(save.totals.food)} foods eaten · {fmtNum(save.totals.perfects)} perfect feeds · {fmtNum(save.totals.burps)} burps
      </div>
    </div>
  );
}

function Credits() {
  return (
    <div className="w-full font-pixel text-[6.5px] text-amber-100/85 leading-relaxed text-center">
      <p className="mb-2">HUNGRY HOLE — a cozy arcade about feeding a very hungry (and very cute) hole.</p>
      <p className="mb-2">Design, code, pixel art, music &amp; sounds: made with 💛 in one sitting.</p>
      <p>Tip: the hole likes exact numbers. Burp when in doubt!</p>
    </div>
  );
}
