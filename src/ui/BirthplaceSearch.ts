// Copyright (c) 2026 RSG-KH | Apache-2.0 License
import type { BirthplaceChoice } from '../data/BirthplaceHierarchy';
import { escapeHtml } from './html';

const BATCH_SIZE = 50;
const MAX_VISIBLE_RESULTS_HEIGHT = 178;
let nextId = 0;

function searchKey(value: string): string {
  // NFC keeps Khmer vowels and other combining marks meaningful.
  return value.trim().normalize('NFC').toLocaleLowerCase();
}

interface PreparedChoice<T> {
  choice: BirthplaceChoice<T>;
  labelKey: string;
  aliasKeys: string[];
}

export class BirthplaceSearch<T> {
  readonly element: HTMLElement;
  private input: HTMLInputElement;
  private clearButton: HTMLButtonElement;
  private list: HTMLElement;
  private options: PreparedChoice<T>[];
  private matches: PreparedChoice<T>[] = [];
  private rendered = 0;
  private active = -1;
  private edited = false;
  private id = `birthplace-search-${++nextId}`;
  private positionFrame = 0;
  private positionOverlay?: HTMLElement;
  private schedulePosition = () => {
    if (!this.positionFrame && !this.list.hidden) {
      this.positionFrame = requestAnimationFrame(() => {
        this.positionFrame = 0;
        this.positionList();
      });
    }
  };

  constructor(label: string, choices: BirthplaceChoice<T>[],
              private onSelect: (choice: BirthplaceChoice<T>) => void,
              private onEdit: () => void,
              private onOpen: (picker: BirthplaceSearch<T>) => void,
              private noMatches: string, clearLabel: string,
              private showAllOnFocus = false) {
    this.options = choices.map(choice => ({ choice, labelKey: searchKey(choice.label),
      aliasKeys: choice.aliases.map(searchKey).filter(Boolean) }));
    this.element = document.createElement('div');
    this.element.className = 'birthplace-search-step';
    this.element.innerHTML = `<input id="${this.id}" type="text" inputmode="search" enterkeyhint="search" role="combobox" aria-label="${escapeHtml(label)}" aria-autocomplete="list"
        aria-controls="${this.id}-list" aria-expanded="false" autocomplete="off"
        placeholder="${escapeHtml(label)}" />
      <button type="button" class="birthplace-search-clear" aria-label="${escapeHtml(clearLabel)} ${escapeHtml(label)}" hidden>×</button>
      <div id="${this.id}-list" class="birthplace-suggestions" role="listbox"
        aria-label="${escapeHtml(label)}" hidden></div>`;
    this.input = this.element.querySelector('input')!;
    this.clearButton = this.element.querySelector('.birthplace-search-clear')!;
    this.list = this.element.querySelector('.birthplace-suggestions')!;
    this.input.addEventListener('focus', () => this.show());
    this.input.addEventListener('click', () => this.show());
    this.input.addEventListener('input', () => {
      this.clearButton.hidden = !this.input.value;
      this.edited = true;
      this.onEdit();
      this.show();
    });
    this.input.addEventListener('keydown', event => this.onKeydown(event));
    this.clearButton.addEventListener('click', () => {
      this.input.value = '';
      this.input.dispatchEvent(new Event('input', { bubbles: true }));
      this.input.focus();
    });
    this.list.addEventListener('scroll', () => {
      if (this.list.scrollTop + this.list.clientHeight >= this.list.scrollHeight - 60) this.appendBatch();
    });
    this.list.addEventListener('click', event => {
      const option = (event.target as Element).closest<HTMLElement>('[data-choice-index]');
      if (option) this.choose(Number(option.dataset.choiceIndex));
    });
  }

  hide(): void {
    this.list.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    this.stopPositioning();
  }

  containsTarget(target: Node): boolean {
    return this.element.contains(target) || this.list.contains(target);
  }

  dispose(): void {
    this.hide();
    this.list.remove();
  }

  get value(): string { return this.input.value; }

  setValue(value: string): void {
    this.input.value = value;
    this.clearButton.hidden = !value;
    this.edited = false;
    this.hide();
  }

  setSelected(choice: BirthplaceChoice<T>): void {
    this.setValue(choice.label);
  }

