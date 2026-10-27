export type Cleanup = () => void;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function button(
  label: string,
  options: {
    className?: string;
    onClick?: (event: MouseEvent) => void;
    ariaLabel?: string;
    type?: 'button' | 'submit';
    pulse?: boolean;
    title?: string;
  } = {},
): HTMLButtonElement {
  const node = h('button', options.className ?? 'btn', label);
  node.type = options.type ?? 'button';
  if (options.ariaLabel) node.setAttribute('aria-label', options.ariaLabel);
  if (options.title) node.title = options.title;
  if (options.pulse) node.classList.add('btn-pulse');
  if (options.onClick) node.addEventListener('click', options.onClick);
  return node;
}

export function iconButton(
  svg: string,
  label: string,
  options: {
    className?: string;
    onClick?: (event: MouseEvent) => void;
    title?: string;
  } = {},
): HTMLButtonElement {
  const node = h('button', options.className ?? 'icon-btn');
  node.type = 'button';
  node.setAttribute('aria-label', label);
  node.innerHTML = svg;
  if (options.title) node.title = options.title;
  if (options.onClick) node.addEventListener('click', options.onClick);
  return node;
}

export function setText(node: Element | null, value: string): void {
  if (node && node.textContent !== value) node.textContent = value;
}

export function setHidden(node: Element | null, hidden: boolean): void {
  if (!node) return;
  if (hidden) node.setAttribute('hidden', '');
  else node.removeAttribute('hidden');
}

export function starsMarkup(count: number, max = 3): string {
  return Array.from({ length: max }, (_, index) => (index < count ? '★' : '☆')).join('');
}

export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

export const ICONS = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor"/></svg>',
  pause:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 5h3.4v14H7V5Zm6.6 0H17v14h-3.4V5Z" fill="currentColor"/></svg>',
  reset:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5a7 7 0 1 1-6.6 4.7H3.2A9 9 0 1 0 12 3v2Z" fill="currentColor"/><path d="M12 1.5 16 5l-4 3.5v-7Z" fill="currentColor"/></svg>',
  shade:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 18.5 18.5 4l1.5 1.5L5.5 20 4 18.5Z" fill="currentColor"/></svg>',
  close:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  print:
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 3h10v4H7V3Zm-3 5h16v8h-3v5H7v-5H4V8Zm5 8v3h6v-3H9Z" fill="currentColor"/></svg>',
};
