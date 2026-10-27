import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type CameraPreset = 'orbit' | 'top' | 'front';

export function frameCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  radius: number,
  preset: CameraPreset = 'orbit',
): void {
  const safeRadius = Math.max(radius, 0.8);
  const fov = (camera.fov * Math.PI) / 180;
  const distance = (safeRadius / Math.sin(fov / 2)) * 1.35;
  controls.target.set(0, 0, 0);
  if (preset === 'top') {
    camera.position.set(0.001, distance, 0.001);
  } else if (preset === 'front') {
    camera.position.set(0, 0, distance);
  } else {
    camera.position.set(distance * 0.62, distance * 0.52, distance * 0.72);
  }
  camera.near = distance / 100;
  camera.far = distance * 20;
  camera.updateProjectionMatrix();
  controls.update();
}

export function orbitCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  deltaTheta: number,
  deltaPhi: number,
): void {
  const offset = camera.position.clone().sub(controls.target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta -= deltaTheta;
  spherical.phi = THREE.MathUtils.clamp(spherical.phi - deltaPhi, 0.08, Math.PI - 0.08);
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
  camera.lookAt(controls.target);
  controls.update();
}

export function zoomCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  factor: number,
): void {
  const offset = camera.position.clone().sub(controls.target);
  const distance = controls.minDistance
    ? Math.max(controls.minDistance, offset.length() * factor)
    : offset.length() * factor;
  const clamped = Math.min(controls.maxDistance, Math.max(controls.minDistance, distance));
  offset.setLength(clamped);
  camera.position.copy(controls.target).add(offset);
  controls.update();
}
