import { useCallback, useEffect, useRef, useState } from "react";
import menuBg from "../public/images/menu-bg.jpg";
import { BlockIcon } from "./components/BlockIcon";
import { TouchControls, detectTouch } from "./components/TouchControls";
import { BLOCKS, PLACEABLE, type BlockId } from "./game/constants";
import { Game, type HudState } from "./game/Game";

type Screen = "menu" | "howto" | "loading" | "play";

const SPLASHES = [
  "Also try Terraria!",
  "As seen on TV!",
  "100% bug free!",
  "More polygons!",
  "Absolutely no viruses!",
  "Wow!",
  "Don't look at the bugs!",
  "Open world-ish!",
  "Infinite-ish terrain!",
  "May contain cubes!",
  "Creeper? Aw man.",
  "Punch trees!",
  "Diggy diggy hole!",
  "Made of voxels!",
  "Singleplayer!",
];

const TIPS = [
  "Trees hide logs. Logs make planks. Planks make homes.",
  "Double-tap Space or press F to fly in creative mode.",
  "Press N to skip the sun ahead. Nights are darker underground.",
  "Scroll or press 1-9 to switch blocks on the hotbar.",
  "Right-click places a block. Left-click breaks one.",
  "Hold Ctrl to sprint. Hold Shift to sneak.",
  "Deserts grow cactus. Snow biomes glitter on the peaks.",
  "Diamond ore hides deep. Bring a pick... or just your hand.",
];

const TOUCH_TIPS = [
  "Drag anywhere to look around. Tap to place a block.",
  "Press and hold the screen to mine blocks.",
  "Double-tap JUMP to fly. Use the arrows while flying.",
  "Tap a hotbar slot at the bottom to switch blocks.",
  "Tap Sneak to crouch safely at edges. Tap Run to sprint.",
  "You hop up single steps automatically while walking.",
  "Deserts grow cactus. Snow biomes glitter on the peaks.",
  "Diamond ore hides deep. Start digging!",
];

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

function isFullscreen(): boolean {
  const d = document as FullscreenDocument;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

async function enterImmersive() {
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  try {
    if (!isFullscreen()) {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    }
  } catch {
    /* fullscreen unavailable (e.g. iPhone Safari) */
  }
  try {
    const so = screen.orientation as ScreenOrientation & {
      lock?: (o: "landscape") => Promise<void>;
    };
    await so?.lock?.("landscape");
  } catch {
    /* orientation lock unavailable */
  }
}

async function exitImmersive() {
  const d = document as FullscreenDocument;
  try {
    if (d.fullscreenElement) await document.exitFullscreen();
    else if (d.webkitFullscreenElement) await d.webkitExitFullscreen?.();
  } catch {
    /* ignore */
  }
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* ignore */
  }
}

function randomSplash() {
  return SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
}

