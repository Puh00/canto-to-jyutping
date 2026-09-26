import { describe, expect, it } from 'vitest';
import { highlightBounds } from './highlight-bounds';

describe('highlight bounds', () => {
  it('uses the complete image when reading the whole photo', () => {
    expect(highlightBounds(1000, 520)).toEqual({ left: 0, top: 0, width: 1000, height: 520 });
  });
  it('includes the brush radius and eight pixels of surrounding context', () => {
    expect(highlightBounds(1000, 520, [{ width: .12, points: [{ x: .075, y: .2 }, { x: .285, y: .2 }] }]))
      .toEqual({ left: 7, top: 36, width: 346, height: 136 });
  });
  it('keeps disjoint highlighted areas in a single rectangle', () => {
    expect(highlightBounds(1000, 520, [
      { width: .12, points: [{ x: .075, y: .2 }, { x: .285, y: .2 }] },
      { width: .12, points: [{ x: .075, y: .7 }, { x: .285, y: .7 }] },
    ])).toEqual({ left: 7, top: 36, width: 346, height: 396 });
  });
  it('clips strokes and padding at the photo edges, including portrait photos', () => {
    expect(highlightBounds(300, 600, [{ width: .2, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }]))
      .toEqual({ left: 0, top: 0, width: 300, height: 600 });
    expect(highlightBounds(300, 600, [{ width: .2, points: [{ x: .5, y: .5 }] }]))
      .toEqual({ left: 112, top: 262, width: 76, height: 76 });
  });
  it('rounds fractional bounds outward and rejects empty selections', () => {
    expect(highlightBounds(101, 201, [{ width: .1, points: [{ x: .5, y: .5 }] }]))
      .toEqual({ left: 37, top: 87, width: 27, height: 27 });
    expect(() => highlightBounds(101, 201, [])).toThrow('Highlight some text first.');
    expect(() => highlightBounds(101, 201, [{ width: .1, points: [] }])).toThrow('Highlight some text first.');
  });
});
