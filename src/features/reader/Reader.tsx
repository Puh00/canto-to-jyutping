import { useMemo, useRef, useState } from 'react';
import type { Annotation } from '../../pronunciation/types';
import { PronunciationDetails } from './PronunciationDetails';
import { annotate } from '../../pronunciation/annotate';
import { AnnotatedText } from './AnnotatedText';
import { TextInput } from './TextInput';
import styles from './reader.module.css';

const examples = [
  { label: 'A café order', text: '咖啡 Coffee $28\n牛肉麵 $58' },
  { label: 'A street sign', text: '旺角\n請勿吸煙' },
  { label: 'Everyday Cantonese', text: '佢喺屋企' },
];

export function Reader() {
  const [source, setSource] = useState('');
  const [selected, setSelected] = useState<Annotation | null>(null);
  function changeSource(value: string) { setSelected(null); setSource(value); }
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tokens = useMemo(() => annotate(source), [source]);
  const hasText = source.trim().length > 0;
  const hasReadings = tokens.some(token => token.kind === 'han');
  const hasAlternatives = tokens.some(token => token.kind === 'han' && token.alternatives.length > 0);

  return (
    <div className={styles.reader}>
      <div className={styles.workspace}>
        <TextInput value={source} onChange={changeSource} inputRef={inputRef} />
        <section className={styles.outputCard} aria-labelledby="output-title">
          <div className={styles.cardHeading}>
            <h2 id="output-title">Jyutping</h2>
          </div>
          <div className={styles.outputBody}>
            {hasText ? <><AnnotatedText tokens={tokens} onInspect={setSelected} />{hasAlternatives && <p className={styles.readingHint}>Tap an underlined reading to see alternatives.</p>}</> : (
              <div className={styles.empty}>
                <div className={styles.exampleCharacters} aria-hidden="true">
                  <span>你<small>nei5</small></span><span>好<small>hou2</small></span>
                </div>
                <p>Paste Chinese text to see its Jyutping.</p>
              </div>
            )}
          </div>
        </section>
      </div>
      <div className={styles.exampleRow}>
        <span>Try an example</span>
        {examples.map(example => <button key={example.label} type="button" onClick={() => changeSource(example.text)}>{example.label}<span aria-hidden="true">↗</span></button>)}
      </div>
      {selected && <PronunciationDetails token={selected} onClose={() => setSelected(null)} />}
      {hasReadings && <p className={styles.accuracy}>Suggested readings may be incorrect.</p>}
    </div>
  );
}

