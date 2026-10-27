import type { Face, SolidDefinition, Vec2, Vec3 } from './types';
import {
  add3,
  cross3,
  dot3,
  length3,
  normalize3,
  polygonArea2D,
  scale3,
  sub3,
  TOL,
  v3,
} from './vec';

export function faceVertices(solid: SolidDefinition, face: Face): Vec3[] {
  return face.vertexIndices.map((index) => solid.vertices[index]!);
}

export function faceNormal(solid: SolidDefinition, face: Face): Vec3 {
  const points = faceVertices(solid, face);
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]!;
    const next = points[(i + 1) % points.length]!;
    nx += (current.y - next.y) * (current.z + next.z);
    ny += (current.z - next.z) * (current.x + next.x);
    nz += (current.x - next.x) * (current.y + next.y);
  }
  return normalize3(v3(nx, ny, nz));
}

export function facePolygonNormal(points: Vec3[]): Vec3 {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]!;
    const next = points[(i + 1) % points.length]!;
    nx += (current.y - next.y) * (current.z + next.z);
    ny += (current.z - next.z) * (current.x + next.x);
    nz += (current.x - next.x) * (current.y + next.y);
  }
  return normalize3(v3(nx, ny, nz));
}

export function faceArea(solid: SolidDefinition, face: Face): number {
  return polygonArea3D(faceVertices(solid, face));
}

export function polygonArea3D(points: Vec3[]): number {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    x += a.y * b.z - a.z * b.y;
    y += a.z * b.x - a.x * b.z;
    z += a.x * b.y - a.y * b.x;
  }
  return Math.hypot(x, y, z) / 2;
}

export function faceCentroid(solid: SolidDefinition, face: Face): Vec3 {
  const points = faceVertices(solid, face);
  let total = v3();
  for (const point of points) total = add3(total, point);
  return scale3(total, 1 / points.length);
}

export function solidEdges(solid: SolidDefinition): [number, number][] {
  const edges = new Map<string, [number, number]>();
  for (const face of solid.faces) {
    const indices = face.vertexIndices;
    for (let i = 0; i < indices.length; i += 1) {
      const a = indices[i]!;
      const b = indices[(i + 1) % indices.length]!;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (!edges.has(key)) edges.set(key, [a, b]);
    }
  }
  return [...edges.values()];
}

export function findSharedEdge(a: Face, b: Face): [number, number] | null {
  const shared = a.vertexIndices.filter((index) => b.vertexIndices.includes(index));
  if (shared.length !== 2) return null;
  const orderA = a.vertexIndices;
  const first = orderA.indexOf(shared[0]!);
  const second = orderA.indexOf(shared[1]!);
  const count = orderA.length;
  const adjacent = (first + 1) % count === second || (second + 1) % count === first;
  if (!adjacent) return null;
  return [shared[0]!, shared[1]!];
}

export interface FaceAdjacency {
  edge: [number, number];
  faceA: string;
  faceB: string;
}

export function faceAdjacency(solid: SolidDefinition): FaceAdjacency[] {
  const edgeMap = new Map<string, { faceId: string; edge: [number, number] }[]>();
  for (const face of solid.faces) {
    const indices = face.vertexIndices;
    for (let i = 0; i < indices.length; i += 1) {
      const a = indices[i]!;
      const b = indices[(i + 1) % indices.length]!;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const list = edgeMap.get(key) ?? [];
      list.push({ faceId: face.id, edge: [a, b] });
      edgeMap.set(key, list);
    }
  }
  const result: FaceAdjacency[] = [];
  for (const list of edgeMap.values()) {
    if (list.length === 2) {
      result.push({
        edge: list[0]!.edge,
        faceA: list[0]!.faceId,
        faceB: list[1]!.faceId,
      });
    }
  }
  return result;
}

export function solidCentroid(solid: SolidDefinition): Vec3 {
  let total = v3();
  for (const vertex of solid.vertices) total = add3(total, vertex);
  return scale3(total, 1 / solid.vertices.length);
}

export function solidBoundingRadius(solid: SolidDefinition, center = v3()): number {
  let radius = 0;
  for (const vertex of solid.vertices) {
    radius = Math.max(radius, length3(sub3(vertex, center)));
  }
  return radius;
}