function randomSeed() {
  return (Math.random() * 1e9) | 0;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [screen, setScreen] = useState<Screen>("menu");
  const [splash] = useState(randomSplash);
  const [seed, setSeed] = useState(() => String(randomSeed()));
  const [progress, setProgress] = useState(0);
  const [tip] = useState(() => {
    const pool = detectTouch() ? TOUCH_TIPS : TIPS;
    return pool[Math.floor(Math.random() * pool.length)];
  });
  const [hud, setHud] = useState<HudState | null>(null);
  const [paused, setPaused] = useState(false);
  const [inv, setInv] = useState(false);
  const [debug, setDebug] = useState(true);
  const [isTouch] = useState(detectTouch);
  const touchRef = useRef(isTouch);
  touchRef.current = isTouch;

  const destroyGame = useCallback(() => {
    gameRef.current?.dispose();
    gameRef.current = null;
  }, []);

  const startWorld = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (touchRef.current) void enterImmersive();
    destroyGame();
    setProgress(0);
    setScreen("loading");
    setPaused(false);
    setInv(false);
    const parsed = Number(seed);
    const worldSeed = Number.isFinite(parsed) && parsed !== 0 ? parsed : randomSeed();
    setSeed(String(worldSeed));
    const game = new Game(canvas, worldSeed, {
      onHud: (h) => setHud(h),
      onReady: () => {},
      onPause: () => {
        setPaused(true);
        setInv(false);
      },
      touch: touchRef.current,
    });
    gameRef.current = game;
    await game.generate((p) => setProgress(p));
    setScreen("play");
    game.start();
  }, [destroyGame, seed]);

  useEffect(() => {
    return () => destroyGame();
  }, [destroyGame]);

  // Mobile: block browser scroll/zoom gestures everywhere except the
  // scrollable inventory card, and stop iOS pinch-zoom.
  useEffect(() => {
    if (!isTouch) return;
    const allowScroll = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest(".inv-card");
    const onTouchMove = (e: TouchEvent) => {
      if (!allowScroll(e.target)) e.preventDefault();
    };
    const onGesture = (e: Event) => e.preventDefault();
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("gesturestart", onGesture, { passive: false });
    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("gesturestart", onGesture);
    };
  }, [isTouch]);

  // Mobile: leaving fullscreen (system back / swipe) pauses the game.
  useEffect(() => {
    if (!isTouch) return;
    const onChange = () => {
      const g = gameRef.current;
      if (!isFullscreen() && g && g.running && !g.paused) g.pause();
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, [isTouch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screen !== "play") return;
      const g = gameRef.current;
      if (!g) return;
      if (e.code === "KeyE") {
        e.preventDefault();
        setInv((v) => {
          const next = !v;
          if (next) {
            setPaused(false);
            if (touchRef.current) g.enterMenu();
            else g.unlock();
          } else {
            if (touchRef.current) g.resume();
            else g.lock();
          }
          return next;
        });
      }
      if (e.code === "F3") {
        e.preventDefault();
        setDebug((d) => !d);
      }
      if (e.code === "Escape" && inv) {
        setInv(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, inv]);

  const resume = () => {
    setPaused(false);
    setInv(false);
    if (isTouch) {
      void enterImmersive();
      gameRef.current?.resume();
    } else {
      gameRef.current?.lock();
    }
  };

  const quit = () => {
    if (isTouch) void exitImmersive();
    destroyGame();
    setHud(null);
    setPaused(false);
    setInv(false);
    setScreen("menu");
  };

  const playing = screen === "play" && !!hud && !paused && !inv && hud.locked;

  return (
    <div className="game-root">
      <canvas ref={canvasRef} className="game-canvas" />

      {screen === "menu" && (
        <Menu
          splash={splash}
          seed={seed}
          onSeed={setSeed}
          onPlay={startWorld}
          onHow={() => setScreen("howto")}
        />
      )}

      {screen === "howto" && <HowTo onBack={() => setScreen("menu")} touch={isTouch} />}

      {screen === "loading" && <Loading progress={progress} tip={tip} />}

      {screen === "play" && playing && (
        <>
          <Hud
            hud={hud}
            debug={debug}
            underwater={hud.inWater}
            touch={isTouch}
            onToggleDebug={() => setDebug((d) => !d)}
            onSlot={(i) => gameRef.current?.setSlot(i)}
          />
          {isTouch && gameRef.current && (
            <TouchControls
              game={gameRef.current}
              hud={hud}
              onPause={() => gameRef.current?.pause()}
              onInventory={() => {
                gameRef.current?.enterMenu();
                setInv(true);
              }}
            />
          )}
        </>
      )}

      {screen === "play" && !isTouch && !paused && !inv && (!hud || !hud.locked) && (
        <button className="click-play" type="button" onClick={() => gameRef.current?.lock()}>
          <span>Click to play</span>
          <small>Esc pauses · E inventory · F fly</small>
        </button>
      )}

      {screen === "play" && paused && <Pause onResume={resume} onQuit={quit} />}

      {screen === "play" && inv && hud && (
        <Inventory
          hud={hud}
          onPick={(id) => {
            gameRef.current?.setHotbarBlock(id);
          }}
          onClose={() => {
            setInv(false);
            if (isTouch) gameRef.current?.resume();
            else gameRef.current?.lock();
          }}
        />
      )}
    </div>
  );
}

function Menu({
  splash,
  seed,
  onSeed,
  onPlay,
  onHow,
}: {
  splash: string;
  seed: string;
  onSeed: (s: string) => void;
  onPlay: () => void;
  onHow: () => void;
}) {
  const touch = detectTouch();
  return (
    <div
      className="overlay menu-overlay"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(8,10,16,0.28), rgba(8,10,16,0.62)), url(${menuBg})`,
      }}
    >
      <div className="menu-vignette" />
      <div className="menu-inner">
        <div className="title-wrap">
          <h1 className="mc-title">
            <span>BLOCK</span>
            <span className="mc-title-gold">CRAFT</span>
          </h1>
          <div className="splash">{splash}</div>
        </div>

        <div className="menu-panel">
          <label className="seed-label">
            World seed
            <div className="seed-row">
              <input
                className="mc-input"
                value={seed}
                onChange={(e) => onSeed(e.target.value.replace(/[^\d-]/g, ""))}
                maxLength={12}
              />
              <button
                className="mc-btn mc-btn-sm"
                type="button"
                onClick={() => onSeed(String(randomSeed()))}
              >
                Random
              </button>
            </div>
          </label>
          <button className="mc-btn mc-btn-green" type="button" onClick={onPlay}>
            Singleplayer
          </button>
          <button className="mc-btn" type="button" onClick={onHow}>
            How to Play
          </button>
        </div>

        <p className="menu-foot">
          {touch
            ? "Creative sandbox · touch controls · landscape recommended"
            : "Creative sandbox · WASD to move · mouse to look"}
        </p>
      </div>
    </div>
  );
}

function HowTo({ onBack, touch }: { onBack: () => void; touch: boolean }) {
  return (
    <div
      className="overlay menu-overlay"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(8,10,16,0.28), rgba(8,10,16,0.62)), url(${menuBg})`,
      }}
    >
      <div className="menu-vignette" />
      <div className="howto-card">
        <h2 className="howto-title">How to Play</h2>
        {touch ? (
          <ul className="howto-list">
            <li>
              <kbd>Left pad</kbd> Move · <kbd>Drag screen</kbd> Look
            </li>
            <li>
              <kbd>Tap</kbd> Place block · <kbd>Hold</kbd> Mine
            </li>
            <li>
              <kbd>JUMP</kbd> Jump or swim · double-tap it to fly
            </li>
            <li>
              <kbd>SNEAK</kbd> Crouch · <kbd>RUN</kbd> Sprint · fly with the arrows
            </li>
            <li>
              Tap the <kbd>hotbar</kbd> to pick blocks · <kbd>INV</kbd> inventory · <kbd>❚❚</kbd>{" "}
              pause
            </li>
          </ul>
        ) : (
          <ul className="howto-list">
          <li>
            <kbd>W A S D</kbd> Move · <kbd>Space</kbd> Jump · <kbd>Shift</kbd> Sneak
          </li>
          <li>
            <kbd>Ctrl</kbd> Sprint · <kbd>F</kbd> or double <kbd>Space</kbd> Fly
          </li>
          <li>
            <kbd>Left click</kbd> Break · <kbd>Right click</kbd> Place
          </li>
          <li>
            <kbd>1-9</kbd> / scroll Hotbar · <kbd>E</kbd> Inventory
          </li>
            <li>
              <kbd>Esc</kbd> Pause · <kbd>F3</kbd> Debug · <kbd>N</kbd> Skip time
            </li>
          </ul>
        )}
        <p className="howto-note">
          Explore plains, forests, deserts, snowy peaks and beaches. Dig for coal, iron, gold and
          diamond. Build anything — this is creative mode, blocks are infinite.
        </p>
        <button className="mc-btn" type="button" onClick={onBack}>
          Done
        </button>
      </div>
    </div>
  );
}

