import * as THREE from "three";
import {
  BLOCKS,
  Block,
  DEFAULT_HOTBAR,
  PLACEABLE,
  RENDER_CHUNKS,
  chunkKey,
  worldToChunk,
  type BlockId,
} from "./constants";
import { Player } from "./player";
import { createAtlas } from "./textures";
import { World, type Hit } from "./world";

export type HudState = {
  x: number;
  y: number;
  z: number;
  fps: number;
  flying: boolean;
  inWater: boolean;
  target: string | null;
  slot: number;
  hotbar: BlockId[];
  selected: BlockId;
  paused: boolean;
  locked: boolean;
  dayFactor: number;
  seed: number;
};

export type GameOptions = {
  onHud: (hud: HudState) => void;
  onReady: () => void;
  onPause: () => void;
  /** Touch mode: on-screen controls, no pointer lock, lighter quality preset. */
  touch?: boolean;
};

type Particle = {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  max: number;
  mesh: THREE.Mesh;
};

export class Game {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  world: World;
  player: Player;
  seed: number;

  hotbar: BlockId[] = [...DEFAULT_HOTBAR];
  slot = 0;
  paused = false;
  running = false;
  touchMode = false;

  /** Chunk radius (mobile uses a smaller radius for performance). */
  private radius = RENDER_CHUNKS;

  private touchMove = { x: 0, y: 0 };
  private touchJump = false;
  private touchSneak = false;
  private touchSprint = false;
  private touchBreak = false;
  private placeOnceFlag = false;

  private keys = new Set<string>();
  private mouseLeft = false;
  private mouseRight = false;
  private breakCd = 0;
  private placeCd = 0;
  private last = 0;
  private raf = 0;
  private fps = 60;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private hudAcc = 0;
  private look = new THREE.Vector3();
  private eye = new THREE.Vector3();
  private hit: Hit | null = null;
  private outline: THREE.LineSegments;
  private hand: THREE.Group;
  private handMesh: THREE.Mesh;
  private swing = 0;
  private bob = 0;
  private sun: THREE.DirectionalLight;
  private moon: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private sunMesh: THREE.Mesh;
  private moonMesh: THREE.Mesh;
  private clouds: THREE.Group;
  private particles: Particle[] = [];
  private partMat: THREE.MeshLambertMaterial;
  private time = 80;
  private daySpeed = 1;
  private atlas: THREE.CanvasTexture;
  private fog = new THREE.Fog(0x78c0ff, 48, 118);
  private cb: GameOptions;
  private listeners: Array<[string, EventTarget, EventListener]> = [];
  private spaceTap = 0;
  private lastCx = Number.MAX_SAFE_INTEGER;
  private lastCz = Number.MAX_SAFE_INTEGER;
  private chunkQueue: Array<[number, number]> = [];
  private queued = new Set<string>();

  constructor(canvas: HTMLCanvasElement, seed: number, cb: GameOptions) {
    this.canvas = canvas;
    this.seed = seed;
    this.cb = cb;
    this.touchMode = !!cb.touch;
    this.radius = this.touchMode ? Math.min(2, RENDER_CHUNKS) : RENDER_CHUNKS;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.touchMode ? 1.25 : 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.scene = new THREE.Scene();
    this.scene.fog = this.fog;
    this.camera = new THREE.PerspectiveCamera(
      72,
      window.innerWidth / window.innerHeight,
      0.08,
      this.touchMode ? 160 : 256,
    );
    this.camera.rotation.order = "YXZ";
    if (this.touchMode) {
      this.fog.near = 24;
      this.fog.far = 46;
    }

    this.atlas = createAtlas();
    this.world = new World(seed, this.atlas);
    this.scene.add(this.world.group);
    this.player = new Player();
    if (this.touchMode) this.player.autoJump = true;

    this.hemi = new THREE.HemisphereLight(0x9ec9ff, 0x3d4a2a, 0.55);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff3c8, 1.15);
    this.sun.position.set(60, 80, 30);
    this.scene.add(this.sun);
    this.moon = new THREE.DirectionalLight(0x8899cc, 0.0);
    this.scene.add(this.moon);

    const sunGeo = new THREE.SphereGeometry(8, 12, 12);
    this.sunMesh = new THREE.Mesh(sunGeo, new THREE.MeshBasicMaterial({ color: 0xfff0a8 }));
    this.scene.add(this.sunMesh);
    this.moonMesh = new THREE.Mesh(sunGeo, new THREE.MeshBasicMaterial({ color: 0xdde6ff }));
    this.scene.add(this.moonMesh);

    this.clouds = this.makeClouds();
    this.scene.add(this.clouds);

