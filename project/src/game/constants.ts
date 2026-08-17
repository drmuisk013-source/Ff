export const CHUNK_W = 16;
export const CHUNK_H = 72;
export const RENDER_CHUNKS = 3;
export const SEA_LEVEL = 22;
export const TILE = 16;
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 4;

export const Block = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COBBLE: 4,
  LOG: 5,
  LEAVES: 6,
  PLANKS: 7,
  SAND: 8,
  WATER: 9,
  GLASS: 10,
  BRICK: 11,
  BEDROCK: 12,
  COAL: 13,
  IRON: 14,
  GOLD: 15,
  DIAMOND: 16,
  SNOW: 17,
  GRAVEL: 18,
  CACTUS: 19,
  SANDSTONE: 20,
  STONEBRICK: 21,
  WOOL: 22,
  PUMPKIN: 23,
} as const;

export type BlockId = (typeof Block)[keyof typeof Block];

export const Tex = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  STONE: 3,
  COBBLE: 4,
  LOG_SIDE: 5,
  LOG_TOP: 6,
  LEAVES: 7,
  PLANKS: 8,
  SAND: 9,
  WATER: 10,
  GLASS: 11,
  BRICK: 12,
  BEDROCK: 13,
  COAL: 14,
  IRON: 15,
  GOLD: 16,
  DIAMOND: 17,
  SNOW: 18,
  GRAVEL: 19,
  CACTUS_SIDE: 20,
  CACTUS_TOP: 21,
  SANDSTONE: 22,
  STONEBRICK: 23,
  WOOL: 24,
  PUMPKIN_SIDE: 25,
  PUMPKIN_TOP: 26,
  SNOW_SIDE: 27,
} as const;

export type BlockDef = {
  id: BlockId;
  name: string;
  solid: boolean;
  opaque: boolean;
  liquid: boolean;
  cutout: boolean;
  placeable: boolean;
  textures: { top: number; bottom: number; side: number };
  color: { top: string; side: string; bottom: string };
};

