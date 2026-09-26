import type { RefObject } from 'react';
import styles from './reader.module.css';

type Props = {
  value: string;
  onChange: (value: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
};

export function TextInput({ value, onChange, inputRef }: Props) {
  return (
    <section className={styles.inputCard} aria-labelledby="input-title">
      <div className={styles.cardHeading}>
        <label id="input-title" htmlFor="cantonese-text">Cantonese text</label>
        {value && <button type="button" className={styles.clear} onClick={() => { onChange(''); inputRef.current?.focus(); }}>Clear text <span aria-hidden="true">×</span></button>}
      </div>
      <textarea
        id="cantonese-text"
        ref={inputRef}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={'Paste or type Cantonese characters here…'}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        className={styles.textarea}
      />
    </section>
  );
}
