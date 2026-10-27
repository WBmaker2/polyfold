import { CHALLENGES, challengesForFilter } from '../../data/challenges';
import type { Challenge, ChallengeSetFilter } from '../../geometry/types';
import type { AppState } from '../../app/state';
import { ICONS, clear, h, optionLetter, starsMarkup } from '../../ui/components/dom';

export interface TeacherCallbacks {
  onFilter: (filter: ChallengeSetFilter) => void;
  onShowAnswers: (value: boolean) => void;
  onReset: () => void;
  onAnnounce: (message: string) => void;
}

const TYPE_LABELS: Record<Challenge['type'], string> = {
  'valid-net': '전개도 판별',
  'identify-solid': '입체 맞히기',
  'cross-section': '단면 예측',
  measure: '측정',
};

export class TeacherPanel {
  private readonly left: HTMLElement;
  private readonly right: HTMLElement;
  private readonly filterButtons = new Map<ChallengeSetFilter, HTMLButtonElement>();
  private readonly showAnswers: HTMLInputElement;
  private readonly progressSummary: HTMLElement;
  private readonly answerKey: HTMLElement;
  private readonly emptyState: HTMLElement;
  private key = '';

  constructor(
    leftHost: HTMLElement,
    rightHost: HTMLElement,
    private readonly callbacks: TeacherCallbacks,
  ) {
    this.left = leftHost;
    this.right = rightHost;

    const wrap = h('div', 'panel-stack');
    const intro = h('div', 'panel-intro');
    intro.append(
      h('p', 'eyebrow', '교사 도구'),
      h('h2', 'panel-title', '학습 운영'),
      h('p', 'panel-copy', '로그인 없이 이 기기에서 바로 문제 세트와 정답을 확인할 수 있어요.'),
    );

    const filterField = h('div', 'field');
    filterField.append(h('span', 'field-label', '도전 세트'));
    const filterRow = h('div', 'segmented segmented-wrap');
    filterRow.setAttribute('role', 'group');
    filterRow.setAttribute('aria-label', '도전 세트 선택');
    const filters: { value: ChallengeSetFilter; label: string }[] = [
      { value: 'all', label: '전체 8' },
      { value: 'basic', label: '기본 5' },
      { value: 'advanced', label: '심화 3' },
    ];
    for (const item of filters) {
      const buttonNode = h('button', 'segmented-btn', item.label);
      buttonNode.type = 'button';
      buttonNode.addEventListener('click', () => this.callbacks.onFilter(item.value));
      this.filterButtons.set(item.value, buttonNode);
      filterRow.append(buttonNode);
    }
    filterField.append(filterRow);

    const filterNote = h('p', 'note', '선택한 세트는 정답 키와 학습지에 적용돼요.');

    const showAnswersLabel = h('label', 'check');
    this.showAnswers = h('input');
    this.showAnswers.type = 'checkbox';
    this.showAnswers.id = 'teacher-show-answers';
    this.showAnswers.addEventListener('change', () =>
      this.callbacks.onShowAnswers(this.showAnswers.checked),
    );
    showAnswersLabel.append(this.showAnswers, h('span', '', '정답과 해설 보기'));

    this.progressSummary = h('div', 'teacher-summary');

    const actions = h('div', 'btn-row');
    const printButton = h('button', 'btn btn-primary btn-pulse');
    printButton.type = 'button';
    printButton.innerHTML = ICONS.print;
    printButton.append(document.createTextNode(' 학습지 인쇄'));
    printButton.addEventListener('click', () => this.printWorksheet());
    const resetButton = h('button', 'btn btn-danger', '진행 초기화');
    resetButton.type = 'button';
    resetButton.addEventListener('click', () => {
      if (
        window.confirm(
          '이 기기에 저장된 별, 정답, 진행 상황을 모두 지울까요? 이 작업은 되돌릴 수 없어요.',
        )
      ) {
        this.callbacks.onReset();
      }
    });
    actions.append(printButton, resetButton);

    const localNote = h(
      'p',
      'note',
      '진행 상황은 브라우저 localStorage에만 저장됩니다. 서버로 전송되지 않아요.',
    );
    wrap.append(
      intro,
      filterField,
      filterNote,
      showAnswersLabel,
      this.progressSummary,
      actions,
      localNote,
    );
    this.left.append(wrap);

    const keyWrap = h('div', 'panel-stack');
    const keyHead = h('div', 'panel-intro');
    keyHead.append(
      h('p', 'eyebrow', '정답 키'),
      h('h2', 'panel-title', '문제별 해설'),
      h('p', 'panel-copy', '정답 공개를 켜면 바로 확인할 수 있고, 끄면 학생 화면처럼 가려져요.'),
    );
    this.answerKey = h('div', 'answer-key');
    this.emptyState = h('p', 'empty-state', '이 세트에는 해당하는 문제가 없어요.');
    keyWrap.append(keyHead, this.answerKey, this.emptyState);
    this.right.append(keyWrap);
  }