export const BLOCKS: Record<number, BlockDef> = {
  [Block.AIR]: {
    id: Block.AIR,
    name: "Air",
    solid: false,
    opaque: false,
    liquid: false,
    cutout: false,
    placeable: false,
    textures: { top: 0, bottom: 0, side: 0 },
    color: { top: "#000", side: "#000", bottom: "#000" },
  },
  [Block.GRASS]: {
    id: Block.GRASS,
    name: "Grass",
    solid: true,
    opaque: true,
    liquid: false,
    cutout: false,
    placeable: true,
    textures: { top: Tex.GRASS_TOP, bottom: Tex.DIRT, side: Tex.GRASS_SIDE },
    color: { top: "#5d9b3e", side: "#7a5a32", bottom: "#7a5a32" },
  },
  [Block.DIRT]: {
    id: Block.DIRT,
    name: "Dirt",
    solid: true,
    opaque: true,
    liquid: false,
    cutout: false,
    placeable: true,
    textures: { top: Tex.DIRT, bottom: Tex.DIRT, side: Tex.DIRT },
    color: { top: "#8a6b3e", side: "#7a5a32", bottom: "#6b4c28" },
  },
  [Block.STONE]: {
    id: Block.STONE,
    name: "Stone",
    solid: true,
    opaque: true,
    liquid: false,
    cutout: false,
    placeable: true,
    textures: { top: Tex.STONE, bottom: Tex.STONE, side: Tex.STONE },
    color: { top: "#7f7f7f", side: "#707070", bottom: "#5a5a5a" },
  },
  [Block.COBBLE]: {
    id: Block.COBBLE,
    name: "Cobblestone",
    solid: true,
    opaque: true,
    liquid: false,
    cutout: false,
    placeable: true,
    textures: { top: Tex.COBBLE, bottom: Tex.COBBLE, side: Tex.COBBLE },
    color: { top: "#6b6b6b", side: "#5c5c5c", bottom: "#4a4a4a" },
  },
  [Block.LOG]: {
    id: Block.LOG,
    name: "Oak Log",
    solid: true,
    opaque: true,
    liquid: false,
    cutout: false,
    placeable: true,
    textures: { top: Tex.LOG_TOP, bottom: Tex.LOG_TOP, side: Tex.LOG_SIDE },
    color: { top: "#6d5530", side: "#4d3b22", bottom: "#6d5530" },
  },
  [Block.LEAVES]: {
    id: Block.LEAVES,
    name: "Oak Leaves",
    solid: true,
    opaque: false,
    liquid: false,
    cutout: true,
    placeable: true,
    textures: { top: Tex.LEAVES, bottom: Tex.LEAVES, side: Tex.LEAVES },
    color: { top: "#3d7a28", side: "#326620", bottom: "#2a551a" },
  },
  [Block.PLANKS]: {
    id: Block.PLANKS,
    name: "Oak Planks",
    solid: true,
    opaque: true,
    liquid: false,
    cutout: false,
    placeable: true,
    textures: { top: Tex.PLANKS, bottom: Tex.PLANKS, side: Tex.PLANKS },
    color: { top: "#b8945f", side: "#a07d4a", bottom: "#8c6b3c" },
  },
  [Block.SAND]: {
    id: Block.SAND,
    name: "Sand",
    solid: true,
    opaque: true,
    liquid: false,
    cutout: false,
    placeable: true,
    textures: { top: Tex.SAND, bottom: Tex.SAND, side: Tex.SAND },
    color: { top: "#ddd5a0", side: "#d0c686", bottom: "#c2b56e" },
  },
  [Block.WATER]: {
    id: Block.WATER,
    name: "Water",
    solid: false,
    opaque: false,
    liquid: true,
    cutout: false,
    placeable: true,
    textures: { top: Tex.WATER, bottom: Tex.WATER, side: Tex.WATER },
    color: { top: "#3f76e4", side: "#2d5bb8", bottom: "#2450a0" },
  },
  [Block.GLASS]: {
    id: Block.GLASS,
    name: "Glass",
    solid: true,
    opaque: false,
    liquid: false,
    cutout: true,
    placeable: true,
    textures: { top: Tex.GLASS, bottom: Tex.GLASS, side: Tex.GLASS },
    color: { top: "#c8e6f0", side: "#b0d4e0", bottom: "#98c4d0" },
  },
  [Block.BRICK]: {
    id: Block.BRICK,
    name: "Bricks",
    solid: true,
    opaque: true,
    liquid: false,
    cutout: false,
    placeable: true,
    textures: { top: Tex.BRICK, bottom: Tex.BRICK, side: Tex.BRICK },
    color: { top: "#9b4e3a", side: "#854233", bottom: "#6e3629" },
  },
  [Block.BEDROCK]: {
    id: Block.BEDROCK,
    name: "Bedrock",
    solid: true,
    opaque: true,
    liquid: false,
    cutout: false,
    placeable: false,
    textures: { top: Tex.BEDROCK, bottom: Tex.BEDROCK, side: Tex.BEDROCK },
    color: { top: "#333333", side: "#222222", bottom: "#111111" },
  },
  [Block.COAL]: {
    id: Block.COAL,
    name: "Coal Ore",
    solid: true,
    opaque: true,
    liquid: false,
    cutout: false,
    placeable: true,
    textures: { top: Tex.COAL, bottom: Tex.COAL, side: Tex.COAL },
    color: { top: "#4a4a4a", side: "#3d3d3d", bottom: "#2e2e2e" },
  },
  [Block.IRON]: {
    id: Block.IRON,
    name: "Iron Ore",
    solid: true,
    opaque: true,
    liquid: false,
    cutout: false,
    placeable: true,
    textures: { top: Tex.IRON, bottom: Tex.IRON, side: Tex.IRON },
    color: { top: "#b0a090", side: "#8a8070", bottom: "#6a6050" },
  },
  [Block.GOLD]: {
    id: Block.GOLD,
    name: "Gold Ore",
    solid: true,
    opaque: true,
    liquid: false,
    cutout: false,
    placeable: true,
    textures: { top: Tex.GOLD, bottom: Tex.GOLD, side: Tex.GOLD },
    color: { top: "#d4c040", side: "#b8a030", bottom: "#8a7820" },
  },
  [Block.DIAMOND]: {
    id: Block.DIAMOND,
    name: "Diamond Ore",
    solid: true,
    opaque: true,
    liquid: false,
    cutout: false,
    placeable: true,
    textures: { top: Tex.DIAMOND, bottom: Tex.DIAMOND, side: Tex.DIAMOND },
    color: { top: "#4ad0c8", side: "#38b0b0", bottom: "#288888" },
  },
  [Block.SNOW]: {
    id: Block.SNOW,
    name: "Snow",
    solid: true,
    opaque: true,
    liquid: false,
    cutout: false,
    placeable: true,
    textures: { top: Tex.SNOW, bottom: Tex.DIRT, side: Tex.SNOW_SIDE },
    color: { top: "#f0f5ff", side: "#c8b090", bottom: "#7a5a32" },
  },
  [Block.GRAVEL]: {
    id: Block.GRAVEL,
    name: "Gravel",
    solid: true,
    opaque: true,
    liquid: false,
    cutout: false,
    placeable: true,
    textures: { top: Tex.GRAVEL, bottom: Tex.GRAVEL, side: Tex.GRAVEL },
    color: { top: "#857f7a", side: "#746e69", bottom: "#5e5854" },
  },
  [Block.CACTUS]: {
    id: Block.CACTUS,
    name: "Cactus",
    solid: true,
    opaque: true,
    liquid: false,
    cutout: false,
    placeable: true,
    textures: { top: Tex.CACTUS_TOP, bottom: Tex.CACTUS_TOP, side: Tex.CACTUS_SIDE },
    color: { top: "#3d8a28", side: "#2f7a20", bottom: "#2a681c" },
  },
  [Block.SANDSTONE]: {
    id: Block.SANDSTONE,
    name: "Sandstone",
    solid: true,
    opaque: true,
    liquid: false,
    cutout: false,
    placeable: true,
    textures: { top: Tex.SANDSTONE, bottom: Tex.SANDSTONE, side: Tex.SANDSTONE },
    color: { top: "#ddd09a", side: "#c8b86e", bottom: "#b0a058" },
  },
  [Block.STONEBRICK]: {
    id: Block.STONEBRICK,
    name: "Stone Bricks",
    solid: true,
    opaque: true,
    liquid: false,
    cutout: false,
    placeable: true,
    textures: { top: Tex.STONEBRICK, bottom: Tex.STONEBRICK, side: Tex.STONEBRICK },
    color: { top: "#7a7a7a", side: "#6a6a6a", bottom: "#555555" },
  },
  [Block.WOOL]: {
    id: Block.WOOL,
    name: "White Wool",
    solid: true,
    opaque: true,
    liquid: false,
    cutout: false,
    placeable: true,
    textures: { top: Tex.WOOL, bottom: Tex.WOOL, side: Tex.WOOL },
    color: { top: "#f2f2f2", side: "#e0e0e0", bottom: "#c8c8c8" },
  },
  [Block.PUMPKIN]: {
    id: Block.PUMPKIN,
    name: "Pumpkin",
    solid: true,
    opaque: true,
    liquid: false,
    cutout: false,
    placeable: true,
    textures: { top: Tex.PUMPKIN_TOP, bottom: Tex.PUMPKIN_SIDE, side: Tex.PUMPKIN_SIDE },
    color: { top: "#c07018", side: "#d87c1a", bottom: "#a05810" },
  },
};

