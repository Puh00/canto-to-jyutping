import { useState } from 'react';
import { AppearanceControl } from './features/appearance/AppearanceControl';
import { Reader } from './features/reader/Reader';

import PhotoReader from './features/photo/PhotoReader';

export function App() {
  const [mode, setMode] = useState<'text' | 'photo'>('text');
  return (
    <div className="site-shell">
      <header className="site-header">
        <a href="./" className="brand" aria-label="Cantonese Reader home">
          <span className="brand-mark" lang="zh-Hant">粵</span>
          <span>Cantonese Reader</span>
        </a>
        <div className="header-actions">
          <AppearanceControl />
        </div>
      </header>
      <main>
        <div className="intro">
          <h1>Read Cantonese, one character at a time</h1>
          <p>Paste text or choose a photo to see Jyutping beneath each character.</p>
        </div>
        <nav className="reader-modes" aria-label="Reading method">
          <button type="button" aria-pressed={mode === 'text'} onClick={() => setMode('text')}>Read text</button>
          <button type="button" aria-pressed={mode === 'photo'} onClick={() => setMode('photo')}>Read a photo</button>
        </nav>
        <div hidden={mode !== 'text'}><Reader /></div>
        {mode === 'photo' && <PhotoReader />}
      </main>
      <footer className="site-footer">
        <span>Text and photos are processed on your device.</span>
        <a href="./notices.txt">Built with ToJyutping <span aria-hidden="true">↗</span></a>
      </footer>
    </div>
  );
}
