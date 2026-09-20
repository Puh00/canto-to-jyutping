import { getJyutpingCandidates, getJyutpingList } from 'to-jyutping';
import type { Annotation } from './types';

export function annotate(source: string): Annotation[] {
  const candidates = getJyutpingCandidates(source);
  const annotations: Annotation[] = [];
  let offset = 0;

  getJyutpingList(source).forEach(([text, suggested], index) => {
    const start = offset;
    offset += text.length;
    const previous = annotations.at(-1);
    // Variation selectors and combining marks must share the base character's element.
    if (previous?.kind === 'han' && /^\p{Mark}+$/u.test(text)) {
      previous.text += text;
      previous.end = offset;
      return;
    }
    const kind = /\p{Script=Han}/u.test(text) ? 'han' : 'text';
    const reading = kind === 'han' ? suggested : null;
    const alternatives = kind === 'han'
      ? [...new Set(candidates[index]?.[1] ?? [])].filter(value => value !== reading)
      : [];
    annotations.push({ start, end: offset, text, kind, reading, alternatives });
  });
  return annotations;
}
