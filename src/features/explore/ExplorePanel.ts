import { CHALLENGES } from '../../data/challenges';
import { SOLIDS } from '../../geometry/solids';
import type {
  CrossSection,
  FoldSpeed,
  MobileTab,
  SolidDefinition,
  Vec3,
} from '../../geometry/types';
import { formatNumber } from '../../geometry/vec';
import type { AppState } from '../../app/state';
import type { ViewModel } from '../../app/viewModel';
import {
  ICONS,
  button,
  clear,
  h,
  iconButton,
  setHidden,
  setText,
  starsMarkup,
} from '../../ui/components/dom';

export interface ExploreCallbacks {
  onSelectSolid: (solidId: string) => void;
  onSelectNet: (netId: string) => void;
  onFold: (value: number) => void;
  onTogglePlay: () => void;
  onResetFold: () => void;
  onFaceSelect: (faceId: string | null) => void;
  onSectionEnabled: (enabled: boolean) => void;
  onSectionNormal: (normal: Vec3) => void;
  onSectionOffset: (offset: number) => void;
  onReducedMotion: (value: boolean) => void;
  onShowFormulas: (value: boolean) => void;
  onFoldSpeed: (speed: FoldSpeed) => void;
  onMobileTab: (tab: MobileTab) => void;
  onOpenChallenge: () => void;
  onStartChallenge: (index: number) => void;
}

const SECTION_PRESETS: { label: string; normal: Vec3 }[] = [
  { label: '가로', normal: { x: 0, y: 1, z: 0 } },
  { label: '좌우', normal: { x: 1, y: 0, z: 0 } },
  { label: '앞뒤', normal: { x: 0, y: 0, z: 1 } },
  { label: '대각선', normal: { x: 1, y: 1, z: 1 } },
];

const MOBILE_TABS: { tab: MobileTab; label: string }[] = [
  { tab: 'fold', label: '접기' },
  { tab: 'slice', label: '단면' },
  { tab: 'measure', label: '측정' },
  { tab: 'challenge', label: '도전' },
];

export class ExplorePanel {
  private readonly galleryButtons = new Map<string, HTMLButtonElement>();
  private readonly left: HTMLElement;
  private readonly right: HTMLElement;
  private readonly netSelect: HTMLSelectElement;
  private readonly netMeta: HTMLElement;
  private readonly netNote: HTMLElement;
  private readonly foldSlider: HTMLInputElement;
  private readonly foldOutput: HTMLOutputElement;
  private readonly playButton: HTMLButtonElement;
  private readonly reducedMotion: HTMLInputElement;
  private readonly foldSpeedButtons = new Map<FoldSpeed, HTMLButtonElement>();
  private readonly faceText: HTMLElement;
  private readonly clearFace: HTMLButtonElement;
  private readonly sectionToggle: HTMLInputElement;
  private readonly sectionPresets: HTMLButtonElement[] = [];
  private readonly sectionOffset: HTMLInputElement;
  private readonly sectionOffsetValue: HTMLElement;
  private readonly sectionResult: HTMLElement;
  private readonly sectionCanvas: HTMLCanvasElement;
  private readonly sectionMeta: HTMLElement;
  private readonly formulaBlocks: HTMLElement;
  private readonly formulaToggle: HTMLInputElement;
  private readonly areaValue: HTMLElement;
  private readonly volumeValue: HTMLElement;
  private readonly nextChallengeText: HTMLElement;
  private readonly nextChallengeStars: HTMLElement;
  private readonly mobileTabButtons = new Map<MobileTab, HTMLButtonElement>();
  private readonly cards = new Map<string, HTMLElement>();
  private netOptionsKey = '';
  private formulaKey = '';
  private sectionKey = '';

