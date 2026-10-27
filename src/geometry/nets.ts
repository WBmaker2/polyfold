import type {
  NetFace,
  NetInvalidReason,
  NetLayout,
  NetValidation,
  SolidDefinition,
  Transform,
  Vec2,
  Vec3,
} from './types';
import {
  add2,
  applyTransform,
  bounds2D,
  composeTransforms,
  cross3,
  distance2,
  dot3,
  identityTransform,
  normalize3,
  polygonArea2D,
  polygonCentroid2D,
  rotationAboutLine,
  scale2,
  signedAngleAroundAxis,
  sub2,
  sub3,
  v2,
} from './vec';
import {
  faceAdjacency,
  faceArea,
  faceNormal,
  faceVertices,
  findSharedEdge,
  pointOnSegment2D,
  polygonsOverlap,
} from './polyhedron';

interface UnfoldedLayout {
  layout: NetLayout;
  transforms: Map<string, Transform>;
}

const invalidMessages: Record<NetInvalidReason, string> = {
  overlap: '두 면이 같은 자리에서 겹쳐요. 겹친 부분은 접을 수 없어요.',
  'missing-face': '면이 하나 빠져 있어요. 입체를 만들려면 모든 면이 필요해요.',
  'duplicate-face': '같은 면이 두 번 들어 있어요.',
  disconnected: '떨어져 있는 면이 있어요. 모든 면이 접는 선으로 이어져야 해요.',
  'bad-hinge': '접는 선이 실제 모서리와 맞지 않아요.',
  'area-mismatch': '면의 크기가 원래 입체와 맞지 않아요.',
  none: '전개도를 확인해 주세요.',
};

function projectPoint(point: Vec3, origin: Vec3, e1: Vec3, e2: Vec3): Vec2 {
  const relative = sub3(point, origin);
  return v2(dot3(relative, e1), dot3(relative, e2));
}

function rootBasis(solid: SolidDefinition): {
  origin: Vec3;
  normal: Vec3;
  e1: Vec3;
  e2: Vec3;
} {
  const root = solid.faces.find((face) => face.id === solid.rootFaceId) ?? solid.faces[0]!;
  const vertices = faceVertices(solid, root);
  const origin = vertices[0]!;
  const normal = faceNormal(solid, root);
  const e1 = normalize3(sub3(vertices[1]!, origin));
  const e2 = normalize3(cross3(normal, e1));
  return { origin, normal, e1, e2 };
}

function buildParentMap(
  solid: SolidDefinition,
  treeEdges: { a: string; b: string }[],
): Map<string, string | null> | null {
  const adjacency = new Map<string, string[]>();
  for (const face of solid.faces) adjacency.set(face.id, []);
  for (const edge of treeEdges) {
    adjacency.get(edge.a)?.push(edge.b);
    adjacency.get(edge.b)?.push(edge.a);
  }
  const root = solid.rootFaceId;
  const parent = new Map<string, string | null>();
  const queue = [root];
  parent.set(root, null);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (!parent.has(next)) {
        parent.set(next, current);
        queue.push(next);
      }
    }
  }
  if (parent.size !== solid.faces.length) return null;
  return parent;
}

