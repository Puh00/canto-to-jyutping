export type Annotation = {
  /** UTF-16 offset in the unchanged source, compatible with String.slice. */
  start: number;
  end: number;
  text: string;
  kind: 'han' | 'text';
  reading: string | null;
  alternatives: readonly string[];
};
