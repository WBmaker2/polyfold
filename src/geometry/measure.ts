import { faceArea, solidEdges, triangulateFace } from './polyhedron';
import type { SolidDefinition, Vec3 } from './types';
import { cross3, dot3, sub3 } from './vec';

export interface SolidMeasurements {
  surfaceArea: number;
  volume: number;
}

export function surfaceArea(solid: SolidDefinition): number {
  return solid.faces.reduce((total, face) => total + faceArea(solid, face), 0);
}

export function volume(solid: SolidDefinition): number {
  let total = 0;
  for (const face of solid.faces) {
    for (const triangle of triangulateFace(solid, face)) {
      const [a, b, c] = triangle as [Vec3, Vec3, Vec3];
      total += dot3(sub3(a, { x: 0, y: 0, z: 0 }), cross3(b, c)) / 6;
    }
  }
  return Math.abs(total);
}

export function measureSolid(solid: SolidDefinition): SolidMeasurements {
  return {
    surfaceArea: surfaceArea(solid),
    volume: volume(solid),
  };
}

export function vertexCount(solid: SolidDefinition): number {
  return solid.vertices.length;
}

export function faceCount(solid: SolidDefinition): number {
  return solid.faces.length;
}

export function edgeCount(solid: SolidDefinition): number {
  return solidEdges(solid).length;
}

export function eulerCharacteristic(solid: SolidDefinition): number {
  return vertexCount(solid) - edgeCount(solid) + faceCount(solid);
}
