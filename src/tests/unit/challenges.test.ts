import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../../data/challenges';
import { computeCrossSection } from '../../geometry/crossSection';
import { measureSolid } from '../../geometry/measure';
import { getSolid } from '../../geometry/solids';
import { formatNumber } from '../../geometry/vec';

describe('challenge content', () => {
  it('has eight challenges across the four challenge types', () => {
    expect(CHALLENGES).toHaveLength(8);
    const types = new Set(CHALLENGES.map((challenge) => challenge.type));
    expect(types).toEqual(new Set(['valid-net', 'identify-solid', 'cross-section', 'measure']));
    for (const type of types) {
      expect(CHALLENGES.filter((challenge) => challenge.type === type)).toHaveLength(2);
    }
  });

  it('gives every challenge a valid answer and a Korean explanation', () => {
    for (const challenge of CHALLENGES) {
      expect(challenge.options, challenge.id).toContain(challenge.answer);
      expect(challenge.explanationKo.length, challenge.id).toBeGreaterThan(10);
      expect(challenge.promptKo.length, challenge.id).toBeGreaterThan(5);
      expect([1, 2, 3]).toContain(challenge.difficulty);
    }
  });

  it('points every net challenge at a real net of its solid', () => {
    for (const challenge of CHALLENGES) {
      if (!challenge.netId) continue;
      const solid = getSolid(challenge.solidId);
      const layout = solid.netLayouts.find((item) => item.id === challenge.netId);
      expect(layout, challenge.id).toBeDefined();
    }
  });

  it('matches cross-section answers to the geometry', () => {
    for (const challenge of CHALLENGES) {
      if (challenge.type !== 'cross-section' || !challenge.section) continue;
      const solid = getSolid(challenge.solidId);
      const result = computeCrossSection(solid, {
        normal: challenge.section.normal,
        offset: challenge.section.offset,
      });
      expect(result, challenge.id).not.toBeNull();
      expect(result!.shapeNameKo, challenge.id).toBe(challenge.answer);
      expect(challenge.options, challenge.id).toContain(result!.shapeNameKo);
    }
  });

  it('matches measurement answers to the solid measures', () => {
    const measures = measureSolid(getSolid('cube'));
    expect(CHALLENGES.find((challenge) => challenge.id === 'cube-measure-area')?.answer).toBe(
      formatNumber(measures.surfaceArea),
    );
    const pyramid = measureSolid(getSolid('square-pyramid'));
    expect(CHALLENGES.find((challenge) => challenge.id === 'pyramid-measure-volume')?.answer).toBe(
      formatNumber(pyramid.volume),
    );
  });
});