function unfoldWithParents(
  solid: SolidDefinition,
  parentMap: Map<string, string | null>,
): UnfoldedLayout | null {
  const facesById = new Map(solid.faces.map((face) => [face.id, face]));
  const rootId = solid.rootFaceId;
  if (!facesById.has(rootId)) return null;

  const transforms = new Map<string, Transform>();
  transforms.set(rootId, identityTransform());
  const parentOf = new Map<string, string | null>([[rootId, null]]);
  const hinges: { childId: string; parentId: string; edge: [number, number] }[] = [];
  const queue = [rootId];
  const visited = new Set<string>([rootId]);

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const parentFace = facesById.get(parentId)!;
    const parentTransform = transforms.get(parentId)!;
    for (const [faceId, parent] of parentMap) {
      if (parent !== parentId) continue;
      const childFace = facesById.get(faceId);
      if (!childFace) return null;
      const shared = findSharedEdge(parentFace, childFace);
      if (!shared) return null;
      const pointA = solid.vertices[shared[0]]!;
      const pointB = solid.vertices[shared[1]]!;
      const axis = normalize3(sub3(pointB, pointA));
      const angle = signedAngleAroundAxis(
        faceNormal(solid, childFace),
        faceNormal(solid, parentFace),
        axis,
      );
      const local = rotationAboutLine(pointA, axis, angle);
      const world = composeTransforms(parentTransform, local);
      transforms.set(faceId, world);
      parentOf.set(faceId, parentId);
      hinges.push({ childId: faceId, parentId, edge: shared });
      visited.add(faceId);
      queue.push(faceId);
    }
  }

  if (visited.size !== solid.faces.length) return null;

  const basis = rootBasis(solid);
  const projected = new Map<string, Vec2[]>();
  for (const face of solid.faces) {
    const transform = transforms.get(face.id);
    if (!transform) return null;
    const flatPoints = faceVertices(solid, face).map((point) => applyTransform(transform, point));
    for (const flatPoint of flatPoints) {
      if (Math.abs(dot3(sub3(flatPoint, basis.origin), basis.normal)) > 1e-5) {
        return null;
      }
    }
    const polygon = flatPoints.map((point) =>
      projectPoint(point, basis.origin, basis.e1, basis.e2),
    );
    if (polygonArea2D(polygon) < 0) polygon.reverse();
    projected.set(face.id, polygon);
  }

  const hinge2D = new Map<string, { parentFaceId: string; edge: [Vec2, Vec2] }>();
  for (const hinge of hinges) {
    const parentTransform = transforms.get(hinge.parentId)!;
    const pointA = solid.vertices[hinge.edge[0]]!;
    const pointB = solid.vertices[hinge.edge[1]]!;
    const flatA = applyTransform(parentTransform, pointA);
    const flatB = applyTransform(parentTransform, pointB);
    hinge2D.set(hinge.childId, {
      parentFaceId: hinge.parentId,
      edge: [
        projectPoint(flatA, basis.origin, basis.e1, basis.e2),
        projectPoint(flatB, basis.origin, basis.e1, basis.e2),
      ],
    });
  }

  const allPoints = [...projected.values()].flat();
  const box = bounds2D(allPoints);
  const shift = v2(-(box.minX + box.maxX) / 2, -(box.minY + box.maxY) / 2);

  const faces: NetFace[] = solid.faces.map((face) => {
    const polygon = projected.get(face.id)!.map((point) => add2(point, shift));
    const hinge = hinge2D.get(face.id);
    return {
      faceId: face.id,
      polygon,
      ...(hinge
        ? {
            hinge: {
              parentFaceId: hinge.parentFaceId,
              edge: [add2(hinge.edge[0], shift), add2(hinge.edge[1], shift)] as [Vec2, Vec2],
            },
          }
        : {}),
    };
  });

  const layout: NetLayout = {
    id: `${solid.id}-candidate`,
    solidId: solid.id,
    valid: true,
    faces,
  };
  return { layout, transforms };
}

function polygonHasEdge(polygon: Vec2[], a: Vec2, b: Vec2, tolerance = 1e-5): boolean {
  for (let i = 0; i < polygon.length; i += 1) {
    const p = polygon[i]!;
    const q = polygon[(i + 1) % polygon.length]!;
    if (pointOnSegment2D(a, p, q, tolerance) && pointOnSegment2D(b, p, q, tolerance)) {
      return true;
    }
  }
  return false;
}

