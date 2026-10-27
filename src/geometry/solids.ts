import { generateNetsForSolid } from './nets';
import type { Face, SolidDefinition, Vec3 } from './types';

const SQRT3 = Math.sqrt(3);
const SQRT5 = Math.sqrt(5);
const SQRT6 = Math.sqrt(6);

const palette = {
  coral: '#df6a50',
  gold: '#dfa83d',
  teal: '#2f8279',
  sky: '#5586b3',
  plum: '#8a6a9e',
  olive: '#83955a',
};

function face(id: string, vertexIndices: number[], label: string, color: string): Face {
  return { id, vertexIndices, label, color };
}

const cube: SolidDefinition = {
  id: 'cube',
  nameKo: '정육면체',
  nameEn: 'Cube',
  descriptionKo:
    '모서리의 길이가 모두 1인 정육면체예요. 여섯 개의 정사각형 면이 서로 수직으로 만나요.',
  vertices: [
    { x: -0.5, y: -0.5, z: -0.5 },
    { x: 0.5, y: -0.5, z: -0.5 },
    { x: 0.5, y: 0.5, z: -0.5 },
    { x: -0.5, y: 0.5, z: -0.5 },
    { x: -0.5, y: -0.5, z: 0.5 },
    { x: 0.5, y: -0.5, z: 0.5 },
    { x: 0.5, y: 0.5, z: 0.5 },
    { x: -0.5, y: 0.5, z: 0.5 },
  ],
  faces: [
    face('back', [0, 3, 2, 1], '뒤', palette.sky),
    face('front', [4, 5, 6, 7], '앞', palette.coral),
    face('left', [0, 4, 7, 3], '왼쪽', palette.olive),
    face('right', [1, 2, 6, 5], '오른쪽', palette.teal),
    face('bottom', [0, 1, 5, 4], '아래', palette.plum),
    face('top', [3, 7, 6, 2], '위', palette.gold),
  ],
  rootFaceId: 'bottom',
  netLayouts: [],
  formulas: {
    surfaceArea: '겉넓이 = 6 × a²',
    surfaceAreaSub: '6 × 1² = 6',
    volume: '부피 = a³',
    volumeSub: '1³ = 1',
  },
  measures: {
    surfaceArea: 6,
    volume: 1,
  },
};

const prism: SolidDefinition = {
  id: 'prism',
  nameKo: '직육면체',
  nameEn: 'Rectangular prism',
  descriptionKo:
    '가로 1, 세로 2, 높이 3인 직육면체예요. 마주 보는 면은 서로 평행하고 크기가 같아요.',
  vertices: [
    { x: -0.5, y: -1, z: -1.5 },
    { x: 0.5, y: -1, z: -1.5 },
    { x: 0.5, y: 1, z: -1.5 },
    { x: -0.5, y: 1, z: -1.5 },
    { x: -0.5, y: -1, z: 1.5 },
    { x: 0.5, y: -1, z: 1.5 },
    { x: 0.5, y: 1, z: 1.5 },
    { x: -0.5, y: 1, z: 1.5 },
  ],
  faces: [
    face('back', [0, 3, 2, 1], '뒤', palette.sky),
    face('front', [4, 5, 6, 7], '앞', palette.coral),
    face('left', [0, 4, 7, 3], '왼쪽', palette.olive),
    face('right', [1, 2, 6, 5], '오른쪽', palette.teal),
    face('bottom', [0, 1, 5, 4], '아래', palette.plum),
    face('top', [3, 7, 6, 2], '위', palette.gold),
  ],
  rootFaceId: 'bottom',
  netLayouts: [],
  formulas: {
    surfaceArea: '겉넓이 = 2(ab + bc + ca)',
    surfaceAreaSub: '2(1×2 + 2×3 + 3×1) = 22',
    volume: '부피 = a × b × c',
    volumeSub: '1 × 2 × 3 = 6',
  },
  measures: {
    surfaceArea: 22,
    volume: 6,
  },
};

const triangleRadius = 1;
const triangleHeight = 1;
const prismBaseArea = 2;
const triangularPrismPerimeter = 2 + 2 * SQRT5;

