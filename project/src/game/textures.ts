import * as THREE from "three";
import { ATLAS_COLS, ATLAS_ROWS, BLOCKS, TILE, type BlockId } from "./constants";

type RNG = () => number;

function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function put(data: Uint8ClampedArray, x: number, y: number, r: number, g: number, b: number, a = 255) {
  if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
  const i = (y * TILE + x) * 4;
  data[i] = r;
  data[i + 1] = g;
  data[i + 2] = b;
  data[i + 3] = a;
}

function fillNoise(
  data: Uint8ClampedArray,
  r: number,
  g: number,
  b: number,
  vary: number,
  rng: RNG,
) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = (rng() - 0.5) * vary;
      put(data, x, y, clamp(r + n), clamp(g + n), clamp(b + n));
    }
  }
}

function paintTile(atlas: ImageData, slot: number, painter: (data: Uint8ClampedArray) => void) {
  const col = slot % ATLAS_COLS;
  const row = Math.floor(slot / ATLAS_COLS);
  const tile = new ImageData(TILE, TILE);
  painter(tile.data);
  const ox = col * TILE;
  const oy = row * TILE;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const si = (y * TILE + x) * 4;
      const di = ((oy + y) * atlas.width + (ox + x)) * 4;
      atlas.data[di] = tile.data[si];
      atlas.data[di + 1] = tile.data[si + 1];
      atlas.data[di + 2] = tile.data[si + 2];
      atlas.data[di + 3] = tile.data[si + 3];
    }
  }
}

function grassTop(data: Uint8ClampedArray, rng: RNG) {
  fillNoise(data, 78, 148, 52, 36, rng);
  for (let i = 0; i < 18; i++) {
    put(data, (rng() * TILE) | 0, (rng() * TILE) | 0, 52, 110, 34);
  }
  for (let i = 0; i < 10; i++) {
    put(data, (rng() * TILE) | 0, (rng() * TILE) | 0, 120, 180, 70);
  }
}

function dirt(data: Uint8ClampedArray, rng: RNG) {
  fillNoise(data, 134, 96, 50, 28, rng);
  for (let i = 0; i < 12; i++) {
    put(data, (rng() * TILE) | 0, (rng() * TILE) | 0, 90, 64, 32);
  }
}

function grassSide(data: Uint8ClampedArray, rng: RNG) {
  dirt(data, rng);
  const fringe = 4 + ((rng() * 2) | 0);
  for (let x = 0; x < TILE; x++) {
    const h = fringe + ((rng() * 3) | 0) - 1;
    for (let y = 0; y < h; y++) {
      const n = (rng() - 0.5) * 30;
      put(data, x, y, clamp(78 + n), clamp(148 + n), clamp(52 + n));
    }
  }
}

function snowSide(data: Uint8ClampedArray, rng: RNG) {
  dirt(data, rng);
  for (let x = 0; x < TILE; x++) {
    const h = 3 + ((rng() * 3) | 0);
    for (let y = 0; y < h; y++) {
      const n = (rng() - 0.5) * 18;
      put(data, x, y, clamp(236 + n), clamp(242 + n), clamp(250 + n));
    }
  }
}

function stone(data: Uint8ClampedArray, rng: RNG) {
  fillNoise(data, 126, 126, 126, 22, rng);
  for (let i = 0; i < 10; i++) {
    put(data, (rng() * TILE) | 0, (rng() * TILE) | 0, 100, 100, 100);
  }
}

function cobble(data: Uint8ClampedArray, rng: RNG) {
  fillNoise(data, 90, 90, 90, 16, rng);
  const stones = [
    [1, 1, 7, 6],
    [8, 1, 7, 5],
    [1, 8, 6, 7],
    [8, 7, 7, 8],
  ];
  for (const [sx, sy, w, h] of stones) {
    const shade = 70 + rng() * 50;
    for (let y = sy; y < sy + h && y < TILE; y++) {
      for (let x = sx; x < sx + w && x < TILE; x++) {
        const n = (rng() - 0.5) * 18;
        const edge = x === sx || y === sy || x === sx + w - 1 || y === sy + h - 1;
        const v = edge ? shade - 28 : shade + n;
        put(data, x, y, clamp(v), clamp(v), clamp(v));
      }
    }
  }
}

