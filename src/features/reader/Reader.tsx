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
  const characterCount = tokens.filter(token => token.kind === 'han').length;

  return (
    <div className={styles.reader}>
      <div className={styles.workspace}>
        <TextInput value={source} onChange={changeSource} inputRef={inputRef} />
        <section className={styles.outputCard} aria-labelledby="output-title">
          <div className={styles.cardHeading}>
            <div><span className={styles.step}>02</span><h2 id="output-title">Your Cantonese reading</h2></div>
            <span className={styles.outputBadge}>Jyutping</span>
          </div>
          <div className={styles.outputBody}>
            {hasText ? <><AnnotatedText tokens={tokens} onInspect={setSelected} /><p className={styles.readingHint}>Tap a character with an underlined reading to see alternatives.</p></> : (
              <div className={styles.empty}>
                <div className={styles.exampleCharacters} aria-hidden="true">
                  <span>你<small>nei5</small></span><span>好<small>hou2</small></span>
                </div>
                <p>Your reading starts here.</p>
                <span>Jyutping will appear below each character.</span>
              </div>
            )}
          </div>
          <div className={styles.outputFooter}>
            <span className={styles.smallDot} />
            <span role="status">{hasText ? `${characterCount} Chinese ${characterCount === 1 ? 'character' : 'characters'}` : 'Ready when you are'}</span>
          </div>
        </section>
      </div>
      <div className={styles.exampleRow}>
        <span>Try a little Cantonese</span>
        {examples.map(example => <button key={example.label} type="button" onClick={() => changeSource(example.text)}>{example.label}<span aria-hidden="true">↗</span></button>)}
      </div>
      {selected && <PronunciationDetails token={selected} onClose={() => setSelected(null)} />}
      <p className={styles.accuracy}>Some characters have multiple readings. Suggested pronunciations may be incorrect.</p>
    </div>
  );
}

