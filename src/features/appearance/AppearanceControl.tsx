import { useEffect, useState } from 'react';
import styles from './appearance.module.css';

type Appearance = 'system' | 'light' | 'dark';

export function AppearanceControl() {
  const [appearance, setAppearance] = useState<Appearance>(() => {
    const saved = document.documentElement.dataset.theme;
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    media.addEventListener('change', update);
    update();
    return () => media.removeEventListener('change', update);
  }, []);

  const dark = appearance === 'dark' || (appearance === 'system' && systemDark);
  const description = `${dark ? 'Dark' : 'Light'} appearance${appearance === 'system' ? ' (system)' : ''}. Switch to ${dark ? 'light' : 'dark'}`;

  function changeAppearance(value: 'light' | 'dark') {
    setAppearance(value);
    document.documentElement.dataset.theme = value;
    try {
      localStorage.setItem('canto-theme', value);
    } catch {
      // Appearance still changes when browser storage is unavailable.
    }
  }

  return <button type="button" role="switch" className={styles.toggle} aria-label="Dark mode" aria-checked={dark}
    title={description} onClick={() => changeAppearance(dark ? 'light' : 'dark')}>
    <span className={styles.thumb} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        {dark
          ? <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
          : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>}
      </svg>
    </span>
  </button>;
}