function logSide(data: Uint8ClampedArray, rng: RNG) {
  for (let x = 0; x < TILE; x++) {
    const band = 70 + Math.sin(x * 0.9) * 18 + (rng() - 0.5) * 10;
    for (let y = 0; y < TILE; y++) {
      const n = (rng() - 0.5) * 14;
      put(data, x, y, clamp(band + 20 + n), clamp(band - 8 + n), clamp(band - 28 + n));
    }
  }
  for (let y = 0; y < TILE; y++) {
    put(data, 0, y, 48, 32, 16);
    put(data, TILE - 1, y, 48, 32, 16);
  }
}

function logTop(data: Uint8ClampedArray, rng: RNG) {
  const cx = 7.5;
  const cy = 7.5;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const ring = Math.sin(d * 1.6) * 16;
      const n = (rng() - 0.5) * 12;
      if (d < 2.2) {
        put(data, x, y, clamp(70 + n), clamp(50 + n), clamp(28 + n));
      } else {
        put(data, x, y, clamp(120 + ring + n), clamp(88 + ring * 0.6 + n), clamp(48 + n));
      }
    }
  }
}

function leaves(data: Uint8ClampedArray, rng: RNG) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      if (rng() < 0.22) {
        put(data, x, y, 0, 0, 0, 0);
      } else {
        const n = (rng() - 0.5) * 40;
        put(data, x, y, clamp(48 + n), clamp(118 + n), clamp(36 + n), 255);
      }
    }
  }
}

function planks(data: Uint8ClampedArray, rng: RNG) {
  fillNoise(data, 176, 142, 88, 16, rng);
  for (let y = 0; y < TILE; y++) {
    const row = Math.floor(y / 4);
    const shift = row % 2 === 0 ? 0 : 8;
    for (let x = 0; x < TILE; x++) {
      if (y % 4 === 0) put(data, x, y, 110, 80, 42);
      if ((x + shift) % 8 === 0) put(data, x, y, 110, 80, 42);
    }
  }
}

function sand(data: Uint8ClampedArray, rng: RNG) {
  fillNoise(data, 220, 210, 150, 24, rng);
  for (let i = 0; i < 14; i++) {
    put(data, (rng() * TILE) | 0, (rng() * TILE) | 0, 200, 180, 120);
  }
}

function water(data: Uint8ClampedArray, rng: RNG) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const w = Math.sin(x * 0.7 + y * 0.4) * 18 + Math.cos(y * 0.8) * 10;
      put(data, x, y, clamp(40 + w), clamp(100 + w * 0.6), clamp(210 + w * 0.3), 180);
    }
  }
  for (let i = 0; i < 6; i++) {
    put(data, (rng() * TILE) | 0, (rng() * TILE) | 0, 180, 210, 255, 200);
  }
}

function glass(data: Uint8ClampedArray) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const edge = x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1;
      const inner = x === 1 || y === 1 || x === TILE - 2 || y === TILE - 2;
      if (edge) put(data, x, y, 210, 230, 240, 220);
      else if (inner) put(data, x, y, 180, 210, 230, 90);
      else put(data, x, y, 160, 200, 220, 28);
    }
  }
}

function brick(data: Uint8ClampedArray, rng: RNG) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      put(data, x, y, 170, 160, 150);
    }
  }
  for (let row = 0; row < 4; row++) {
    const y0 = row * 4;
    const shift = row % 2 === 0 ? 0 : 4;
    for (let col = 0; col < 3; col++) {
      const x0 = ((col * 8 + shift) % 16) - 1;
      const shade = rng() * 20 - 6;
      for (let y = y0 + 1; y < y0 + 4 && y < TILE; y++) {
        for (let x = x0; x < x0 + 7; x++) {
          const xx = ((x % TILE) + TILE) % TILE;
          put(data, xx, y, clamp(155 + shade), clamp(72 + shade), clamp(52 + shade));
        }
      }
    }
  }
}