  constructor(
    leftHost: HTMLElement,
    rightHost: HTMLElement,
    private readonly callbacks: ExploreCallbacks,
  ) {
    this.left = leftHost;
    this.right = rightHost;
    this.left.append(this.buildGallery());
    this.right.append(
      this.buildMobileTabs(),
      this.buildFoldCard(),
      this.buildSectionCard(),
      this.buildMeasureCard(),
      this.buildChallengeCard(),
    );

    this.netSelect = this.right.querySelector('#net-select')!;
    this.netMeta = this.right.querySelector('#net-meta')!;
    this.netNote = this.right.querySelector('#net-note')!;
    this.foldSlider = this.right.querySelector('#fold-slider')!;
    this.foldOutput = this.right.querySelector('#fold-output')!;
    this.playButton = this.right.querySelector('#fold-play')!;
    this.reducedMotion = this.right.querySelector('#reduce-motion')!;
    this.faceText = this.right.querySelector('#face-text')!;
    this.clearFace = this.right.querySelector('#clear-face')!;
    this.sectionToggle = this.right.querySelector('#section-toggle')!;
    this.sectionOffset = this.right.querySelector('#section-offset')!;
    this.sectionOffsetValue = this.right.querySelector('#section-offset-value')!;
    this.sectionResult = this.right.querySelector('#section-result')!;
    this.sectionCanvas = this.right.querySelector('#section-canvas')!;
    this.sectionMeta = this.right.querySelector('#section-meta')!;
    this.formulaBlocks = this.right.querySelector('#formula-blocks')!;
    this.formulaToggle = this.right.querySelector('#show-formulas')!;
    this.areaValue = this.right.querySelector('#area-value')!;
    this.volumeValue = this.right.querySelector('#volume-value')!;
    this.nextChallengeText = this.right.querySelector('#next-challenge-text')!;
    this.nextChallengeStars = this.right.querySelector('#next-challenge-stars')!;
    this.right
      .querySelectorAll<HTMLButtonElement>('[data-section-preset]')
      .forEach((buttonNode) => this.sectionPresets.push(buttonNode));

    this.netSelect.addEventListener('change', () =>
      this.callbacks.onSelectNet(this.netSelect.value),
    );
    this.foldSlider.addEventListener('input', () =>
      this.callbacks.onFold(Number(this.foldSlider.value)),
    );
    this.foldSlider.addEventListener('pointerdown', () => {
      this.callbacks.onFold(Number(this.foldSlider.value));
    });
    this.playButton.addEventListener('click', () => this.callbacks.onTogglePlay());
    this.right
      .querySelector('#fold-reset')!
      .addEventListener('click', () => this.callbacks.onResetFold());
    this.reducedMotion.addEventListener('change', () =>
      this.callbacks.onReducedMotion(this.reducedMotion.checked),
    );
    this.clearFace.addEventListener('click', () => this.callbacks.onFaceSelect(null));
    this.sectionToggle.addEventListener('change', () =>
      this.callbacks.onSectionEnabled(this.sectionToggle.checked),
    );
    this.sectionOffset.addEventListener('input', () =>
      this.callbacks.onSectionOffset(Number(this.sectionOffset.value)),
    );
    this.formulaToggle.addEventListener('change', () =>
      this.callbacks.onShowFormulas(this.formulaToggle.checked),
    );
    for (const presetButton of this.sectionPresets) {
      presetButton.addEventListener('click', () => {
        const preset = SECTION_PRESETS.find(
          (item) => item.label === presetButton.dataset.sectionPreset,
        );
        if (preset) this.callbacks.onSectionNormal(preset.normal);
      });
    }
    this.right
      .querySelector('#open-challenge')!
      .addEventListener('click', () => this.callbacks.onOpenChallenge());
    this.right
      .querySelector('#start-next')!
      .addEventListener('click', () => this.callbacks.onStartChallenge(0));
  }

