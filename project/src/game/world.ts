import * as THREE from "three";
import {
  ATLAS_COLS,
  ATLAS_ROWS,
  BLOCKS,
  Block,
  CHUNK_H,
  CHUNK_W,
  FACE_LIGHT,
  RENDER_CHUNKS,
  SEA_LEVEL,
  chunkKey,
  isLiquid,
  isOpaque,
  isSolid,
  localCoord,
  worldToChunk,
  type BlockId,
} from "./constants";
import { Noise, hash2, hash3 } from "./noise";

export type Hit = {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  id: number;
  t: number;
};

type Layer = "opaque" | "cutout" | "liquid";

const FACES = [
  {
    d: [1, 0, 0] as const,
    corners: [
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
    ],
    ao: [
      [
        [1, 0, -1],
        [1, -1, 0],
        [1, -1, -1],
      ],
      [
        [1, 0, -1],
        [1, 1, 0],
        [1, 1, -1],
      ],
      [
        [1, 0, 1],
        [1, 1, 0],
        [1, 1, 1],
      ],
      [
        [1, 0, 1],
        [1, -1, 0],
        [1, -1, 1],
      ],
    ],
  },
  {
    d: [-1, 0, 0] as const,
    corners: [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [0, 0, 0],
    ],
    ao: [
      [
        [-1, 0, 1],
        [-1, -1, 0],
        [-1, -1, 1],
      ],
      [
        [-1, 0, 1],
        [-1, 1, 0],
        [-1, 1, 1],
      ],
      [
        [-1, 0, -1],
        [-1, 1, 0],
        [-1, 1, -1],
      ],
      [
        [-1, 0, -1],
        [-1, -1, 0],
        [-1, -1, -1],
      ],
    ],
  },
  {
    d: [0, 1, 0] as const,
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    ao: [
      [
        [0, 1, 1],
        [-1, 1, 0],
        [-1, 1, 1],
      ],
      [
        [0, 1, 1],
        [1, 1, 0],
        [1, 1, 1],
      ],
      [
        [0, 1, -1],
        [1, 1, 0],
        [1, 1, -1],
      ],
      [
        [0, 1, -1],
        [-1, 1, 0],
        [-1, 1, -1],
      ],
    ],
  },
  {
    d: [0, -1, 0] as const,
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    ao: [
      [
        [0, -1, -1],
        [-1, -1, 0],
        [-1, -1, -1],
      ],
      [
        [0, -1, -1],
        [1, -1, 0],
        [1, -1, -1],
      ],
      [
        [0, -1, 1],
        [1, -1, 0],
        [1, -1, 1],
      ],
      [
        [0, -1, 1],
        [-1, -1, 0],
        [-1, -1, 1],
      ],
    ],
  },
  {
    d: [0, 0, 1] as const,
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    ao: [
      [
        [0, -1, 1],
        [-1, 0, 1],
        [-1, -1, 1],
      ],
      [
        [0, -1, 1],
        [1, 0, 1],
        [1, -1, 1],
      ],
      [
        [0, 1, 1],
        [1, 0, 1],
        [1, 1, 1],
      ],
      [
        [0, 1, 1],
        [-1, 0, 1],
        [-1, 1, 1],
      ],
    ],
  },
  {
    d: [0, 0, -1] as const,
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    ao: [
      [
        [0, -1, -1],
        [1, 0, -1],
        [1, -1, -1],
      ],
      [
        [0, -1, -1],
        [-1, 0, -1],
        [-1, -1, -1],
      ],
      [
        [0, 1, -1],
        [-1, 0, -1],
        [-1, 1, -1],
      ],
      [
        [0, 1, -1],
        [1, 0, -1],
        [1, 1, -1],
      ],
    ],
  },
];

export class Chunk {
  cx: number;
  cz: number;
  data: Uint8Array;
  meshes: Partial<Record<Layer, THREE.Mesh>> = {};
  dirty = true;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.data = new Uint8Array(CHUNK_W * CHUNK_H * CHUNK_W);
  }

  idx(x: number, y: number, z: number): number {
    return x + z * CHUNK_W + y * CHUNK_W * CHUNK_W;
  }

  get(x: number, y: number, z: number): number {
    if (y < 0 || y >= CHUNK_H || x < 0 || x >= CHUNK_W || z < 0 || z >= CHUNK_W) return Block.AIR;
    return this.data[this.idx(x, y, z)];
  }

  set(x: number, y: number, z: number, id: number) {
    if (y < 0 || y >= CHUNK_H || x < 0 || x >= CHUNK_W || z < 0 || z >= CHUNK_W) return;
    this.data[this.idx(x, y, z)] = id;
    this.dirty = true;
  }
}