function bedrock(data: Uint8ClampedArray, rng: RNG) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const v = rng() < 0.5 ? 20 + rng() * 20 : 50 + rng() * 30;
      put(data, x, y, v, v, v);
    }
  }
}

function ore(data: Uint8ClampedArray, rng: RNG, cr: number, cg: number, cb: number) {
  stone(data, rng);
  for (let i = 0; i < 16; i++) {
    const x = (rng() * TILE) | 0;
    const y = (rng() * TILE) | 0;
    put(data, x, y, cr, cg, cb);
    if (rng() > 0.4) put(data, x + 1, y, cr, cg, cb);
    if (rng() > 0.4) put(data, x, y + 1, cr, cg, cb);
  }
}

function snow(data: Uint8ClampedArray, rng: RNG) {
  fillNoise(data, 236, 242, 250, 14, rng);
  for (let i = 0; i < 8; i++) {
    put(data, (rng() * TILE) | 0, (rng() * TILE) | 0, 210, 220, 235);
  }
}

function gravel(data: Uint8ClampedArray, rng: RNG) {
  fillNoise(data, 128, 122, 116, 30, rng);
  for (let i = 0; i < 20; i++) {
    const v = 80 + rng() * 70;
    put(data, (rng() * TILE) | 0, (rng() * TILE) | 0, v, v - 6, v - 12);
  }
}

function cactusSide(data: Uint8ClampedArray, rng: RNG) {
  fillNoise(data, 52, 130, 36, 18, rng);
  for (let y = 0; y < TILE; y++) {
    put(data, 0, y, 18, 70, 16);
    put(data, 1, y, 30, 90, 22);
    put(data, TILE - 1, y, 18, 70, 16);
    put(data, TILE - 2, y, 30, 90, 22);
    put(data, 5, y, 28, 80, 20);
    put(data, 10, y, 28, 80, 20);
  }
  for (let i = 0; i < 5; i++) {
    put(data, 5, (rng() * TILE) | 0, 200, 200, 180);
    put(data, 10, (rng() * TILE) | 0, 200, 200, 180);
  }
}

function cactusTop(data: Uint8ClampedArray, rng: RNG) {
  fillNoise(data, 58, 140, 40, 16, rng);
  for (let i = 0; i < TILE; i++) {
    put(data, i, 0, 18, 70, 16);
    put(data, i, TILE - 1, 18, 70, 16);
    put(data, 0, i, 18, 70, 16);
    put(data, TILE - 1, i, 18, 70, 16);
  }
}

function sandstone(data: Uint8ClampedArray, rng: RNG) {
  fillNoise(data, 218, 202, 130, 16, rng);
  for (let y = 0; y < TILE; y += 4) {
    for (let x = 0; x < TILE; x++) {
      put(data, x, y, 190, 170, 100);
    }
  }
}

function stonebrick(data: Uint8ClampedArray, rng: RNG) {
  fillNoise(data, 122, 122, 122, 12, rng);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      if (y % 8 === 0 || x % 8 === 0) put(data, x, y, 80, 80, 80);
    }
  }
}

function wool(data: Uint8ClampedArray, rng: RNG) {
  fillNoise(data, 234, 234, 234, 14, rng);
  for (let i = 0; i < 20; i++) {
    put(data, (rng() * TILE) | 0, (rng() * TILE) | 0, 250, 250, 250);
  }
}

function pumpkinSide(data: Uint8ClampedArray, rng: RNG) {
  for (let x = 0; x < TILE; x++) {
    const band = Math.sin(x * 0.9) * 18;
    for (let y = 0; y < TILE; y++) {
      const n = (rng() - 0.5) * 12;
      put(data, x, y, clamp(210 + band + n), clamp(118 + band * 0.4 + n), clamp(22 + n));
    }
  }
  for (let y = 5; y < 12; y++) {
    put(data, 4, y, 30, 18, 8);
    put(data, 11, y, 30, 18, 8);
  }
  put(data, 5, 8, 30, 18, 8);
  put(data, 6, 8, 30, 18, 8);
  put(data, 9, 8, 30, 18, 8);
  put(data, 10, 8, 30, 18, 8);
}

