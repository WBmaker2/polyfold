import { computeCrossSection, normalizePlane } from '../geometry/crossSection';
import { buildFoldRig, foldTransforms } from '../geometry/folding';
import { measureSolid, type SolidMeasurements } from '../geometry/measure';
import { netById } from '../geometry/nets';
import { getSolid } from '../geometry/solids';
import type {
  CrossSection,
  FoldRig,
  NetLayout,
  PlaneDefinition,
  SolidDefinition,
  Transform,
} from '../geometry/types';
import type { AppState } from './state';

export interface ViewModel {
  solid: SolidDefinition;
  layout: NetLayout;
  layoutValid: boolean;
  rig: FoldRig;
  foldTransforms: Map<string, Transform>;
  crossSection: CrossSection | null;
  sectionPlane: PlaneDefinition | null;
  measures: SolidMeasurements;
  sectionRange: [number, number];
}

const rigCache = new Map<string, FoldRig>();
const measureCache = new Map<string, SolidMeasurements>();
const crossSectionCache = new Map<string, CrossSection | null>();

export function sectionRange(
  solid: SolidDefinition,
  normal: { x: number; y: number; z: number },
): [number, number] {
  const normalized = normalizePlane({ normal, offset: 0 });
  const n = normalized.normal;
  let min = Infinity;
  let max = -Infinity;
  for (const vertex of solid.vertices) {
    const value = n.x * vertex.x + n.y * vertex.y + n.z * vertex.z;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return [min, max];
}

function crossSectionFor(solid: SolidDefinition, plane: PlaneDefinition): CrossSection | null {
  const key = `${solid.id}:${plane.normal.x.toFixed(6)}:${plane.normal.y.toFixed(6)}:${plane.normal.z.toFixed(6)}:${plane.offset.toFixed(6)}`;
  if (crossSectionCache.has(key)) return crossSectionCache.get(key) ?? null;
  const section = computeCrossSection(solid, plane);
  crossSectionCache.set(key, section);
  return section;
}

export function buildViewModel(state: AppState): ViewModel {
  const solid = getSolid(state.solidId);
  const layout = netById(solid, state.netId);
  const rigKey = `${solid.id}:${layout.id}`;
  let rig = rigCache.get(rigKey);
  if (!rig) {
    try {
      rig = buildFoldRig(solid, layout);
      rigCache.set(rigKey, rig);
    } catch {
      rig = buildFoldRig(solid, solid.netLayouts[0]!);
      rigCache.set(rigKey, rig);
    }
  }
  let measures = measureCache.get(solid.id);
  if (!measures) {
    measures = measureSolid(solid);
    measureCache.set(solid.id, measures);
  }
  const sectionPlane = state.section.enabled
    ? normalizePlane({ normal: state.section.normal, offset: state.section.offset })
    : null;
  const crossSection = sectionPlane ? crossSectionFor(solid, sectionPlane) : null;
  return {
    solid,
    layout,
    layoutValid: layout.valid,
    rig,
    foldTransforms: foldTransforms(rig, state.foldT),
    crossSection,
    sectionPlane,
    measures,
    sectionRange: sectionRange(solid, state.section.normal),
  };
}