export function validateNet(solid: SolidDefinition, layout: NetLayout): NetValidation {
  const solidFaceIds = new Set(solid.faces.map((face) => face.id));
  const seen = new Set<string>();
  const layoutById = new Map<string, NetFace>();

  if (layout.faces.length !== solid.faces.length) {
    return {
      valid: false,
      reason: 'missing-face',
      messageKo: invalidMessages['missing-face'],
    };
  }

  for (const netFace of layout.faces) {
    if (!solidFaceIds.has(netFace.faceId)) {
      return {
        valid: false,
        reason: 'missing-face',
        messageKo: invalidMessages['missing-face'],
      };
    }
    if (seen.has(netFace.faceId)) {
      return {
        valid: false,
        reason: 'duplicate-face',
        messageKo: invalidMessages['duplicate-face'],
      };
    }
    seen.add(netFace.faceId);
    layoutById.set(netFace.faceId, netFace);
    const face = solid.faces.find((item) => item.id === netFace.faceId);
    if (!face || netFace.polygon.length !== face.vertexIndices.length) {
      return {
        valid: false,
        reason: 'area-mismatch',
        messageKo: invalidMessages['area-mismatch'],
      };
    }
    const expectedArea = faceArea(solid, face);
    const actualArea = Math.abs(polygonArea2D(netFace.polygon));
    if (Math.abs(expectedArea - actualArea) > Math.max(1e-6, expectedArea * 1e-5)) {
      return {
        valid: false,
        reason: 'area-mismatch',
        messageKo: invalidMessages['area-mismatch'],
      };
    }
  }

  const roots = layout.faces.filter((face) => !face.hinge);
  if (roots.length !== 1) {
    return {
      valid: false,
      reason: 'disconnected',
      messageKo: invalidMessages.disconnected,
    };
  }

  const children = new Map<string, string[]>();
  for (const face of layout.faces) children.set(face.faceId, []);
  for (const face of layout.faces) {
    if (!face.hinge) continue;
    const parent = layoutById.get(face.hinge.parentFaceId);
    if (!parent) {
      return {
        valid: false,
        reason: 'bad-hinge',
        messageKo: invalidMessages['bad-hinge'],
      };
    }
    const childSolidFace = solid.faces.find((item) => item.id === face.faceId)!;
    const parentSolidFace = solid.faces.find((item) => item.id === parent.faceId)!;
    if (!findSharedEdge(parentSolidFace, childSolidFace)) {
      return {
        valid: false,
        reason: 'bad-hinge',
        messageKo: invalidMessages['bad-hinge'],
      };
    }
    if (
      !polygonHasEdge(parent.polygon, face.hinge.edge[0], face.hinge.edge[1]) ||
      !polygonHasEdge(face.polygon, face.hinge.edge[0], face.hinge.edge[1])
    ) {
      return {
        valid: false,
        reason: 'bad-hinge',
        messageKo: invalidMessages['bad-hinge'],
      };
    }
    children.get(parent.faceId)!.push(face.faceId);
  }

  const visited = new Set<string>();
  const queue = [roots[0]!.faceId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) {
      return {
        valid: false,
        reason: 'bad-hinge',
        messageKo: invalidMessages['bad-hinge'],
      };
    }
    visited.add(current);
    for (const child of children.get(current) ?? []) queue.push(child);
  }
  if (visited.size !== layout.faces.length) {
    return {
      valid: false,
      reason: 'disconnected',
      messageKo: invalidMessages.disconnected,
    };
  }

  for (let i = 0; i < layout.faces.length; i += 1) {
    for (let j = i + 1; j < layout.faces.length; j += 1) {
      const a = layout.faces[i]!;
      const b = layout.faces[j]!;
      if (polygonsOverlap(a.polygon, b.polygon)) {
        return {
          valid: false,
          reason: 'overlap',
          messageKo: invalidMessages.overlap,
        };
      }
    }
  }

  return { valid: true, reason: 'none', messageKo: '' };
}

function combinations<T>(items: T[], choose: number): T[][] {
  const result: T[][] = [];
  const current: T[] = [];
  const walk = (start: number) => {
    if (current.length === choose) {
      result.push([...current]);
      return;
    }
    for (let i = start; i <= items.length - (choose - current.length); i += 1) {
      current.push(items[i]!);
      walk(i + 1);
      current.pop();
    }
  };
  walk(0);
  return result;
}

function shapeSignature(layout: NetLayout): string {
  return layout.faces
    .map((face) =>
      face.polygon
        .map((point) => `${Math.round(point.x * 1000)},${Math.round(point.y * 1000)}`)
        .join(';'),
    )
    .sort()
    .join('|');
}

