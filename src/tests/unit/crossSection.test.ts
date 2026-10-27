import { describe, expect, it } from 'vitest';
import { SOLIDS } from '../../geometry/solids';
import {
  computeCrossSection,
  describeCrossSection,
  normalizePlane,
} from '../../geometry/crossSection';
import type { Vec3 } from '../../geometry/types';

const cube = SOLIDS.find((solid) => solid.id === 'cube')!;
const pyramid = SOLIDS.find((solid) => solid.id === 'square-pyramid')!;

function section(normal: Vec3, offset: number) {
  const result = computeCrossSection(cube, { normal, offset });
  if (!result) throw new Error('expected a cross-section');
  return result;
}

describe('cross-section geometry', () => {
  it('cuts a square parallel to a face', () => {
    const result = section({ x: 0, y: 1, z: 0 }, 0);
    expect(result.sides).toBe(4);
    expect(result.shapeNameKo).toBe('정사각형');
    expect(result.area).toBeCloseTo(1, 9);
    expect(result.perimeter).toBeCloseTo(4, 9);
  });

  it('cuts a rectangle through four edges', () => {
    const result = section({ x: 1, y: 1, z: 0 }, 0);
    expect(result.sides).toBe(4);
    expect(result.shapeNameKo).toBe('직사각형');
    expect(result.area).toBeCloseTo(Math.SQRT2, 9);
  });

  it('cuts an equilateral triangle through three adjacent vertices', () => {
    const result = section({ x: 1, y: 1, z: 1 }, 0.5);
    expect(result.sides).toBe(3);
    expect(result.shapeNameKo).toBe('정삼각형');
    expect(result.area).toBeCloseTo(Math.sqrt(3) / 2, 9);
  });

  it('cuts a regular hexagon through six edges', () => {
    const result = section({ x: 1, y: 1, z: 1 }, 0);
    expect(result.sides).toBe(6);
    expect(result.shapeNameKo).toBe('정육각형');
    expect(result.area).toBeCloseTo((3 * Math.sqrt(3)) / 4, 9);
  });

  it('cuts a pentagon through one vertex and opposite edges', () => {
    const result = section({ x: 1, y: 1, z: 2 }, -0.6);
    expect(result.sides).toBe(5);
    expect(result.shapeNameKo).toBe('오각형');
  });

  it('returns null when the plane misses the solid', () => {
    expect(computeCrossSection(cube, { normal: { x: 0, y: 1, z: 0 }, offset: 3 })).toBeNull();
  });

  it('returns null when the plane only touches one vertex', () => {
    expect(
      computeCrossSection(cube, { normal: { x: 1, y: 1, z: 1 }, offset: 1.5000001 }),
    ).toBeNull();
  });

  it('cuts the pyramid into a square when horizontal', () => {
    const result = computeCrossSection(pyramid, { normal: { x: 0, y: 1, z: 0 }, offset: 0 });
    expect(result).not.toBeNull();
    expect(result!.sides).toBe(4);
    expect(result!.area).toBeCloseTo(1, 9);
  });

  it('normalizes plane normals and offsets together', () => {
    const plane = normalizePlane({ normal: { x: 0, y: 2, z: 0 }, offset: 2 });
    expect(plane.normal.y).toBeCloseTo(1, 9);
    expect(plane.offset).toBeCloseTo(1, 9);
  });

  it('describes the section in Korean', () => {
    expect(describeCrossSection(section({ x: 0, y: 1, z: 0 }, 0))).toContain('정사각형');
    expect(describeCrossSection(null)).toContain('단면이 없어요');
  });
});
