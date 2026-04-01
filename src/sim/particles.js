const DEFAULT_PARAMS = {
  particleCount: 650,
  radius: 2.7,
  gravity: 1000,
  interactionRadius: 16,
  restDensity: 8.6,
  pressureStiffness: 0.24,
  nearPressureStiffness: 0.62,
  viscosity: 0.06,
  bounce: 0.97,
  mouseForce: 9000,
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
    const size = Math.min(width, height) * 0.52;
    return {
      cx: width * 0.57,
      cy: height * 0.62,
      halfSize: size * 0.5,
      cameraDepth: Math.max(width, height) * 0.85,
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
  }

  clampToCube(p) {
    const limit = this.container.halfSize - this.params.radius;
    const b = this.params.bounce;
    if (p.x < -limit) {
      p.x = -limit;
      p.vx = Math.abs(p.vx) * b;
    } else if (p.x > limit) {
      p.x = limit;
      p.vx = -Math.abs(p.vx) * b;
    }
    if (p.y < -limit) {
      p.y = -limit;
      p.vy = Math.abs(p.vy) * b;
    } else if (p.y > limit) {
      p.y = limit;
      p.vy = -Math.abs(p.vy) * b;
    }
    if (p.z < -limit) {
      p.z = -limit;
      p.vz = Math.abs(p.vz) * b;
    } else if (p.z > limit) {
      p.z = limit;
      p.vz = -Math.abs(p.vz) * b;
    }
  }

  reset(count = this.params.particleCount) {
    this.particles = [];
    const spacing = this.params.radius * 2.2;
    const side = Math.max(2, Math.floor((this.container.halfSize * 1.3) / spacing));
    const startX = -this.container.halfSize * 0.65;
    const startY = -this.container.halfSize * 0.75;
    const startZ = -this.container.halfSize * 0.56;
    for (let i = 0; i < count; i += 1) {
      const xIndex = i % side;
      const yIndex = Math.floor(i / side) % side;
      const zIndex = Math.floor(i / (side * side));
      const x = startX + xIndex * spacing + (Math.random() - 0.5) * 0.5;
      const y = startY + yIndex * spacing + (Math.random() - 0.5) * 0.5;
      const z = startZ + zIndex * spacing + (Math.random() - 0.5) * 0.5;
      this.particles.push({ x, y, z, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, vz: (Math.random() - 0.5) * 5, px: x, py: y, pz: z, density: 0, nearDensity: 0, pressure: 0, nearPressure: 0 });
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
    } = this.params;
    const h = interactionRadius;
    const hSq = h * h;
    const g = this.getGravityLocal();
    const cohesionStrength = 0.14;

    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i];
      p.vx += g.x * dt;
      p.vy += g.y * dt;
      p.vz += g.z * dt;
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

    const hash = this.buildSpatialHash(h);

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
      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const rvz = b.vz - a.vz;
      const rel = rvx * nx + rvy * ny + rvz * nz;
      if (rel > 0) {
        const viscImpulse = rel * q * viscosity * 0.5;
        a.vx += nx * viscImpulse;
        a.vy += ny * viscImpulse;
        a.vz += nz * viscImpulse;
        b.vx -= nx * viscImpulse;
        b.vy -= ny * viscImpulse;
        b.vz -= nz * viscImpulse;
      }
    });

    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i];
      p.vx = (p.px - p.x) / dt;
      p.vy = (p.py - p.y) / dt;
      p.vz = (p.pz - p.z) / dt;
      p.x = p.px;
      p.y = p.py;
      p.z = p.pz;
      this.clampToCube(p);
    }
  }

  drawCube(ctx) {
    const h = this.container.halfSize;
    const points = [
      this.projectPoint3D(-h, -h, -h), this.projectPoint3D(h, -h, -h), this.projectPoint3D(h, h, -h), this.projectPoint3D(-h, h, -h),
      this.projectPoint3D(-h, -h, h), this.projectPoint3D(h, -h, h), this.projectPoint3D(h, h, h), this.projectPoint3D(-h, h, h),
    ];
    const drawPoly = (indices, fillStyle) => {
      ctx.fillStyle = fillStyle;
      ctx.beginPath();
      ctx.moveTo(points[indices[0]].x, points[indices[0]].y);
      for (let i = 1; i < indices.length; i += 1) {
        ctx.lineTo(points[indices[i]].x, points[indices[i]].y);
      }
      ctx.closePath();
      ctx.fill();
    };
    drawPoly([0, 1, 2, 3], "rgba(85, 126, 213, 0.08)");
    drawPoly([4, 5, 6, 7], "rgba(136, 188, 255, 0.14)");
    drawPoly([0, 1, 5, 4], "rgba(88, 129, 210, 0.06)");
    drawPoly([1, 2, 6, 5], "rgba(80, 116, 197, 0.06)");
    drawPoly([2, 3, 7, 6], "rgba(94, 136, 220, 0.08)");
    drawPoly([3, 0, 4, 7], "rgba(76, 114, 191, 0.06)");
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    ctx.strokeStyle = "rgba(191, 226, 255, 0.74)";
    ctx.lineWidth = 1.1;
    for (let i = 0; i < edges.length; i += 1) {
      const [a, b] = edges[i];
      ctx.beginPath();
      ctx.moveTo(points[a].x, points[a].y);
      ctx.lineTo(points[b].x, points[b].y);
      ctx.stroke();
    }
  }

  drawOrbeez(ctx, x, y, r, speedNorm, depthNorm) {
    const frontBoost = 0.42 + depthNorm * 0.58;
    const glow = ctx.createRadialGradient(x - r * 0.36, y - r * 0.4, r * 0.16, x, y, r * 1.3);
    glow.addColorStop(0, `rgba(255, 255, 255, ${0.78 + frontBoost * 0.22})`);
    glow.addColorStop(0.2, `rgba(${118 + Math.floor(speedNorm * 24)}, ${210 + Math.floor(frontBoost * 28)}, 255, ${0.8 + frontBoost * 0.2})`);
    glow.addColorStop(0.8, `rgba(35, ${106 + Math.floor(frontBoost * 54)}, 224, ${0.5 + frontBoost * 0.4})`);
    glow.addColorStop(1, `rgba(9, 43, 118, ${0.28 + frontBoost * 0.35})`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.28 + frontBoost * 0.5})`;
    ctx.beginPath();
    ctx.arc(x - r * 0.34, y - r * 0.34, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  draw(ctx) {
    const { radius } = this.params;
    ctx.fillStyle = "rgba(5, 8, 14, 0.08)";
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawCube(ctx);
    const projected = [];
    for (let i = 0; i < this.particles.length; i += 1) {
      const p = this.particles[i];
      const screen = this.projectPoint3D(p.x, p.y, p.z);
      projected.push({ screen, speed: Math.min(1, Math.hypot(p.vx, p.vy, p.vz) / 350) });
    }
    projected.sort((a, b) => a.screen.z - b.screen.z);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < projected.length; i += 1) {
      const item = projected[i];
      const depthNorm = Math.max(0, Math.min(1, (item.screen.perspective - 0.75) / 0.65));
      const r = radius * (1.4 + item.screen.perspective * 0.35);
      ctx.fillStyle = `rgba(74, 154, 255, ${0.025 + depthNorm * 0.05})`;
      ctx.beginPath();
      ctx.arc(item.screen.x, item.screen.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    for (let i = 0; i < projected.length; i += 1) {
      const item = projected[i];
      const depthNorm = Math.max(0, Math.min(1, (item.screen.perspective - 0.75) / 0.65));
      const drawRadius = radius * (0.9 + item.screen.perspective * 0.24);
      this.drawOrbeez(ctx, item.screen.x, item.screen.y, drawRadius, item.speed, depthNorm);
    }
  }
}
