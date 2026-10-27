import { CHALLENGES } from '../data/challenges';
import { normalizePlane } from '../geometry/crossSection';
import { validNets } from '../geometry/nets';
import { getSolid } from '../geometry/solids';
import { faceById } from '../geometry/solids';
import type { ChallengeSetFilter, MobileTab, Route, Vec3, ViewMode } from '../geometry/types';
import { ExplorePanel } from '../features/explore/ExplorePanel';
import { ChallengePanel } from '../features/challenge/ChallengePanel';
import { TeacherPanel } from '../features/teacher/TeacherPanel';
import { Stage } from '../render/Stage';
import { clearProgress, saveProgress, saveProgressNow } from '../storage/progress';
import { h } from '../ui/components/dom';
import {
  getState,
  routeFromHash,
  setState,
  subscribe,
  toStoredProgress,
  type AppState,
} from './state';
import { buildViewModel, sectionRange } from './viewModel';

const FOLD_DURATION = 1500;

export class App {
  private readonly leftHost: HTMLElement;
  private readonly rightHost: HTMLElement;
  private readonly stage: Stage;
  private readonly navLinks: HTMLAnchorElement[] = [];
  private readonly announcer: HTMLElement | null;
  private explorePanel: ExplorePanel | null = null;
  private challengePanel: ChallengePanel | null = null;
  private teacherPanel: TeacherPanel | null = null;
  private mountedRoute: Route | null = null;
  private foldRaf: number | null = null;
  private announceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly root: HTMLElement) {
    this.announcer = document.getElementById('announcer');
    const shell = h('div', 'app-shell');
    const skip = h('a', 'skip-link', '본문으로 건너뛰기');
    skip.href = '#main-content';

    const header = h('header', 'app-header');
    const brand = h('a', 'brand');
    brand.href = '#explore';
    const mark = h('span', 'brand-mark');
    mark.innerHTML = `<svg viewBox="0 0 44 44" aria-hidden="true" focusable="false">
      <path d="M22 3 39 12.5v19L22 41 5 31.5v-19L22 3Z" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".45"/>
      <path d="M22 3 39 12.5 22 22 5 12.5 22 3Z" fill="currentColor" opacity=".95"/>
      <path d="M5 12.5v19L22 41V22L5 12.5Z" fill="currentColor" opacity=".55"/>
      <path d="M39 12.5v19L22 41V22l17-9.5Z" fill="currentColor" opacity=".28"/>
    </svg>`;
    const brandText = h('span', 'brand-text');
    brandText.append(
      h('h1', 'brand-name', 'PolyFold'),
      h('span', 'brand-tagline', '접고, 자르고, 발견하는 입체도형'),
    );
    brand.append(mark, brandText);

    const nav = h('nav', 'main-nav');
    nav.setAttribute('aria-label', '주요 화면');
    const routes: { route: Route; label: string }[] = [
      { route: 'explore', label: '탐구' },
      { route: 'challenge', label: '도전' },
      { route: 'teacher', label: '교사' },
    ];
    for (const item of routes) {
      const link = h('a', 'nav-link', item.label);
      link.href = `#${item.route}`;
      link.dataset.route = item.route;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        this.go(item.route);
      });
      this.navLinks.push(link);
      nav.append(link);
    }
    const ageChip = h('span', 'header-chip', '초5–중2 · 수학');
    header.append(brand, nav, ageChip);

    const main = h('main', 'app-main');
    main.id = 'main-content';
    main.tabIndex = -1;
    this.leftHost = h('aside', 'panel panel-left');
    this.leftHost.setAttribute('aria-label', '탐구 목록');
    this.leftHost.tabIndex = 0;
    const stageHost = h('section', 'stage');
    stageHost.setAttribute('aria-label', '입체 도형 무대');
    this.rightHost = h('aside', 'panel panel-right');
    this.rightHost.setAttribute('aria-label', '탐구 도구');
    this.rightHost.tabIndex = 0;
    main.append(this.leftHost, stageHost, this.rightHost);
    skip.addEventListener('click', (event) => {
      event.preventDefault();
      main.scrollIntoView({ block: 'start' });
      main.focus();
    });

    shell.append(skip, header, main);
    this.root.append(shell);

    brand.addEventListener('click', (event) => {
      event.preventDefault();
      this.go('explore');
    });

    this.stage = new Stage(stageHost, {
      onViewMode: (mode) => this.setViewMode(mode),
      onTogglePlay: () => this.togglePlay(),
      onFaceSelect: (faceId) => this.selectFace(faceId),
    });

    if (getState().route === 'challenge') {
      this.applyChallenge(getState().challengeIndex);
    }
    history.replaceState(null, '', `#${getState().route}`);

    subscribe((state, previous) => this.handleState(state, previous));
    window.addEventListener('hashchange', this.handleHashChange);
    this.handleState(getState(), getState());
  }

  private handleState = (state: AppState, previous: AppState): void => {
    if (
      state.answers !== previous.answers ||
      state.stars !== previous.stars ||
      state.wrongAttempts !== previous.wrongAttempts
    ) {
      saveProgressNow(toStoredProgress(state));
    } else if (state.solidId !== previous.solidId || state.preferences !== previous.preferences) {
      saveProgress(toStoredProgress(state));
    }
    this.render(state);
  };

  private render(state: AppState): void {
    document.documentElement.classList.toggle('reduce-motion', state.preferences.reducedMotion);
    document.body.dataset.route = state.route;
    document.title =
      state.route === 'challenge'
        ? `도전 ${state.challengeIndex + 1} · PolyFold`
        : state.route === 'teacher'
          ? '교사 도구 · PolyFold'
          : 'PolyFold — 입체도형 탐구';
    for (const link of this.navLinks) {
      const active = link.dataset.route === state.route;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }

    if (this.mountedRoute !== state.route) {
      this.mountedRoute = state.route;
      this.mountPanels(state);
    }

    const viewModel = buildViewModel(state);
    this.stage.update(state, viewModel);
    if (state.route === 'explore') this.explorePanel?.update(state, viewModel);
    else if (state.route === 'challenge') this.challengePanel?.update(state);
    else this.teacherPanel?.update(state);
  }

  private mountPanels(state: AppState): void {
    this.leftHost.replaceChildren();
    this.rightHost.replaceChildren();
    this.explorePanel = null;
    this.challengePanel = null;
    this.teacherPanel = null;
    if (state.route === 'explore') {
      this.leftHost.setAttribute('aria-label', '입체 갤러리');
      this.rightHost.setAttribute('aria-label', '탐구 도구');
      this.explorePanel = new ExplorePanel(this.leftHost, this.rightHost, {
        onSelectSolid: (solidId) => this.selectSolid(solidId),
        onSelectNet: (netId) => this.selectNet(netId),
        onFold: (value) => this.setFold(value),
        onTogglePlay: () => this.togglePlay(),
        onResetFold: () => this.resetFold(),
        onFaceSelect: (faceId) => this.selectFace(faceId),
        onSectionEnabled: (enabled) => this.setSectionEnabled(enabled),
        onSectionNormal: (normal) => this.setSectionNormal(normal),
        onSectionOffset: (offset) => this.setSectionOffset(offset),
        onReducedMotion: (value) => this.setReducedMotion(value),
        onShowFormulas: (value) => this.setShowFormulas(value),
        onMobileTab: (tab) => this.setMobileTab(tab),
        onOpenChallenge: () => this.openChallenge(),
        onStartChallenge: (index) => this.startChallenge(index),
      });
    } else if (state.route === 'challenge') {
      this.leftHost.setAttribute('aria-label', '도전 목록');
      this.rightHost.setAttribute('aria-label', '도전 문제');
      this.challengePanel = new ChallengePanel(this.leftHost, this.rightHost, {
        onSelectChallenge: (index) => this.startChallenge(index),
        onDraft: (answer) => this.setDraft(answer),
        onSubmit: () => this.submitAnswer(),
        onNext: () => this.nextChallenge(),
        onPrev: () => this.prevChallenge(),
        onToggleHint: () => this.toggleHint(),
        onExplore: () => this.openSandbox(),
      });
    } else {
      this.leftHost.setAttribute('aria-label', '교사 설정');
      this.rightHost.setAttribute('aria-label', '정답 키');
      this.teacherPanel = new TeacherPanel(this.leftHost, this.rightHost, {
        onFilter: (filter) => this.setTeacherFilter(filter),
        onShowAnswers: (value) => this.setTeacherShowAnswers(value),
        onReset: () => this.resetProgress(),
        onAnnounce: (message) => this.announce(message),
      });
    }
  }

  private go(route: Route): void {
    if (route !== getState().route) {
      history.pushState(null, '', `#${route}`);
      setState((current) => ({
        route,
        playing: false,
        mobileTab: 'fold' as MobileTab,
        answerDraft:
          route === 'challenge'
            ? (current.answers[CHALLENGES[current.challengeIndex]?.id ?? ''] ?? null)
            : current.answerDraft,
        revealed:
          route === 'challenge'
            ? Boolean(current.answers[CHALLENGES[current.challengeIndex]?.id ?? ''])
            : current.revealed,
      }));
      if (route === 'challenge') {
        this.applyChallenge(getState().challengeIndex);
      }
      this.announce(
        route === 'explore'
          ? '탐구 화면으로 이동했어요.'
          : route === 'challenge'
            ? '도전 화면으로 이동했어요.'
            : '교사 도구 화면으로 이동했어요.',
      );
      window.scrollTo({
        top: 0,
        behavior: getState().preferences.reducedMotion ? 'auto' : 'smooth',
      });
    }
  }

  private handleHashChange = (): void => {
    const route = routeFromHash();
    if (route === getState().route) return;
    setState({ route, playing: false, mobileTab: 'fold' });
    if (route === 'challenge') this.applyChallenge(getState().challengeIndex);
  };

  private selectSolid(solidId: string): void {
    const solid = getSolid(solidId);
    const net = validNets(solid)[0] ?? solid.netLayouts[0]!;
    this.stopFold();
    setState((state) => {
      const normalized = normalizePlane({
        normal: state.section.normal,
        offset: state.section.offset,
      });
      const [min, max] = sectionRange(solid, normalized.normal);
      return {
        solidId: solid.id,
        netId: net.id,
        foldT: 1,
        playing: false,
        selectedFaceId: null,
        section: {
          ...state.section,
          normal: normalized.normal,
          offset: Math.min(max, Math.max(min, normalized.offset)),
        },
      };
    });
    this.announce(`${solid.nameKo}을(를) 선택했어요.`);
  }

  private selectNet(netId: string): void {
    const state = getState();
    const solid = getSolid(state.solidId);
    const layout = solid.netLayouts.find((item) => item.id === netId);
    if (!layout) return;
    this.stopFold();
    setState({
      netId,
      foldT: 0,
      viewMode: 'net',
      playing: false,
      selectedFaceId: null,
    });
    this.announce(
      layout.valid
        ? `${solid.nameKo} ${layout.index !== undefined ? layout.index + 1 : ''}번 전개도를 선택했어요. 접을 수 있어요.`
        : '접을 수 없는 전개도를 선택했어요. 이유를 확인해 보세요.',
    );
  }

  private setFold(value: number): void {
    this.stopFold();
    const next = Math.min(1, Math.max(0, value));
    setState((state) => ({
      foldT: next,
      playing: false,
      viewMode: next > 0.001 ? '3d' : state.viewMode,
    }));
  }

  private resetFold(): void {
    this.stopFold();
    setState({ foldT: 1, playing: false });
    this.announce('입체를 다시 세웠어요.');
  }

  private togglePlay(): void {
    const state = getState();
    if (state.preferences.reducedMotion) {
      this.stopFold();
      setState({
        viewMode: '3d',
        foldT: state.foldT >= 0.999 ? 0 : 1,
        playing: false,
      });
      this.announce('애니메이션 줄이기가 켜져 있어 바로 접었어요.');
      return;
    }
    if (state.playing) {
      this.stopFold();
      return;
    }
    this.startFold();
  }

  private startFold(): void {
    this.stopFold();
    const state = getState();
    const from = state.viewMode === 'net' || state.foldT >= 0.999 ? 0 : state.foldT;
    const start = performance.now();
    setState({ playing: true, viewMode: '3d', foldT: from });
    const tick = (now: number) => {
      const next = Math.min(1, from + (now - start) / FOLD_DURATION);
      setState({ foldT: next });
      if (next < 1) {
        this.foldRaf = requestAnimationFrame(tick);
      } else {
        this.foldRaf = null;
        setState({ playing: false, foldT: 1 });
      }
    };
    this.foldRaf = requestAnimationFrame(tick);
  }

  private stopFold(): void {
    if (this.foldRaf !== null) {
      cancelAnimationFrame(this.foldRaf);
      this.foldRaf = null;
    }
    if (getState().playing) setState({ playing: false });
  }

  private selectFace(faceId: string | null): void {
    setState({ selectedFaceId: faceId });
    if (faceId) {
      const face = faceById(getSolid(getState().solidId), faceId);
      if (face) this.announce(`${face.label} 면을 선택했어요.`);
    }
  }

  private setViewMode(mode: ViewMode): void {
    const state = getState();
    if (state.route === 'challenge' && !state.revealed) return;
    this.stopFold();
    setState({
      viewMode: mode,
      foldT: mode === 'net' ? 0 : 1,
      playing: false,
    });
    this.announce(mode === 'net' ? '평면 전개도 보기로 바꿨어요.' : '3D 입체 보기로 바꿨어요.');
  }

  private setSectionEnabled(enabled: boolean): void {
    const state = getState();
    const solid = getSolid(state.solidId);
    const [min, max] = sectionRange(solid, state.section.normal);
    this.stopFold();
    setState({
      viewMode: enabled ? '3d' : state.viewMode,
      foldT: enabled ? 1 : state.foldT,
      section: {
        ...state.section,
        enabled,
        offset: Math.min(max, Math.max(min, state.section.offset)),
      },
    });
    if (enabled) this.announce(this.sectionAnnouncement());
  }

  private setSectionNormal(normal: Vec3): void {
    const normalized = normalizePlane({ normal, offset: 0 });
    const state = getState();
    const solid = getSolid(state.solidId);
    const [min, max] = sectionRange(solid, normalized.normal);
    this.stopFold();
    setState({
      viewMode: '3d',
      foldT: 1,
      section: {
        enabled: true,
        normal: normalized.normal,
        offset: Math.min(max, Math.max(min, 0)),
      },
    });
    this.announce('절단면 방향을 바꿨어요.');
  }

  private setSectionOffset(offset: number): void {
    setState((state) => ({ section: { ...state.section, offset } }));
  }

  private setReducedMotion(value: boolean): void {
    if (value) this.stopFold();
    setState((state) => ({
      preferences: { ...state.preferences, reducedMotion: value },
      playing: value ? false : state.playing,
    }));
    this.announce(value ? '애니메이션 줄이기를 켰어요.' : '애니메이션 줄이기를 껐어요.');
  }

  private setShowFormulas(value: boolean): void {
    setState((state) => ({
      preferences: { ...state.preferences, showFormulas: value },
    }));
  }

  private setMobileTab(tab: MobileTab): void {
    setState({ mobileTab: tab });
  }

  private openChallenge(): void {
    const next = CHALLENGES.findIndex((challenge) => !getState().answers[challenge.id]);
    this.startChallenge(next >= 0 ? next : 0);
  }

  private startChallenge(index: number): void {
    const clamped = Math.min(CHALLENGES.length - 1, Math.max(0, index));
    if (getState().route !== 'challenge') {
      history.pushState(null, '', '#challenge');
      setState({ route: 'challenge', mobileTab: 'fold', playing: false });
    }
    this.applyChallenge(clamped);
    window.scrollTo({ top: 0, behavior: 'auto' });
    this.announce(`${clamped + 1}번 도전을 열었어요.`);
  }

  private applyChallenge(index: number): void {
    const challenge = CHALLENGES[index] ?? CHALLENGES[0]!;
    const solid = getSolid(challenge.solidId);
    const fallbackNet = validNets(solid)[0] ?? solid.netLayouts[0]!;
    const netId = challenge.netId ?? fallbackNet.id;
    const section = challenge.section
      ? normalizePlane({ normal: challenge.section.normal, offset: challenge.section.offset })
      : null;
    const answer = getState().answers[challenge.id] ?? null;
    const revealed = Boolean(answer);
    const isNetChallenge = challenge.type === 'valid-net' || challenge.type === 'identify-solid';
    this.stopFold();
    setState((state) => ({
      route: 'challenge',
      challengeIndex: index,
      solidId: solid.id,
      netId,
      viewMode: isNetChallenge ? 'net' : '3d',
      foldT: isNetChallenge ? 0 : 1,
      playing: false,
      selectedFaceId: null,
      section: section
        ? { enabled: true, normal: section.normal, offset: section.offset }
        : { enabled: false, normal: state.section.normal, offset: state.section.offset },
      answerDraft: answer,
      revealed,
      hintVisible: false,
      feedbackKo: revealed
        ? (state.stars[challenge.id] ?? 0) > 0
          ? '이미 완료한 문제예요. 해설을 다시 확인해 보세요.'
          : '정답을 확인했던 문제예요. 해설을 다시 볼 수 있어요.'
        : '',
      feedbackTone: revealed ? 'good' : 'idle',
    }));
  }

  private setDraft(answer: string): void {
    if (getState().revealed) return;
    setState({ answerDraft: answer, feedbackKo: '', feedbackTone: 'idle' });
  }

  private submitAnswer(): void {
    const state = getState();
    const challenge = CHALLENGES[state.challengeIndex];
    if (!challenge || !state.answerDraft || state.revealed) return;
    const correct = state.answerDraft === challenge.answer;
    if (correct) {
      const attempts = state.wrongAttempts[challenge.id] ?? 0;
      const stars = attempts === 0 ? 3 : attempts === 1 ? 2 : 1;
      setState({
        answers: { ...state.answers, [challenge.id]: state.answerDraft },
        stars: { ...state.stars, [challenge.id]: stars },
        revealed: true,
        feedbackKo:
          attempts === 0
            ? '정답이에요! 첫 시도에 맞혔어요. 별 3개를 받았어요.'
            : '정답이에요! 해설을 읽고 다시 확인해 보세요.',
        feedbackTone: 'good',
      });
      this.challengePanel?.focusExplanation();
      return;
    }
    const attempts = (state.wrongAttempts[challenge.id] ?? 0) + 1;
    if (attempts >= 2) {
      setState({
        wrongAttempts: { ...state.wrongAttempts, [challenge.id]: attempts },
        answers: { ...state.answers, [challenge.id]: state.answerDraft },
        stars: { ...state.stars, [challenge.id]: 0 },
        revealed: true,
        feedbackKo: '두 번 도전했어요. 정답과 해설을 확인해 보세요.',
        feedbackTone: 'info',
      });
      this.challengePanel?.focusExplanation();
    } else {
      setState({
        wrongAttempts: { ...state.wrongAttempts, [challenge.id]: attempts },
        feedbackKo: '아직 정답이 아니에요. 힌트를 보고 한 번 더 생각해 보세요.',
        feedbackTone: 'bad',
      });
    }
  }

  private nextChallenge(): void {
    const next = (getState().challengeIndex + 1) % CHALLENGES.length;
    this.applyChallenge(next);
    this.challengePanel?.focusPrompt();
    this.announce(`${next + 1}번 문제로 이동했어요.`);
  }

  private prevChallenge(): void {
    const prev = (getState().challengeIndex - 1 + CHALLENGES.length) % CHALLENGES.length;
    this.applyChallenge(prev);
    this.challengePanel?.focusPrompt();
    this.announce(`${prev + 1}번 문제로 이동했어요.`);
  }

  private toggleHint(): void {
    setState((state) => ({ hintVisible: !state.hintVisible }));
  }

  private openSandbox(): void {
    const state = getState();
    setState({
      route: 'explore',
      playing: false,
      mobileTab: 'slice',
      feedbackKo: '',
      feedbackTone: 'idle',
    });
    history.pushState(null, '', '#explore');
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (state.section.enabled) this.announce('탐구 화면에서 단면을 직접 움직여 확인해 보세요.');
    else this.announce('탐구 화면에서 입체를 직접 조작해 확인해 보세요.');
  }

  private setTeacherFilter(filter: ChallengeSetFilter): void {
    setState((state) => ({ teacher: { ...state.teacher, filter } }));
  }

  private setTeacherShowAnswers(value: boolean): void {
    setState((state) => ({ teacher: { ...state.teacher, showAnswers: value } }));
  }

  private resetProgress(): void {
    clearProgress();
    setState({
      answers: {},
      stars: {},
      wrongAttempts: {},
      challengeIndex: 0,
      answerDraft: null,
      revealed: false,
      hintVisible: false,
      feedbackKo: '진행 상황을 모두 초기화했어요.',
      feedbackTone: 'info',
    });
    if (getState().route === 'challenge') this.applyChallenge(0);
    this.announce('학생 진행 상황을 모두 초기화했어요.');
  }

  private sectionAnnouncement(): string {
    const state = getState();
    const viewModel = buildViewModel(state);
    if (!viewModel.crossSection) return '절단면이 입체를 지나지 않아 단면이 없어요.';
    return `단면은 ${viewModel.crossSection.shapeNameKo}이고 넓이는 ${viewModel.crossSection.area.toFixed(2)}예요.`;
  }

  private announce(message: string): void {
    if (!this.announcer) return;
    if (this.announceTimer) clearTimeout(this.announceTimer);
    this.announcer.textContent = '';
    this.announceTimer = setTimeout(() => {
      if (this.announcer) this.announcer.textContent = message;
    }, 40);
  }

  dispose(): void {
    this.stopFold();
    window.removeEventListener('hashchange', this.handleHashChange);
    this.stage.dispose();
  }
}
