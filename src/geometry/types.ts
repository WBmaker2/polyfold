export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Transform {
  q: Quat;
  t: Vec3;
}

export interface Face {
  id: string;
  vertexIndices: number[];
  label: string;
  color: string;
}

export interface NetHinge {
  parentFaceId: string;
  edge: [Vec2, Vec2];
}

export interface NetFace {
  faceId: string;
  polygon: Vec2[];
  hinge?: NetHinge;
}

export type NetInvalidReason =
  | 'overlap'
  | 'missing-face'
  | 'duplicate-face'
  | 'disconnected'
  | 'bad-hinge'
  | 'area-mismatch'
  | 'none';

export interface NetLayout {
  id: string;
  solidId: string;
  valid: boolean;
  faces: NetFace[];
  noteKo?: string;
  invalidReason?: NetInvalidReason;
  index?: number;
}

export interface SolidFormulas {
  surfaceArea: string;
  surfaceAreaSub: string;
  volume: string;
  volumeSub: string;
}

export interface SolidMeasures {
  surfaceArea: number;
  volume: number;
}

export interface SolidDefinition {
  id: string;
  nameKo: string;
  nameEn: string;
  vertices: Vec3[];
  faces: Face[];
  netLayouts: NetLayout[];
  rootFaceId: string;
  formulas: SolidFormulas;
  measures: SolidMeasures;
  descriptionKo: string;
}

export interface PlaneDefinition {
  normal: Vec3;
  offset: number;
}

export interface PlaneBasis {
  u: Vec3;
  v: Vec3;
}

export interface CrossSection {
  points3D: Vec3[];
  points2D: Vec2[];
  normal: Vec3;
  offset: number;
  basis: PlaneBasis;
  sides: number;
  shapeNameKo: string;
  area: number;
  perimeter: number;
}

export interface FoldHinge {
  point: Vec3;
  axis: Vec3;
  angle: number;
}

export interface FoldNode {
  faceId: string;
  parentFaceId: string | null;
  hinge: FoldHinge | null;
  children: string[];
}

export interface FoldRig {
  solid: SolidDefinition;
  rootId: string;
  nodes: Map<string, FoldNode>;
  order: string[];
  embedding: Transform;
}

export interface NetValidation {
  valid: boolean;
  reason: NetInvalidReason;
  messageKo: string;
}

export type ChallengeType = 'valid-net' | 'identify-solid' | 'cross-section' | 'measure';

export interface ChallengeSection {
  normal: Vec3;
  offset: number;
  labelKo?: string;
}

export interface Challenge {
  id: string;
  type: ChallengeType;
  solidId: string;
  netId?: string;
  section?: ChallengeSection;
  promptKo: string;
  hintKo?: string;
  options: string[];
  optionNetIds?: string[];
  answer: string;
  explanationKo: string;
  difficulty: 1 | 2 | 3;
}

export type Route = 'explore' | 'challenge' | 'teacher';
export type ViewMode = '3d' | 'net';
export type ChallengeSetFilter = 'all' | 'basic' | 'advanced';
export type MobileTab = 'fold' | 'slice' | 'measure' | 'challenge';
