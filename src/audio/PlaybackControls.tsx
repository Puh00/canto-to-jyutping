import type { usePlayback } from './usePlayback';
import { PlaybackIcon } from './PlaybackIcon';
import styles from './playback.module.css';

export function PlaybackControls({ playback }: { playback: ReturnType<typeof usePlayback> }) {
  const running = ['loading', 'playing', 'paused'].includes(playback.status);
  const paused = playback.status === 'paused';
  const label = running ? paused ? 'Resume' : 'Pause' : 'Read aloud';
  return <div className={styles.playback} role="group" aria-label="Audio playback">
    <div className={styles.buttons}>
      <button type="button" aria-label={label} title={label} disabled={!running && !playback.canPlay}
        onClick={running ? paused ? playback.resume : playback.pause : playback.play}>
        <PlaybackIcon kind={running && !paused ? 'pause' : 'play'} />
      </button>
      <button type="button" aria-label="Stop" title="Stop" disabled={!running} onClick={playback.stop}>
        <PlaybackIcon kind="stop" />
      </button>
    </div>
    <span role="status" className={styles.message}>{playback.status === 'loading' ? 'Loading audio…' : playback.status === 'paused' ? 'Audio paused.' : ''}</span>
    {playback.error && <span role="alert" className={styles.message}>{playback.error}</span>}
    {playback.skipped > 0 && <span className={styles.message}>{playback.skipped} Chinese {playback.skipped === 1 ? 'character has' : 'characters have'} no audio and will be skipped.</span>}
  </div>;
}
