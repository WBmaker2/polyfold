import { faceVertices, polygonArea3D } from './polyhedron';
import type {
  CrossSection,
  PlaneBasis,
  PlaneDefinition,
  SolidDefinition,
  Vec2,
  Vec3,
} from './types';
import {
  EPS,
  add3,
  cross3,
  dedupePoints3D,
  distance2,
  distance3,
  dot3,
  formatNumber,
  normalize3,
  polygonPerimeter2D,
  scale3,
  sub3,
  v2,
  v3,
} from './vec';

const SHAPE_NAMES: Record<number, string> = {
  3: '삼각형',
  4: '사각형',
  5: '오각형',
  6: '육각형',
  7: '칠각형',
  8: '팔각형',
  9: '구각형',
  10: '십각형',
};

export function normalizePlane(plane: PlaneDefinition): PlaneDefinition {
  const length = Math.hypot(plane.normal.x, plane.normal.y, plane.normal.z);
  if (length < EPS) return { normal: v3(0, 1, 0), offset: plane.offset };
  return {
    normal: scale3(plane.normal, 1 / length),
    offset: plane.offset / length,
  };
}

export function planeDistance(plane: PlaneDefinition, point: Vec3): number {
  return dot3(plane.normal, point) - plane.offset;
}

export function planeBasis(normal: Vec3): PlaneBasis {
  const n = normalize3(normal);
  const helper = Math.abs(n.x) < 0.85 ? v3(1, 0, 0) : v3(0, 1, 0);
  const u = normalize3(cross3(n, helper));
  const v = normalize3(cross3(n, u));
  return { u, v };
}

function sectionPoints(solid: SolidDefinition, plane: PlaneDefinition): Vec3[] {
  const points: Vec3[] = [];
  for (const face of solid.faces) {
    const vertices = faceVertices(solid, face);
    const distances = vertices.map((point) => planeDistance(plane, point));
    for (let i = 0; i < vertices.length; i += 1) {
      const next = (i + 1) % vertices.length;
      const a = vertices[i]!;
      const b = vertices[next]!;
      const da = distances[i]!;
      const db = distances[next]!;
      if (Math.abs(da) <= 1e-9) points.push(a);
      if ((da < -1e-9 && db > 1e-9) || (da > 1e-9 && db < -1e-9)) {
        const t = da / (da - db);
        points.push(add3(a, scale3(sub3(b, a), t)));
      }
    }
  }
  return dedupePoints3D(points, 1e-7);
}

function sortAroundCenter(points2D: { x: number; y: number }[]): { x: number; y: number }[] {
  const center = points2D.reduce(
    (acc, point) => ({
      x: acc.x + point.x / points2D.length,
      y: acc.y + point.y / points2D.length,
    }),
    { x: 0, y: 0 },
  );
  return [...points2D].sort(
    (a, b) =>
      Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x),
  );
}

function almostEqual(a: number, b: number, tolerance = 1e-6): boolean {
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
}

function shapeName(points2D: Vec2[], sides: number): string {
  if (sides === 3) {
    const a = distance2(points2D[0]!, points2D[1]!);
    const b = distance2(points2D[1]!, points2D[2]!);
    const c = distance2(points2D[2]!, points2D[0]!);
    if (almostEqual(a, b) && almostEqual(b, c)) return '정삼각형';
    if (almostEqual(a, b) || almostEqual(b, c) || almostEqual(a, c)) return '이등변삼각형';
    return '삼각형';
  }
  if (sides === 4) {
    const sidesLength = [0, 1, 2, 3].map((index) =>
      distance2(points2D[index]!, points2D[(index + 1) % 4]!),
    );
    const diagonals = [
      distance2(points2D[0]!, points2D[2]!),
      distance2(points2D[1]!, points2D[3]!),
    ];
    const allSidesEqual = sidesLength.every((value) => almostEqual(value, sidesLength[0]!));
    const rightDiagonal = almostEqual(diagonals[0]!, diagonals[1]!);
    if (allSidesEqual && rightDiagonal) return '정사각형';
    if (rightDiagonal) return '직사각형';
    return '사각형';
  }
  if (sides === 6) {
    const sidesLength = [0, 1, 2, 3, 4, 5].map((index) =>
      distance2(points2D[index]!, points2D[(index + 1) % 6]!),
    );
    if (sidesLength.every((value) => almostEqual(value, sidesLength[0]!))) return '정육각형';
  }
  return SHAPE_NAMES[sides] ?? `${sides}각형`;
}

function samePoint(a: Vec3, b: Vec3, tolerance: number): boolean {
  return distance3(a, b) <= tolerance;
}

export function computeCrossSection(
  solid: SolidDefinition,
  inputPlane: PlaneDefinition,
): CrossSection | null {
  const plane = normalizePlane(inputPlane);
  let points = sectionPoints(solid, plane);
  points = points.filter(
    (point, index) => points.findIndex((other) => samePoint(other, point, 1e-6)) === index,
  );
  if (points.length < 3) return null;

  const basis = planeBasis(plane.normal);
  const origin = scale3(plane.normal, plane.offset);
  const projected = points.map((point) => {
    const relative = sub3(point, origin);
    return v2(dot3(relative, basis.u), dot3(relative, basis.v));
  });
  const ordered2D = sortAroundCenter(projected);
  if (polygonArea3D(points) === 0) return null;

  const seen = new Set<string>();
  const ordered3D: Vec3[] = [];
  for (const point2D of ordered2D) {
    const index = projected.findIndex((candidate) => distance2(candidate, point2D) < 1e-9);
    const key = index.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered3D.push(points[index]!);
  }

  const signedArea =
    ordered2D.reduce(
      (sum, point, index) =>
        sum +
        point.x * ordered2D[(index + 1) % ordered2D.length]!.y -
        ordered2D[(index + 1) % ordered2D.length]!.x * point.y,
      0,
    ) / 2;
  if (signedArea < 0) {
    ordered2D.reverse();
    ordered3D.reverse();
  }

  const sides = ordered2D.length;
  const area = Math.abs(
    ordered2D.reduce(
      (sum, point, index) =>
        sum +
        point.x * ordered2D[(index + 1) % ordered2D.length]!.y -
        ordered2D[(index + 1) % ordered2D.length]!.x * point.y,
      0,
    ) / 2,
  );
  if (area < 1e-9) return null;

  return {
    points3D: ordered3D,
    points2D: ordered2D,
    normal: plane.normal,
    offset: plane.offset,
    basis,
    sides,
    shapeNameKo: shapeName(ordered2D, sides),
    area,
    perimeter: polygonPerimeter2D(ordered2D),
  };
}

export function describeCrossSection(section: CrossSection | null): string {
  if (!section) return '단면이 없어요. 자르는 면이 입체를 지나지 않아요.';
  return `${section.shapeNameKo}, 둘레 ${formatNumber(section.perimeter)}, 넓이 ${formatNumber(section.area)}`;
}
