import { useEffect, useRef } from "react";
import type { BlockId } from "../game/constants";
import { drawBlockIcon } from "../game/textures";

export function BlockIcon({ id, size = 40 }: { id: BlockId; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawBlockIcon(ref.current, id, size);
  }, [id, size]);
  return <canvas ref={ref} width={size} height={size} className="pointer-events-none" />;
}
