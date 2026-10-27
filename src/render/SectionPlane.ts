import * as THREE from 'three';
import type { CrossSection, PlaneDefinition, SolidDefinition } from '../geometry/types';
import { normalizePlane } from '../geometry/crossSection';
import { solidBoundingRadius } from '../geometry/polyhedron';

export class SectionPlane {
  readonly group = new THREE.Group();
  private planeMesh: THREE.Mesh | null = null;
  private fillMesh: THREE.Mesh | null = null;
  private outline: THREE.LineLoop | null = null;
  private planeBorder: THREE.LineLoop | null = null;
  private key = '';

  constructor() {
    this.group.name = 'section-plane';
  }

  update(
    solid: SolidDefinition,
    plane: PlaneDefinition | null,
    section: CrossSection | null,
    options: { showPlane: boolean; showShape: boolean },
  ): void {
    const normalized = plane ? normalizePlane(plane) : null;
    const sectionKey = section
      ? `${section.shapeNameKo}:${section.points3D.length}:${section.area.toFixed(6)}`
      : 'none';
    const key = `${solid.id}:${normalized ? `${normalized.normal.x.toFixed(6)},${normalized.normal.y.toFixed(6)},${normalized.normal.z.toFixed(6)},${normalized.offset.toFixed(6)}` : 'none'}:${String(options.showPlane)}:${String(options.showShape)}:${sectionKey}`;
    if (key === this.key) return;
    this.clear();
    this.key = key;
    if (!normalized || !options.showPlane) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    const radius = solidBoundingRadius(solid) * 1.65;

    const planeGeometry = new THREE.PlaneGeometry(radius * 2, radius * 2);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#dfa83d'),
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(normalized.normal.x, normalized.normal.y, normalized.normal.z),
    );
    this.planeMesh.quaternion.copy(quaternion);
    this.planeMesh.position.set(
      normalized.normal.x * normalized.offset,
      normalized.normal.y * normalized.offset,
      normalized.normal.z * normalized.offset,
    );
    this.planeMesh.renderOrder = 4;
    const borderGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-radius, -radius, 0),
      new THREE.Vector3(radius, -radius, 0),
      new THREE.Vector3(radius, radius, 0),
      new THREE.Vector3(-radius, radius, 0),
    ]);
    const borderMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color('#dfa83d'),
      transparent: true,
      opacity: 0.55,
    });
    this.planeBorder = new THREE.LineLoop(borderGeometry, borderMaterial);
    this.planeBorder.quaternion.copy(quaternion);
    this.planeBorder.position.copy(this.planeMesh.position);
    this.planeBorder.renderOrder = 4;
    this.group.add(this.planeMesh, this.planeBorder);

    if (!section || !options.showShape || section.points3D.length < 3) return;

    const points = section.points3D;
    const fillGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    points.forEach((point, index) => {
      positions[index * 3] = point.x;
      positions[index * 3 + 1] = point.y;
      positions[index * 3 + 2] = point.z;
    });
    fillGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const indices: number[] = [];
    for (let i = 1; i < points.length - 1; i += 1) indices.push(0, i, i + 1);
    fillGeometry.setIndex(indices);
    const fillMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#df6a50'),
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
    this.fillMesh.renderOrder = 5;
    this.group.add(this.fillMesh);

    const outlineGeometry = new THREE.BufferGeometry();
    outlineGeometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));
    const outlineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color('#b8462c'),
      transparent: true,
      opacity: 0.95,
    });
    this.outline = new THREE.LineLoop(outlineGeometry, outlineMaterial);
    this.outline.renderOrder = 6;
    this.group.add(this.outline);
  }

  private clear(): void {
    if (this.planeMesh) {
      this.planeMesh.geometry.dispose();
      (this.planeMesh.material as THREE.Material).dispose();
    }
    if (this.fillMesh) {
      this.fillMesh.geometry.dispose();
      (this.fillMesh.material as THREE.Material).dispose();
    }
    if (this.outline) {
      this.outline.geometry.dispose();
      (this.outline.material as THREE.Material).dispose();
    }
    if (this.planeBorder) {
      this.planeBorder.geometry.dispose();
      (this.planeBorder.material as THREE.Material).dispose();
    }
    this.planeMesh = null;
    this.fillMesh = null;
    this.outline = null;
    this.planeBorder = null;
    this.group.clear();
  }

  dispose(): void {
    this.clear();
  }
}
