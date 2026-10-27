import { describe, expect, it } from 'vitest';
import { SOLIDS } from '../../geometry/solids';
import type { SolidDefinition } from '../../geometry/types';
import { faceNormalsPointOutward } from './helpers';
import {
  edgeCount,
  eulerCharacteristic,
  faceCount,
  measureSolid,
  vertexCount,
} from '../../geometry/measure';

const SQRT5 = Math.sqrt(5);

function solid(id: string): SolidDefinition {
  const found = SOLIDS.find((item) => item.id === id);
  if (!found) throw new Error(`missing solid ${id}`);
  return found;
}

describe('solid definitions', () => {
  it.each([
    ['cube', 8, 6, 12],
    ['prism', 8, 6, 12],
    ['triangular-prism', 6, 5, 9],
    ['square-pyramid', 5, 5, 8],
    ['tetrahedron', 4, 4, 6],
  ])('%s has the expected vertex, face, and edge counts', (id, vertices, faces, edges) => {
    const item = solid(id);
    expect(vertexCount(item)).toBe(vertices);
    expect(faceCount(item)).toBe(faces);
    expect(edgeCount(item)).toBe(edges);
    expect(eulerCharacteristic(item)).toBe(2);
  });

  it('has five solids', () => {
    expect(SOLIDS).toHaveLength(5);
  });

  it.each(SOLIDS.map((item) => [item.id, item] as const))('%s faces point outward', (_, item) => {
    expect(faceNormalsPointOutward(item)).toBe(true);
  });
});

describe('measurements', () => {
  it('matches known cube values', () => {
    const values = measureSolid(solid('cube'));
    expect(values.surfaceArea).toBeCloseTo(6, 9);
    expect(values.volume).toBeCloseTo(1, 9);
  });

  it('matches known rectangular prism values', () => {
    const values = measureSolid(solid('prism'));
    expect(values.surfaceArea).toBeCloseTo(22, 9);
    expect(values.volume).toBeCloseTo(6, 9);
  });

  it('matches known triangular prism values', () => {
    const values = measureSolid(solid('triangular-prism'));
    expect(values.surfaceArea).toBeCloseTo(8 + 4 * SQRT5, 9);
    expect(values.volume).toBeCloseTo(4, 9);
  });

  it('matches known square pyramid values', () => {
    const values = measureSolid(solid('square-pyramid'));
    expect(values.surfaceArea).toBeCloseTo(4 + 4 * SQRT5, 9);
    expect(values.volume).toBeCloseTo(8 / 3, 9);
  });

  it('matches known regular tetrahedron values', () => {
    const values = measureSolid(solid('tetrahedron'));
    expect(values.surfaceArea).toBeCloseTo(4 * Math.sqrt(3), 9);
    expect(values.volume).toBeCloseTo((2 * Math.sqrt(2)) / 3, 9);
  });

  it('keeps the authored display measures in sync with the computed values', () => {
    for (const item of SOLIDS) {
      const computed = measureSolid(item);
      expect(computed.surfaceArea).toBeCloseTo(item.measures.surfaceArea, 6);
      expect(computed.volume).toBeCloseTo(item.measures.volume, 6);
    }
  });
});
