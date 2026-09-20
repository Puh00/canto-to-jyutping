import { useState } from 'react';
import styles from './appearance.module.css';

type Appearance = 'system' | 'light' | 'dark';

export function AppearanceControl() {
  const [appearance, setAppearance] = useState<Appearance>(() => {
    const saved = document.documentElement.dataset.theme;
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  });

  function changeAppearance(value: Appearance) {
    setAppearance(value);
    if (value === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = value;
    try {
      if (value === 'system') localStorage.removeItem('canto-theme');
      else localStorage.setItem('canto-theme', value);
    } catch {
      // Appearance still changes when browser storage is unavailable.
    }
  }

  return <label className={styles.control}>
    <span>Appearance</span>
    <select value={appearance} onChange={event => changeAppearance(event.target.value as Appearance)}>
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>;
}
