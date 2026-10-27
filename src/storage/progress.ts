export const PROGRESS_KEY = 'polyfold.progress.v1';

export interface StoredProgress {
  version: 1;
  answers: Record<string, string>;
  stars: Record<string, number>;
  wrongAttempts: Record<string, number>;
  lastSolidId?: string;
  preferences: {
    reducedMotion: boolean;
    showFormulas: boolean;
  };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function loadProgress(): StoredProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredProgress>;
    if (parsed.version !== 1) {
      localStorage.removeItem(PROGRESS_KEY);
      console.warn('PolyFold: 알 수 없는 저장 버전이라 진행 상황을 초기화했어요.');
      return null;
    }
    return {
      version: 1,
      answers: parsed.answers ?? {},
      stars: parsed.stars ?? {},
      wrongAttempts: parsed.wrongAttempts ?? {},
      lastSolidId: parsed.lastSolidId,
      preferences: {
        reducedMotion: parsed.preferences?.reducedMotion ?? false,
        showFormulas: parsed.preferences?.showFormulas ?? true,
      },
    };
  } catch {
    return null;
  }
}

export function saveProgress(progress: StoredProgress): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch {
      console.warn('PolyFold: 진행 상황을 저장하지 못했어요.');
    }
  }, 120);
}

export function saveProgressNow(progress: StoredProgress): void {
  if (saveTimer) clearTimeout(saveTimer);
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    console.warn('PolyFold: 진행 상황을 저장하지 못했어요.');
  }
}

export function clearProgress(): void {
  if (saveTimer) clearTimeout(saveTimer);
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    console.warn('PolyFold: 진행 상황을 지우지 못했어요.');
  }
}