    const edge = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
    this.outline = new THREE.LineSegments(
      edge,
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }),
    );
    this.outline.visible = false;
    this.scene.add(this.outline);

    this.hand = new THREE.Group();
    this.handMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.28, 0.28),
      new THREE.MeshLambertMaterial({ map: this.atlas }),
    );
    this.hand.add(this.handMesh);
    this.hand.position.set(0.42, -0.38, -0.62);
    this.camera.add(this.hand);
    this.scene.add(this.camera);
    this.updateHandUVs();

    this.partMat = new THREE.MeshLambertMaterial({ map: this.atlas });

    this.bind();
  }

  async generate(onProgress: (p: number) => void) {
    const r = this.radius;
    const list: Array<[number, number]> = [];
    for (let cz = -r; cz <= r; cz++) {
      for (let cx = -r; cx <= r; cx++) list.push([cx, cz]);
    }
    for (let i = 0; i < list.length; i++) {
      this.world.generateChunk(list[i][0], list[i][1]);
      if (i % 2 === 0) {
        onProgress(((i + 1) / list.length) * 0.55);
        await nextFrame();
      }
    }
    this.world.decorateAll();
    onProgress(0.6);
    await nextFrame();
    const chunks = [...this.world.chunks.values()];
    for (let i = 0; i < chunks.length; i++) {
      this.world.remesh(chunks[i]);
      if (i % 2 === 0) {
        onProgress(0.65 + ((i + 1) / chunks.length) * 0.35);
        await nextFrame();
      }
    }
    const spawn = this.world.findSpawn();
    this.player.pos.copy(spawn);
    this.world.clearDirty();
    this.lastCx = worldToChunk(spawn.x);
    this.lastCz = worldToChunk(spawn.z);
    this.cb.onReady();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.emitHud();
    this.loop(this.last);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose() {
    this.stop();
    for (const [type, target, fn] of this.listeners) {
      target.removeEventListener(type, fn);
    }
    this.listeners = [];
    this.world.dispose();
    this.atlas.dispose();
    this.renderer.dispose();
    this.outline.geometry.dispose();
    (this.outline.material as THREE.Material).dispose();
    this.handMesh.geometry.dispose();
    (this.handMesh.material as THREE.Material).dispose();
    this.partMat.dispose();
    this.particles.forEach((p) => {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
    });
  }

  lock() {
    if (this.touchMode) return;
    this.canvas.requestPointerLock();
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Pause and surface the pause menu (used by touch pause / fullscreen exit). */
  pause() {
    if (!this.running) return;
    this.clearTouchInputs();
    this.paused = true;
    this.cb.onPause();
  }

  /** Pause silently for an in-game menu (e.g. inventory) without the pause overlay. */
  enterMenu() {
    this.clearTouchInputs();
    this.paused = true;
  }

  /** Leave a paused/menu state and keep playing. */
  resume() {
    this.paused = false;
    if (!this.touchMode) this.lock();
  }

  setTouchMove(x: number, y: number) {
    this.touchMove.x = Math.max(-1, Math.min(1, x));
    this.touchMove.y = Math.max(-1, Math.min(1, y));
  }

  addLook(dx: number, dy: number) {
    if (!this.touchMode || this.paused) return;
    const scale = 1.7;
    this.player.applyMouse(dx * scale, dy * scale);
  }

  setTouchJump(down: boolean) {
    this.touchJump = down;
    if (down && this.player.inWater) return;
  }

  setTouchSneak(down: boolean) {
    this.touchSneak = down;
  }

  setTouchSprint(down: boolean) {
    this.touchSprint = down;
  }

  setTouchBreak(down: boolean) {
    this.touchBreak = down;
  }

  placeOnce() {
    this.placeOnceFlag = true;
  }

  private clearTouchInputs() {
    this.touchMove.x = 0;
    this.touchMove.y = 0;
    this.touchJump = false;
    this.touchSneak = false;
    this.touchSprint = false;
    this.touchBreak = false;
    this.placeOnceFlag = false;
  }


  setSlot(i: number) {
    this.slot = ((i % 9) + 9) % 9;
    this.updateHandUVs();
  }

  setHotbarBlock(id: BlockId) {
    this.hotbar[this.slot] = id;
    this.updateHandUVs();
  }

  selected(): BlockId {
    return this.hotbar[this.slot];
  }

  toggleFly() {
    this.player.flying = !this.player.flying;
    this.player.vel.y = 0;
  }

  private bind() {
    const on = (type: string, target: EventTarget, fn: EventListener) => {
      target.addEventListener(type, fn);
      this.listeners.push([type, target, fn]);
    };

    on("keydown", window, (e) => {
      const ev = e as KeyboardEvent;
      if (ev.repeat && ev.code === "Space") return;
      this.keys.add(ev.code);
      if (
        ev.code === "Tab" ||
        ev.code === "Space" ||
        ev.code === "ArrowUp" ||
        ev.code === "ArrowDown" ||
        ev.code === "ArrowLeft" ||
        ev.code === "ArrowRight" ||
        ev.code === "KeyF" ||
        ev.code === "KeyE"
      ) {
        ev.preventDefault();
      }
      if (this.paused) return;
      if (ev.code >= "Digit1" && ev.code <= "Digit9") {
        this.setSlot(Number(ev.code.slice(5)) - 1);
      }
      if (ev.code === "KeyF") this.toggleFly();
      if (ev.code === "Space") {
        const now = performance.now();
        if (now - this.spaceTap < 280) this.toggleFly();
        this.spaceTap = now;
      }
      if (ev.code === "KeyN") this.time += 40;
    });
    on("keyup", window, (e) => {
      this.keys.delete((e as KeyboardEvent).code);
    });
    on("mousedown", this.canvas, (e) => {
      const ev = e as MouseEvent;
      if (this.touchMode) return;
      if (!document.pointerLockElement) {
        this.lock();
        return;
      }
      if (ev.button === 0) this.mouseLeft = true;
      if (ev.button === 2) this.mouseRight = true;
    });
    on("mouseup", window, (e) => {
      const ev = e as MouseEvent;
      if (ev.button === 0) this.mouseLeft = false;
      if (ev.button === 2) this.mouseRight = false;
    });
    on("contextmenu", this.canvas, (e) => e.preventDefault());
    on("mousemove", document, (e) => {
      if (document.pointerLockElement !== this.canvas) return;
      const ev = e as MouseEvent;
      this.player.applyMouse(ev.movementX, ev.movementY);
    });
    on("wheel", this.canvas, (e) => {
      const ev = e as WheelEvent;
      ev.preventDefault();
      this.setSlot(this.slot + (ev.deltaY > 0 ? 1 : -1));
    });
    on("pointerlockchange", document, () => {
      const locked = document.pointerLockElement === this.canvas;
      if (!locked && this.running) {
        this.paused = true;
        this.cb.onPause();
      } else if (locked) {
        this.paused = false;
      }
    });
    on("resize", window, () => this.resize());
    on("orientationchange", window, () => this.resize());
    if (window.visualViewport) {
      on("resize", window.visualViewport, () => this.resize());
    }
    on("blur", window, () => {
      this.keys.clear();
      this.clearTouchInputs();
    });
    on("visibilitychange", document, () => {
      if (document.hidden && this.running && !this.paused) {
        this.pause();
      }
    });
  }

  private resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.4) {
      this.fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
    if (!this.paused) this.update(dt);
    this.render();
    this.hudAcc += dt;
    if (this.hudAcc > 0.08) {
      this.hudAcc = 0;
      this.emitHud();
    }
  };

  private update(dt: number) {
    const kf = Number(this.keys.has("KeyW") || this.keys.has("ArrowUp")) - Number(this.keys.has("KeyS") || this.keys.has("ArrowDown"));
    const ks = Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) - Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"));
    const f = Math.max(-1, Math.min(1, kf + this.touchMove.y));
    const s = Math.max(-1, Math.min(1, ks + this.touchMove.x));
    this.player.update(dt, this.world, {
      f,
      s,
      jump: this.keys.has("Space") || this.touchJump,
      sneak: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") || this.touchSneak,
      sprint: this.keys.has("ControlLeft") || this.keys.has("ControlRight") || this.touchSprint,
      flyUp: this.keys.has("Space") || this.touchJump,
    });

    this.time += dt * this.daySpeed;
    this.breakCd = Math.max(0, this.breakCd - dt);
    this.placeCd = Math.max(0, this.placeCd - dt);
    this.swing = Math.max(0, this.swing - dt * 4.2);

    this.player.lookDir(this.look);
    this.player.eyePos(this.eye);
    this.hit = this.world.raycast(this.eye.x, this.eye.y, this.eye.z, this.look.x, this.look.y, this.look.z, 6.5);

    if (this.hit) {
      this.outline.position.set(this.hit.x + 0.5, this.hit.y + 0.5, this.hit.z + 0.5);
      this.outline.visible = true;
    } else {
      this.outline.visible = false;
    }

    if ((this.mouseLeft || this.touchBreak) && this.hit && this.breakCd <= 0) {
      this.breakBlock(this.hit);
      this.breakCd = 0.16;
      this.swing = 1;
    }
    if ((this.mouseRight || this.placeOnceFlag) && this.hit && this.placeCd <= 0) {
      this.placeBlock(this.hit);
      this.placeCd = 0.18;
      this.swing = 1;
    }
    this.placeOnceFlag = false;

    this.syncChunks();
    this.world.flushDirty();
    this.updateParticles(dt);
    this.clouds.position.x = ((this.time * 1.6) % 80) - 40;
    this.updateSky();
  }

  private breakBlock(hit: Hit) {
    if (hit.id === Block.BEDROCK) return;
    this.spawnDebris(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, hit.id as BlockId);
    this.world.setBlock(hit.x, hit.y, hit.z, Block.AIR);
    blip(140, 0.06, "square");
  }

  private placeBlock(hit: Hit) {
    const id = this.selected();
    if (!id || !BLOCKS[id]?.placeable) return;
    const x = hit.x + hit.nx;
    const y = hit.y + hit.ny;
    const z = hit.z + hit.nz;
    if (y < 0 || y >= 72) return;
    if (this.world.getBlock(x, y, z) !== Block.AIR && !isWater(this.world.getBlock(x, y, z))) return;
    if (this.player.overlapsBlock(x, y, z)) return;
    this.world.setBlock(x, y, z, id);
    blip(280, 0.05, "square");
  }

  private spawnDebris(x: number, y: number, z: number, id: BlockId) {
    const def = BLOCKS[id];
    const color = new THREE.Color(def.color.top);
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
      const mat = this.partMat.clone();
      mat.color = color;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      this.particles.push({
        pos: new THREE.Vector3(x, y, z),
        vel: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4),
        life: 0.55 + Math.random() * 0.25,
        max: 0.8,
        mesh,
      });
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= 18 * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.x += dt * 6;
      p.mesh.rotation.y += dt * 8;
      const s = Math.max(0, p.life / p.max);
      p.mesh.scale.setScalar(s);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  private updateSky() {
    const cycle = 240;
    const t = ((this.time % cycle) + cycle) % cycle;
    const ang = (t / cycle) * Math.PI * 2 - Math.PI / 2;
    const sx = Math.cos(ang);
    const sy = Math.sin(ang);
    this.sun.position.set(sx * 120, sy * 120, 40);
    this.moon.position.set(-sx * 120, -sy * 120, -40);
    this.sunMesh.position.copy(this.player.pos).add(this.sun.position.clone().setLength(140));
    this.moonMesh.position.copy(this.player.pos).add(this.moon.position.clone().setLength(140));

    const day = Math.max(0, Math.min(1, sy * 1.15 + 0.15));
    const dusk = Math.max(0, 1 - Math.abs(sy) * 2.2);
    const dayCol = new THREE.Color(0x78c0ff);
    const duskCol = new THREE.Color(0xff7a3a);
    const nightCol = new THREE.Color(0x06081a);
    const sky = nightCol.clone().lerp(dayCol, day).lerp(duskCol, dusk * (1 - day) * 0.85);
    this.scene.background = sky;
    this.fog.color.copy(sky);
    this.sun.intensity = 0.15 + day * 1.05;
    this.moon.intensity = (1 - day) * 0.28;
    this.hemi.intensity = 0.18 + day * 0.45;
    this.hemi.color.set(day > 0.3 ? 0x9ec9ff : 0x334466);
  }

  private render() {
    this.camera.position.set(this.player.pos.x, this.player.pos.y + 1.62, this.player.pos.z);
    this.camera.rotation.y = this.player.yaw;
    this.camera.rotation.x = this.player.pitch;

    const moving = this.player.vel.lengthSq() > 0.4 && this.player.onGround && !this.player.flying;
    if (moving) this.bob += 0.22;
    const bobY = moving ? Math.sin(this.bob) * 0.035 : 0;
    const bobX = moving ? Math.cos(this.bob * 0.5) * 0.012 : 0;
    this.camera.position.y += bobY;
    this.camera.position.x += bobX;

    const sw = Math.sin(this.swing * Math.PI);
    this.hand.rotation.x = sw * 0.85;
    this.hand.rotation.z = sw * -0.35;
    this.hand.position.set(0.42 + sw * -0.08, -0.38 - sw * 0.12, -0.62 - sw * 0.08);

    this.renderer.render(this.scene, this.camera);
  }

  private updateHandUVs() {
    const id = this.selected();
    const def = BLOCKS[id];
    if (!def) return;
    const geo = this.handMesh.geometry as THREE.BoxGeometry;
    applyBoxUVs(geo, def.textures.side, def.textures.top, def.textures.bottom);
  }

  private emitHud() {
    this.cb.onHud({
      x: this.player.pos.x,
      y: this.player.pos.y,
      z: this.player.pos.z,
      fps: this.fps,
      flying: this.player.flying,
      inWater: this.player.inWater,
      target: this.hit ? BLOCKS[this.hit.id]?.name ?? null : null,
      slot: this.slot,
      hotbar: [...this.hotbar],
      selected: this.selected(),
      paused: this.paused,
      locked: this.touchMode ? this.running && !this.paused : document.pointerLockElement === this.canvas,
      dayFactor: Math.max(0, Math.min(1, Math.sin((((this.time % 240) + 240) % 240) / 240 * Math.PI * 2 - Math.PI / 2) * 1.15 + 0.15)),
      seed: this.seed,
    });
  }

  private syncChunks() {
    const pcx = worldToChunk(this.player.pos.x);
    const pcz = worldToChunk(this.player.pos.z);
    if (pcx !== this.lastCx || pcz !== this.lastCz) {
      this.lastCx = pcx;
      this.lastCz = pcz;
      const r = RENDER_CHUNKS;
      const needed = new Set<string>();
      for (let cz = pcz - r; cz <= pcz + r; cz++) {
        for (let cx = pcx - r; cx <= pcx + r; cx++) {
          const k = chunkKey(cx, cz);
          needed.add(k);
          if (!this.world.getChunk(cx, cz) && !this.queued.has(k)) {
            this.chunkQueue.push([cx, cz]);
            this.queued.add(k);
          }
        }
      }
      for (const [k, chunk] of [...this.world.chunks]) {
        if (!needed.has(k)) this.world.unload(chunk.cx, chunk.cz);
      }
    }

    if (this.chunkQueue.length === 0) return;
    const next = this.chunkQueue.shift();
    if (!next) return;
    const [cx, cz] = next;
    this.queued.delete(chunkKey(cx, cz));
    if (Math.max(Math.abs(cx - this.lastCx), Math.abs(cz - this.lastCz)) > this.radius) return;
    if (this.world.getChunk(cx, cz)) return;
    this.world.generateChunk(cx, cz);
    this.world.decorateChunk(cx, cz);
  }

  private makeClouds() {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
    });
    const rng = (n: number) => {
      const x = Math.sin(n * 127.1 + this.seed) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < 18; i++) {
      const cloud = new THREE.Group();
      const bits = 4 + ((rng(i + 3) * 5) | 0);
      for (let b = 0; b < bits; b++) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(6 + rng(i * 9 + b) * 8, 2, 5 + rng(i * 5 + b) * 7), mat);
        mesh.position.set((rng(i + b * 2) - 0.5) * 14, rng(i + b) * 1.5, (rng(i + b * 3) - 0.5) * 10);
        cloud.add(mesh);
      }
      cloud.position.set((rng(i) - 0.5) * 160, 62 + rng(i + 1) * 8, (rng(i + 2) - 0.5) * 160);
      g.add(cloud);
    }
    return g;
  }

  getWaterOverlayNeeded() {
    return this.player.inWater;
  }
}

