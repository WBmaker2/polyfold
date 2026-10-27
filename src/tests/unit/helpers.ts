import type { SolidDefinition } from '../../geometry/types';
import { faceCentroid, faceNormal } from '../../geometry/polyhedron';
import { solidCentroid } from '../../geometry/polyhedron';
import { dot3, sub3 } from '../../geometry/vec';

export function faceNormalsPointOutward(solid: SolidDefinition): boolean {
  const center = solidCentroid(solid);
  return solid.faces.every((face) => {
    const normal = faceNormal(solid, face);
    const outward = sub3(faceCentroid(solid, face), center);
    return dot3(normal, outward) > 0;
  });
}
