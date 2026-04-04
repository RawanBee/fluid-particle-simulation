const DEFAULT_PARAMS = {
  particleCount: 650,
  radius: 8.4,
  gravity: 1000,
  interactionRadius: 18,
  restDensity: 7.6,
  pressureStiffness: 0.19,
  nearPressureStiffness: 0.036,
  viscosity: 0.02,
  bounce: 0.088,
  mouseForce: 9500,
  velocityDamping: 0.059,
  vorticityConfinement: 90,
  fillFraction: 0.5,
  solverIterations: 3,
};

export class ParticleSim {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.params = { ...DEFAULT_PARAMS };
    this.particles = [];
    this.pointer = { x: 0, y: 0, active: false };
    this.rotationX = -0.52;
    this.rotationY = 0.52;
    this.rotationZ = 0;
    this.targetRotationX = this.rotationX;
    this.targetRotationY = this.rotationY;
    this.targetRotationZ = this.rotationZ;
    this.rotVelX = 0;
    this.rotVelY = 0;
    this.rotVelZ = 0;
    this.isDraggingCube = false;
    this.lastDragX = 0;
    this.lastDragY = 0;
    this.container = this.buildContainer(width, height);
    this.targetCx = this.container.cx;
    this.targetCy = this.container.cy;
    this.targetHalfSize = this.container.halfSize;
    this.velCx = 0;
    this.velCy = 0;
    this.velSize = 0;
    this.prevVelCx = 0;
    this.prevVelCy = 0;
    this.prevRotVelX = 0;
    this.prevRotVelY = 0;
    this.prevRotVelZ = 0;
    this.inertia = {
      localAx: 0,
      localAy: 0,
      localAz: 0,
      omegaX: 0,
      omegaY: 0,
      omegaZ: 0,
    };
    this.defaultCx = this.container.cx;
    this.defaultCy = this.container.cy;
    this.defaultHalfSize = this.container.halfSize;
    this.defaultRotationX = this.rotationX;
    this.defaultRotationY = this.rotationY;
    this.defaultRotationZ = this.rotationZ;
    this.idleTime = 0;
    this.handPoseActive = false;
    this.reset(this.params.particleCount);
  }

  buildContainer(width, height) {
    const size = Math.min(width, height) * 0.34;
    return {
      cx: width * 0.57,
      cy: height * 0.62,
      halfSize: size * 0.5,
      cameraDepth: Math.max(width, height) * 1.35,
    };
  }

  resize(width, height) {
    const oldHalf = this.container.halfSize;
    const previous = this.container;
    this.width = width;
    this.height = height;
    this.container = this.buildContainer(width, height);
    this.defaultCx = this.container.cx;
    this.defaultCy = this.container.cy;
    this.defaultHalfSize = this.container.halfSize;
    const scale = this.container.halfSize / Math.max(1, oldHalf);
    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i];
      p.x *= scale;
      p.y *= scale;
      p.z *= scale;
      p.px *= scale;
      p.py *= scale;
      p.pz *= scale;
    }
    if (!this.handPoseActive) {
      this.targetCx = this.container.cx;
      this.targetCy = this.container.cy;
      this.targetHalfSize = this.container.halfSize;
    } else {
      this.targetCx += this.container.cx - previous.cx;
      this.targetCy += this.container.cy - previous.cy;
    }
  }

  rotatePoint3D(x, y, z) {
    const cz = Math.cos(this.rotationZ);
    const sz = Math.sin(this.rotationZ);
    const cx = Math.cos(this.rotationX);
    const sx = Math.sin(this.rotationX);
    const cy = Math.cos(this.rotationY);
    const sy = Math.sin(this.rotationY);
    const zx = x * cz - y * sz;
    const zy = x * sz + y * cz;
    const zz = z;
    const rx = zx;
    const ry = zy * cx - zz * sx;
    const rz = zy * sx + zz * cx;
    return { x: rx * cy + rz * sy, y: ry, z: -rx * sy + rz * cy };
  }

  inverseRotatePoint3D(x, y, z) {
    const cy = Math.cos(this.rotationY);
    const sy = Math.sin(this.rotationY);
    const cx = Math.cos(this.rotationX);
    const sx = Math.sin(this.rotationX);
    const cz = Math.cos(this.rotationZ);
    const sz = Math.sin(this.rotationZ);
    const yx = x * cy - z * sy;
    const yy = y;
    const yz = x * sy + z * cy;
    const xx = yx;
    const xy = yy * cx + yz * sx;
    const xz = -yy * sx + yz * cx;
    return { x: xx * cz + xy * sz, y: -xx * sz + xy * cz, z: xz };
  }

  projectPoint3D(x, y, z) {
    const p = this.rotatePoint3D(x, y, z);
    const perspective = this.container.cameraDepth / (this.container.cameraDepth - p.z);
    return { x: this.container.cx + p.x * perspective, y: this.container.cy + p.y * perspective, z: p.z, perspective };
  }

  getGravityLocal() {
    return this.inverseRotatePoint3D(0, this.params.gravity, 0);
  }

  getFluidHalfExtent() {
    return this.container.halfSize - this.params.radius * 1.05;
  }

  getFluidSlabBounds() {
    const hLim = this.getFluidHalfExtent();
    const g = this.getGravityLocal();
    const ax = Math.abs(g.x) >= Math.abs(g.y) && Math.abs(g.x) >= Math.abs(g.z)
      ? 0
      : Math.abs(g.y) >= Math.abs(g.z)
        ? 1
        : 2;
    const ga = ax === 0 ? g.x : ax === 1 ? g.y : g.z;
    const gl = Math.hypot(g.x, g.y, g.z);
    const towardMax = gl < 1e-9 ? true : ga >= 0;
    const fill = Math.min(1, Math.max(0.06, this.params.fillFraction ?? 0.5));
    let lo;
    let hi;
    if (towardMax) {
      lo = hLim * (1 - 2 * fill);
      hi = hLim;
    } else {
      lo = -hLim;
      hi = hLim * (2 * fill - 1);
    }
    return { hLim, ax, lo, hi };
  }

  setPointer(x, y, active) {
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.active = active;
  }

  setParam(key, value) {
    this.params[key] = value;
  }

  applyHandPose(centerX, centerY, rotX, rotY, rotZ, scale) {
    this.handPoseActive = true;
    this.targetCx = centerX;
    this.targetCy = centerY;
    this.targetRotationX = rotX;
    this.targetRotationY = rotY;
    this.targetRotationZ = rotZ;
    this.targetHalfSize = this.defaultHalfSize * scale;
  }

  relaxHandPose(dt, withFloat = false) {
    this.handPoseActive = false;
    this.idleTime += dt;
    const floatX = withFloat ? Math.sin(this.idleTime * 0.8) * this.defaultHalfSize * 0.06 : 0;
    const floatY = withFloat ? Math.cos(this.idleTime * 0.95) * this.defaultHalfSize * 0.04 : 0;
    const floatR = withFloat ? Math.sin(this.idleTime * 0.6) * 0.09 : 0;
    this.targetCx = this.defaultCx + floatX;
    this.targetCy = this.defaultCy + floatY;
    this.targetRotationX = this.defaultRotationX + floatR * 0.4;
    this.targetRotationY = this.defaultRotationY - floatR * 0.8;
    this.targetRotationZ = this.defaultRotationZ + floatR * 0.25;
    this.targetHalfSize = this.defaultHalfSize;
  }

  startCubeDrag(x, y) {
    this.isDraggingCube = true;
    this.lastDragX = x;
    this.lastDragY = y;
  }

  dragCube(x, y, mode = "rotate") {
    if (!this.isDraggingCube) {
      return;
    }
    const dx = x - this.lastDragX;
    const dy = y - this.lastDragY;
    this.lastDragX = x;
    this.lastDragY = y;

    if (mode === "pan") {
      this.targetCx += dx;
      this.targetCy += dy;
      this.targetCx = Math.max(this.width * 0.12, Math.min(this.width * 0.88, this.targetCx));
      this.targetCy = Math.max(this.height * 0.1, Math.min(this.height * 0.9, this.targetCy));
      return;
    }

    if (mode === "depth") {
      this.targetRotationZ += dx * 0.0065;
      this.targetHalfSize += -dy * 0.28;
      this.targetHalfSize = Math.max(this.defaultHalfSize * 0.72, Math.min(this.defaultHalfSize * 1.38, this.targetHalfSize));
      this.targetRotationZ = Math.max(-1.2, Math.min(1.2, this.targetRotationZ));
      return;
    }

    this.targetRotationY += dx * 0.007;
    this.targetRotationX += dy * 0.007;
    this.targetRotationZ += dx * 0.0018;
    this.targetRotationX = Math.max(-1.15, Math.min(1.15, this.targetRotationX));
    this.targetRotationY = Math.max(-1.45, Math.min(1.45, this.targetRotationY));
    this.targetRotationZ = Math.max(-1.2, Math.min(1.2, this.targetRotationZ));
  }

  endCubeDrag() {
    this.isDraggingCube = false;
  }

  adjustCubeScale(delta) {
    this.targetHalfSize += delta;
    this.targetHalfSize = Math.max(this.defaultHalfSize * 0.72, Math.min(this.defaultHalfSize * 1.38, this.targetHalfSize));
  }

  containsPointInContainer(screenX, screenY) {
    const h = this.container.halfSize;
    const corners = [
      this.projectPoint3D(-h, -h, h),
      this.projectPoint3D(h, -h, h),
      this.projectPoint3D(h, h, h),
      this.projectPoint3D(-h, h, h),
      this.projectPoint3D(-h, -h, -h),
      this.projectPoint3D(h, -h, -h),
      this.projectPoint3D(h, h, -h),
      this.projectPoint3D(-h, h, -h),
    ];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < corners.length; i += 1) {
      minX = Math.min(minX, corners[i].x);
      maxX = Math.max(maxX, corners[i].x);
      minY = Math.min(minY, corners[i].y);
      maxY = Math.max(maxY, corners[i].y);
    }
    return screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY;
  }

  integratePose(dt) {
    const spring = 170;
    const damping = 22;
    this.velCx += (this.targetCx - this.container.cx) * spring * dt;
    this.velCy += (this.targetCy - this.container.cy) * spring * dt;
    this.velSize += (this.targetHalfSize - this.container.halfSize) * spring * dt;
    this.rotVelX += (this.targetRotationX - this.rotationX) * spring * dt;
    this.rotVelY += (this.targetRotationY - this.rotationY) * spring * dt;
    this.rotVelZ += (this.targetRotationZ - this.rotationZ) * spring * dt;
    this.velCx *= Math.exp(-damping * dt);
    this.velCy *= Math.exp(-damping * dt);
    this.velSize *= Math.exp(-damping * dt);
    this.rotVelX *= Math.exp(-damping * dt);
    this.rotVelY *= Math.exp(-damping * dt);
    this.rotVelZ *= Math.exp(-damping * dt);
    this.container.cx += this.velCx * dt;
    this.container.cy += this.velCy * dt;
    this.container.halfSize += this.velSize * dt;
    this.rotationX += this.rotVelX * dt;
    this.rotationY += this.rotVelY * dt;
    this.rotationZ += this.rotVelZ * dt;
    this.rotationX = Math.max(-1.2, Math.min(1.2, this.rotationX));
    this.rotationY = Math.max(-1.45, Math.min(1.45, this.rotationY));
    this.rotationZ = Math.max(-1.2, Math.min(1.2, this.rotationZ));
    this.container.halfSize = Math.max(this.defaultHalfSize * 0.74, Math.min(this.defaultHalfSize * 1.34, this.container.halfSize));

    const invDt = 1 / Math.max(1e-5, dt);
    const axScreen = (this.velCx - this.prevVelCx) * invDt;
    const ayScreen = (this.velCy - this.prevVelCy) * invDt;
    const localA = this.inverseRotatePoint3D(axScreen, ayScreen, 0);
    this.inertia.localAx = localA.x;
    this.inertia.localAy = localA.y;
    this.inertia.localAz = localA.z;
    this.inertia.omegaX = this.rotVelX;
    this.inertia.omegaY = this.rotVelY;
    this.inertia.omegaZ = this.rotVelZ;

    this.prevVelCx = this.velCx;
    this.prevVelCy = this.velCy;
    this.prevRotVelX = this.rotVelX;
    this.prevRotVelY = this.rotVelY;
    this.prevRotVelZ = this.rotVelZ;
  }

  clampToCube(p) {
    const limit = this.container.halfSize - this.params.radius;
    const restitution = this.params.bounce;
    const tangentKeep = 0.91 + 0.09 * restitution;
    if (p.x < -limit) {
      p.x = -limit;
      if (p.vx < 0) {
        p.vx = -p.vx * restitution;
        p.vy *= tangentKeep;
        p.vz *= tangentKeep;
      }
    } else if (p.x > limit) {
      p.x = limit;
      if (p.vx > 0) {
        p.vx = -p.vx * restitution;
        p.vy *= tangentKeep;
        p.vz *= tangentKeep;
      }
    }
    if (p.y < -limit) {
      p.y = -limit;
      if (p.vy < 0) {
        p.vy = -p.vy * restitution;
        p.vx *= tangentKeep;
        p.vz *= tangentKeep;
      }
    } else if (p.y > limit) {
      p.y = limit;
      if (p.vy > 0) {
        p.vy = -p.vy * restitution;
        p.vx *= tangentKeep;
        p.vz *= tangentKeep;
      }
    }
    if (p.z < -limit) {
      p.z = -limit;
      if (p.vz < 0) {
        p.vz = -p.vz * restitution;
        p.vx *= tangentKeep;
        p.vy *= tangentKeep;
      }
    } else if (p.z > limit) {
      p.z = limit;
      if (p.vz > 0) {
        p.vz = -p.vz * restitution;
        p.vx *= tangentKeep;
        p.vy *= tangentKeep;
      }
    }
  }

  reset(count = this.params.particleCount) {
    this.particles = [];
    const { hLim, ax, lo, hi } = this.getFluidSlabBounds();
    for (let i = 0; i < count; i += 1) {
      let x;
      let y;
      let z;
      if (ax === 0) {
        x = lo + Math.random() * (hi - lo);
        y = (Math.random() * 2 - 1) * hLim;
        z = (Math.random() * 2 - 1) * hLim;
      } else if (ax === 1) {
        x = (Math.random() * 2 - 1) * hLim;
        y = lo + Math.random() * (hi - lo);
        z = (Math.random() * 2 - 1) * hLim;
      } else {
        x = (Math.random() * 2 - 1) * hLim;
        y = (Math.random() * 2 - 1) * hLim;
        z = lo + Math.random() * (hi - lo);
      }
      x += (Math.random() - 0.5) * 0.35;
      y += (Math.random() - 0.5) * 0.35;
      z += (Math.random() - 0.5) * 0.35;
      x = Math.max(-hLim, Math.min(hLim, x));
      y = Math.max(-hLim, Math.min(hLim, y));
      z = Math.max(-hLim, Math.min(hLim, z));
      if (ax === 0) {
        x = Math.max(lo, Math.min(hi, x));
      } else if (ax === 1) {
        y = Math.max(lo, Math.min(hi, y));
      } else {
        z = Math.max(lo, Math.min(hi, z));
      }
      this.particles.push({
        x,
        y,
        z,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        vz: (Math.random() - 0.5) * 5,
        px: x,
        py: y,
        pz: z,
        density: 0,
        nearDensity: 0,
        pressure: 0,
        nearPressure: 0,
      });
    }
  }

  hashKey(ix, iy, iz) {
    return `${ix}|${iy}|${iz}`;
  }

  buildSpatialHash(cellSize) {
    const hash = new Map();
    const inv = 1 / cellSize;
    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i];
      const ix = Math.floor(p.px * inv);
      const iy = Math.floor(p.py * inv);
      const iz = Math.floor(p.pz * inv);
      const key = this.hashKey(ix, iy, iz);
      if (!hash.has(key)) {
        hash.set(key, []);
      }
      hash.get(key).push(i);
    }
    return hash;
  }

  forEachNeighborPair(hash, cellSize, callback) {
    const inv = 1 / cellSize;
    const offsets = [-1, 0, 1];
    for (let i = 0; i < this.particles.length; i += 1) {
      const a = this.particles[i];
      const ix = Math.floor(a.px * inv);
      const iy = Math.floor(a.py * inv);
      const iz = Math.floor(a.pz * inv);
      for (let ox = 0; ox < offsets.length; ox += 1) {
        for (let oy = 0; oy < offsets.length; oy += 1) {
          for (let oz = 0; oz < offsets.length; oz += 1) {
            const key = this.hashKey(ix + offsets[ox], iy + offsets[oy], iz + offsets[oz]);
            const cell = hash.get(key);
            if (!cell) {
              continue;
            }
            for (let k = 0; k < cell.length; k += 1) {
              const j = cell[k];
              if (j <= i) {
                continue;
              }
              callback(i, j);
            }
          }
        }
      }
    }
  }

  update(dt) {
    this.integratePose(dt);
    const {
      interactionRadius,
      restDensity,
      pressureStiffness,
      nearPressureStiffness,
      viscosity,
      mouseForce,
      velocityDamping,
      vorticityConfinement,
      solverIterations,
    } = this.params;
    const h = interactionRadius;
    const hSq = h * h;
    const g = this.getGravityLocal();
    const cohesionStrength = nearPressureStiffness;
    const solverIters = Math.max(1, Math.min(8, solverIterations ?? 3));
    const minSep = this.params.radius * 1.98;
    const coreRelax = 0.52;

    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i];
      p.vx += g.x * dt;
      p.vy += g.y * dt;
      p.vz += g.z * dt;

      const inertiaCoupling = 0.0018;
      p.vx -= this.inertia.localAx * dt * inertiaCoupling;
      p.vy -= this.inertia.localAy * dt * inertiaCoupling;
      p.vz -= this.inertia.localAz * dt * inertiaCoupling;

      const spinCoupling = 0.09;
      const sx = this.inertia.omegaY * p.z - this.inertia.omegaZ * p.y;
      const sy = this.inertia.omegaZ * p.x - this.inertia.omegaX * p.z;
      const sz = this.inertia.omegaX * p.y - this.inertia.omegaY * p.x;
      p.vx += sx * spinCoupling * dt;
      p.vy += sy * spinCoupling * dt;
      p.vz += sz * spinCoupling * dt;

      if (this.pointer.active) {
        const projected = this.projectPoint3D(p.x, p.y, p.z);
        const dxs = projected.x - this.pointer.x;
        const dys = projected.y - this.pointer.y;
        const screenSq = dxs * dxs + dys * dys;
        if (screenSq < 12000) {
          const pointer3D = this.inverseRotatePoint3D(dxs, dys, 0);
          const lenSq = pointer3D.x * pointer3D.x + pointer3D.y * pointer3D.y + pointer3D.z * pointer3D.z + 40;
          const invLen = 1 / Math.sqrt(lenSq);
          const impulse = (mouseForce * dt) / lenSq;
          p.vx += pointer3D.x * invLen * impulse;
          p.vy += pointer3D.y * invLen * impulse;
          p.vz += pointer3D.z * invLen * impulse;
        }
      }
      p.px = p.x + p.vx * dt;
      p.py = p.y + p.vy * dt;
      p.pz = p.z + p.vz * dt;
      p.density = 0;
      p.nearDensity = 0;
    }

    for (let iter = 0; iter < solverIters; iter += 1) {
      const hash = this.buildSpatialHash(h);

      for (let i = 0; i < this.particles.length; i += 1) {
        const p = this.particles[i];
        p.density = 0;
        p.nearDensity = 0;
      }

      this.forEachNeighborPair(hash, h, (i, j) => {
        const a = this.particles[i];
        const b = this.particles[j];
        const dx = b.px - a.px;
        const dy = b.py - a.py;
        const dz = b.pz - a.pz;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq > hSq || distSq < 1e-9) {
          return;
        }
        const dist = Math.sqrt(distSq);
        const q = 1 - dist / h;
        const q2 = q * q;
        const q3 = q2 * q;
        a.density += q2;
        b.density += q2;
        a.nearDensity += q3;
        b.nearDensity += q3;
      });

      for (let i = 0; i < this.particles.length; i += 1) {
        const p = this.particles[i];
        p.pressure = pressureStiffness * Math.max(0, p.density - restDensity);
        p.nearPressure = nearPressureStiffness * p.nearDensity;
      }

      this.forEachNeighborPair(hash, h, (i, j) => {
        const a = this.particles[i];
        const b = this.particles[j];
        const dx = b.px - a.px;
        const dy = b.py - a.py;
        const dz = b.pz - a.pz;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq > hSq || distSq < 1e-9) {
          return;
        }
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;
        const q = 1 - dist / h;
        const q2 = q * q;
        const pressureTerm = (a.pressure + b.pressure) * q + (a.nearPressure + b.nearPressure) * q2;
        const displace = pressureTerm * dt * dt * 0.5;
        const cohesion = cohesionStrength * q * (1 - q) * dt;
        a.px += nx * cohesion - nx * displace;
        a.py += ny * cohesion - ny * displace;
        a.pz += nz * cohesion - nz * displace;
        b.px -= nx * cohesion - nx * displace;
        b.py -= ny * cohesion - ny * displace;
        b.pz -= nz * cohesion - nz * displace;
        if (dist < minSep) {
          const overlap = (minSep - dist) * coreRelax;
          const half = overlap * 0.5;
          a.px -= nx * half;
          a.py -= ny * half;
          a.pz -= nz * half;
          b.px += nx * half;
          b.py += ny * half;
          b.pz += nz * half;
        }
      });
    }

    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i];
      p.vx = (p.px - p.x) / dt;
      p.vy = (p.py - p.y) / dt;
      p.vz = (p.pz - p.z) / dt;
      p.x = p.px;
      p.y = p.py;
      p.z = p.pz;
    }

    const hashVisc = this.buildSpatialHash(h);
    this.forEachNeighborPair(hashVisc, h, (i, j) => {
      const a = this.particles[i];
      const b = this.particles[j];
      const dx = b.px - a.px;
      const dy = b.py - a.py;
      const dz = b.pz - a.pz;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq > hSq || distSq < 1e-9) {
        return;
      }
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const ny = dy / dist;
      const nz = dz / dist;
      const q = 1 - dist / h;
      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const rvz = b.vz - a.vz;
      const rel = rvx * nx + rvy * ny + rvz * nz;
      const tx = rvx - rel * nx;
      const ty = rvy - rel * ny;
      const tz = rvz - rel * nz;
      const shearW = q * viscosity * 0.42;
      a.vx += tx * shearW;
      a.vy += ty * shearW;
      a.vz += tz * shearW;
      b.vx -= tx * shearW;
      b.vy -= ty * shearW;
      b.vz -= tz * shearW;
      if (rel < 0) {
        const bulkW = -rel * q * viscosity * 0.22;
        a.vx += nx * bulkW;
        a.vy += ny * bulkW;
        a.vz += nz * bulkW;
        b.vx -= nx * bulkW;
        b.vy -= ny * bulkW;
        b.vz -= nz * bulkW;
      }
    });

    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i];
      this.clampToCube(p);
      p.px = p.x;
      p.py = p.y;
      p.pz = p.z;
    }

    if (velocityDamping > 0) {
      const damp = Math.exp(-velocityDamping * dt);
      for (let i = 0; i < this.particles.length; i += 1) {
        const p = this.particles[i];
        p.vx *= damp;
        p.vy *= damp;
        p.vz *= damp;
      }
    }

    if (vorticityConfinement > 0) {
      const hashVort = this.buildSpatialHash(h);
      const vortScale = (vorticityConfinement / 90) * 32 * dt;
      this.forEachNeighborPair(hashVort, h, (i, j) => {
        const a = this.particles[i];
        const b = this.particles[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq > h * h || distSq < 1e-9) {
          return;
        }
        const dist = Math.sqrt(distSq);
        const q = 1 - dist / h;
        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const rvz = b.vz - a.vz;
        const crx = dy * rvz - dz * rvy;
        const cry = dz * rvx - dx * rvz;
        const crz = dx * rvy - dy * rvx;
        const len = Math.hypot(crx, cry, crz);
        if (len < 1e-7) {
          return;
        }
        const mag = vortScale * q * q;
        const sx = (crx / len) * mag;
        const sy = (cry / len) * mag;
        const sz = (crz / len) * mag;
        a.vx += sx;
        a.vy += sy;
        a.vz += sz;
        b.vx -= sx;
        b.vy -= sy;
        b.vz -= sz;
      });
    }
  }

  drawCube(ctx, mode = "all") {
    const h = this.container.halfSize;
    const points = [
      this.projectPoint3D(-h, -h, -h), this.projectPoint3D(h, -h, -h), this.projectPoint3D(h, h, -h), this.projectPoint3D(-h, h, -h),
      this.projectPoint3D(-h, -h, h), this.projectPoint3D(h, -h, h), this.projectPoint3D(h, h, h), this.projectPoint3D(-h, h, h),
    ];
    const faceDefs = [
      { indices: [0, 1, 2, 3], base: [88, 126, 206] },
      { indices: [4, 5, 6, 7], base: [132, 184, 255] },
      { indices: [0, 1, 5, 4], base: [90, 132, 212] },
      { indices: [1, 2, 6, 5], base: [80, 118, 196] },
      { indices: [2, 3, 7, 6], base: [96, 138, 220] },
      { indices: [3, 0, 4, 7], base: [78, 114, 191] },
    ];

    for (let i = 0; i < faceDefs.length; i += 1) {
      const f = faceDefs[i];
      const [a, b, c, d] = f.indices;
      f.depth = (points[a].z + points[b].z + points[c].z + points[d].z) * 0.25;
    }
    faceDefs.sort((a, b) => a.depth - b.depth);

    const minFaceDepth = faceDefs[0].depth;
    const maxFaceDepth = faceDefs[faceDefs.length - 1].depth;
    const faceDepthRange = Math.max(1e-5, maxFaceDepth - minFaceDepth);

    const drawPoly = (indices, fillStyle, strokeStyle) => {
      ctx.fillStyle = fillStyle;
      ctx.beginPath();
      ctx.moveTo(points[indices[0]].x, points[indices[0]].y);
      for (let i = 1; i < indices.length; i += 1) {
        ctx.lineTo(points[indices[i]].x, points[indices[i]].y);
      }
      ctx.closePath();
      ctx.fill();
      if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    };

    if (mode !== "edges") {
      for (let i = 0; i < faceDefs.length; i += 1) {
        const f = faceDefs[i];
        const depthNorm = (f.depth - minFaceDepth) / faceDepthRange;
        const alpha = 0.04 + depthNorm * 0.12;
        const [r, g, b] = f.base;
        drawPoly(
          f.indices,
          `rgba(${r}, ${g}, ${b}, ${alpha})`,
          `rgba(180, 222, 255, ${0.08 + depthNorm * 0.16})`,
        );
      }
    }

    const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

    let minEdgeDepth = Infinity;
    let maxEdgeDepth = -Infinity;
    const edgeDepths = [];
    for (let i = 0; i < edges.length; i += 1) {
      const [a, b] = edges[i];
      const depth = (points[a].z + points[b].z) * 0.5;
      edgeDepths.push(depth);
      minEdgeDepth = Math.min(minEdgeDepth, depth);
      maxEdgeDepth = Math.max(maxEdgeDepth, depth);
    }
    const edgeDepthRange = Math.max(1e-5, maxEdgeDepth - minEdgeDepth);

    if (mode !== "faces") {
      for (let i = 0; i < edges.length; i += 1) {
        const [a, b] = edges[i];
        const depthNorm = (edgeDepths[i] - minEdgeDepth) / edgeDepthRange;
        if (depthNorm < 0.08) {
          continue;
        }
        ctx.strokeStyle = `rgba(255, 242, 0, ${0.34 + depthNorm * 0.62})`;
        ctx.lineWidth = 2.1 + depthNorm * 2.4;
        ctx.beginPath();
        ctx.moveTo(points[a].x, points[a].y);
        ctx.lineTo(points[b].x, points[b].y);
        ctx.stroke();
      }
    }
  }

  drawOrbeez(ctx, x, y, r, speedNorm, depthNorm) {
    const frontBoost = 0.4 + depthNorm * 0.6;
    const glow = ctx.createRadialGradient(
      x - r * 0.18,
      y - r * 0.22,
      r * 0.08,
      x,
      y,
      r * 1.5,
    );
    glow.addColorStop(0, `rgba(255, 250, 220, ${0.22 + frontBoost * 0.1})`);
    glow.addColorStop(0.18, `rgba(255, 178, 92, ${0.34 + speedNorm * 0.12})`);
    glow.addColorStop(0.55, `rgba(255, 108, 34, ${0.24 + frontBoost * 0.16})`);
    glow.addColorStop(1, `rgba(120, 18, 0, ${0.08 + frontBoost * 0.1})`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  draw(ctx) {
    const { radius } = this.params;
    ctx.fillStyle = "rgba(5, 8, 14, 0.035)";
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawCube(ctx, "faces");
    const velProbe = 0.065;
    const projected = [];
    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i];
      const screen = this.projectPoint3D(p.x, p.y, p.z);
      const ahead = this.projectPoint3D(
        p.x + p.vx * velProbe,
        p.y + p.vy * velProbe,
        p.z + p.vz * velProbe,
      );
      const sdx = ahead.x - screen.x;
      const sdy = ahead.y - screen.y;
      const speed3 = Math.hypot(p.vx, p.vy, p.vz);
      projected.push({
        screen,
        speed: Math.min(1, speed3 / 350),
        angle: Math.atan2(sdy, sdx),
        speed3,
      });
    }
    projected.sort((a, b) => a.screen.z - b.screen.z);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < projected.length; i += 1) {
      const item = projected[i];
      const depthNorm = Math.max(0, Math.min(1, (item.screen.perspective - 0.75) / 0.65));
      const baseR = radius * (1.0 + item.screen.perspective * 0.28);
      const stretch = 1 + Math.min(item.speed3 / 230 * 0.9, 2.2);
      ctx.translate(item.screen.x, item.screen.y);
      ctx.rotate(item.angle);
      ctx.fillStyle = `rgba(255, 120, 40, ${0.028 + depthNorm * 0.05})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, baseR * stretch, baseR * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.restore();
    for (let i = 0; i < projected.length; i += 1) {
      const item = projected[i];
      const depthNorm = Math.max(0, Math.min(1, (item.screen.perspective - 0.75) / 0.65));
      const drawRadius = radius * (0.9 + item.screen.perspective * 0.24);
      this.drawOrbeez(ctx, item.screen.x, item.screen.y, drawRadius, item.speed, depthNorm);
    }
    this.drawCube(ctx, "edges");
  }
}