  update(state: AppState, viewModel: ViewModel): void {
    for (const [solidId, buttonNode] of this.galleryButtons) {
      const active = solidId === state.solidId;
      buttonNode.classList.toggle('is-active', active);
      buttonNode.setAttribute('aria-pressed', String(active));
    }

    const solid = viewModel.solid;
    this.refreshNetOptions(solid);
    if (this.netSelect.value !== state.netId) this.netSelect.value = state.netId;
    setText(this.netMeta, viewModel.layoutValid ? '접을 수 있는 전개도' : '접을 수 없는 전개도');
    this.netMeta.classList.toggle('is-invalid', !viewModel.layoutValid);
    setText(this.netNote, viewModel.layout.noteKo ?? '');
    setHidden(this.netNote, !viewModel.layout.noteKo);

    this.foldSlider.value = String(state.foldT);
    const percent = Math.round(state.foldT * 100);
    setText(this.foldOutput, `${percent}%`);
    this.foldSlider.setAttribute('aria-valuetext', `${percent}% 접힘`);
    for (const [speed, buttonNode] of this.foldSpeedButtons) {
      const active = speed === state.preferences.foldSpeed;
      buttonNode.classList.toggle('is-active', active);
      buttonNode.setAttribute('aria-pressed', String(active));
    }
    this.playButton.innerHTML = state.playing ? ICONS.pause : ICONS.play;
    this.playButton.append(
      document.createTextNode(
        state.playing ? ' 멈춤' : state.foldT >= 0.999 ? ' 다시 접기' : ' 접기 시작',
      ),
    );
    this.reducedMotion.checked = state.preferences.reducedMotion;

    const selectedFace = state.selectedFaceId
      ? solid.faces.find((face) => face.id === state.selectedFaceId)
      : undefined;
    setText(
      this.faceText,
      selectedFace
        ? `선택한 면: ${selectedFace.label}`
        : '면을 누르면 같은 면이 전개도에서도 강조돼요.',
    );
    setHidden(this.clearFace, !selectedFace);

    this.sectionToggle.checked = state.section.enabled;
    this.sectionOffset.disabled = !state.section.enabled;
    const [rangeMin, rangeMax] = viewModel.sectionRange;
    const margin = Math.max((rangeMax - rangeMin) * 0.08, 0.02);
    const min = rangeMin - margin;
    const max = rangeMax + margin;
    const step = Math.max((max - min) / 120, 0.001);
    this.sectionOffset.min = String(min);
    this.sectionOffset.max = String(max);
    this.sectionOffset.step = String(step);
    this.sectionOffset.value = String(state.section.offset);
    setText(this.sectionOffsetValue, `중심에서 ${formatNumber(state.section.offset)}`);
    for (const presetButton of this.sectionPresets) {
      const preset = SECTION_PRESETS.find(
        (item) => item.label === presetButton.dataset.sectionPreset,
      );
      const active = preset ? normalMatches(preset.normal, state.section.normal) : false;
      presetButton.classList.toggle('is-active', active);
      presetButton.setAttribute('aria-pressed', String(active));
      presetButton.disabled = !state.section.enabled;
    }
    this.renderSection(state, viewModel);

    setText(this.areaValue, formatNumber(viewModel.measures.surfaceArea));
    setText(this.volumeValue, formatNumber(viewModel.measures.volume));
    this.formulaToggle.checked = state.preferences.showFormulas;
    setHidden(this.formulaBlocks, !state.preferences.showFormulas);
    this.renderFormulas(solid, viewModel);

    const completed = CHALLENGES.filter((challenge) => state.answers[challenge.id]).length;
    const next = CHALLENGES.find((challenge) => !state.answers[challenge.id]);
    const totalStars = Object.values(state.stars).reduce((sum, value) => sum + value, 0);
    setText(
      this.nextChallengeText,
      next
        ? `${CHALLENGES.indexOf(next) + 1}번 문제 · ${next.promptKo}`
        : '모든 도전을 마쳤어요. 다시 복습해 볼까요?',
    );
    setText(
      this.nextChallengeStars,
      `${completed}/${CHALLENGES.length} 완료 · ${starsMarkup(Math.min(3, Math.round(totalStars / Math.max(1, completed))))} 평균`,
    );

    for (const [tab, buttonNode] of this.mobileTabButtons) {
      const active = tab === state.mobileTab;
      buttonNode.classList.toggle('is-active', active);
      buttonNode.setAttribute('aria-selected', String(active));
    }
    for (const [cardName, card] of this.cards) {
      card.classList.toggle('is-mobile-active', cardName === state.mobileTab);
    }
  }