function cubeCanonicalKey(layout: NetLayout): string {
  const centers = layout.faces.map((face) => polygonCentroid2D(face.polygon));
  const minX = Math.min(...centers.map((point) => Math.round(point.x)));
  const minY = Math.min(...centers.map((point) => Math.round(point.y)));
  const cells = centers.map((point) => [Math.round(point.x) - minX, Math.round(point.y) - minY]);
  const transforms = [
    ([x, y]: number[]) => [x, y],
    ([x, y]: number[]) => [x, -y],
    ([x, y]: number[]) => [-x, y],
    ([x, y]: number[]) => [-x, -y],
    ([x, y]: number[]) => [y, x],
    ([x, y]: number[]) => [y, -x],
    ([x, y]: number[]) => [-y, x],
    ([x, y]: number[]) => [-y, -x],
  ];
  let best = '';
  for (const transform of transforms) {
    const transformed = cells.map((cell) => transform(cell));
    const shiftedX = Math.min(...transformed.map((cell) => cell[0]!));
    const shiftedY = Math.min(...transformed.map((cell) => cell[1]!));
    const key = transformed
      .map((cell) => `${cell[0]! - shiftedX},${cell[1]! - shiftedY}`)
      .sort()
      .join('|');
    if (best === '' || key < best) best = key;
  }
  return best;
}

function cloneLayout(layout: NetLayout): NetLayout {
  return {
    ...layout,
    faces: layout.faces.map((face) => ({
      faceId: face.faceId,
      polygon: face.polygon.map((point) => ({ ...point })),
      ...(face.hinge
        ? {
            hinge: {
              parentFaceId: face.hinge.parentFaceId,
              edge: [{ ...face.hinge.edge[0] }, { ...face.hinge.edge[1] }] as [Vec2, Vec2],
            },
          }
        : {}),
    })),
  };
}

function leafFace(layout: NetLayout): NetFace | null {
  const parents = new Set(
    layout.faces.map((face) => face.hinge?.parentFaceId).filter((id): id is string => !!id),
  );
  const leaves = layout.faces.filter((face) => face.hinge && !parents.has(face.faceId));
  return leaves[leaves.length - 1] ?? layout.faces.find((face) => face.hinge) ?? null;
}

function makeMissingInvalid(base: NetLayout, id: string): NetLayout | null {
  const leaf = leafFace(base);
  if (!leaf) return null;
  const layout = cloneLayout(base);
  layout.id = id;
  layout.valid = false;
  layout.invalidReason = 'missing-face';
  layout.noteKo = invalidMessages['missing-face'];
  layout.faces = layout.faces.filter((face) => face.faceId !== leaf.faceId);
  return layout;
}

function makeDuplicateInvalid(base: NetLayout, id: string): NetLayout | null {
  const leaf = leafFace(base);
  if (!leaf) return null;
  const layout = cloneLayout(base);
  layout.id = id;
  layout.valid = false;
  layout.invalidReason = 'duplicate-face';
  layout.noteKo = invalidMessages['duplicate-face'];
  const box = bounds2D(base.faces.flatMap((face) => face.polygon));
  const shift = v2(box.width + 2, 0);
  layout.faces.push({
    faceId: leaf.faceId,
    polygon: leaf.polygon.map((point) => add2(point, shift)),
  });
  return layout;
}

function makeDisconnectedInvalid(base: NetLayout, id: string): NetLayout | null {
  const leaf = leafFace(base);
  if (!leaf) return null;
  const layout = cloneLayout(base);
  layout.id = id;
  layout.valid = false;
  layout.invalidReason = 'disconnected';
  layout.noteKo = invalidMessages.disconnected;
  for (const face of layout.faces) {
    if (face.faceId === leaf.faceId) delete face.hinge;
  }
  return layout;
}

function makeAreaMismatchInvalid(base: NetLayout, id: string): NetLayout | null {
  const leaf = leafFace(base);
  if (!leaf) return null;
  const layout = cloneLayout(base);
  layout.id = id;
  layout.valid = false;
  layout.invalidReason = 'area-mismatch';
  layout.noteKo = invalidMessages['area-mismatch'];
  for (const face of layout.faces) {
    if (face.faceId !== leaf.faceId) continue;
    const center = polygonCentroid2D(face.polygon);
    face.polygon = face.polygon.map((point) => add2(center, scale2(sub2(point, center), 1.35)));
  }
  return layout;
}

