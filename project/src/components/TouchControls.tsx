import { useEffect, useRef, useState } from "react";
import type { Game, HudState } from "../game/Game";

/** True when the primary input is a touch screen (phone / tablet). */
export function detectTouch(): boolean {
  if (typeof window === "undefined") return false;
  const hasTouch = "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const fine = window.matchMedia("(pointer: fine)").matches;
  if (coarse) return true;
  return hasTouch && !fine;
}

export function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}

const MOVE_SLOP = 12; // px of travel before a touch counts as a look-drag
const HOLD_MS = 260; // press-and-hold this long to start mining
const TAP_MS = 260; // release faster than this (without moving) = place

type TouchRec = {
  x: number;
  y: number;
  startX: number;
  startY: number;
  t0: number;
  moved: boolean;
  breaking: boolean;
  timer: number;
};

/**
 * Full-screen invisible layer behind the on-screen buttons.
 * - drag: look around
 * - tap (short, no movement): place a block at the crosshair
 * - press & hold: mine continuously (looking still works while held)
 */
function TouchLayer({ game }: { game: Game }) {
  const touches = useRef(new Map<number, TouchRec>());

  const stop = (rec: TouchRec) => {
    window.clearTimeout(rec.timer);
    if (rec.breaking) {
      rec.breaking = false;
      game.setTouchBreak(false);
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    const rec: TouchRec = {
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      t0: performance.now(),
      moved: false,
      breaking: false,
      timer: 0,
    };
    rec.timer = window.setTimeout(() => {
      if (!rec.moved && touches.current.has(e.pointerId)) {
        rec.breaking = true;
        game.setTouchBreak(true);
        buzz(24);
      }
    }, HOLD_MS);
    touches.current.set(e.pointerId, rec);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rec = touches.current.get(e.pointerId);
    if (!rec) return;
    const dx = e.clientX - rec.x;
    const dy = e.clientY - rec.y;
    rec.x = e.clientX;
    rec.y = e.clientY;
    if (Math.hypot(e.clientX - rec.startX, e.clientY - rec.startY) > MOVE_SLOP) {
      rec.moved = true;
    }
    game.addLook(dx, dy);
  };

  const end = (e: React.PointerEvent<HTMLDivElement>, allowTap: boolean) => {
    const rec = touches.current.get(e.pointerId);
    if (!rec) return;
    touches.current.delete(e.pointerId);
    stop(rec);
    if (
      allowTap &&
      !rec.moved &&
      !rec.breaking &&
      performance.now() - rec.t0 <= TAP_MS + 60
    ) {
      game.placeOnce();
      buzz(12);
    }
  };

  useEffect(() => {
    const map = touches.current;
    return () => {
      map.forEach((rec) => {
        window.clearTimeout(rec.timer);
        if (rec.breaking) game.setTouchBreak(false);
      });
      map.clear();
    };
  }, [game]);

  return (
    <div
      className="touch-layer"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => end(e, true)}
      onPointerCancel={(e) => end(e, false)}
    />
  );
}

/** Left-thumb virtual joystick for movement. */
function Joystick({ game }: { game: Game }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const pid = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const MAX = 46;

  const apply = (e: React.PointerEvent) => {
    const el = baseRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > MAX) {
      dx = (dx / len) * MAX;
      dy = (dy / len) * MAX;
    }
    setKnob({ x: dx, y: dy });
    game.setTouchMove(dx / MAX, -dy / MAX);
  };

  const release = () => {
    pid.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    game.setTouchMove(0, 0);
  };

  return (
    <div
      ref={baseRef}
      className={`joy-base ${active ? "joy-on" : ""}`}
      onPointerDown={(e) => {
        if (pid.current !== null) return;
        pid.current = e.pointerId;
        setActive(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        apply(e);
      }}
      onPointerMove={(e) => {
        if (pid.current !== e.pointerId) return;
        apply(e);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div className="joy-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      <span className="joy-dir joy-n">▲</span>
      <span className="joy-dir joy-s">▼</span>
      <span className="joy-dir joy-w">◀</span>
      <span className="joy-dir joy-e">▶</span>
    </div>
  );
}

function HoldBtn({
  label,
  className = "",
  onDown,
  onUp,
}: {
  label: string;
  className?: string;
  onDown: () => void;
  onUp: () => void;
}) {
  const [down, setDown] = useState(false);
  const press = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDown(true);
    onDown();
  };
  const release = () => {
    if (!down) return;
    setDown(false);
    onUp();
  };
  return (
    <button
      type="button"
      className={`tbtn ${className} ${down ? "tbtn-press" : ""}`}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

function ToggleBtn({
  label,
  on,
  className = "",
  onToggle,
}: {
  label: string;
  on: boolean;
  className?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`tbtn ${className} ${on ? "tbtn-on" : ""}`}
      onPointerDown={(e) => {
        e.preventDefault();
        onToggle();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

/**
 * All on-screen controls: look layer, joystick, jump/sneak/sprint/fly
 * buttons, and the top bar (inventory + pause).
 */
export function TouchControls({
  game,
  hud,
  onPause,
  onInventory,
}: {
  game: Game;
  hud: HudState;
  onPause: () => void;
  onInventory: () => void;
}) {
  const [sneak, setSneak] = useState(false);
  const [sprint, setSprint] = useState(false);
  const flying = hud.flying;
  const lastJumpTap = useRef(0);

  // Entering fly mode turns the sneak toggle into a descend button.
  useEffect(() => {
    if (flying && sneak) {
      setSneak(false);
      game.setTouchSneak(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flying]);

  const jumpDown = () => {
    const now = performance.now();
    if (now - lastJumpTap.current < 300) {
      game.toggleFly();
      buzz(18);
      lastJumpTap.current = 0;
    } else {
      lastJumpTap.current = now;
    }
    game.setTouchJump(true);
  };

  return (
    <div className="touch-ui">
      <TouchLayer game={game} />
      <Joystick game={game} />

      <div className="tcluster">
        <div className="trow">
          {!flying && (
            <ToggleBtn
              label="SNEAK"
              on={sneak}
              className="tbtn-sm"
              onToggle={() => {
                setSneak((v) => {
                  game.setTouchSneak(!v);
                  return !v;
                });
              }}
            />
          )}
          <ToggleBtn
            label="RUN"
            on={sprint}
            className="tbtn-sm"
            onToggle={() => {
              setSprint((v) => {
                game.setTouchSprint(!v);
                return !v;
              });
            }}
          />
        </div>
        <div className="trow trow-main">
          {flying && (
            <HoldBtn
              label="▼"
              className="tbtn-mid"
              onDown={() => game.setTouchSneak(true)}
              onUp={() => game.setTouchSneak(false)}
            />
          )}
          <HoldBtn
            label={flying ? "▲" : "JUMP"}
            className="tbtn-jump"
            onDown={jumpDown}
            onUp={() => game.setTouchJump(false)}
          />
        </div>
      </div>

      <div className="ttop">
        <button
          type="button"
          className="tbtn tbtn-top"
          onPointerDown={(e) => e.preventDefault()}
          onClick={onInventory}
        >
          INV
        </button>
        <button
          type="button"
          className="tbtn tbtn-top"
          onPointerDown={(e) => e.preventDefault()}
          onClick={onPause}
        >
          ❚❚
        </button>
      </div>
    </div>
  );
}
