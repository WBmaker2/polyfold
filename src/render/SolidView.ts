import * as THREE from 'three';
import type { NetLayout, SolidDefinition, Transform, Vec2 } from '../geometry/types';
import { transformNetPoint } from '../geometry/folding';
import { faceById } from '../geometry/solids';

interface FaceEntry {
  mesh: THREE.Mesh;
  line: THREE.LineLoop;
  material: THREE.MeshStandardMaterial;
  lineMaterial: THREE.LineBasicMaterial;
  polygon: Vec2[];
}

export class SolidView {
  readonly group = new THREE.Group();
  private entries = new Map<string, FaceEntry>();
  private solid: SolidDefinition | null = null;

  constructor() {
    this.group.name = 'solid';
  }

  setSolid(solid: SolidDefinition, layout: NetLayout): void {
    this.clear();
    this.solid = solid;
    for (const face of solid.faces) {
      const netFace = layout.faces.find((item) => item.faceId === face.id);
      const polygon = netFace?.polygon ?? [];
      if (polygon.length < 3) continue;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(polygon.length * 3);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const indices: number[] = [];
      for (let i = 1; i < polygon.length - 1; i += 1) indices.push(0, i, i + 1);
      geometry.setIndex(indices);
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(face.color),
        roughness: 0.72,
        metalness: 0.02,
        side: THREE.DoubleSide,
        flatShading: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.faceId = face.id;
      mesh.renderOrder = 1;
      mesh.frustumCulled = false;

      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(polygon.length * 3), 3),
      );
      const lineMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color('#143e3b'),
        transparent: true,
        opacity: 0.62,
      });
      const line = new THREE.LineLoop(lineGeometry, lineMaterial);
      line.renderOrder = 2;
      line.frustumCulled = false;

      this.group.add(mesh, line);
      this.entries.set(face.id, { mesh, line, material, lineMaterial, polygon });
    }
    this.update(undefined, null);
  }

  update(transforms?: Map<string, Transform>, selectedFaceId: string | null = null): void {
    for (const [faceId, entry] of this.entries) {
      const transform = transforms?.get(faceId);
      const positions = entry.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const linePositions = entry.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      entry.polygon.forEach((point, index) => {
        const world = transform
          ? transformNetPoint(transform, point)
          : { x: point.x, y: point.y, z: 0 };
        positions.setXYZ(index, world.x, world.y, world.z);
        linePositions.setXYZ(index, world.x, world.y, world.z);
      });
      positions.needsUpdate = true;
      linePositions.needsUpdate = true;
      entry.mesh.geometry.computeVertexNormals();
      entry.mesh.geometry.computeBoundingSphere();
      entry.line.geometry.computeBoundingSphere();
    }
    this.setSelected(selectedFaceId);
  }

  setSelected(selectedFaceId: string | null): void {
    for (const [faceId, entry] of this.entries) {
      const selected = faceId === selectedFaceId;
      entry.material.emissive.set(selected ? '#f3c969' : '#000000');
      entry.material.emissiveIntensity = selected ? 0.55 : 0;
      entry.lineMaterial.color.set(selected ? '#b8462c' : '#143e3b');
      entry.lineMaterial.opacity = selected ? 0.95 : 0.62;
    }
  }

  faceLabel(faceId: string): string {
    if (!this.solid) return '';
    return faceById(this.solid, faceId)?.label ?? '';
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  private clear(): void {
    for (const entry of this.entries.values()) {
      entry.mesh.geometry.dispose();
      entry.material.dispose();
      entry.line.geometry.dispose();
      entry.lineMaterial.dispose();
    }
    this.group.clear();
    this.entries.clear();
    this.solid = null;
  }

  dispose(): void {
    this.clear();
  }
}
