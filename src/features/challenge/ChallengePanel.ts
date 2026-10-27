import { CHALLENGES } from '../../data/challenges';
import type { Challenge } from '../../geometry/types';
import type { AppState } from '../../app/state';
import {
  button,
  clear,
  h,
  optionLetter,
  setHidden,
  setText,
  starsMarkup,
} from '../../ui/components/dom';

export interface ChallengeCallbacks {
  onSelectChallenge: (index: number) => void;
  onDraft: (answer: string) => void;
  onSubmit: () => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleHint: () => void;
  onExplore: () => void;
}

const TYPE_LABELS: Record<Challenge['type'], string> = {
  'valid-net': '전개도 판별',
  'identify-solid': '입체 맞히기',
  'cross-section': '단면 예측',
  measure: '측정',
};

export class ChallengePanel {
  private readonly left: HTMLElement;
  private readonly right: HTMLElement;
  private readonly listButtons: HTMLButtonElement[] = [];
  private readonly progressDots: HTMLElement;
  private readonly progressText: HTMLElement;
  private readonly typeLabel: HTMLElement;
  private readonly difficulty: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly hintButton: HTMLButtonElement;
  private readonly hintText: HTMLElement;
  private readonly optionsHost: HTMLElement;
  private readonly submitButton: HTMLButtonElement;
  private readonly feedback: HTMLElement;
  private readonly explanation: HTMLElement;
  private readonly actionRow: HTMLElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly starLabel: HTMLElement;
  private readonly optionButtons = new Map<string, HTMLButtonElement>();
  private optionsKey = '';

  constructor(
    leftHost: HTMLElement,
    rightHost: HTMLElement,
    private readonly callbacks: ChallengeCallbacks,
  ) {
    this.left = leftHost;
    this.right = rightHost;
    this.left.append(this.buildList());

    const panel = h('div', 'panel-stack challenge-panel');
    const header = h('div', 'challenge-head');
    const eyebrowRow = h('div', 'challenge-eyebrow-row');
    this.typeLabel = h('p', 'eyebrow', '도전');
    const difficulty = h('span', 'difficulty');
    this.difficulty = difficulty;
    eyebrowRow.append(this.typeLabel, difficulty);
    const progressRow = h('div', 'progress-row');
    this.progressDots = h('div', 'progress-dots');
    this.progressDots.setAttribute('aria-hidden', 'true');
    this.progressText = h('span', 'progress-text');
    progressRow.append(this.progressDots, this.progressText);
    this.starLabel = h('p', 'challenge-stars');
    header.append(eyebrowRow, progressRow, this.starLabel);

    this.prompt = h('h2', 'challenge-prompt');
    this.prompt.tabIndex = -1;
    this.hintButton = h('button', 'link-btn', '힌트 보기');
    this.hintButton.type = 'button';
    this.hintButton.setAttribute('aria-expanded', 'false');
    this.hintText = h('p', 'hint-text');
    this.hintText.id = 'challenge-hint';
    this.hintButton.setAttribute('aria-controls', 'challenge-hint');
    this.optionsHost = h('div', 'options');
    this.optionsHost.setAttribute('role', 'radiogroup');
    this.optionsHost.setAttribute('aria-label', '답 선택');

    this.submitButton = button('답 제출하기', {
      className: 'btn btn-primary btn-pulse challenge-submit',
      onClick: () => this.callbacks.onSubmit(),
    });
    this.feedback = h('div', 'challenge-feedback');
    this.feedback.setAttribute('aria-live', 'polite');
    this.feedback.setAttribute('aria-atomic', 'true');
    this.explanation = h('p', 'challenge-explanation');
    this.actionRow = h('div', 'btn-row challenge-actions');
    const exploreButton = button('탐구에서 확인하기', {
      className: 'btn btn-ghost',
      onClick: () => this.callbacks.onExplore(),
    });
    this.nextButton = button('다음 문제', {
      className: 'btn btn-primary btn-pulse',
      onClick: () => this.callbacks.onNext(),
    });
    this.actionRow.append(exploreButton, this.nextButton);

    const navRow = h('div', 'challenge-nav');
    const prev = h('button', 'link-btn', '← 이전 문제');
    prev.type = 'button';
    prev.addEventListener('click', () => this.callbacks.onPrev());
    const next = h('button', 'link-btn', '다음 문제 →');
    next.type = 'button';
    next.addEventListener('click', () => this.callbacks.onNext());
    navRow.append(prev, next);

    panel.append(
      header,
      this.prompt,
      this.hintButton,
      this.hintText,
      this.optionsHost,
      this.submitButton,
      this.feedback,
      this.explanation,
      this.actionRow,
      navRow,
    );
    this.right.append(panel);

    this.hintButton.addEventListener('click', () => this.callbacks.onToggleHint());
  }