const triangularPrism: SolidDefinition = {
  id: 'triangular-prism',
  nameKo: '삼각기둥',
  nameEn: 'Triangular prism',
  descriptionKo:
    '밑면이 이등변삼각형인 삼각기둥이에요. 같은 삼각형이 위아래에 있고, 옆면은 세 개의 직사각형이에요.',
  vertices: [
    { x: -triangleRadius, y: -1, z: -triangleRadius },
    { x: triangleRadius, y: -1, z: -triangleRadius },
    { x: 0, y: -1, z: triangleHeight },
    { x: -triangleRadius, y: 1, z: -triangleRadius },
    { x: triangleRadius, y: 1, z: -triangleRadius },
    { x: 0, y: 1, z: triangleHeight },
  ],
  faces: [
    face('base-bottom', [0, 1, 2], '밑면', palette.gold),
    face('base-top', [3, 5, 4], '윗면', palette.plum),
    face('side-back', [0, 3, 4, 1], '옆면 1', palette.sky),
    face('side-right', [1, 4, 5, 2], '옆면 2', palette.teal),
    face('side-left', [0, 2, 5, 3], '옆면 3', palette.coral),
  ],
  rootFaceId: 'base-bottom',
  netLayouts: [],
  formulas: {
    surfaceArea: '겉넓이 = 2 × 밑넓이 + (밑면의 둘레) × 높이',
    surfaceAreaSub: `2 × 2 + (2 + 2√5) × 2 = 8 + 4√5 ≈ 16.94`,
    volume: '부피 = 밑넓이 × 높이',
    volumeSub: '2 × 2 = 4',
  },
  measures: {
    surfaceArea: 2 * prismBaseArea + triangularPrismPerimeter * 2,
    volume: prismBaseArea * 2,
  },
};

const squarePyramid: SolidDefinition = {
  id: 'square-pyramid',
  nameKo: '정사각뿔',
  nameEn: 'Square pyramid',
  descriptionKo:
    '밑면이 한 변 2인 정사각형이고 높이가 2인 정사각뿔이에요. 네 옆면은 모두 합동인 이등변삼각형이에요.',
  vertices: [
    { x: -1, y: -1, z: -1 },
    { x: 1, y: -1, z: -1 },
    { x: 1, y: -1, z: 1 },
    { x: -1, y: -1, z: 1 },
    { x: 0, y: 1, z: 0 },
  ],
  faces: [
    face('base', [0, 1, 2, 3], '밑면', palette.gold),
    face('side-back', [0, 4, 1], '옆면 1', palette.sky),
    face('side-right', [1, 4, 2], '옆면 2', palette.teal),
    face('side-front', [2, 4, 3], '옆면 3', palette.coral),
    face('side-left', [3, 4, 0], '옆면 4', palette.olive),
  ],
  rootFaceId: 'base',
  netLayouts: [],
  formulas: {
    surfaceArea: '겉넓이 = 밑넓이 + 4 × (삼각형 넓이)',
    surfaceAreaSub: `4 + 4 × (½ × 2 × √5) = 4 + 4√5 ≈ 12.94`,
    volume: '부피 = ⅓ × 밑넓이 × 높이',
    volumeSub: '⅓ × 4 × 2 = 2.67',
  },
  measures: {
    surfaceArea: 4 + 4 * SQRT5,
    volume: 8 / 3,
  },
};

const tetraBaseY = -SQRT6 / 6;
const tetraApexY = SQRT6 / 2;
const tetraBaseRadius = (2 * SQRT3) / 3;
const tetraBaseZ = -SQRT3 / 3;

const tetrahedron: SolidDefinition = {
  id: 'tetrahedron',
  nameKo: '정사면체',
  nameEn: 'Regular tetrahedron',
  descriptionKo: '모서리의 길이가 모두 2인 정사면체예요. 네 면이 모두 합동인 정삼각형이에요.',
  vertices: [
    { x: 0, y: tetraBaseY, z: tetraBaseRadius },
    { x: -1, y: tetraBaseY, z: tetraBaseZ },
    { x: 1, y: tetraBaseY, z: tetraBaseZ },
    { x: 0, y: tetraApexY, z: 0 },
  ],
  faces: [
    face('base', [0, 1, 2], '밑면', palette.gold),
    face('side-left', [0, 3, 1], '옆면 1', palette.sky),
    face('side-back', [1, 3, 2], '옆면 2', palette.teal),
    face('side-right', [2, 3, 0], '옆면 3', palette.coral),
  ],
  rootFaceId: 'base',
  netLayouts: [],
  formulas: {
    surfaceArea: '겉넓이 = √3 × a²',
    surfaceAreaSub: '√3 × 2² = 4√3 ≈ 6.93',
    volume: '부피 = a³ ÷ (6√2)',
    volumeSub: '2³ ÷ (6√2) = 0.94',
  },
  measures: {
    surfaceArea: 4 * SQRT3,
    volume: (2 * Math.sqrt(2)) / 3,
  },
};

export const SOLIDS: SolidDefinition[] = [cube, prism, triangularPrism, squarePyramid, tetrahedron];

export const SOLID_BY_ID = new Map(SOLIDS.map((solid) => [solid.id, solid]));

export function getSolid(id: string): SolidDefinition {
  return SOLID_BY_ID.get(id) ?? cube;
}

for (const solid of SOLIDS) {
  solid.netLayouts = generateNetsForSolid(solid);
}

export function solidById(id: string): SolidDefinition {
  return getSolid(id);
}

export function faceById(solid: SolidDefinition, faceId: string): Face | undefined {
  return solid.faces.find((item) => item.id === faceId);
}

export function formatVertex(vertex: Vec3): string {
  return `(${vertex.x.toFixed(2)}, ${vertex.y.toFixed(2)}, ${vertex.z.toFixed(2)})`;
}