function isWater(id: number) {
  return id === Block.WATER;
}

function tileUV(slot: number) {
  const cols = 8;
  const rows = 4;
  const col = slot % cols;
  const row = Math.floor(slot / cols);
  const pad = 0.002;
  return {
    u0: col / cols + pad,
    u1: (col + 1) / cols - pad,
    v0: 1 - (row + 1) / rows + pad,
    v1: 1 - row / rows - pad,
  };
}

function applyBoxUVs(geo: THREE.BoxGeometry, side: number, top: number, bottom: number) {
  const uv = geo.attributes.uv;
  const faces = [side, side, top, bottom, side, side];
  for (let f = 0; f < 6; f++) {
    const t = tileUV(faces[f]);
    const coords = [t.u0, t.v1, t.u1, t.v1, t.u0, t.v0, t.u1, t.v0];
    uv.setXY(f * 4 + 0, coords[0], coords[1]);
    uv.setXY(f * 4 + 1, coords[2], coords[3]);
    uv.setXY(f * 4 + 2, coords[4], coords[5]);
    uv.setXY(f * 4 + 3, coords[6], coords[7]);
  }
  uv.needsUpdate = true;
}

let audioCtx: AudioContext | null = null;
function blip(freq: number, dur: number, type: OscillatorType) {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume().catch(() => {});
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = 0.035;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.stop(audioCtx.currentTime + dur);
  } catch {
    /* ignore */
  }
}

export { PLACEABLE };

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