  private buildGallery(): HTMLElement {
    const wrap = h('div', 'panel-stack');
    const intro = h('div', 'panel-intro');
    intro.append(
      h('p', 'eyebrow', '탐구'),
      h('h2', 'panel-title', '입체 갤러리'),
      h('p', 'panel-copy', '전개도를 접고, 평면으로 잘라 보며 입체도형의 성질을 발견해 보세요.'),
    );
    const list = h('div', 'solid-list');
    for (const solid of SOLIDS) {
      const card = h('button', 'solid-card');
      card.type = 'button';
      card.dataset.solidId = solid.id;
      card.setAttribute('aria-pressed', 'false');
      const mark = h('span', 'solid-mark');
      mark.innerHTML = solidGlyph(solid.faces[0]?.color ?? '#dfa83d');
      const info = h('span', 'solid-info');
      info.append(h('strong', 'solid-name', solid.nameKo), h('span', 'solid-en', solid.nameEn));
      info.append(h('span', 'solid-meta', `면 ${solid.faces.length} · 모서리 ${edgeCount(solid)}`));
      card.append(mark, info);
      card.addEventListener('click', () => this.callbacks.onSelectSolid(solid.id));
      this.galleryButtons.set(solid.id, card);
      list.append(card);
    }
    wrap.append(intro, list);
    return wrap;
  }