function Loading({ progress, tip }: { progress: number; tip: string }) {
  const pct = Math.min(100, Math.round(progress * 100));
  return (
    <div className="overlay load-overlay">
      <div className="load-card">
        <h2 className="load-title">Generating world</h2>
        <p className="load-tip">{tip}</p>
        <div className="load-bar">
          <div className="load-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="load-pct">{pct}%</div>
      </div>
    </div>
  );
}

function Hud({
  hud,
  debug,
  underwater,
  touch,
  onToggleDebug,
  onSlot,
}: {
  hud: HudState;
  debug: boolean;
  underwater: boolean;
  touch: boolean;
  onToggleDebug: () => void;
  onSlot: (i: number) => void;
}) {
  return (
    <>
      {underwater && <div className="water-tint" />}
      <div className="crosshair" />
      {debug && (
        <div
          className={`debug ${touch ? "debug-touch" : ""}`}
          onClick={touch ? onToggleDebug : undefined}
        >
          <div>Blockcraft 1.0</div>
          <div>{hud.fps.toFixed(0)} fps</div>
          <div>
            XYZ: {hud.x.toFixed(2)} / {hud.y.toFixed(2)} / {hud.z.toFixed(2)}
          </div>
          <div>
            Block: {Math.floor(hud.x)} {Math.floor(hud.y)} {Math.floor(hud.z)}
          </div>
          <div>Seed: {hud.seed}</div>
          <div>
            {hud.flying ? "Flying" : hud.inWater ? "Swimming" : "Walking"}
            {hud.target ? ` · ${hud.target}` : ""}
          </div>
        </div>
      )}
      {touch && !debug && (
        <button type="button" className="debug-restore" onClick={onToggleDebug}>
          F3
        </button>
      )}
      <div className={`hotbar-wrap ${touch ? "hotbar-touch" : ""}`}>
        <div className="selected-name">{BLOCKS[hud.selected]?.name}</div>
        <div className="hotbar">
          {hud.hotbar.map((id, i) =>
            touch ? (
              <button
                key={i}
                type="button"
                className={`slot slot-btn ${i === hud.slot ? "slot-on" : ""}`}
                onPointerDown={() => onSlot(i)}
              >
                <BlockIcon id={id} size={34} />
                <span className="slot-num">{i + 1}</span>
              </button>
            ) : (
              <div key={i} className={`slot ${i === hud.slot ? "slot-on" : ""}`}>
                <BlockIcon id={id} size={36} />
                <span className="slot-num">{i + 1}</span>
              </div>
            ),
          )}
        </div>
        <div className="hotbar-hint">
          {touch
            ? "Tap slot to pick · Hold to mine · Tap to place"
            : "E Inventory · F Fly · Esc Pause"}
        </div>
      </div>
    </>
  );
}

