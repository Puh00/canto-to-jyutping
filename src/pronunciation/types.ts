export type Annotation = {
  /** UTF-16 offset in the unchanged source, compatible with String.slice. */
  start: number;
  end: number;
  /** Original source text, including any marks attached to a Han character. */
  text: string;
  kind: 'han' | 'text';
  reading: string | null;
  alternatives: readonly string[];
};