export class World {
  chunks = new Map<string, Chunk>();
  seed: number;
  noise: Noise;
  group = new THREE.Group();
  private mats!: Record<Layer, THREE.MeshLambertMaterial>;
  private dirty = new Set<string>();

  constructor(seed: number, atlas: THREE.Texture) {
    this.seed = seed;
    this.noise = new Noise(seed);
    this.mats = {
      opaque: new THREE.MeshLambertMaterial({
        map: atlas,
        vertexColors: true,
      }),
      cutout: new THREE.MeshLambertMaterial({
        map: atlas,
        vertexColors: true,
        alphaTest: 0.15,
        side: THREE.DoubleSide,
      }),
      liquid: new THREE.MeshLambertMaterial({
        map: atlas,
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    };
  }

  getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cz));
  }

  ensureChunk(cx: number, cz: number): Chunk {
    const k = chunkKey(cx, cz);
    let c = this.chunks.get(k);
    if (!c) {
      c = new Chunk(cx, cz);
      this.chunks.set(k, c);
    }
    return c;
  }

  getBlock(x: number, y: number, z: number): number {
    if (y < 0) return Block.BEDROCK;
    if (y >= CHUNK_H) return Block.AIR;
    const cx = worldToChunk(x);
    const cz = worldToChunk(z);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return Block.AIR;
    return chunk.get(localCoord(x), y, localCoord(z));
  }

  setBlock(x: number, y: number, z: number, id: number) {
    if (y < 0 || y >= CHUNK_H) return;
    const cx = worldToChunk(x);
    const cz = worldToChunk(z);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;
    const lx = localCoord(x);
    const lz = localCoord(z);
    chunk.set(lx, y, lz, id);
    this.markDirty(cx, cz);
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_W - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_W - 1) this.markDirty(cx, cz + 1);
  }

  markDirty(cx: number, cz: number) {
    const c = this.getChunk(cx, cz);
    if (c) {
      c.dirty = true;
      this.dirty.add(chunkKey(cx, cz));
    }
  }

  heightAt(x: number, z: number): number {
    const n = this.noise;
    const e = (n.fbm2(x * 0.0032, z * 0.0032, 5) + 1) * 0.5;
    const ridged = 1 - Math.abs(n.fbm2(x * 0.008, z * 0.008, 4));
    const detail = n.fbm2(x * 0.03, z * 0.03, 3);
    const mountain = Math.pow(Math.max(0, e - 0.42) / 0.58, 1.55);
    const base = 10 + e * 18 + ridged * ridged * mountain * 28 + detail * 3.2;
    return Math.max(2, Math.min(CHUNK_H - 8, Math.floor(base)));
  }

  biomeAt(x: number, z: number): "plains" | "forest" | "desert" | "snow" | "beach" {
    const h = this.heightAt(x, z);
    if (h <= SEA_LEVEL + 1) return "beach";
    const temp = this.noise.fbm2(x * 0.004 + 40, z * 0.004 + 40, 3);
    const moist = this.noise.fbm2(x * 0.0045 - 80, z * 0.0045 - 80, 3);
    if (temp < -0.22) return "snow";
    if (temp > 0.32 && moist < 0.05) return "desert";
    if (moist > 0.12) return "forest";
    return "plains";
  }

  generateChunk(cx: number, cz: number) {
    const chunk = this.ensureChunk(cx, cz);
    const seed = this.seed;
    for (let lz = 0; lz < CHUNK_W; lz++) {
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const x = cx * CHUNK_W + lx;
        const z = cz * CHUNK_W + lz;
        const h = this.heightAt(x, z);
        const biome = this.biomeAt(x, z);
        for (let y = 0; y < CHUNK_H; y++) {
          let id: number = Block.AIR;
          if (y === 0) id = Block.BEDROCK;
          else if (y <= 2 && hash3(x, y, z, seed) < 0.7) id = Block.BEDROCK;
          else if (y > h) {
            if (y <= SEA_LEVEL) id = Block.WATER;
          } else {
            const depth = h - y;
            if (biome === "desert") {
              if (depth === 0) id = Block.SAND;
              else if (depth < 4) id = Block.SAND;
              else if (depth < 6) id = Block.SANDSTONE;
              else id = Block.STONE;
            } else if (biome === "beach") {
              if (depth < 3) id = Block.SAND;
              else if (depth < 5) id = Block.SANDSTONE;
              else id = Block.STONE;
            } else if (biome === "snow") {
              if (depth === 0) id = Block.SNOW;
              else if (depth < 4) id = Block.DIRT;
              else id = Block.STONE;
            } else {
              if (depth === 0) id = y < SEA_LEVEL ? Block.DIRT : Block.GRASS;
              else if (depth < 4) id = Block.DIRT;
              else id = Block.STONE;
            }
            if (id === Block.STONE) {
              const r = hash3(x, y, z, seed + 9);
              if (y < 14 && r < 0.004) id = Block.DIAMOND;
              else if (y < 28 && r < 0.01) id = Block.GOLD;
              else if (y < 48 && r < 0.028) id = Block.IRON;
              else if (r < 0.055) id = Block.COAL;
              else if (r < 0.07 && y < h - 2) id = Block.GRAVEL;
            }
            const cave = this.noise.fbm3(x * 0.055, y * 0.07, z * 0.055, 3);
            const cave2 = this.noise.noise3(x * 0.03 + 20, y * 0.04, z * 0.03);
            if (y > 3 && y < h - 1 && cave > 0.38 && cave2 > -0.05) {
              id = y <= SEA_LEVEL && y > h - 6 ? Block.WATER : Block.AIR;
            }
          }
          chunk.set(lx, y, lz, id);
        }
      }
    }
    chunk.dirty = true;
    this.dirty.add(chunkKey(cx, cz));
  }

  decorateAll() {
    for (const chunk of this.chunks.values()) this.decorate(chunk);
  }

  decorateChunk(cx: number, cz: number) {
    const chunk = this.getChunk(cx, cz);
    if (chunk) this.decorate(chunk);
  }

  private decorate(chunk: Chunk) {
    const seed = this.seed;
    for (let lz = 0; lz < CHUNK_W; lz++) {
      for (let lx = 0; lx < CHUNK_W; lx++) {
        const x = chunk.cx * CHUNK_W + lx;
        const z = chunk.cz * CHUNK_W + lz;
        let surface = -1;
        for (let y = CHUNK_H - 1; y >= 0; y--) {
          const id = chunk.get(lx, y, lz);
          if (id !== Block.AIR && id !== Block.WATER) {
            surface = y;
            break;
          }
        }
        if (surface < 0) continue;
        const top = chunk.get(lx, surface, lz);
        const biome = this.biomeAt(x, z);
        const r = hash2(x, z, seed);

        if (top === Block.GRASS && biome === "forest" && r < 0.045) {
          this.placeTree(x, surface + 1, z);
        } else if (top === Block.GRASS && biome === "plains" && r < 0.012) {
          this.placeTree(x, surface + 1, z);
        } else if (top === Block.SAND && biome === "desert" && r < 0.018) {
          const h = 2 + ((hash2(x, z, seed + 3) * 3) | 0);
          for (let i = 0; i < h; i++) {
            if (this.getBlock(x, surface + 1 + i, z) === Block.AIR) {
              this.setWorldIfAir(x, surface + 1 + i, z, Block.CACTUS);
            }
          }
        } else if (top === Block.GRASS && r > 0.985) {
          this.setWorldIfAir(x, surface + 1, z, Block.PUMPKIN);
        }
      }
    }
  }

  private setWorldIfAir(x: number, y: number, z: number, id: number) {
    if (this.getBlock(x, y, z) === Block.AIR) this.setBlock(x, y, z, id);
  }

  private placeTree(x: number, y: number, z: number) {
    const h = 4 + ((hash2(x, z, this.seed + 11) * 3) | 0);
    for (let i = 0; i < h; i++) this.setWorldIfAir(x, y + i, z, Block.LOG);
    const top = y + h - 1;
    for (let dy = -2; dy <= 2; dy++) {
      const rad = dy >= 1 ? 1 : 2;
      for (let dx = -rad; dx <= rad; dx++) {
        for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) === rad && Math.abs(dz) === rad && hash2(x + dx, z + dz + dy, this.seed) < 0.4) {
            continue;
          }
          if (dx === 0 && dz === 0 && dy <= 0) continue;
          this.setWorldIfAir(x + dx, top + dy, z + dz, Block.LEAVES);
        }
      }
    }
    this.setWorldIfAir(x, top + 2, z, Block.LEAVES);
  }

  generateAll(onProgress?: (p: number) => void) {
    const r = RENDER_CHUNKS;
    const list: Array<[number, number]> = [];
    for (let cz = -r; cz <= r; cz++) {
      for (let cx = -r; cx <= r; cx++) list.push([cx, cz]);
    }
    list.forEach(([cx, cz], i) => {
      this.generateChunk(cx, cz);
      onProgress?.((i + 1) / list.length * 0.7);
    });
  }

  meshAll(onProgress?: (p: number) => void) {
    const all = [...this.chunks.values()];
    all.forEach((c, i) => {
      this.remesh(c);
      onProgress?.(0.7 + ((i + 1) / all.length) * 0.3);
    });
  }

  flushDirty() {
    if (this.dirty.size === 0) return;
    for (const k of this.dirty) {
      const c = this.chunks.get(k);
      if (c) this.remesh(c);
    }
    this.dirty.clear();
  }

  clearDirty() {
    this.dirty.clear();
  }

  unload(cx: number, cz: number) {
    const k = chunkKey(cx, cz);
    const chunk = this.chunks.get(k);
    if (!chunk) return;
    for (const m of Object.values(chunk.meshes)) {
      if (!m) continue;
      this.group.remove(m);
      m.geometry.dispose();
    }
    this.chunks.delete(k);
    this.dirty.delete(k);
  }

  remesh(chunk: Chunk) {
    const layers: Record<Layer, { pos: number[]; nrm: number[]; uv: number[]; col: number[]; idx: number[] }> = {
      opaque: { pos: [], nrm: [], uv: [], col: [], idx: [] },
      cutout: { pos: [], nrm: [], uv: [], col: [], idx: [] },
      liquid: { pos: [], nrm: [], uv: [], col: [], idx: [] },
    };

    for (let y = 0; y < CHUNK_H; y++) {
      for (let z = 0; z < CHUNK_W; z++) {
        for (let x = 0; x < CHUNK_W; x++) {
          const id = chunk.get(x, y, z) as BlockId;
          if (id === Block.AIR) continue;
          const def = BLOCKS[id];
          if (!def) continue;
          const layer: Layer = def.liquid ? "liquid" : def.cutout ? "cutout" : "opaque";
          const wx = chunk.cx * CHUNK_W + x;
          const wz = chunk.cz * CHUNK_W + z;
          this.addFaces(layers[layer], id, wx, y, wz);
        }
      }
    }

    (["opaque", "cutout", "liquid"] as Layer[]).forEach((layer) => {
      const old = chunk.meshes[layer];
      if (old) {
        this.group.remove(old);
        old.geometry.dispose();
        delete chunk.meshes[layer];
      }
      const geo = this.buildGeo(layers[layer]);
      if (!geo) return;
      const mesh = new THREE.Mesh(geo, this.mats[layer]);
      mesh.frustumCulled = true;
      chunk.meshes[layer] = mesh;
      this.group.add(mesh);
    });
    chunk.dirty = false;
  }

  private addFaces(
    buf: { pos: number[]; nrm: number[]; uv: number[]; col: number[]; idx: number[] },
    id: number,
    x: number,
    y: number,
    z: number,
  ) {
    const def = BLOCKS[id];
    for (let f = 0; f < 6; f++) {
      const face = FACES[f];
      const nx = x + face.d[0];
      const ny = y + face.d[1];
      const nz = z + face.d[2];
      const nid = this.getBlock(nx, ny, nz);
      if (def.liquid) {
        if (nid === id || isOpaque(nid)) continue;
      } else if (def.opaque) {
        if (isOpaque(nid)) continue;
      } else {
        if (isOpaque(nid) || nid === id) continue;
      }
      const tex =
        face.d[1] === 1 ? def.textures.top : face.d[1] === -1 ? def.textures.bottom : def.textures.side;
      const uv = tileUV(tex);
      const light = FACE_LIGHT[f];
      const aos = face.ao.map((offs) => {
        const s1 = isOpaque(this.getBlock(x + offs[0][0], y + offs[0][1], z + offs[0][2]));
        const s2 = isOpaque(this.getBlock(x + offs[1][0], y + offs[1][1], z + offs[1][2]));
        const cr = isOpaque(this.getBlock(x + offs[2][0], y + offs[2][1], z + offs[2][2]));
        const v = s1 && s2 ? 0 : 3 - (Number(s1) + Number(s2) + Number(cr));
        return [0.52, 0.7, 0.85, 1][v];
      });
      const flip = aos[0] + aos[2] > aos[1] + aos[3];
      const vi = buf.pos.length / 3;
      const uvs = [
        [uv.u0, uv.v0],
        [uv.u0, uv.v1],
        [uv.u1, uv.v1],
        [uv.u1, uv.v0],
      ];
      for (let i = 0; i < 4; i++) {
        const c = face.corners[i];
        buf.pos.push(x + c[0], y + c[1], z + c[2]);
        buf.nrm.push(face.d[0], face.d[1], face.d[2]);
        buf.uv.push(uvs[i][0], uvs[i][1]);
        const ao = aos[i] * light;
        buf.col.push(ao, ao, ao);
      }
      if (flip) buf.idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      else buf.idx.push(vi + 1, vi + 2, vi + 3, vi + 1, vi + 3, vi);
    }
  }

  private buildGeo(buf: { pos: number[]; nrm: number[]; uv: number[]; col: number[]; idx: number[] }) {
    if (buf.idx.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(buf.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(buf.nrm, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(buf.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(buf.col, 3));
    g.setIndex(buf.idx);
    g.computeBoundingSphere();
    return g;
  }

  surfaceY(x: number, z: number): number {
    for (let y = CHUNK_H - 1; y >= 0; y--) {
      const id = this.getBlock(Math.floor(x), y, Math.floor(z));
      if (isSolid(id)) return y + 1;
    }
    return SEA_LEVEL + 2;
  }

  findSpawn(): THREE.Vector3 {
    for (let r = 0; r < 24; r++) {
      for (let t = 0; t < 8; t++) {
        const x = Math.round(Math.cos((t / 8) * Math.PI * 2) * r) + 0.5;
        const z = Math.round(Math.sin((t / 8) * Math.PI * 2) * r) + 0.5;
        const y = this.surfaceY(x, z);
        const below = this.getBlock(Math.floor(x), y - 1, Math.floor(z));
        if (isSolid(below) && below !== Block.WATER && y > SEA_LEVEL) {
          return new THREE.Vector3(x, y + 0.05, z);
        }
      }
    }
    return new THREE.Vector3(0.5, this.surfaceY(0.5, 0.5) + 0.05, 0.5);
  }

  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): Hit | null {
    let x = Math.floor(ox);
    let y = Math.floor(oy);
    let z = Math.floor(oz);
    const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;
    const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dy) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dz) : Infinity;
    let tMaxX = stepX > 0 ? (x + 1 - ox) * tDeltaX : stepX < 0 ? (ox - x) * tDeltaX : Infinity;
    let tMaxY = stepY > 0 ? (y + 1 - oy) * tDeltaY : stepY < 0 ? (oy - y) * tDeltaY : Infinity;
    let tMaxZ = stepZ > 0 ? (z + 1 - oz) * tDeltaZ : stepZ < 0 ? (oz - z) * tDeltaZ : Infinity;
    let nx = 0;
    let ny = 0;
    let nz = 0;
    let t = 0;
    for (let i = 0; i < 80 && t <= maxDist; i++) {
      const id = this.getBlock(x, y, z);
      if (id !== Block.AIR && !isLiquid(id)) {
        return { x, y, z, nx, ny, nz, id, t };
      }
      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          t = tMaxX;
          tMaxX += tDeltaX;
          nx = -stepX;
          ny = 0;
          nz = 0;
        } else {
          z += stepZ;
          t = tMaxZ;
          tMaxZ += tDeltaZ;
          nx = 0;
          ny = 0;
          nz = -stepZ;
        }
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        t = tMaxY;
        tMaxY += tDeltaY;
        nx = 0;
        ny = -stepY;
        nz = 0;
      } else {
        z += stepZ;
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
    }
    return null;
  }

  dispose() {
    for (const c of this.chunks.values()) {
      for (const m of Object.values(c.meshes)) {
        if (!m) continue;
        this.group.remove(m);
        m.geometry.dispose();
      }
    }
    this.mats.opaque.dispose();
    this.mats.cutout.dispose();
    this.mats.liquid.dispose();
    this.chunks.clear();
  }
}

function tileUV(slot: number) {
  const col = slot % ATLAS_COLS;
  const row = Math.floor(slot / ATLAS_COLS);
  const pad = 0.002;
  const u0 = col / ATLAS_COLS + pad;
  const u1 = (col + 1) / ATLAS_COLS - pad;
  const v1 = 1 - row / ATLAS_ROWS - pad;
  const v0 = 1 - (row + 1) / ATLAS_ROWS + pad;
  return { u0, v0, u1, v1 };
}
