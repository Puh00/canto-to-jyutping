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
          <span className="header-note"><span className="status-dot" /> Made for the way you speak</span>
          <AppearanceControl />
        </div>
      </header>
      <main>
        <div className="intro">
          <p className="eyebrow"><span /> CHINESE CHARACTERS, CANTONESE PRONUNCIATION</p>
          <h1>The words you know.<br /><em>The characters you don’t.</em></h1>
          <p className="intro-copy">A little help reading the Cantonese around you.<br className="desktop-break" /> Add Chinese text and find its Jyutping, character by character.</p>
        </div>
        <nav className="reader-modes" aria-label="Reading method">
          <button type="button" aria-pressed={mode === 'text'} onClick={() => setMode('text')}>Read text</button>
          <button type="button" aria-pressed={mode === 'photo'} onClick={() => setMode('photo')}>Read a photo</button>
        </nav>
        <div hidden={mode !== 'text'}><Reader /></div>
        {mode === 'photo' && <PhotoReader />}
        <aside className="reassurance" aria-label="About this reader">
          <div><span className="assurance-icon" aria-hidden="true">↗</span><p><strong>Open. Paste. Read.</strong><span>No account. No extra steps.</span></p></div>
          <div><span className="assurance-icon assurance-character" aria-hidden="true">字</span><p><strong>Your words stay yours.</strong><span>Original characters, with pronunciation.</span></p></div>
          <div><span className="assurance-icon" aria-hidden="true">⌂</span><p><strong>Right here on your device.</strong><span>Your text isn’t sent to a server.</span></p></div>
        </aside>
      </main>
      <footer className="site-footer">
        <span>A small bridge between speaking and reading.</span>
        <a href="./notices.txt">Built with ToJyutping <span aria-hidden="true">↗</span></a>
      </footer>
    </div>
  );
}
