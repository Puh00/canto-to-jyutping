import type { Annotation } from '../../pronunciation/types';
import styles from './reader.module.css';

type Props = {
  tokens: readonly Annotation[];
  onInspect: (token: Annotation) => void;
};

export function AnnotatedText({ tokens, onInspect }: Props) {
  // Adjacent unannotated text stays together, including emoji sequences and spacing.
  const runs: (Annotation | string)[] = [];
  for (const token of tokens) {
    if (token.kind === 'text') {
      const last = runs[runs.length - 1];
      if (typeof last === 'string') runs[runs.length - 1] = last + token.text;
      else runs.push(token.text);
    } else runs.push(token);
  }

  return <div className={styles.annotations} lang="zh-Hant">
    {runs.map((run, index) => {
      if (typeof run === 'string') return <span key={`text-${index}`} className={styles.plain}>{run}</span>;
      const content = <>
        <span className={styles.character}>{run.text}</span>
        <span className={styles.reading} lang="yue-Latn">{run.reading ?? '?'}</span>
      </>;
      const interactive = run.reading === null || run.alternatives.length > 0;
      return interactive
        ? <button
            key={run.start}
            type="button"
            className={`${styles.token} ${styles.interactive} ${run.reading === null ? styles.missing : ''}`}
            onClick={() => onInspect(run)}
            aria-haspopup="dialog"
            aria-label={run.reading ? `${run.text}, ${run.reading}. View other readings` : `${run.text}. No pronunciation found`}
          >{content}</button>
        : <span key={run.start} className={styles.token}>{content}</span>;
    })}
  </div>;
}