function makeBadHingeInvalid(
  solid: SolidDefinition,
  base: NetLayout,
  id: string,
): NetLayout | null {
  const leaf = leafFace(base);
  if (!leaf || !leaf.hinge) return null;
  const childFace = solid.faces.find((face) => face.id === leaf.faceId)!;
  const parentFace = solid.faces.find((face) => face.id === leaf.hinge!.parentFaceId)!;
  const replacement = solid.faces.find(
    (face) =>
      face.id !== leaf.faceId && face.id !== parentFace.id && !findSharedEdge(face, childFace),
  );
  if (!replacement) return null;
  const layout = cloneLayout(base);
  layout.id = id;
  layout.valid = false;
  layout.invalidReason = 'bad-hinge';
  layout.noteKo = invalidMessages['bad-hinge'];
  for (const face of layout.faces) {
    if (face.faceId === leaf.faceId) {
      face.hinge = {
        parentFaceId: replacement.id,
        edge: [{ ...leaf.hinge.edge[0] }, { ...leaf.hinge.edge[1] }] as [Vec2, Vec2],
      };
    }
  }
  return layout;
}

function layoutNote(layout: NetLayout, validation: NetValidation): NetLayout {
  if (validation.valid) return layout;
  layout.valid = false;
  layout.invalidReason = validation.reason;
  layout.noteKo = validation.messageKo;
  return layout;
}

function bboxScore(layout: NetLayout): number {
  const box = bounds2D(layout.faces.flatMap((face) => face.polygon));
  return box.width * box.height + (box.width + box.height) * 0.001;
}

export function generateNetsForSolid(solid: SolidDefinition): NetLayout[] {
  const adjacency = faceAdjacency(solid);
  const edgeChoices = combinations(adjacency, solid.faces.length - 1);
  const validByShape = new Map<string, NetLayout>();
  const invalidOverlapByShape = new Map<string, NetLayout>();

  for (const edges of edgeChoices) {
    const parentMap = buildParentMap(
      solid,
      edges.map((edge) => ({ a: edge.faceA, b: edge.faceB })),
    );
    if (!parentMap) continue;
    const unfolded = unfoldWithParents(solid, parentMap);
    if (!unfolded) continue;
    const validation = validateNet(solid, unfolded.layout);
    if (validation.valid) {
      const key =
        solid.id === 'cube' ? cubeCanonicalKey(unfolded.layout) : shapeSignature(unfolded.layout);
      if (!validByShape.has(key)) validByShape.set(key, unfolded.layout);
    } else if (validation.reason === 'overlap') {
      layoutNote(unfolded.layout, validation);
      const key = shapeSignature(unfolded.layout);
      if (!invalidOverlapByShape.has(key)) invalidOverlapByShape.set(key, unfolded.layout);
    }
  }

  const validEntries = [...validByShape.entries()].sort((a, b) => {
    const scoreA = bboxScore(a[1]);
    const scoreB = bboxScore(b[1]);
    if (Math.abs(scoreA - scoreB) > 1e-6) return scoreA - scoreB;
    return shapeSignature(a[1]).localeCompare(shapeSignature(b[1]));
  });

  const maxValid = solid.id === 'cube' ? 11 : 8;
  const validLayouts = validEntries.slice(0, maxValid).map(([key, layout]) => {
    const copy = cloneLayout(layout);
    copy.valid = true;
    copy.invalidReason = undefined;
    copy.noteKo = undefined;
    return { key, layout: copy };
  });

  if (solid.id === 'cube') {
    validLayouts.sort((a, b) => a.key.localeCompare(b.key));
  }

  validLayouts.forEach((entry, index) => {
    entry.layout.id = `${solid.id}-net-${String(index + 1).padStart(2, '0')}`;
    entry.layout.index = index;
  });

  const invalidLayouts: NetLayout[] = [];
  const overlapCandidates = [...invalidOverlapByShape.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, layout]) => layout);
  const overlapCount = solid.id === 'cube' ? 2 : solid.id === 'tetrahedron' ? 0 : 1;
  for (let i = 0; i < Math.min(overlapCount, overlapCandidates.length); i += 1) {
    const layout = cloneLayout(overlapCandidates[i]!);
    layout.id = `${solid.id}-invalid-overlap-${i + 1}`;
    layout.valid = false;
    layout.invalidReason = 'overlap';
    layout.noteKo = invalidMessages.overlap;
    invalidLayouts.push(layout);
  }

  const base = validLayouts[0]?.layout;
  if (base) {
    if (solid.id === 'cube') {
      const missing = makeMissingInvalid(base, 'cube-invalid-missing');
      const duplicate = makeDuplicateInvalid(base, 'cube-invalid-duplicate');
      const disconnected = makeDisconnectedInvalid(base, 'cube-invalid-disconnected');
      const badHinge = makeBadHingeInvalid(solid, base, 'cube-invalid-bad-hinge');
      const areaMismatch = makeAreaMismatchInvalid(base, 'cube-invalid-area');
      for (const layout of [missing, duplicate, disconnected, badHinge, areaMismatch]) {
        if (layout) invalidLayouts.push(layout);
      }
    } else if (solid.id === 'square-pyramid') {
      const missing = makeMissingInvalid(base, 'square-pyramid-invalid-missing');
      const duplicate = makeDuplicateInvalid(base, 'square-pyramid-invalid-duplicate');
      const areaMismatch = makeAreaMismatchInvalid(base, 'square-pyramid-invalid-area');
      for (const layout of [missing, duplicate, areaMismatch]) {
        if (layout) invalidLayouts.push(layout);
      }
    } else {
      const missing = makeMissingInvalid(base, `${solid.id}-invalid-missing`);
      if (missing) invalidLayouts.push(missing);
      if (validLayouts.length < 3 && solid.id !== 'tetrahedron') {
        const duplicate = makeDuplicateInvalid(base, `${solid.id}-invalid-duplicate`);
        if (duplicate) invalidLayouts.push(duplicate);
      }
    }
  }

  if (validLayouts.length + invalidLayouts.length < 3) {
    if (base) {
      const duplicate = makeDuplicateInvalid(base, `${solid.id}-invalid-duplicate`);
      if (duplicate) invalidLayouts.push(duplicate);
    }
  }

  const all = [...validLayouts.map((entry) => entry.layout), ...invalidLayouts];
  all.forEach((layout, index) => {
    layout.index = index;
  });
  return all;
}

