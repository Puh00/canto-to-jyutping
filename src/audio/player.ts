import type { Annotation } from '../pronunciation/types';
import syllables from './syllables.json';

export const AUDIO_BASE = 'https://raw.githubusercontent.com/AlienKevin/wordshk_app/1571375f5daceab45d0393ac5a1a72b6a47067c0/assets/jyutping_female/';
const available = new Set(syllables);
export const hasAudio = (reading: string | null) => reading !== null && available.has(reading);
export type Clip = { start: number; reading: string };
export type PlaybackState = {
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'error';
  activeStart: number | null;
  activeReading?: string;
  error: string;
};
const idle: PlaybackState = { status: 'idle', activeStart: null, error: '' };

export function playlist(tokens: readonly Annotation[]) {
  const clips: Clip[] = [];
  let skipped = 0;
  for (const token of tokens) {
    if (token.kind !== 'han') continue;
    if (token.reading && available.has(token.reading)) clips.push({ start: token.start, reading: token.reading });
    else skipped++;
  }
  return { clips, skipped };
}

/** Owns one sequence. No audio context or network activity before play(). */
export class AudioPlayer {
  private state: PlaybackState = idle;
  private listeners = new Set<(state: PlaybackState) => void>();
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private generation = 0;
  private abort: AbortController | null = null;
  private cache = new Map<string, AudioBuffer>();
  private pending = new Map<string, Promise<AudioBuffer>>();
  private release: (() => void) | null = null;
  private resumeWait: (() => void) | null = null;
  private paused = false;
  private transportVersion = 0;

  subscribe(listener: (state: PlaybackState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => { this.listeners.delete(listener); };
  }

  private publish(state: PlaybackState) {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }

  stop = () => {
    this.generation++;
    this.transportVersion++;
    this.abort?.abort();
    this.abort = null;
    this.pending.clear();
    this.paused = false;
    this.resumeWait?.(); this.resumeWait = null;
    this.release?.(); this.release = null;
    if (this.source) {
      this.source.onended = null;
      // A failed start can leave an unstarted node to clean up.
      try { this.source.stop(); } catch { /* Already stopped or never started. */ }
      this.source.disconnect();
      this.source = null;
    }
    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
    this.publish(idle);
  };

  reset = () => { this.stop(); this.cache.clear(); };

  private fail(id: number) {
    if (id !== this.generation) return;
    this.stop();
    this.publish({ status: 'error', activeStart: null, error: 'Audio could not play. Check your connection and try again.' });
  }

  pause = () => {
    if (!this.context || !['loading', 'playing'].includes(this.state.status)) return;
    this.paused = true;
    this.transportVersion++;
    const id = this.generation;
    this.publish({ ...this.state, status: 'paused' });
    void this.context.suspend().catch(() => this.fail(id));
  };

  resume = () => {
    if (!this.context || !this.paused) return;
    const id = this.generation;
    const version = ++this.transportVersion;
    // Called directly by the button gesture, before awaiting anything.
    void this.context.resume().then(() => {
      if (id !== this.generation || version !== this.transportVersion) return;
      this.paused = false;
      this.publish({ ...this.state, status: this.source ? 'playing' : 'loading' });
      this.resumeWait?.(); this.resumeWait = null;
    }).catch(() => this.fail(id));
  };

  private load(reading: string, context: AudioContext, signal: AbortSignal): Promise<AudioBuffer> {
    const cached = this.cache.get(reading);
    if (cached) return Promise.resolve(cached);
    const pending = this.pending.get(reading);
    if (pending) return pending;
    const request = (async () => {
      const controller = new AbortController();
      const cancel = () => controller.abort();
      signal.addEventListener('abort', cancel, { once: true });
      const timeout = setTimeout(cancel, 15_000);
      try {
        const response = await fetch(`${AUDIO_BASE}${reading}.mp3`, { signal: controller.signal, referrerPolicy: 'no-referrer' });
        if (!response.ok) throw new Error('Audio request failed');
        const bytes = await response.arrayBuffer();
        const buffer = await context.decodeAudioData(bytes);
        if (signal.aborted || controller.signal.aborted) throw new Error('Audio request canceled');
        this.cache.set(reading, buffer);
        return buffer;
      } finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', cancel);
      }
    })();
    this.pending.set(reading, request);
    // Prefetch failures are handled when that clip reaches the front of the queue.
    void request.catch(() => {});
    return request;
  }

  play = (clips: readonly Clip[]) => {
    this.stop();
    if (!clips.length) return;
    if (typeof AudioContext === 'undefined') {
      this.publish({ status: 'error', activeStart: null, error: 'Audio playback is not supported in this browser. Try a browser with Web Audio support.' });
      return;
    }
    const id = this.generation;
    try {
      const context = this.context = new AudioContext();
      this.abort = new AbortController();
      const signal = this.abort.signal;
      const resumed = context.resume();
      this.publish({ status: 'loading', activeStart: null, error: '' });
      void (async () => {
        await resumed;
        for (let index = 0; index < clips.length; index++) {
          if (id !== this.generation) return;
          for (const clip of clips.slice(index, index + 3)) void this.load(clip.reading, context, signal).catch(() => {});
          const clip = clips[index]!;
          const buffer = await this.load(clip.reading, context, signal);
          if (id !== this.generation) return;
          if (this.paused) await new Promise<void>(resolve => { this.resumeWait = resolve; });
          if (id !== this.generation) return;
          const source = this.source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(context.destination);
          await new Promise<void>((resolve, reject) => {
            this.release = resolve;
            source.onended = () => resolve();
            try {
              source.start();
              this.publish({ status: 'playing', activeStart: clip.start, activeReading: clip.reading, error: '' });
            } catch (error) { reject(error); }
          });
          if (id !== this.generation) return;
          source.disconnect(); this.source = null; this.release = null;
          this.publish({ status: this.paused ? 'paused' : 'loading', activeStart: null, error: '' });
        }
        if (id === this.generation) this.stop();
      })().catch(() => this.fail(id));
    } catch { this.fail(id); }
  };
}