  private show(): void {
    this.onOpen(this);
    const query = this.edited ? searchKey(this.input.value) : '';
    if (!this.showAllOnFocus && !query) { this.hide(); return; }
    const nameStarts: PreparedChoice<T>[] = [];
    const nameContains: PreparedChoice<T>[] = [];
    const pathStarts: PreparedChoice<T>[] = [];
    const pathContains: PreparedChoice<T>[] = [];
    for (const option of this.options) {
      if (!query || option.labelKey.startsWith(query)) nameStarts.push(option);
      else if (option.labelKey.includes(query)) nameContains.push(option);
      else if (option.aliasKeys.some(key => key.startsWith(query))) pathStarts.push(option);
      else if (option.aliasKeys.some(key => key.includes(query))) pathContains.push(option);
    }
    this.matches = nameStarts.concat(nameContains, pathStarts, pathContains);
    this.rendered = 0;
    this.active = -1;
    this.list.innerHTML = '';
    const overlay = this.element.closest<HTMLElement>('.modal-overlay');
    if (overlay && this.list.parentElement !== overlay) overlay.appendChild(this.list);
    this.list.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
    if (this.matches.length) this.appendBatch();
    else this.list.innerHTML = `<p class="birthplace-no-matches">${escapeHtml(this.noMatches)}</p>`;
    this.list.scrollTop = 0;
    this.startPositioning(overlay);
    this.positionList();
  }

  private startPositioning(overlay: HTMLElement | null): void {
    if (!overlay || this.positionOverlay === overlay) return;
    this.stopPositioning();
    this.positionOverlay = overlay;
    overlay.addEventListener('scroll', this.schedulePosition, true);
    window.addEventListener('resize', this.schedulePosition);
    window.visualViewport?.addEventListener('resize', this.schedulePosition);
    window.visualViewport?.addEventListener('scroll', this.schedulePosition);
  }

  private stopPositioning(): void {
    if (this.positionFrame) cancelAnimationFrame(this.positionFrame);
    this.positionFrame = 0;
    this.positionOverlay?.removeEventListener('scroll', this.schedulePosition, true);
    window.removeEventListener('resize', this.schedulePosition);
    window.visualViewport?.removeEventListener('resize', this.schedulePosition);
    window.visualViewport?.removeEventListener('scroll', this.schedulePosition);
    this.positionOverlay = undefined;
  }

  private positionList(): void {
    const overlay = this.positionOverlay;
    if (!overlay || this.list.hidden) return;
    const viewport = overlay.getBoundingClientRect();
    const input = this.input.getBoundingClientRect();
    const edge = 8;
    const gap = 4;
    const below = Math.max(0, viewport.bottom - edge - input.bottom - gap);
    const above = Math.max(0, input.top - viewport.top - edge - gap);
    const width = Math.min(input.width, viewport.width - edge * 2);
    const left = Math.max(edge, Math.min(input.left - viewport.left, viewport.width - edge - width));
    this.list.style.width = `${width}px`;
    const desired = Math.min(MAX_VISIBLE_RESULTS_HEIGHT, this.list.scrollHeight);
    const openAbove = below < desired && above > below;
    const height = Math.min(desired, openAbove ? above : below);
    const top = (openAbove ? input.top - gap - height : input.bottom + gap) - viewport.top;
    this.list.style.left = `${left}px`;
    this.list.style.right = 'auto';
    this.list.style.top = `${top}px`;
    this.list.style.bottom = 'auto';
    this.list.style.maxHeight = `${height}px`;
  }

  private appendBatch(): void {
    const end = Math.min(this.rendered + BATCH_SIZE, this.matches.length);
    if (end === this.rendered) return;
    const html = this.matches.slice(this.rendered, end).map(({ choice }, offset) => {
      const index = this.rendered + offset;
      return `<button type="button" role="option" id="${this.id}-option-${index}"
        data-choice-index="${index}" aria-selected="false">
        <span>${escapeHtml(choice.displayPath ?? choice.label)}</span>${choice.detail ? `<small>${escapeHtml(choice.detail)}</small>` : ''}
      </button>`;
    }).join('');
    this.list.insertAdjacentHTML('beforeend', html);
    this.rendered = end;
  }

  private setActive(index: number): void {
    if (!this.matches.length) return;
    this.active = Math.max(0, Math.min(index, this.matches.length - 1));
    while (this.rendered <= this.active) this.appendBatch();
    this.list.querySelectorAll('[aria-selected="true"]').forEach(option => option.setAttribute('aria-selected', 'false'));
    const option = this.list.querySelector<HTMLElement>(`[data-choice-index="${this.active}"]`)!;
    option.setAttribute('aria-selected', 'true');
    this.input.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({ block: 'nearest' });
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !this.list.hidden) {
      event.preventDefault();
      event.stopPropagation();
      this.hide();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!this.showAllOnFocus && (!this.edited || !searchKey(this.input.value))) return;
      event.preventDefault();
      if (this.list.hidden) this.show();
      this.setActive(this.active + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Enter' && !this.list.hidden && this.matches.length) {
      event.preventDefault();
      this.choose(this.active < 0 ? 0 : this.active);
    }
  }

  private choose(index: number): void {
    const selected = this.matches[index]?.choice;
    if (!selected) return;
    this.setSelected(selected);
    this.onSelect(selected);
  }
}
