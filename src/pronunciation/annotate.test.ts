import fixtures from '../../tests/fixtures/reading-examples.json';
import { describe, expect, it } from 'vitest';
import { annotate } from './annotate';

describe('pronunciation annotations', () => {
  it('uses the surrounding word to read 行 differently in a bank and in walking', () => {
    expect(annotate('銀行 行路').map(token => token.reading)).toEqual([
      'ngan4', 'hong4', null, 'haang4', 'lou6',
    ]);
  });

  it('offers other readings without replacing the contextual reading', () => {
    const token = annotate('銀行')[1]!;
    expect(token.reading).toBe('hong4');
    expect(token.alternatives).toContain('haang4');
    expect(token.alternatives).not.toContain('hong4');
  });
});

it.each(fixtures.examples)('matches reviewed dictionary readings for $input', fixture => {
  const reading = annotate(fixture.input).map(token => token.reading).join(' ');
  expect(fixture.accepted).toContain(reading);
});

it('preserves Unicode and mixed text with original UTF-16 source offsets', () => {
  const source = '𠀀😀咖啡\nCoffee $28 👩🏽‍💻';
  const tokens = annotate(source);
  expect(tokens.map(token => token.text).join('')).toBe(source);
  expect(tokens.every(token => source.slice(token.start, token.end) === token.text)).toBe(true);
  expect(tokens[0]).toMatchObject({ text: '𠀀', start: 0, end: 2, kind: 'han', reading: null });
  expect(tokens[1]).toMatchObject({ text: '😀', start: 2, end: 4, kind: 'text', reading: null });
  expect(tokens.filter(token => token.kind === 'text').every(token => token.reading === null && token.alternatives.length === 0)).toBe(true);
});

it('preserves a character that has a multisyllabic reading', () => {
  const result = annotate('瓩');
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ text: '瓩', reading: 'cin1 ngaa5', start: 0, end: 1 });
});

it('returns no annotations for an empty input', () => {
  expect(annotate('')).toEqual([]);
});


it.each(['神\uFE00', '神\u{E0100}', '神\u0301'])('keeps trailing Unicode marks attached to the source character in %s', source => {
  const result = annotate(source + '行路');
  expect(result[0]).toMatchObject({ text: source, start: 0, end: source.length, reading: 'san4', kind: 'han' });
  expect(result[1]).toMatchObject({ text: '行', start: source.length, end: source.length + 1, reading: 'haang4' });
  expect(result.map(token => token.text).join('')).toBe(source + '行路');
});
