/**
 * Return the source substring selected within a reading, excluding pronunciation nodes.
 * Source spans must contain one text node and their UTF-16 source offset.
 * Return null for selections outside the reading or without selected source text.
 * Expand partial graphemes so copying cannot detach marks or split emoji/surrogates.
 */
export function selectedSource(container: HTMLElement, source: string, selection: Selection | null): string | null {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return null;

  let start = Infinity;
  let end = -Infinity;
  for (const element of container.querySelectorAll<HTMLElement>('[data-source-start]')) {
    const node = element.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE || !range.intersectsNode(node)) continue;
    const localStart = range.startContainer === node ? range.startOffset : 0;
    const localEnd = range.endContainer === node ? range.endOffset : node.textContent!.length;
    if (localStart >= localEnd) continue;
    const offset = Number(element.dataset.sourceStart);
    start = Math.min(start, offset + localStart);
    end = Math.max(end, offset + localEnd);
  }
  if (start === Infinity) return null;

  for (const part of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(source)) {
    const boundary = part.index + part.segment.length;
    if (part.index < start && start < boundary) start = part.index;
    if (part.index < end && end < boundary) end = boundary;
    if (boundary >= end) break;
  }
  return source.slice(start, end);
}
