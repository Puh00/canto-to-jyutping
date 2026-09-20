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
        <div><span className={styles.step}>01</span><label id="input-title" htmlFor="chinese-text">Chinese text</label></div>
        <span className={styles.language}>Traditional Chinese</span>
      </div>
      <textarea
        id="chinese-text"
        ref={inputRef}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={'Paste or type Chinese characters here…'}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        aria-describedby="input-help"
        className={styles.textarea}
      />
      <div className={styles.inputFooter}>
        <span id="input-help">Updates as you type</span>
        {value && <button type="button" className={styles.clear} onClick={() => { onChange(''); inputRef.current?.focus(); }}>Clear text <span aria-hidden="true">×</span></button>}
      </div>
    </section>
  );
}
