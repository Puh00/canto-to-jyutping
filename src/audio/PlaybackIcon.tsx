export function PlaybackIcon({ kind }: { kind: 'play' | 'pause' | 'stop' }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false">
    {kind === 'play' ? <path d="M7 4v16l13-8z" />
      : kind === 'pause' ? <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
      : <rect x="5" y="5" width="14" height="14" rx="1" />}
  </svg>;
}