  update(state: AppState): void {
    for (const [filter, buttonNode] of this.filterButtons) {
      const active = filter === state.teacher.filter;
      buttonNode.classList.toggle('is-active', active);
      buttonNode.setAttribute('aria-pressed', String(active));
    }
    this.showAnswers.checked = state.teacher.showAnswers;

    const completed = CHALLENGES.filter((challenge) => state.answers[challenge.id]).length;
    const totalStars = Object.values(state.stars).reduce((sum, value) => sum + value, 0);
    clear(this.progressSummary);
    const summaryRow = h('div', 'teacher-stat-row');
    const completedStat = h('div', 'teacher-stat');
    completedStat.append(
      h('strong', '', `${completed}/${CHALLENGES.length}`),
      h('span', '', '완료한 문제'),
    );
    const starsStat = h('div', 'teacher-stat');
    starsStat.append(h('strong', '', String(totalStars)), h('span', '', '모은 별'));
    summaryRow.append(completedStat, starsStat);
    this.progressSummary.append(summaryRow);

    const key = `${state.teacher.filter}:${String(state.teacher.showAnswers)}:${JSON.stringify(
      state.answers,
    )}:${JSON.stringify(state.stars)}`;
    if (key !== this.key) {
      this.key = key;
      this.renderAnswerKey(state);
    }
  }

  private renderAnswerKey(state: AppState): void {
    clear(this.answerKey);
    const challenges = challengesForFilter(state.teacher.filter);
    this.emptyState.hidden = challenges.length > 0;
    for (const challenge of challenges) {
      const index = CHALLENGES.indexOf(challenge) + 1;
      const item = h('article', 'answer-item');
      const head = h('div', 'answer-head');
      const title = h('div', 'answer-title');
      title.append(h('span', 'answer-index', String(index)), h('strong', '', challenge.promptKo));
      const meta = h('span', 'answer-meta');
      meta.textContent = `${TYPE_LABELS[challenge.type]} · 난이도 ${challenge.difficulty}`;
      head.append(title, meta);
      const status = h('p', 'answer-status');
      status.textContent = state.answers[challenge.id]
        ? `학생 답 · ${state.answers[challenge.id]} · ${starsMarkup(
            state.stars[challenge.id] ?? 0,
          )}`
        : '아직 풀지 않았어요.';
      item.append(head, status);
      if (state.teacher.showAnswers) {
        const solution = h('div', 'answer-solution');
        solution.append(
          h('strong', '', `정답 · ${challenge.answer}`),
          h('p', '', challenge.explanationKo),
        );
        item.append(solution);
      }
      this.answerKey.append(item);
    }
  }

  private printWorksheet(): void {
    const stateFilter =
      [...this.filterButtons.entries()].find(([, buttonNode]) =>
        buttonNode.classList.contains('is-active'),
      )?.[0] ?? 'all';
    const selected = challengesForFilter(stateFilter);
    const worksheet = h('section', 'worksheet');
    worksheet.id = 'worksheet';
    const header = h('header', 'worksheet-head');
    header.append(
      h('h1', '', 'PolyFold 도전 학습지'),
      h('p', '', '전개도와 단면을 생각하며 답을 적어 보세요.'),
    );
    const info = h('div', 'worksheet-info');
    info.append(h('span', '', '이름: ______________________'), h('span', '', '날짜: ____________'));
    worksheet.append(header, info);
    selected.forEach((challenge, index) => {
      const item = h('article', 'worksheet-item');
      item.append(
        h('h2', '', `${index + 1}. ${challenge.promptKo}`),
        h(
          'p',
          'worksheet-options',
          challenge.options
            .map((option, optionIndex) => `${optionLetter(optionIndex)}. ${option}`)
            .join('   '),
        ),
        h('div', 'worksheet-lines'),
      );
      worksheet.append(item);
    });
    document.body.append(worksheet);
    document.body.classList.add('printing');
    const cleanup = () => {
      document.body.classList.remove('printing');
      worksheet.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    this.callbacks.onAnnounce('학습지 인쇄 창을 열었어요.');
    window.setTimeout(cleanup, 2000);
  }
}
