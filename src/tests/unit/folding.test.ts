import { describe, expect, it } from 'vitest';
import { SOLIDS, faceById } from '../../geometry/solids';
import {
  buildFoldRig,
  faceMatchesSolid,
  foldTransforms,
  foldedNetFace,
} from '../../geometry/folding';
import { faceArea, faceNormal, faceVertices } from '../../geometry/polyhedron';
import { validNets } from '../../geometry/nets';
import { applyTransform, dot3, sub3 } from '../../geometry/vec';
import type { NetLayout, SolidDefinition } from '../../geometry/types';

function flatArea(layout: NetLayout, faceId: string): number {
  const face = layout.faces.find((item) => item.faceId === faceId)!;
  let sum = 0;
  for (let i = 0; i < face.polygon.length; i += 1) {
    const a = face.polygon[i]!;
    const b = face.polygon[(i + 1) % face.polygon.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function checkAllNets(solid: SolidDefinition): void {
  for (const layout of validNets(solid)) {
    const rig = buildFoldRig(solid, layout);
    expect(rig.order.length, `${solid.id}/${layout.id} order`).toBe(solid.faces.length);

    const flat = foldTransforms(rig, 0);
    const folded = foldTransforms(rig, 1);
    const rootFace = faceById(solid, rig.rootId)!;
    const rootNormal = faceNormal(solid, rootFace);
    const rootPoint = faceVertices(solid, rootFace)[0]!;

    for (const face of solid.faces) {
      const flatPoints = foldedNetFace(rig, layout, face.id, 0, flat);
      for (const point of flatPoints) {
        expect(
          Math.abs(dot3(sub3(point, rootPoint), rootNormal)),
          `${solid.id}/${layout.id}/${face.id} flat plane`,
        ).toBeLessThan(1e-6);
      }
      expect(flatArea(layout, face.id), `${solid.id}/${layout.id}/${face.id} area`).toBeCloseTo(
        faceArea(solid, face),
        9,
      );

      const foldedPoints = foldedNetFace(rig, layout, face.id, 1, folded);
      expect(
        faceMatchesSolid(solid, face, foldedPoints, 1e-6),
        `${solid.id}/${layout.id}/${face.id} should match the solid at t=1`,
      ).toBe(true);

      const transformedNormal = (() => {
        const q = folded.get(face.id)!;
        const origin = applyTransform(q, { x: 0, y: 0, z: 0 });
        const normalPoint = applyTransform(q, { x: 0, y: 0, z: 1 });
        return sub3(normalPoint, origin);
      })();
      const solidNormal = faceNormal(solid, face);
      const agreement = Math.abs(dot3(transformedNormal, solidNormal));
      expect(agreement, `${solid.id}/${layout.id}/${face.id} normal`).toBeCloseTo(1, 6);
    }
  }
}

describe('folding rig', () => {
  it('folds every valid net of every solid onto the solid at t=1', () => {
    for (const solid of SOLIDS) checkAllNets(solid);
  });

  it('is flat at t=0 and folded at t=1', () => {
    const cube = SOLIDS.find((solid) => solid.id === 'cube')!;
    const layout = validNets(cube)[0]!;
    const rig = buildFoldRig(cube, layout);
    expect(rig.rootId).toBe(layout.faces.find((face) => !face.hinge)?.faceId);
    const transforms = foldTransforms(rig, 0.5);
    expect(transforms.size).toBe(cube.faces.length);
  });
});
