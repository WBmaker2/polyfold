import type { Quat, Transform, Vec2, Vec3 } from './types';

export const EPS = 1e-9;
export const TOL = 1e-6;

export function v2(x = 0, y = 0): Vec2 {
  return { x, y };
}

export function v3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function add3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale3(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function mul3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x * b.x, y: a.y * b.y, z: a.z * b.z };
}

export function dot3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function length3(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}

export function distance3(a: Vec3, b: Vec3): number {
  return length3(sub3(a, b));
}

export function normalize3(a: Vec3): Vec3 {
  const len = length3(a);
  if (len < EPS) return { x: 0, y: 0, z: 0 };
  return scale3(a, 1 / len);
}

export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function nearlyEqual(a: number, b: number, tolerance = TOL): boolean {
  return Math.abs(a - b) <= tolerance;
}

export function nearlyEqual3(a: Vec3, b: Vec3, tolerance = TOL): boolean {
  return distance3(a, b) <= tolerance;
}

export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export function sub2(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function add2(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function scale2(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}

export function dot2(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function cross2(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

export function distance2(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function polygonArea2D(points: Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function polygonPerimeter2D(points: Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    sum += distance2(points[i]!, points[(i + 1) % points.length]!);
  }
  return sum;
}

export function polygonCentroid2D(points: Vec2[]): Vec2 {
  if (points.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

export function bounds2D(points: Vec2[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const n = normalize3(axis);
  const half = angle / 2;
  const s = Math.sin(half);
  return { x: n.x * s, y: n.y * s, z: n.z * s, w: Math.cos(half) };
}

export function quatMultiply(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

export function quatRotateVec3(q: Quat, p: Vec3): Vec3 {
  const qv: Vec3 = { x: q.x, y: q.y, z: q.z };
  const t = scale3(cross3(qv, p), 2);
  return add3(add3(p, scale3(t, q.w)), cross3(qv, t));
}

export function identityTransform(): Transform {
  return { q: { x: 0, y: 0, z: 0, w: 1 }, t: { x: 0, y: 0, z: 0 } };
}

export function rotationAboutLine(point: Vec3, axis: Vec3, angle: number): Transform {
  const q = quatFromAxisAngle(axis, angle);
  const rotatedPoint = quatRotateVec3(q, point);
  return { q, t: sub3(point, rotatedPoint) };
}

export function composeTransforms(a: Transform, b: Transform): Transform {
  const q = quatMultiply(a.q, b.q);
  const rotatedT = quatRotateVec3(a.q, b.t);
  return { q, t: add3(rotatedT, a.t) };
}

export function applyTransform(tr: Transform, p: Vec3): Vec3 {
  return add3(quatRotateVec3(tr.q, p), tr.t);
}

export function quatConjugate(q: Quat): Quat {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

export function inverseTransform(tr: Transform): Transform {
  const q = quatConjugate(tr.q);
  return { q, t: scale3(quatRotateVec3(q, tr.t), -1) };
}

export function signedAngleAroundAxis(from: Vec3, to: Vec3, axis: Vec3): number {
  const a = normalize3(from);
  const b = normalize3(to);
  const x = dot3(a, b);
  const y = dot3(normalize3(axis), cross3(a, b));
  return Math.atan2(y, x);
}

export function uniqueSorted(values: number[], tolerance = TOL): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const value of sorted) {
    if (out.length === 0 || Math.abs(value - out[out.length - 1]!) > tolerance) {
      out.push(value);
    }
  }
  return out;
}

export function dedupePoints2D(points: Vec2[], tolerance = TOL): Vec2[] {
  const out: Vec2[] = [];
  for (const point of points) {
    if (!out.some((existing) => distance2(existing, point) <= tolerance)) {
      out.push(point);
    }
  }
  return out;
}

export function dedupePoints3D(points: Vec3[], tolerance = TOL): Vec3[] {
  const out: Vec3[] = [];
  for (const point of points) {
    if (!out.some((existing) => distance3(existing, point) <= tolerance)) {
      out.push(point);
    }
  }
  return out;
}

export function formatNumber(value: number, digits = 2): string {
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits);
}