export function netById(solid: SolidDefinition, netId: string): NetLayout {
  return solid.netLayouts.find((layout) => layout.id === netId) ?? solid.netLayouts[0]!;
}

export function validNets(solid: SolidDefinition): NetLayout[] {
  return solid.netLayouts.filter((layout) => layout.valid);
}

export function invalidNets(solid: SolidDefinition): NetLayout[] {
  return solid.netLayouts.filter((layout) => !layout.valid);
}

export function netFaceCount(layout: NetLayout): number {
  return layout.faces.length;
}

export function netCenter(layout: NetLayout): Vec2 {
  const box = bounds2D(layout.faces.flatMap((face) => face.polygon));
  return v2((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2);
}

export function netScale(layout: NetLayout): number {
  const box = bounds2D(layout.faces.flatMap((face) => face.polygon));
  return Math.max(box.width, box.height, 1e-6);
}

export function distancePointToNetFace(point: Vec2, netFace: NetFace): number {
  const center = polygonCentroid2D(netFace.polygon);
  return distance2(point, center);
}

export function polygonContainsNetPoint(netFace: NetFace, point: Vec2): boolean {
  let positive = false;
  let negative = false;
  for (let i = 0; i < netFace.polygon.length; i += 1) {
    const a = netFace.polygon[i]!;
    const b = netFace.polygon[(i + 1) % netFace.polygon.length]!;
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (cross > 1e-7) positive = true;
    if (cross < -1e-7) negative = true;
  }
  return !(positive && negative);
}

export function scaledPolygon(netFace: NetFace, scale: number, offset: Vec2): Vec2[] {
  const center = polygonCentroid2D(netFace.polygon);
  return netFace.polygon.map((point) =>
    add2(scale2(sub2(point, center), scale), add2(center, offset)),
  );
}

export function netBoundingBox(layout: NetLayout): ReturnType<typeof bounds2D> {
  return bounds2D(layout.faces.flatMap((face) => face.polygon));
}

export function faceInNet(layout: NetLayout, faceId: string): NetFace | undefined {
  return layout.faces.find((face) => face.faceId === faceId);
}

export function faceAdjacencyForNet(layout: NetLayout, faceId: string): string[] {
  const children = new Set<string>();
  for (const face of layout.faces) {
    if (face.hinge?.parentFaceId === faceId) children.add(face.faceId);
  }
  const parent = layout.faces.find((face) => face.faceId === faceId)?.hinge?.parentFaceId;
  if (parent) children.add(parent);
  return [...children];
}

export { invalidMessages };
