import { faceNormal, faceVertices, findSharedEdge } from './polyhedron';
import type {
  Face,
  FoldNode,
  FoldRig,
  NetLayout,
  Quat,
  SolidDefinition,
  Transform,
  Vec2,
  Vec3,
} from './types';
import {
  EPS,
  add3,
  applyTransform,
  composeTransforms,
  cross3,
  dot3,
  identityTransform,
  inverseTransform,
  length3,
  normalize3,
  rotationAboutLine,
  scale3,
  signedAngleAroundAxis,
  sub3,
  v3,
} from './vec';

function quatFromBasis(e1: Vec3, e2: Vec3, e3: Vec3): Quat {
  const m00 = e1.x;
  const m01 = e2.x;
  const m02 = e3.x;
  const m10 = e1.y;
  const m11 = e2.y;
  const m12 = e3.y;
  const m20 = e1.z;
  const m21 = e2.z;
  const m22 = e3.z;
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    return { w: 0.25 * s, x: (m21 - m12) / s, y: (m02 - m20) / s, z: (m10 - m01) / s };
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return { w: (m21 - m12) / s, x: 0.25 * s, y: (m01 + m10) / s, z: (m02 + m20) / s };
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return { w: (m02 - m20) / s, x: (m01 + m10) / s, y: 0.25 * s, z: (m12 + m21) / s };
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return { w: (m10 - m01) / s, x: (m02 + m20) / s, y: (m12 + m21) / s, z: 0.25 * s };
}

function matchLayoutShift(rootPolygon: Vec2[], projected: Vec2[]): Vec2[] | null {
  const candidates: Vec2[][] = [projected, [...projected].reverse()];
  for (const candidate of candidates) {
    const shifts = candidate.map((point, index) => ({
      x: rootPolygon[index]!.x - point.x,
      y: rootPolygon[index]!.y - point.y,
    }));
    const average = shifts.reduce(
      (acc, shift) => ({ x: acc.x + shift.x / shifts.length, y: acc.y + shift.y / shifts.length }),
      { x: 0, y: 0 },
    );
    const maxError = Math.max(
      ...candidate.map((point, index) =>
        Math.hypot(
          point.x + average.x - rootPolygon[index]!.x,
          point.y + average.y - rootPolygon[index]!.y,
        ),
      ),
    );
    if (maxError < 1e-5) return candidate;
  }
  return null;
}

function rootEmbedding(solid: SolidDefinition, layout: NetLayout): Transform {
  const rootLayout = layout.faces.find((face) => !face.hinge);
  const rootId =
    rootLayout?.faceId ??
    solid.faces.find((face) => face.id === solid.rootFaceId)?.id ??
    solid.faces[0]!.id;
  const rootFace = solid.faces.find((face) => face.id === rootId) ?? solid.faces[0]!;
  const rootVertices = faceVertices(solid, rootFace);
  const normal = faceNormal(solid, rootFace);
  const e1 = normalize3(sub3(rootVertices[1]!, rootVertices[0]!));
  const e2 = normalize3(cross3(normal, e1));
  const origin = rootVertices[0]!;
  const projected = rootVertices.map((point) => {
    const relative = sub3(point, origin);
    return { x: dot3(relative, e1), y: dot3(relative, e2) };
  });
  const rootNet = rootLayout?.polygon ?? projected;
  const matched = matchLayoutShift(rootNet, projected) ?? projected;
  const shifts = matched.map((point, index) => ({
    x: rootNet[index]!.x - point.x,
    y: rootNet[index]!.y - point.y,
  }));
  const shift = shifts.reduce(
    (acc, item) => ({ x: acc.x + item.x / shifts.length, y: acc.y + item.y / shifts.length }),
    { x: 0, y: 0 },
  );
  return {
    q: quatFromBasis(e1, e2, normal),
    t: sub3(origin, add3(scale3(e1, shift.x), scale3(e2, shift.y))),
  };
}

function countLeaves(layout: NetLayout): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const face of layout.faces) children.set(face.faceId, []);
  for (const face of layout.faces) {
    if (!face.hinge) continue;
    children.get(face.hinge.parentFaceId)?.push(face.faceId);
  }
  return children;
}

function angleFromTransform(transform: Transform, axis: Vec3): number {
  let q = transform.q;
  if (q.w < 0) q = { x: -q.x, y: -q.y, z: -q.z, w: -q.w };
  const vectorLength = Math.hypot(q.x, q.y, q.z);
  if (vectorLength < EPS) return 0;
  let angle = 2 * Math.atan2(vectorLength, q.w);
  if (angle > Math.PI) angle -= Math.PI * 2;
  const extractedAxis = {
    x: q.x / vectorLength,
    y: q.y / vectorLength,
    z: q.z / vectorLength,
  };
  if (dot3(extractedAxis, axis) < 0) angle = -angle;
  return angle;
}

