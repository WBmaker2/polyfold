import { getSolid } from '../geometry/solids';
import { validNets } from '../geometry/nets';
import { CHALLENGES } from '../data/challenges';
import { loadProgress, type StoredProgress } from '../storage/progress';
import type {
  ChallengeSetFilter,
  FoldSpeed,
  MobileTab,
  Route,
  Vec3,
  ViewMode,
} from '../geometry/types';

export interface SectionState {
  enabled: boolean;
  normal: Vec3;
  offset: number;
}

export interface PreferencesState {
  reducedMotion: boolean;
  showFormulas: boolean;
  foldSpeed: FoldSpeed;
}

export interface TeacherState {
  filter: ChallengeSetFilter;
  showAnswers: boolean;
}

export interface AppState {
  route: Route;
  solidId: string;
  netId: string;
  viewMode: ViewMode;
  foldT: number;
  playing: boolean;
  section: SectionState;
  selectedFaceId: string | null;
  challengeIndex: number;
  answerDraft: string | null;
  revealed: boolean;
  hintVisible: boolean;
  feedbackKo: string;
  feedbackTone: 'idle' | 'good' | 'bad' | 'info';
  answers: Record<string, string>;
  stars: Record<string, number>;
  wrongAttempts: Record<string, number>;
  preferences: PreferencesState;
  teacher: TeacherState;
  mobileTab: MobileTab;
}

type Listener = (state: AppState, previous: AppState) => void;

const listeners = new Set<Listener>();
let state: AppState = createInitialState();

function validRoute(value: string): Route {
  return value === 'challenge' || value === 'teacher' ? value : 'explore';
}

export function routeFromHash(): Route {
  return validRoute(window.location.hash.replace('#', ''));
}

function resolveStoredSolid(stored: StoredProgress | null): string {
  const candidate = stored?.lastSolidId ?? 'cube';
  return getSolid(candidate).id;
}

function initialSection(): SectionState {
  return { enabled: false, normal: { x: 0, y: 1, z: 0 }, offset: 0 };
}

export function createInitialState(): AppState {
  const stored = loadProgress();
  const reducedMotion =
    stored?.preferences.reducedMotion ??
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const solid = getSolid(resolveStoredSolid(stored));
  const net = validNets(solid)[0] ?? solid.netLayouts[0]!;
  const firstUnfinished = CHALLENGES.findIndex((challenge) => !stored?.answers[challenge.id]);
  return {
    route: routeFromHash(),
    solidId: solid.id,
    netId: net.id,
    viewMode: '3d',
    foldT: 1,
    playing: false,
    section: initialSection(),
    selectedFaceId: null,
    challengeIndex: firstUnfinished >= 0 ? firstUnfinished : 0,
    answerDraft: null,
    revealed: false,
    hintVisible: false,
    feedbackKo: '',
    feedbackTone: 'idle',
    answers: stored?.answers ?? {},
    stars: stored?.stars ?? {},
    wrongAttempts: stored?.wrongAttempts ?? {},
    preferences: {
      reducedMotion,
      showFormulas: stored?.preferences.showFormulas ?? true,
      foldSpeed: stored?.preferences.foldSpeed ?? 'normal',
    },
    teacher: { filter: 'all', showAnswers: false },
    mobileTab: 'fold',
  };
}

export function getState(): AppState {
  return state;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setState(
  update: Partial<AppState> | ((current: AppState) => Partial<AppState>),
): void {
  const previous = state;
  const patch = typeof update === 'function' ? update(previous) : update;
  state = { ...previous, ...patch };
  for (const listener of listeners) listener(state, previous);
}

export function notifyInitial(): void {
  for (const listener of listeners) listener(state, state);
}

export function toStoredProgress(current: AppState): StoredProgress {
  return {
    version: 1,
    answers: current.answers,
    stars: current.stars,
    wrongAttempts: current.wrongAttempts,
    lastSolidId: current.solidId,
    preferences: current.preferences,
  };
}