export const PLACEABLE: BlockId[] = [
  Block.GRASS,
  Block.DIRT,
  Block.STONE,
  Block.COBBLE,
  Block.LOG,
  Block.LEAVES,
  Block.PLANKS,
  Block.SAND,
  Block.WATER,
  Block.GLASS,
  Block.BRICK,
  Block.COAL,
  Block.IRON,
  Block.GOLD,
  Block.DIAMOND,
  Block.SNOW,
  Block.GRAVEL,
  Block.CACTUS,
  Block.SANDSTONE,
  Block.STONEBRICK,
  Block.WOOL,
  Block.PUMPKIN,
];

export const DEFAULT_HOTBAR: BlockId[] = [
  Block.GRASS,
  Block.DIRT,
  Block.STONE,
  Block.COBBLE,
  Block.LOG,
  Block.PLANKS,
  Block.GLASS,
  Block.BRICK,
  Block.SAND,
];

export const FACE_LIGHT = [0.62, 0.62, 1.0, 0.48, 0.8, 0.8];

export function isSolid(id: number): boolean {
  return BLOCKS[id]?.solid ?? false;
}

export function isOpaque(id: number): boolean {
  return BLOCKS[id]?.opaque ?? false;
}

export function isLiquid(id: number): boolean {
  return BLOCKS[id]?.liquid ?? false;
}

export function isCutout(id: number): boolean {
  return BLOCKS[id]?.cutout ?? false;
}

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function worldToChunk(v: number): number {
  return Math.floor(v / CHUNK_W);
}

export function localCoord(v: number): number {
  return ((v % CHUNK_W) + CHUNK_W) % CHUNK_W;
}