export function solidBounds(solid: SolidDefinition): {
  min: Vec3;
  max: Vec3;
} {
  const min = v3(Infinity, Infinity, Infinity);
  const max = v3(-Infinity, -Infinity, -Infinity);
  for (const vertex of solid.vertices) {
    min.x = Math.min(min.x, vertex.x);
    min.y = Math.min(min.y, vertex.y);
    min.z = Math.min(min.z, vertex.z);
    max.x = Math.max(max.x, vertex.x);
    max.y = Math.max(max.y, vertex.y);
    max.z = Math.max(max.z, vertex.z);
  }
  return { min, max };
}

export function projectRange(solid: SolidDefinition, normal: Vec3): [number, number] {
  const n = normalize3(normal);
  let min = Infinity;
  let max = -Infinity;
  for (const vertex of solid.vertices) {
    const value = dot3(n, vertex);
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return [min, max];
}

export function triangulateFace(solid: SolidDefinition, face: Face): Vec3[][] {
  const points = faceVertices(solid, face);
  const triangles: Vec3[][] = [];
  for (let i = 1; i < points.length - 1; i += 1) {
    triangles.push([points[0]!, points[i]!, points[i + 1]!]);
  }
  return triangles;
}

export function pointOnSegment2D(point: Vec2, a: Vec2, b: Vec2, tolerance = TOL): boolean {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const ap = { x: point.x - a.x, y: point.y - a.y };
  const cross = ab.x * ap.y - ab.y * ap.x;
  if (Math.abs(cross) > tolerance * Math.max(1, Math.hypot(ab.x, ab.y))) return false;
  const dot = ap.x * ab.x + ap.y * ab.y;
  const lengthSq = ab.x * ab.x + ab.y * ab.y;
  return dot >= -tolerance && dot <= lengthSq + tolerance;
}

function clipPolygonByHalfPlane(
  subject: Vec2[],
  clipA: Vec2,
  clipB: Vec2,
  tolerance = 1e-9,
): Vec2[] {
  if (subject.length === 0) return [];
  const output: Vec2[] = [];
  const edge = { x: clipB.x - clipA.x, y: clipB.y - clipA.y };
  const inside = (p: Vec2) => edge.x * (p.y - clipA.y) - edge.y * (p.x - clipA.x) >= -tolerance;
  for (let i = 0; i < subject.length; i += 1) {
    const current = subject[i]!;
    const next = subject[(i + 1) % subject.length]!;
    const currentInside = inside(current);
    const nextInside = inside(next);
    if (currentInside) output.push(current);
    if (currentInside !== nextInside) {
      const dx = next.x - current.x;
      const dy = next.y - current.y;
      const denominator = edge.x * dy - edge.y * dx;
      if (Math.abs(denominator) > 1e-12) {
        const t = (edge.x * (clipA.y - current.y) - edge.y * (clipA.x - current.x)) / denominator;
        output.push({ x: current.x + dx * t, y: current.y + dy * t });
      }
    }
  }
  return output;
}

export function convexPolygonIntersectionArea(a: Vec2[], b: Vec2[]): number {
  if (a.length < 3 || b.length < 3) return 0;
  let result = a;
  for (let i = 0; i < b.length; i += 1) {
    const clipA = b[i]!;
    const clipB = b[(i + 1) % b.length]!;
    result = clipPolygonByHalfPlane(result, clipA, clipB);
    if (result.length < 3) return 0;
  }
  return Math.abs(polygonArea2D(result));
}

export function polygonsOverlap(a: Vec2[], b: Vec2[], tolerance = 1e-7): boolean {
  const area = convexPolygonIntersectionArea(a, b);
  if (area <= tolerance) return false;
  const minArea = Math.min(Math.abs(polygonArea2D(a)), Math.abs(polygonArea2D(b)));
  return area > Math.max(tolerance, minArea * 1e-6);
}

export function polygonContainsPoint(points: Vec2[], point: Vec2, tolerance = 1e-9): boolean {
  let positive = false;
  let negative = false;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (cross > tolerance) positive = true;
    if (cross < -tolerance) negative = true;
  }
  return !(positive && negative);
}

export function segmentLength3(a: Vec3, b: Vec3): number {
  return length3(sub3(a, b));
}

export function triangleNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  return normalize3(cross3(sub3(b, a), sub3(c, a)));
}