export function buildFoldRig(solid: SolidDefinition, layout: NetLayout): FoldRig {
  const embedding = rootEmbedding(solid, layout);
  const rootLayout = layout.faces.find((face) => !face.hinge);
  const rootId =
    rootLayout?.faceId ??
    solid.faces.find((face) => face.id === solid.rootFaceId)?.id ??
    solid.faces[0]!.id;
  const facesById = new Map(solid.faces.map((face) => [face.id, face]));
  const layoutById = new Map(layout.faces.map((face) => [face.faceId, face]));
  const children = countLeaves(layout);

  const unfoldTransforms = new Map<string, Transform>();
  unfoldTransforms.set(rootId, identityTransform());

  const nodes = new Map<string, FoldNode>();
  nodes.set(rootId, { faceId: rootId, parentFaceId: null, hinge: null, children: [] });
  const order = [rootId];
  const queue = [rootId];

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    for (const childId of children.get(parentId) ?? []) {
      const parentFace = facesById.get(parentId);
      const childFace = facesById.get(childId);
      const netFace = layoutById.get(childId);
      const parentUnfold = unfoldTransforms.get(parentId);
      if (!parentFace || !childFace || !netFace?.hinge || !parentUnfold) continue;
      const shared = findSharedEdge(parentFace, childFace);
      if (!shared) continue;

      const pointA = solid.vertices[shared[0]]!;
      const pointB = solid.vertices[shared[1]]!;
      const solidAxis = normalize3(sub3(pointB, pointA));
      const unfoldAngle = signedAngleAroundAxis(
        faceNormal(solid, childFace),
        faceNormal(solid, parentFace),
        solidAxis,
      );
      const localUnfold = rotationAboutLine(pointA, solidAxis, unfoldAngle);
      const unfold = composeTransforms(parentUnfold, localUnfold);
      unfoldTransforms.set(childId, unfold);

      const hingeA = netFace.hinge.edge[0]!;
      const hingeB = netFace.hinge.edge[1]!;
      const netAxis = normalize3(v3(hingeB.x - hingeA.x, hingeB.y - hingeA.y, 0));
      const finalParent = composeTransforms(inverseTransform(parentUnfold), embedding);
      const finalChild = composeTransforms(inverseTransform(unfold), embedding);
      const localFinal = composeTransforms(inverseTransform(finalParent), finalChild);
      const angle = angleFromTransform(localFinal, netAxis);
      const point = v3(hingeA.x, hingeA.y, 0);
      const axis = netAxis;
      if (length3(axis) < EPS) continue;

      nodes.set(childId, {
        faceId: childId,
        parentFaceId: parentId,
        hinge: { point, axis, angle },
        children: [],
      });
      nodes.get(parentId)!.children.push(childId);
      order.push(childId);
      queue.push(childId);
    }
  }

  return { solid, rootId, nodes, order, embedding };
}

export function foldTransforms(rig: FoldRig, t: number): Map<string, Transform> {
  const clamped = Math.max(0, Math.min(1, t));
  const transforms = new Map<string, Transform>();
  transforms.set(rig.rootId, rig.embedding);
  for (const faceId of rig.order) {
    if (faceId === rig.rootId) continue;
    const node = rig.nodes.get(faceId);
    if (!node || !node.hinge || !node.parentFaceId) continue;
    const parent = transforms.get(node.parentFaceId);
    if (!parent) continue;
    const local = rotationAboutLine(node.hinge.point, node.hinge.axis, node.hinge.angle * clamped);
    transforms.set(faceId, composeTransforms(parent, local));
  }
  return transforms;
}

export function transformNetPoint(transform: Transform, point: Vec2): Vec3 {
  return applyTransform(transform, v3(point.x, point.y, 0));
}

export function foldedNetFace(
  rig: FoldRig,
  layout: NetLayout,
  faceId: string,
  t: number,
  transforms = foldTransforms(rig, t),
): Vec3[] {
  const netFace = layout.faces.find((face) => face.faceId === faceId);
  const transform = transforms.get(faceId);
  if (!netFace || !transform) return [];
  return netFace.polygon.map((point) => transformNetPoint(transform, point));
}

export function faceMatchesSolid(
  solid: SolidDefinition,
  face: Face,
  points: Vec3[],
  tolerance = 1e-6,
): boolean {
  const target = faceVertices(solid, face);
  if (points.length !== target.length) return false;
  return points.every((point) =>
    target.some(
      (candidate) =>
        Math.abs(point.x - candidate.x) <= tolerance &&
        Math.abs(point.y - candidate.y) <= tolerance &&
        Math.abs(point.z - candidate.z) <= tolerance,
    ),
  );
}
