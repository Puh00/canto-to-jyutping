import { useEffect, useMemo, useState } from 'react';
import type { Annotation } from '../pronunciation/types';
import { AudioPlayer, hasAudio, playlist } from './player';
import type { PlaybackState } from './player';

export function usePlayback(tokens: readonly Annotation[], enabled = true) {
  const [player] = useState(() => new AudioPlayer());
  const [state, setState] = useState<PlaybackState>({ status: 'idle', activeStart: null, error: '' });
  const queue = useMemo(() => playlist(tokens), [tokens]);
  useEffect(() => player.subscribe(setState), [player]);
  useEffect(() => { player.reset(); return player.reset; }, [player, tokens]);
  useEffect(() => { if (!enabled) player.stop(); }, [enabled, player]);
  return { ...state, skipped: queue.skipped, canPlay: enabled && queue.clips.length > 0,
    canPlayReading: (reading: string | null) => enabled && hasAudio(reading),
    playReading: (start: number, reading: string) => { if (enabled && hasAudio(reading)) player.play([{ start, reading }]); },
    play: () => { if (enabled) player.play(queue.clips); }, pause: player.pause, resume: player.resume, stop: player.stop };
}
