import { useState } from 'react';
import { AppearanceControl } from './features/appearance/AppearanceControl';
import { Reader } from './features/reader/Reader';

import PhotoReader from './features/photo/PhotoReader';

export function App() {
  const [mode, setMode] = useState<'text' | 'photo'>('text');
  return (
    <div className="site-shell">
      <header className="site-header">
        <a href="./" className="brand" aria-label="Canto home">
          <span className="brand-mark" lang="zh-Hant">粵</span>
          <span>canto<span className="brand-dot">.</span></span>
        </a>
        <div className="header-actions">
          <AppearanceControl />
        </div>
      </header>
      <main>
        <div className="intro">
          <h1>Cantonese to Jyutping</h1>
        </div>
        <nav className="reader-modes" aria-label="Reading method">
          <button type="button" aria-pressed={mode === 'text'} onClick={() => setMode('text')}>Read text</button>
          <button type="button" aria-pressed={mode === 'photo'} onClick={() => setMode('photo')}>Read a photo</button>
        </nav>
        <div hidden={mode !== 'text'}><Reader active={mode === 'text'} /></div>
        {mode === 'photo' && <PhotoReader />}
      </main>
      <footer className="site-footer">
        <span>Text and photos are processed on your device. Audio loads from an external source.</span>
        <a href="https://github.com/AlienKevin/wordshk_app/tree/1571375f5daceab45d0393ac5a1a72b6a47067c0/assets/jyutping_female" target="_blank" rel="noreferrer">Audio source: words.hk app</a>
        <a href="./notices.txt">Built with ToJyutping <span aria-hidden="true">↗</span></a>
      </footer>
    </div>
  );
}
