import { describe, expect, it } from 'vitest';
import { SOLIDS } from '../../geometry/solids';
import { invalidNets, netById, validNets, validateNet } from '../../geometry/nets';

const cube = SOLIDS.find((solid) => solid.id === 'cube')!;

describe('net generation and validation', () => {
  it('finds all 11 cube nets', () => {
    expect(validNets(cube)).toHaveLength(11);
  });

  it('offers at least five invalid cube nets', () => {
    expect(invalidNets(cube).length).toBeGreaterThanOrEqual(5);
  });

  it('provides at least three nets for every solid', () => {
    for (const solid of SOLIDS) {
      expect(solid.netLayouts.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('labels every valid layout as valid', () => {
    for (const solid of SOLIDS) {
      for (const layout of validNets(solid)) {
        expect(validateNet(solid, layout).valid, `${solid.id}/${layout.id}`).toBe(true);
      }
    }
  });

  it('rejects every authored invalid layout', () => {
    for (const solid of SOLIDS) {
      for (const layout of invalidNets(solid)) {
        const result = validateNet(solid, layout);
        expect(result.valid, `${solid.id}/${layout.id}`).toBe(false);
        expect(result.reason).not.toBe('none');
        expect(result.messageKo.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps invalid nets out of the valid list', () => {
    for (const solid of SOLIDS) {
      for (const layout of validNets(solid)) {
        expect(layout.valid).toBe(true);
        expect(layout.invalidReason).toBeUndefined();
      }
      for (const layout of invalidNets(solid)) {
        expect(layout.valid).toBe(false);
        expect(layout.invalidReason).toBeDefined();
      }
    }
  });

  it('finds a net by id and falls back to the first layout', () => {
    const first = cube.netLayouts[0]!;
    expect(netById(cube, first.id).id).toBe(first.id);
    expect(netById(cube, 'missing').id).toBe(first.id);
  });

  it('covers several distinct invalid reasons', () => {
    const reasons = new Set(invalidNets(cube).map((layout) => layout.invalidReason));
    expect(reasons.has('missing-face')).toBe(true);
    expect(reasons.has('duplicate-face')).toBe(true);
    expect(reasons.has('area-mismatch')).toBe(true);
    expect(reasons.size).toBeGreaterThanOrEqual(4);
  });
});
