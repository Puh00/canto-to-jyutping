import { getJyutpingCandidates, getJyutpingList } from 'to-jyutping';
import type { Annotation } from './types';

/** Source positions are UTF-16 offsets; conversion sees the entire original text. */
export function annotate(source: string): Annotation[] {
  const candidates = getJyutpingCandidates(source);
  let offset = 0;

  return getJyutpingList(source).map(([text, suggested], index) => {
    const start = offset;
    offset += text.length;
    const kind = /\p{Script=Han}/u.test(text) ? 'han' : 'text';
    const reading = kind === 'han' ? suggested : null;
    const alternatives = kind === 'han'
      ? [...new Set(candidates[index]?.[1] ?? [])].filter(value => value !== reading)
      : [];

    return { start, end: offset, text, kind, reading, alternatives };
  });
}