  private buildMobileTabs(): HTMLElement {
    const tabs = h('div', 'mobile-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '탐구 도구');
    for (const item of MOBILE_TABS) {
      const buttonNode = h('button', 'mobile-tab', item.label);
      buttonNode.type = 'button';
      buttonNode.id = `tab-${item.tab}`;
      buttonNode.setAttribute('role', 'tab');
      buttonNode.setAttribute('aria-controls', `card-${item.tab}`);
      buttonNode.addEventListener('click', () => this.callbacks.onMobileTab(item.tab));
      this.mobileTabButtons.set(item.tab, buttonNode);
      tabs.append(buttonNode);
    }
    return tabs;
  }

  private buildFoldCard(): HTMLElement {
    const card = h('section', 'card');
    card.dataset.card = 'fold';
    this.cards.set('fold', card);
    card.id = 'card-fold';
    const head = h('div', 'card-head');
    head.append(h('h2', 'card-title', '접고 펴기'), h('span', 'card-meta', '접기'));
    const field = h('label', 'field');
    field.append(h('span', 'field-label', '전개도 선택'));
    const select = h('select', 'select');
    select.id = 'net-select';
    field.append(select);
    const metaRow = h('div', 'meta-row');
    const meta = h('span', 'badge');
    meta.id = 'net-meta';
    const note = h('p', 'note');
    note.id = 'net-note';
    metaRow.append(meta);
    const progressHead = h('div', 'progress-head');
    const progressHint = h('span', 'progress-hint', '막대를 드래그해 조절하세요');
    progressHint.id = 'fold-slider-hint';
    progressHead.append(h('span', 'field-label', '접는 정도'), progressHint);
    const foldRow = h('div', 'range-row');
    const slider = h('input', 'range');
    slider.type = 'range';
    slider.id = 'fold-slider';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.01';
    slider.value = '1';
    slider.setAttribute('aria-label', '접는 정도');
    slider.setAttribute('aria-valuetext', '100% 접힘');
    slider.setAttribute('aria-describedby', 'fold-slider-hint');
    slider.title = '드래그해서 접는 정도를 조절하세요';
    const output = h('output', 'range-value');
    output.id = 'fold-output';
    output.setAttribute('for', 'fold-slider');
    output.textContent = '100%';
    foldRow.append(slider, output);
    const speedField = h('div', 'field speed-field');
    speedField.append(h('span', 'field-label', '접기 속도'));
    const speedRow = h('div', 'segmented segmented-wrap');
    speedRow.setAttribute('role', 'group');
    speedRow.setAttribute('aria-label', '접기 속도');
    const speeds: { speed: FoldSpeed; label: string; title: string }[] = [
      { speed: 'slow', label: '느리게', title: '약 5초 동안 접어요' },
      { speed: 'normal', label: '보통', title: '약 3초 동안 접어요' },
      { speed: 'fast', label: '빠르게', title: '약 1.5초 동안 접어요' },
    ];
    for (const item of speeds) {
      const speedButton = h('button', 'segmented-btn', item.label);
      speedButton.type = 'button';
      speedButton.dataset.foldSpeed = item.speed;
      speedButton.title = item.title;
      speedButton.setAttribute('aria-label', `${item.label}, ${item.title}`);
      speedButton.addEventListener('click', () => this.callbacks.onFoldSpeed(item.speed));
      this.foldSpeedButtons.set(item.speed, speedButton);
      speedRow.append(speedButton);
    }
    speedField.append(speedRow);
    const buttons = h('div', 'btn-row');
    const play = h('button', 'btn btn-primary btn-pulse');
    play.type = 'button';
    play.id = 'fold-play';
    play.innerHTML = ICONS.play;
    play.append(document.createTextNode(' 접기 시작'));
    const reset = iconButton(ICONS.reset, '접기 초기화', { className: 'icon-btn icon-btn-soft' });
    reset.id = 'fold-reset';
    reset.title = '처음 상태로';
    buttons.append(play, reset);
    const reduce = h('label', 'check');
    const reduceInput = h('input');
    reduceInput.type = 'checkbox';
    reduceInput.id = 'reduce-motion';
    reduce.append(reduceInput, h('span', '', '애니메이션 줄이기'));
    const faceRow = h('div', 'face-row');
    const faceText = h('p', 'note');
    faceText.id = 'face-text';
    const clearButton = h('button', 'link-btn', '선택 해제');
    clearButton.type = 'button';
    clearButton.id = 'clear-face';
    faceRow.append(faceText, clearButton);
    card.append(
      head,
      field,
      metaRow,
      note,
      progressHead,
      foldRow,
      speedField,
      buttons,
      reduce,
      faceRow,
    );
    return card;
  }

  private buildSectionCard(): HTMLElement {
    const card = h('section', 'card');
    card.dataset.card = 'slice';
    this.cards.set('slice', card);
    card.id = 'card-slice';
    const head = h('div', 'card-head');
    head.append(h('h2', 'card-title', '단면 자르기'), h('span', 'card-meta', '단면'));
    const toggle = h('label', 'switch-row');
    const input = h('input');
    input.type = 'checkbox';
    input.id = 'section-toggle';
    const track = h('span', 'switch');
    track.setAttribute('aria-hidden', 'true');
    toggle.append(input, h('span', 'switch-label', '단면 보기'), track);
    const sectionHint = h('p', 'note', '켜면 자르는 면과 잘린 단면이 함께 보여요.');

    const presets = h('div', 'segmented segmented-wrap');
    presets.setAttribute('role', 'group');
    presets.setAttribute('aria-label', '자르는 방향');
    for (const preset of SECTION_PRESETS) {
      const buttonNode = h('button', 'segmented-btn', preset.label);
      buttonNode.type = 'button';
      buttonNode.dataset.sectionPreset = preset.label;
      presets.append(buttonNode);
    }
    const offsetRow = h('div', 'range-row');
    const offset = h('input', 'range');
    offset.type = 'range';
    offset.id = 'section-offset';
    offset.setAttribute('aria-label', '자르는 위치');
    const offsetValue = h('output', 'range-value');
    offsetValue.id = 'section-offset-value';
    offsetValue.setAttribute('for', 'section-offset');
    offsetRow.append(offset, offsetValue);

    const result = h('div', 'section-result');
    result.id = 'section-result';
    const resultHead = h('div', 'section-result-head');
    const resultTitle = h('strong', 'section-shape');
    resultTitle.id = 'section-meta';
    resultTitle.textContent = '단면 보기를 켜 보세요';
    resultHead.append(resultTitle);
    const canvas = h('canvas', 'section-canvas');
    canvas.id = 'section-canvas';
    canvas.width = 640;
    canvas.height = 440;
    canvas.setAttribute('aria-hidden', 'true');
    result.append(resultHead, canvas);
    card.append(head, toggle, sectionHint, presets, offsetRow, result);
    return card;
  }

  private buildMeasureCard(): HTMLElement {
    const card = h('section', 'card');
    card.dataset.card = 'measure';
    this.cards.set('measure', card);
    card.id = 'card-measure';
    const head = h('div', 'card-head');
    head.append(h('h2', 'card-title', '측정'), h('span', 'card-meta', '공식'));
    const stats = h('div', 'stat-grid');
    const area = h('div', 'stat');
    const areaValue = h('strong', 'stat-value', '0');
    areaValue.id = 'area-value';
    area.append(areaValue, h('span', 'stat-label', '겉넓이'));
    const volume = h('div', 'stat');
    const volumeValue = h('strong', 'stat-value', '0');
    volumeValue.id = 'volume-value';
    volume.append(volumeValue, h('span', 'stat-label', '부피'));
    stats.append(area, volume);
    const formulas = h('div', 'formula-blocks');
    formulas.id = 'formula-blocks';
    const toggle = h('label', 'check');
    const input = h('input');
    input.type = 'checkbox';
    input.id = 'show-formulas';
    toggle.append(input, h('span', '', '공식과 풀이 함께 보기'));
    card.append(head, stats, formulas, toggle);
    return card;
  }

  private buildChallengeCard(): HTMLElement {
    const card = h('section', 'card card-accent');
    card.dataset.card = 'challenge';
    this.cards.set('challenge', card);
    card.id = 'card-challenge';
    const head = h('div', 'card-head');
    head.append(h('h2', 'card-title', '도전'), h('span', 'card-meta', '8문제'));
    const text = h('p', 'challenge-next');
    text.id = 'next-challenge-text';
    const stars = h('p', 'challenge-stars');
    stars.id = 'next-challenge-stars';
    const buttons = h('div', 'btn-row');
    const open = button('도전 모드 열기', {
      className: 'btn btn-primary btn-pulse',
      onClick: () => this.callbacks.onOpenChallenge(),
    });
    open.id = 'open-challenge';
    const start = button('1번부터 시작', {
      className: 'btn btn-ghost',
      onClick: () => this.callbacks.onStartChallenge(0),
    });
    start.id = 'start-next';
    buttons.append(open, start);
    card.append(head, text, stars, buttons);
    return card;
  }

  private refreshNetOptions(solid: SolidDefinition): void {
    const key = `${solid.id}:${solid.netLayouts.map((layout) => `${layout.id}-${layout.valid}`).join(',')}`;
    if (key === this.netOptionsKey) return;
    this.netOptionsKey = key;
    const current = this.netSelect.value;
    clear(this.netSelect);
    solid.netLayouts.forEach((layout, index) => {
      const option = h(
        'option',
        '',
        `${index + 1}번 전개도 ${layout.valid ? '(접을 수 있음)' : '(접을 수 없음)'}`,
      );
      option.value = layout.id;
      this.netSelect.append(option);
    });
    if (solid.netLayouts.some((layout) => layout.id === current)) this.netSelect.value = current;
  }

  private renderSection(state: AppState, viewModel: ViewModel): void {
    const section = viewModel.crossSection;
    const key = [
      viewModel.solid.id,
      state.section.enabled,
      state.section.offset.toFixed(5),
      state.route,
      state.revealed,
      section
        ? `${section.shapeNameKo}:${section.area.toFixed(5)}:${section.perimeter.toFixed(5)}`
        : 'none',
    ].join('|');
    if (key === this.sectionKey) return;
    this.sectionKey = key;
    if (!state.section.enabled) {
      setText(this.sectionMeta, '단면 보기를 켜 보세요');
      this.sectionResult.classList.remove('has-section');
      drawEmptySection(this.sectionCanvas);
      return;
    }
    if (!section) {
      setText(this.sectionMeta, '단면이 없어요');
      this.sectionResult.classList.remove('has-section');
      drawEmptySection(this.sectionCanvas);
      return;
    }
    if (state.route === 'challenge' && !state.revealed) {
      setText(this.sectionMeta, '답을 제출하면 단면이 보여요');
      this.sectionResult.classList.remove('has-section');
      drawHiddenSection(this.sectionCanvas);
      return;
    }
    setText(
      this.sectionMeta,
      `${section.shapeNameKo} · 둘레 ${formatNumber(section.perimeter)} · 넓이 ${formatNumber(
        section.area,
      )}`,
    );
    this.sectionResult.classList.add('has-section');
    drawSection(this.sectionCanvas, section);
  }

  private renderFormulas(solid: SolidDefinition, viewModel: ViewModel): void {
    const key = `${solid.id}:${viewModel.measures.surfaceArea}:${viewModel.measures.volume}`;
    if (key === this.formulaKey) return;
    this.formulaKey = key;
    clear(this.formulaBlocks);
    const formula = solid.formulas;
    const area = h('div', 'formula');
    area.append(
      h('span', 'formula-label', '겉넓이'),
      h('code', 'formula-main', formula.surfaceArea),
      h('span', 'formula-sub', formula.surfaceAreaSub),
    );
    const volume = h('div', 'formula');
    volume.append(
      h('span', 'formula-label', '부피'),
      h('code', 'formula-main', formula.volume),
      h('span', 'formula-sub', formula.volumeSub),
    );
    const rounded = h(
      'p',
      'formula-note',
      `계산값 · 겉넓이 ${formatNumber(viewModel.measures.surfaceArea)} · 부피 ${formatNumber(
        viewModel.measures.volume,
      )}`,
    );
    this.formulaBlocks.append(area, volume, rounded);
  }
}

function normalMatches(a: Vec3, b: Vec3): boolean {
  const lengthA = Math.hypot(a.x, a.y, a.z);
  const lengthB = Math.hypot(b.x, b.y, b.z);
  if (lengthA < 1e-9 || lengthB < 1e-9) return false;
  const dot = (a.x * b.x + a.y * b.y + a.z * b.z) / (lengthA * lengthB);
  return Math.abs(dot) > 0.999;
}

function edgeCount(solid: SolidDefinition): number {
  const edges = new Set<string>();
  for (const face of solid.faces) {
    for (let i = 0; i < face.vertexIndices.length; i += 1) {
      const a = face.vertexIndices[i]!;
      const b = face.vertexIndices[(i + 1) % face.vertexIndices.length]!;
      edges.add(a < b ? `${a}:${b}` : `${b}:${a}`);
    }
  }
  return edges.size;
}

function solidGlyph(color: string): string {
  return `<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
    <path d="M20 4 34 12v16L20 36 6 28V12L20 4Z" fill="${color}" opacity=".18"/>
    <path d="M20 4 34 12 20 20 6 12 20 4Z" fill="${color}"/>
    <path d="M6 12v16l14 8V20L6 12Z" fill="${color}" opacity=".72"/>
    <path d="M34 12v16l-14 8V20l14-8Z" fill="${color}" opacity=".46"/>
  </svg>`;
}

function drawSection(canvas: HTMLCanvasElement, section: CrossSection): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  const width = 320;
  const height = 220;
  ctx.clearRect(0, 0, width, height);
  const points = section.points2D;
  if (points.length < 3) return;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const padding = 30;
  const scale = Math.min(
    (width - padding * 2) / Math.max(0.001, maxX - minX),
    (height - padding * 2) / Math.max(0.001, maxY - minY),
  );
  const offsetX = (width - (maxX - minX) * scale) / 2;
  const offsetY = (height - (maxY - minY) * scale) / 2;
  const toCanvas = (point: { x: number; y: number }) => ({
    x: offsetX + (point.x - minX) * scale,
    y: height - offsetY - (point.y - minY) * scale,
  });
  ctx.beginPath();
  points.forEach((point, index) => {
    const mapped = toCanvas(point);
    if (index === 0) ctx.moveTo(mapped.x, mapped.y);
    else ctx.lineTo(mapped.x, mapped.y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(223, 106, 80, 0.18)';
  ctx.fill();
  ctx.strokeStyle = '#b8462c';
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.stroke();
  for (const point of points) {
    const mapped = toCanvas(point);
    ctx.beginPath();
    ctx.arc(mapped.x, mapped.y, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#b8462c';
    ctx.fill();
  }
}

function drawEmptySection(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.clearRect(0, 0, 320, 220);
  ctx.setLineDash([5, 6]);
  ctx.strokeStyle = 'rgba(18, 63, 60, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(24, 24, 272, 172);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(18, 63, 60, 0.5)';
  ctx.font = '600 13px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('단면 보기를 켜고 위치를 움직여 보세요', 160, 114);
}

function drawHiddenSection(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.clearRect(0, 0, 320, 220);
  ctx.fillStyle = 'rgba(223, 168, 61, 0.18)';
  ctx.beginPath();
  ctx.arc(160, 108, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#123f3c';
  ctx.font = '600 28px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 160, 110);
  ctx.font = '600 13px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  ctx.fillText('답을 제출하면 공개돼요', 160, 182);
}

export { normalMatches };
