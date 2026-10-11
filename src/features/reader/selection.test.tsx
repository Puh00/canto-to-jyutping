import { fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { annotate } from '../../pronunciation/annotate';
import { AnnotatedText } from './AnnotatedText';
import { selectedSource } from './selection';

afterEach(() => window.getSelection()?.removeAllRanges());

/** Render a reading with observable audio and inspection callbacks. */
function reading(source: string) {
  const onPlay = vi.fn();
  const onInspect = vi.fn();
  const view = render(<AnnotatedText tokens={annotate(source)} onPlay={onPlay} onInspect={onInspect} canPlayReading={value => value !== null} />);
  const container = view.container.firstElementChild as HTMLElement;
  return { ...view, container, onPlay, onInspect };
}

/** Set a DOM selection with text-node or element boundaries and return it. */
function select(start: Node, startOffset: number, end: Node, endOffset: number) {
  const selection = window.getSelection()!;
  const range = document.createRange();
  range.setStart(start, startOffset);
  range.setEnd(end, endOffset);
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

it('copies exact source text without annotation or layout whitespace', () => {
  const source = ' 銀行\nCoffee $28，𠀀\u{E0100} e\u0301 👩‍👩‍👧‍👦\n';
  const { container } = reading(source);
  const selection = select(container, 0, container, container.childNodes.length);
  expect(selectedSource(container, source, selection)).toBe(source);
  const setData = vi.fn();
  expect(fireEvent.copy(container, { clipboardData: { setData } })).toBe(false);
  expect(setData).toHaveBeenCalledExactlyOnceWith('text/plain', source);
});

it('copies partial plain text and expands partial graphemes', () => {
  const source = '銀行 Coffee e\u0301 👩‍👩‍👧‍👦';
  const { container } = reading(source);
  const node = container.querySelectorAll('[data-source-start]')[2]!.firstChild!;
  expect(selectedSource(container, source, select(node, 2, node, 5))).toBe('off');
  expect(selectedSource(container, source, select(node, 8, node, 9))).toBe('e\u0301');
  expect(selectedSource(container, source, select(node, 12, node, 13))).toBe('👩‍👩‍👧‍👦');
});

it('keeps a supplementary Han character and its variation selector together', () => {
  const source = '𠀀\u{E0100}行';
  const { container } = reading(source);
  const node = container.querySelector('[data-source-start]')!.firstChild!;
  expect(selectedSource(container, source, select(node, 1, node, 2))).toBe('𠀀\u{E0100}');
});

it('respects element boundaries and partial selections crossing into plain text', () => {
  const source = '銀行 Coffee';
  const { container } = reading(source);
  const nodes = container.querySelectorAll('[data-source-start]');
  expect(selectedSource(container, source, select(container, 1, container, 2))).toBe('行');
  expect(selectedSource(container, source, select(nodes[1]!.firstChild!, 0, nodes[2]!.firstChild!, 4))).toBe('行 Cof');
});

it('keeps characters without audio selectable without activating them', () => {
  const source = '𠀀';
  const { container, getByRole, onPlay } = reading(source);
  const character = getByRole('button', { name: '𠀀. Audio unavailable' });
  fireEvent.click(character);
  fireEvent.keyDown(character, { key: 'Enter' });
  expect(onPlay).not.toHaveBeenCalled();
  expect(selectedSource(container, source, select(container, 0, container, 1))).toBe(source);
});

it('leaves collapsed, pronunciation-only, and external selections alone', () => {
  const { container } = reading('銀行');
  const node = container.querySelector('[lang="yue-Latn"]')!.firstChild!;
  expect(selectedSource(container, '銀行', select(node, 0, node, 2))).toBeNull();
  expect(selectedSource(container, '銀行', select(container, 0, container, 0))).toBeNull();
  expect(selectedSource(container, '銀行', select(document.body, 0, container, 1))).toBeNull();
  const setData = vi.fn();
  expect(fireEvent.copy(container, { clipboardData: { setData } })).toBe(true);
  expect(setData).not.toHaveBeenCalled();
});

it('suppresses selection clicks but preserves subsequent taps and keyboard activation', () => {
  const { container, getByRole, onPlay, onInspect } = reading('銀行');
  const character = getByRole('button', { name: '銀, ngan4. Play pronunciation' });
  fireEvent.pointerDown(character);
  select(container, 0, container, container.childNodes.length);
  fireEvent(document, new Event('selectionchange'));
  window.getSelection()!.removeAllRanges();
  fireEvent.click(character, { detail: 1 });
  fireEvent.click(getByRole('button', { name: '行, hong4. View other readings' }), { detail: 1 });
  expect(onPlay).not.toHaveBeenCalled();
  expect(onInspect).not.toHaveBeenCalled();
  fireEvent.pointerDown(character);
  fireEvent.click(character, { detail: 1 });
  fireEvent.keyDown(character, { key: 'Enter' });
  fireEvent.keyDown(character, { key: ' ' });
  expect(onPlay).toHaveBeenCalledTimes(3);
});