function Pause({ onResume, onQuit }: { onResume: () => void; onQuit: () => void }) {
  return (
    <div className="overlay pause-overlay">
      <div className="pause-card">
        <h2 className="pause-title">Game Menu</h2>
        <button className="mc-btn mc-btn-green" type="button" onClick={onResume}>
          Back to Game
        </button>
        <button className="mc-btn" type="button" onClick={onQuit}>
          Save &amp; Quit
        </button>
      </div>
    </div>
  );
}

function Inventory({
  hud,
  onPick,
  onClose,
}: {
  hud: HudState;
  onPick: (id: BlockId) => void;
  onClose: () => void;
}) {
  return (
    <div className="overlay inv-overlay" onClick={onClose}>
      <div className="inv-card" onClick={(e) => e.stopPropagation()}>
        <div className="inv-head">
          <h2>Creative Inventory</h2>
          <button className="inv-x" type="button" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="inv-sub">Click a block to put it on the selected hotbar slot.</p>
        <div className="inv-grid">
          {PLACEABLE.map((id) => (
            <button
              key={id}
              type="button"
              className={`inv-cell ${hud.selected === id ? "inv-cell-on" : ""}`}
              title={BLOCKS[id].name}
              onClick={() => onPick(id)}
            >
              <BlockIcon id={id} size={42} />
              <span>{BLOCKS[id].name}</span>
            </button>
          ))}
        </div>
        <div className="hotbar inv-hotbar">
          {hud.hotbar.map((id, i) => (
            <div key={i} className={`slot ${i === hud.slot ? "slot-on" : ""}`}>
              <BlockIcon id={id} size={36} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