function pumpkinTop(data: Uint8ClampedArray, rng: RNG) {
  fillNoise(data, 200, 110, 20, 16, rng);
  for (let y = 6; y < 10; y++) {
    for (let x = 6; x < 10; x++) {
      put(data, x, y, 40, 90, 22);
    }
  }
}

export function createAtlas(): THREE.CanvasTexture {
  const w = ATLAS_COLS * TILE;
  const h = ATLAS_ROWS * TILE;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const atlas = ctx.createImageData(w, h);
  const rng = mulberry32(1337);

  const painters: Array<(d: Uint8ClampedArray) => void> = [
    (d) => grassTop(d, rng),
    (d) => grassSide(d, rng),
    (d) => dirt(d, rng),
    (d) => stone(d, rng),
    (d) => cobble(d, rng),
    (d) => logSide(d, rng),
    (d) => logTop(d, rng),
    (d) => leaves(d, rng),
    (d) => planks(d, rng),
    (d) => sand(d, rng),
    (d) => water(d, rng),
    (d) => glass(d),
    (d) => brick(d, rng),
    (d) => bedrock(d, rng),
    (d) => ore(d, rng, 20, 20, 20),
    (d) => ore(d, rng, 210, 180, 150),
    (d) => ore(d, rng, 250, 220, 70),
    (d) => ore(d, rng, 80, 230, 220),
    (d) => snow(d, rng),
    (d) => gravel(d, rng),
    (d) => cactusSide(d, rng),
    (d) => cactusTop(d, rng),
    (d) => sandstone(d, rng),
    (d) => stonebrick(d, rng),
    (d) => wool(d, rng),
    (d) => pumpkinSide(d, rng),
    (d) => pumpkinTop(d, rng),
    (d) => snowSide(d, rng),
  ];

  painters.forEach((p, i) => paintTile(atlas, i, p));
  ctx.putImageData(atlas, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function drawBlockIcon(canvas: HTMLCanvasElement, id: BlockId, size = 48) {
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);
  const def = BLOCKS[id];
  if (!def || id === 0) return;

  const top = def.color.top;
  const side = def.color.side;
  const bottom = def.color.bottom;
  const s = size;
  const cx = s / 2;
  const topH = s * 0.28;
  const midY = s * 0.38;
  const botY = s * 0.92;
  const half = s * 0.42;

  ctx.beginPath();
  ctx.moveTo(cx, s * 0.08);
  ctx.lineTo(cx + half, midY);
  ctx.lineTo(cx, midY + topH);
  ctx.lineTo(cx - half, midY);
  ctx.closePath();
  ctx.fillStyle = top;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - half, midY);
  ctx.lineTo(cx, midY + topH);
  ctx.lineTo(cx, botY);
  ctx.lineTo(cx - half, botY - topH);
  ctx.closePath();
  ctx.fillStyle = shade(side, -18);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx + half, midY);
  ctx.lineTo(cx, midY + topH);
  ctx.lineTo(cx, botY);
  ctx.lineTo(cx + half, botY - topH);
  ctx.closePath();
  ctx.fillStyle = shade(bottom, 8);
  ctx.fill();

  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, midY + topH);
  ctx.lineTo(cx, botY);
  ctx.moveTo(cx, midY + topH);
  ctx.lineTo(cx - half, midY);
  ctx.moveTo(cx, midY + topH);
  ctx.lineTo(cx + half, midY);
  ctx.stroke();
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amt);
  const g = clamp(((n >> 8) & 255) + amt);
  const b = clamp((n & 255) + amt);
  return `rgb(${r},${g},${b})`;
}
