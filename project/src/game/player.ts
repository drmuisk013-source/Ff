import * as THREE from "three";
import { CHUNK_H, isLiquid, isSolid } from "./constants";
import type { World } from "./world";

const WIDTH = 0.6;
const HEIGHT = 1.8;
const EYE = 1.62;
const HALF = WIDTH / 2;

export class Player {
  pos = new THREE.Vector3(0, 40, 0);
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = false;
  flying = false;
  sneaking = false;
  sprinting = false;
  inWater = false;
  sensitivity = 0.0022;
  /** Step up 1-block ledges automatically (mobile). */
  autoJump = false;

  applyMouse(dx: number, dy: number) {
    this.yaw -= dx * this.sensitivity;
    this.pitch -= dy * this.sensitivity;
    const lim = Math.PI / 2 - 0.04;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  lookDir(out: THREE.Vector3) {
    out.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    return out;
  }

  eyePos(out: THREE.Vector3) {
    return out.set(this.pos.x, this.pos.y + EYE, this.pos.z);
  }

  update(
    dt: number,
    world: World,
    input: { f: number; s: number; jump: boolean; sneak: boolean; sprint: boolean; flyUp: boolean },
  ) {
    this.sneaking = input.sneak && !this.flying;
    this.sprinting = input.sprint && !this.sneaking && input.f > 0;

    const feet = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.3), Math.floor(this.pos.z));
    const head = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 1.4), Math.floor(this.pos.z));
    this.inWater = isLiquid(feet) || isLiquid(head);

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const wish = new THREE.Vector3();
    wish.addScaledVector(forward, input.f);
    wish.addScaledVector(right, input.s);
    if (wish.lengthSq() > 0) wish.normalize();

    if (this.flying) {
      const speed = this.sprinting ? 18 : 11;
      this.vel.x = wish.x * speed;
      this.vel.z = wish.z * speed;
      this.vel.y = (Number(input.flyUp) - Number(input.sneak)) * speed;
    } else if (this.inWater) {
      this.vel.x += wish.x * 18 * dt;
      this.vel.z += wish.z * 18 * dt;
      this.vel.x *= Math.pow(0.12, dt);
      this.vel.z *= Math.pow(0.12, dt);
      this.vel.y += (input.jump ? 8 : -4) * dt;
      this.vel.y *= Math.pow(0.3, dt);
      const horiz = Math.hypot(this.vel.x, this.vel.z);
      if (horiz > 4.2) {
        this.vel.x = (this.vel.x / horiz) * 4.2;
        this.vel.z = (this.vel.z / horiz) * 4.2;
      }
    } else {
      const speed = this.sneaking ? 2.4 : this.sprinting ? 6.4 : 4.4;
      const accel = this.onGround ? 55 : 12;
      this.vel.x += wish.x * accel * dt;
      this.vel.z += wish.z * accel * dt;
      const damp = this.onGround ? Math.pow(0.0008, dt) : Math.pow(0.18, dt);
      this.vel.x *= damp;
      this.vel.z *= damp;
      const horiz = Math.hypot(this.vel.x, this.vel.z);
      if (horiz > speed) {
        this.vel.x = (this.vel.x / horiz) * speed;
        this.vel.z = (this.vel.z / horiz) * speed;
      }
      this.vel.y -= 28 * dt;
      if (this.vel.y < -48) this.vel.y = -48;
      if (this.onGround && input.jump) this.vel.y = 8.6;

      // Mobile auto-jump: hop up single-block steps while walking (not while sneaking).
      if (
        this.autoJump &&
        this.onGround &&
        !input.jump &&
        !input.sneak &&
        (input.f !== 0 || input.s !== 0) &&
        wish.lengthSq() > 0
      ) {
        const ax = Math.floor(this.pos.x + wish.x * 0.85);
        const az = Math.floor(this.pos.z + wish.z * 0.85);
        const fy = Math.floor(this.pos.y + 0.05);
        if (
          isSolid(world.getBlock(ax, fy, az)) &&
          !isSolid(world.getBlock(ax, fy + 1, az)) &&
          !isSolid(world.getBlock(ax, fy + 2, az))
        ) {
          this.vel.y = 7.4;
        }
      }
    }

    this.moveAxis(world, this.vel.x * dt, 0, 0);
    this.moveAxis(world, 0, this.vel.y * dt, 0);
    this.moveAxis(world, 0, 0, this.vel.z * dt);

    if (this.pos.y < -20) {
      this.pos.y = world.surfaceY(this.pos.x, this.pos.z) + 4;
      this.vel.set(0, 0, 0);
    }
    if (this.pos.y > CHUNK_H + 40) {
      this.pos.y = CHUNK_H + 40;
      this.vel.y = 0;
    }
  }

  private moveAxis(world: World, dx: number, dy: number, dz: number) {
    this.pos.x += dx;
    this.pos.y += dy;
    this.pos.z += dz;

    const minX = this.pos.x - HALF;
    const maxX = this.pos.x + HALF;
    const minY = this.pos.y;
    const maxY = this.pos.y + HEIGHT;
    const minZ = this.pos.z - HALF;
    const maxZ = this.pos.z + HALF;

    const x0 = Math.floor(minX);
    const x1 = Math.floor(maxX);
    const y0 = Math.floor(minY);
    const y1 = Math.floor(maxY);
    const z0 = Math.floor(minZ);
    const z1 = Math.floor(maxZ);

    let grounded = false;

    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (!isSolid(world.getBlock(x, y, z))) continue;
          const bx0 = x;
          const bx1 = x + 1;
          const by0 = y;
          const by1 = y + 1;
          const bz0 = z;
          const bz1 = z + 1;
          if (maxX <= bx0 || minX >= bx1 || maxY <= by0 || minY >= by1 || maxZ <= bz0 || minZ >= bz1) {
            continue;
          }
          if (dx > 0) {
            this.pos.x = bx0 - HALF - 0.0001;
            this.vel.x = 0;
          } else if (dx < 0) {
            this.pos.x = bx1 + HALF + 0.0001;
            this.vel.x = 0;
          } else if (dz > 0) {
            this.pos.z = bz0 - HALF - 0.0001;
            this.vel.z = 0;
          } else if (dz < 0) {
            this.pos.z = bz1 + HALF + 0.0001;
            this.vel.z = 0;
          } else if (dy > 0) {
            this.pos.y = by0 - HEIGHT - 0.0001;
            this.vel.y = 0;
          } else if (dy < 0) {
            this.pos.y = by1 + 0.0001;
            this.vel.y = 0;
            grounded = true;
          }
        }
      }
    }
    if (dy !== 0) this.onGround = grounded;
  }

  overlapsBlock(x: number, y: number, z: number): boolean {
    const minX = this.pos.x - HALF;
    const maxX = this.pos.x + HALF;
    const minY = this.pos.y;
    const maxY = this.pos.y + HEIGHT;
    const minZ = this.pos.z - HALF;
    const maxZ = this.pos.z + HALF;
    return !(maxX <= x || minX >= x + 1 || maxY <= y || minY >= y + 1 || maxZ <= z || minZ >= z + 1);
  }
}