  update(state: AppState): void {
    const challenge = CHALLENGES[state.challengeIndex] ?? CHALLENGES[0]!;
    const completed = CHALLENGES.filter((item) => state.answers[item.id]).length;
    const totalStars = Object.values(state.stars).reduce((sum, value) => sum + value, 0);

    for (let index = 0; index < CHALLENGES.length; index += 1) {
      const item = CHALLENGES[index]!;
      const buttonNode = this.listButtons[index]!;
      const active = index === state.challengeIndex;
      const done = Boolean(state.answers[item.id]);
      buttonNode.classList.toggle('is-active', active);
      buttonNode.classList.toggle('is-done', done);
      buttonNode.setAttribute('aria-current', active ? 'step' : 'false');
      setText(
        buttonNode.querySelector('.challenge-item-stars'),
        done ? starsMarkup(state.stars[item.id] ?? 0) : '',
      );
    }
    const activeButton = this.listButtons[state.challengeIndex];
    if (activeButton) {
      activeButton.scrollIntoView({ block: 'nearest' });
    }

    clear(this.progressDots);
    CHALLENGES.forEach((item, index) => {
      const dot = h('span', 'progress-dot');
      if (state.answers[item.id]) dot.classList.add('is-done');
      if (index === state.challengeIndex) dot.classList.add('is-current');
      this.progressDots.append(dot);
    });
    setText(this.progressText, `${state.challengeIndex + 1} / ${CHALLENGES.length}`);
    setText(this.typeLabel, `${TYPE_LABELS[challenge.type]} · 도전`);
    setText(
      this.difficulty,
      `난이도 ${'●'.repeat(challenge.difficulty)}${'○'.repeat(3 - challenge.difficulty)}`,
    );
    setText(this.starLabel, `완료 ${completed}/${CHALLENGES.length} · 모은 별 ${totalStars}개`);
    if (this.prompt.textContent !== challenge.promptKo) {
      setText(this.prompt, challenge.promptKo);
    }

    setText(this.hintText, challenge.hintKo ?? '힌트가 없어요.');
    setHidden(this.hintText, !state.hintVisible);
    this.hintButton.setAttribute('aria-expanded', String(state.hintVisible));
    setText(this.hintButton, state.hintVisible ? '힌트 숨기기' : '힌트 보기');

    const key = `${challenge.id}:${String(state.revealed)}`;
    if (key !== this.optionsKey) {
      this.optionsKey = key;
      this.renderOptions(challenge, state);
    }
    for (const [answer, buttonNode] of this.optionButtons) {
      const selected = state.answerDraft === answer;
      buttonNode.classList.toggle('is-selected', selected);
      buttonNode.setAttribute('aria-checked', String(selected));
      buttonNode.disabled = state.revealed;
    }

    const canSubmit = Boolean(state.answerDraft) && !state.revealed;
    this.submitButton.disabled = !canSubmit;
    setHidden(this.submitButton, state.revealed);
    this.submitButton.classList.toggle('btn-pulse', canSubmit);

    setText(this.feedback, state.feedbackKo);
    this.feedback.className = `challenge-feedback tone-${state.feedbackTone}`;
    setHidden(this.feedback, !state.feedbackKo);

    const showExplanation = state.revealed;
    setText(this.explanation, showExplanation ? `정답 · ${challenge.explanationKo}` : '');
    setHidden(this.explanation, !showExplanation);
    setHidden(this.actionRow, !showExplanation);
    if (showExplanation) {
      setText(
        this.nextButton,
        state.challengeIndex >= CHALLENGES.length - 1 ? '처음부터 복습' : '다음 문제',
      );
    }
  }

  focusPrompt(): void {
    this.prompt.focus({ preventScroll: true });
  }

  focusExplanation(): void {
    this.explanation.tabIndex = -1;
    this.explanation.focus({ preventScroll: true });
  }

  private renderOptions(challenge: Challenge, state: AppState): void {
    clear(this.optionsHost);
    this.optionButtons.clear();
    challenge.options.forEach((option, index) => {
      const buttonNode = h('button', 'option');
      buttonNode.type = 'button';
      buttonNode.setAttribute('role', 'radio');
      buttonNode.setAttribute('aria-checked', String(state.answerDraft === option));
      const letter = h('span', 'option-letter', optionLetter(index));
      const text = h('span', 'option-text', option);
      const mark = h('span', 'option-mark');
      buttonNode.append(letter, text, mark);
      if (state.revealed) {
        buttonNode.disabled = true;
        if (option === challenge.answer) {
          buttonNode.classList.add('is-correct');
          setText(mark, '정답');
        } else if (option === state.answerDraft) {
          buttonNode.classList.add('is-wrong');
          setText(mark, '내 답');
        }
      }
      buttonNode.addEventListener('click', () => this.callbacks.onDraft(option));
      this.optionButtons.set(option, buttonNode);
      this.optionsHost.append(buttonNode);
    });
  }

  private buildList(): HTMLElement {
    const wrap = h('div', 'panel-stack');
    const intro = h('div', 'panel-intro');
    intro.append(
      h('p', 'eyebrow', '도전'),
      h('h2', 'panel-title', '여덟 가지 문제'),
      h('p', 'panel-copy', '예상하고, 확인하고, 설명하는 순서로 입체도형 감각을 길러 보세요.'),
    );
    const list = h('div', 'challenge-list');
    CHALLENGES.forEach((challenge, index) => {
      const card = h('button', 'challenge-item');
      card.type = 'button';
      card.dataset.challengeId = challenge.id;
      const number = h('span', 'challenge-item-index', String(index + 1));
      const body = h('span', 'challenge-item-body');
      const title = h('span', 'challenge-item-title');
      title.append(
        h('span', 'challenge-item-type', TYPE_LABELS[challenge.type]),
        h('span', 'challenge-item-prompt', challenge.promptKo),
      );
      const stars = h('span', 'challenge-item-stars');
      body.append(title, stars);
      card.append(number, body);
      card.addEventListener('click', () => this.callbacks.onSelectChallenge(index));
      this.listButtons.push(card);
      list.append(card);
    });
    wrap.append(intro, list);
    return wrap;
  }
}
