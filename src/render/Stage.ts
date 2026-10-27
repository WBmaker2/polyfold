import { h, setHidden, setText } from '../ui/components/dom';
import { CHALLENGES } from '../data/challenges';
import type { ViewMode } from '../geometry/types';
import type { AppState } from '../app/state';
import type { ViewModel } from '../app/viewModel';
import { solidBoundingRadius } from '../geometry/polyhedron';
import { transformNetPoint } from '../geometry/folding';
import { smoothstep } from '../geometry/vec';
import { faceById } from '../geometry/solids';
import { formatNumber } from '../geometry/vec';
import { SceneManager } from './SceneManager';
import { SolidView } from './SolidView';
import { NetView } from './NetView';
import { SectionPlane } from './SectionPlane';
import type { CameraPreset } from './cameraModes';

export interface StageCallbacks {
  onViewMode: (mode: ViewMode) => void;
  onTogglePlay: () => void;
  onFaceSelect: (faceId: string | null) => void;
}

export class Stage {
  private readonly sceneCanvas: HTMLCanvasElement;
  private readonly netCanvas: HTMLCanvasElement;
  private readonly stageRegion: HTMLDivElement;
  private readonly sceneManager: SceneManager;
  private readonly solidView = new SolidView();
  private readonly sectionPlane = new SectionPlane();
  private readonly netView: NetView;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly modeLabel: HTMLElement;
  private readonly faceLabel: HTMLElement;
  private readonly sectionLabel: HTMLElement;
  private readonly description: HTMLElement;
  private readonly viewButtons = new Map<ViewMode, HTMLButtonElement>();
  private readonly presetButtons: HTMLButtonElement[] = [];
  private currentSolidId: string | null = null;
  private currentLayoutId: string | null = null;
  private radius = 3;
  private netRadius = 3;
  private viewRadius = 3;
  private lastFoldT: number | null = null;
  private lastViewModel: ViewModel | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly callbacks: StageCallbacks,
  ) {
    this.stageRegion = h('div', 'stage-region');
    this.stageRegion.tabIndex = 0;
    this.stageRegion.setAttribute('role', 'region');
    this.stageRegion.setAttribute('aria-label', '3D 입체 조작 영역');
    this.stageRegion.setAttribute('aria-describedby', 'stage-description');
    this.stageRegion.setAttribute(
      'aria-keyshortcuts',
      'ArrowLeft ArrowRight ArrowUp ArrowDown + - Space',
    );

    this.sceneCanvas = h('canvas', 'scene-canvas');
    this.sceneCanvas.setAttribute('aria-hidden', 'true');
    this.netCanvas = h('canvas', 'net-canvas');
    this.netCanvas.setAttribute('aria-hidden', 'true');
    this.stageRegion.append(this.sceneCanvas, this.netCanvas);

    const toolbar = h('div', 'stage-toolbar');
    const viewGroup = h('div', 'segmented segmented-dark');
    viewGroup.setAttribute('role', 'group');
    viewGroup.setAttribute('aria-label', '보기 방식');
    const views: { mode: ViewMode; label: string }[] = [
      { mode: '3d', label: '3D 입체' },
      { mode: 'net', label: '평면 전개도' },
    ];
    for (const view of views) {
      const button = h('button', 'segmented-btn', view.label);
      button.type = 'button';
      button.addEventListener('click', () => this.callbacks.onViewMode(view.mode));
      this.viewButtons.set(view.mode, button);
      viewGroup.append(button);
    }
    toolbar.append(viewGroup);

    const presetGroup = h('div', 'preset-group');
    presetGroup.setAttribute('role', 'group');
    presetGroup.setAttribute('aria-label', '카메라 시점');
    const presets: { preset: CameraPreset; label: string }[] = [
      { preset: 'orbit', label: '기본' },
      { preset: 'top', label: '위' },
      { preset: 'front', label: '정면' },
    ];
    for (const item of presets) {
      const button = h('button', 'preset-btn', item.label);
      button.type = 'button';
      button.title = `${item.label} 시점으로 보기`;
      button.addEventListener('click', () => {
        this.sceneManager.frame(this.viewRadius || this.radius, item.preset);
        this.markPreset(button);
      });
      this.presetButtons.push(button);
      presetGroup.append(button);
    }
    toolbar.append(presetGroup);

    const badges = h('div', 'stage-badges');
    const titleWrap = h('div', 'stage-title-wrap');
    this.title = h('h2', 'stage-title');
    this.subtitle = h('p', 'stage-subtitle');
    titleWrap.append(this.title, this.subtitle);
    this.modeLabel = h('span', 'stage-chip');
    badges.append(titleWrap, this.modeLabel);

    const lower = h('div', 'stage-lower');
    this.faceLabel = h('p', 'stage-face-label');
    this.sectionLabel = h('p', 'stage-section-label');
    const hint = h(
      'p',
      'stage-hint',
      '드래그로 돌리기 · 스크롤로 확대 · 면을 눌러 확인 · Space로 접기',
    );
    const lowerLeft = h('div', 'stage-lower-left');
    lowerLeft.append(this.faceLabel, this.sectionLabel);
    lower.append(lowerLeft, hint);

    this.description = h('p', 'sr-only');
    this.description.id = 'stage-description';

    this.host.append(this.stageRegion, toolbar, badges, lower, this.description);

    this.sceneManager = new SceneManager(this.sceneCanvas);
    this.sceneManager.scene.add(this.solidView.group, this.sectionPlane.group);
    this.sceneManager.setPickRoot(this.solidView.group);
    this.sceneManager.setPickHandler((faceId) => this.callbacks.onFaceSelect(faceId));
    this.netView = new NetView(this.netCanvas, (faceId) => this.callbacks.onFaceSelect(faceId));

    this.stageRegion.addEventListener('keydown', this.handleKeyDown);
  }

  update(state: AppState, viewModel: ViewModel): void {
    this.lastViewModel = viewModel;
    const { solid, layout } = viewModel;
    const solidChanged = this.currentSolidId !== solid.id;
    const layoutChanged = this.currentLayoutId !== layout.id;
    this.radius = solidBoundingRadius(solid);
    if (solidChanged || layoutChanged) {
      this.solidView.setSolid(solid, layout);
      this.sceneManager.setPickRoot(this.solidView.group);
      this.currentSolidId = solid.id;
      this.currentLayoutId = layout.id;
      this.netRadius = Math.max(
        this.radius,
        ...layout.faces.flatMap((face) =>
          face.polygon.map((point) => {
            const world = transformNetPoint(viewModel.rig.embedding, point);
            return Math.hypot(world.x, world.y, world.z) * 1.05;
          }),
        ),
      );
      this.viewRadius = this.desiredRadius(state.foldT);
      this.sceneManager.frame(this.viewRadius, 'orbit');
      this.markPreset(this.presetButtons[0]!);
    } else if (this.lastFoldT !== state.foldT) {
      this.viewRadius = this.desiredRadius(state.foldT);
      this.sceneManager.setFrameRadius(this.viewRadius);
    }
    this.lastFoldT = state.foldT;

    this.solidView.update(viewModel.foldTransforms, state.selectedFaceId);
    this.sectionPlane.update(solid, viewModel.sectionPlane, viewModel.crossSection, {
      showPlane: state.section.enabled,
      showShape: state.route !== 'challenge' || state.revealed,
    });

    const netMode = state.viewMode === 'net';
    const viewLocked = state.route === 'challenge' && !state.revealed;
    this.host.classList.toggle('is-net-view', netMode);
    setHidden(this.netCanvas, !netMode);
    setHidden(this.sceneCanvas, netMode);
    for (const [mode, button] of this.viewButtons) {
      const active = mode === state.viewMode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
      button.disabled = viewLocked;
      button.title = viewLocked ? '답을 제출한 뒤 다른 보기로 바꿀 수 있어요.' : '';
    }
    if (netMode) {
      const note =
        !viewModel.layoutValid &&
        (state.route !== 'challenge' || state.revealed) &&
        viewModel.layout.noteKo
          ? viewModel.layout.noteKo
          : undefined;
      this.netView.render(solid, layout, state.selectedFaceId, note);
    }

    const selectedFace = state.selectedFaceId ? faceById(solid, state.selectedFaceId) : undefined;
    const concealed = this.concealsSolidName(state);
    setText(this.title, concealed ? '어떤 입체일까요?' : solid.nameKo);
    setText(
      this.subtitle,
      concealed
        ? '전개도의 단서를 살펴보세요.'
        : `${solid.nameEn} · 겉넓이 ${formatNumber(viewModel.measures.surfaceArea)} · 부피 ${formatNumber(
            viewModel.measures.volume,
          )}`,
    );
    setText(this.modeLabel, netMode ? '평면 전개도' : '3D 입체');
    setText(
      this.faceLabel,
      selectedFace
        ? `선택한 면 · ${selectedFace.label}`
        : netMode
          ? '전개도의 면을 눌러 이름을 확인해 보세요.'
          : '입체의 면을 눌러 이름을 확인해 보세요.',
    );
    const sectionText = this.sectionText(state, viewModel);
    setText(this.sectionLabel, sectionText);
    this.sectionLabel.classList.toggle(
      'is-active',
      state.section.enabled && Boolean(viewModel.crossSection),
    );
    setText(this.description, this.describe(state, viewModel));

    const foldPercent = Math.round(state.foldT * 100);
    this.stageRegion.setAttribute(
      'aria-label',
      `${concealed ? '전개도' : `${solid.nameKo} ${netMode ? '전개도' : '3D 입체'}`} 보기, 접기 ${foldPercent}%`,
    );
  }

  focus(): void {
    this.stageRegion.focus({ preventScroll: true });
  }

  redraw(): void {
    if (this.lastViewModel) this.netView.redraw();
  }

  private sectionText(state: AppState, viewModel: ViewModel): string {
    if (!state.section.enabled) return '단면 보기가 꺼져 있어요. 켜면 잘린 모양이 보여요.';
    if (state.route === 'challenge' && !state.revealed) {
      return '단면의 모양은 답을 제출한 뒤 확인할 수 있어요.';
    }
    if (!viewModel.crossSection) return '이 위치에서는 단면이 생기지 않아요.';
    return `단면 · ${viewModel.crossSection.shapeNameKo} · 넓이 ${formatNumber(
      viewModel.crossSection.area,
    )}`;
  }

  private describe(state: AppState, viewModel: ViewModel): string {
    const concealed = this.concealsSolidName(state);
    const parts = concealed
      ? ['전개도 보기입니다.']
      : [viewModel.solid.nameKo, viewModel.solid.descriptionKo];
    parts.push(
      state.viewMode === 'net' ? '평면 전개도 보기입니다.' : '3D 입체 보기입니다.',
      `접기 ${Math.round(state.foldT * 100)}퍼센트.`,
    );
    if (state.viewMode === 'net') {
      const labels = viewModel.layout.faces
        .map((netFace) => faceById(viewModel.solid, netFace.faceId)?.label)
        .filter((label): label is string => Boolean(label));
      parts.push(`전개도 면은 ${labels.join(', ')}으로 이루어져 있습니다.`);
    }
    if (state.selectedFaceId) {
      const face = faceById(viewModel.solid, state.selectedFaceId);
      if (face) parts.push(`선택한 면은 ${face.label}입니다.`);
    }
    if (state.section.enabled) {
      if (state.route === 'challenge' && !state.revealed) {
        parts.push('단면 보기가 켜져 있고 단면의 모양은 아직 공개되지 않았습니다.');
      } else if (viewModel.crossSection) {
        parts.push(
          `단면은 ${viewModel.crossSection.shapeNameKo}이고 넓이는 ${formatNumber(
            viewModel.crossSection.area,
          )}입니다.`,
        );
      } else {
        parts.push('자르는 면이 입체를 지나지 않아 단면이 없습니다.');
      }
    }
    if (viewModel.layout.noteKo && (state.route !== 'challenge' || state.revealed)) {
      parts.push(viewModel.layout.noteKo);
    }
    return parts.join(' ');
  }

  private concealsSolidName(state: AppState): boolean {
    if (state.route !== 'challenge' || state.revealed) return false;
    return CHALLENGES[state.challengeIndex]?.type === 'identify-solid';
  }

  private desiredRadius(foldT: number): number {
    const unfold = 1 - smoothstep(foldT);
    return this.radius + (this.netRadius - this.radius) * unfold;
  }

  private markPreset(active: HTMLButtonElement): void {
    for (const button of this.presetButtons) {
      button.classList.toggle('is-active', button === active);
    }
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    switch (event.key) {
      case 'ArrowLeft':
        this.sceneManager.orbit(0.16, 0);
        event.preventDefault();
        break;
      case 'ArrowRight':
        this.sceneManager.orbit(-0.16, 0);
        event.preventDefault();
        break;
      case 'ArrowUp':
        this.sceneManager.orbit(0, 0.12);
        event.preventDefault();
        break;
      case 'ArrowDown':
        this.sceneManager.orbit(0, -0.12);
        event.preventDefault();
        break;
      case '+':
      case '=':
        this.sceneManager.zoom(0.9);
        event.preventDefault();
        break;
      case '-':
      case '_':
        this.sceneManager.zoom(1.1);
        event.preventDefault();
        break;
      case ' ':
        event.preventDefault();
        this.callbacks.onTogglePlay();
        break;
      default:
        break;
    }
  };

  dispose(): void {
    this.stageRegion.removeEventListener('keydown', this.handleKeyDown);
    this.netView.dispose();
    this.sectionPlane.dispose();
    this.solidView.dispose();
    this.sceneManager.dispose();
  }
}
