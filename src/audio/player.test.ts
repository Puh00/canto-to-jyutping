import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { annotate } from '../pronunciation/annotate';
import { AudioPlayer, playlist } from './player';
import type { PlaybackState } from './player';

class Source {
  buffer: unknown;
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}
class Context {
  static instances: Context[] = [];
  state = 'running';
  destination = {};
  sources: Source[] = [];
  constructor() { Context.instances.push(this); }
  resume = vi.fn(async () => { this.state = 'running'; });
  suspend = vi.fn(async () => { this.state = 'suspended'; });
  close = vi.fn(async () => { this.state = 'closed'; });
  decodeAudioData = vi.fn(async () => ({}));
  createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
}
let player: AudioPlayer;
let state: PlaybackState;
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const response = () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) });

beforeEach(() => {
  Context.instances = [];
  vi.stubGlobal('AudioContext', Context);
  vi.stubGlobal('fetch', vi.fn(async () => response()));
  player = new AudioPlayer();
  player.subscribe(value => { state = value; });
});
afterEach(() => { player.reset(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('keeps source offsets and contextual readings, and counts only unsupported Chinese characters', () => {
  const tokens = annotate('銀行 行路 𠀀 Coffee 28 神\uFE00');
  const queue = playlist(tokens);
  expect(queue.skipped).toBe(1);
  expect(queue.clips.filter(c => ['hong4', 'haang4'].includes(c.reading))).toEqual([
    { start: 1, reading: 'hong4' }, { start: 3, reading: 'haang4' },
  ]);
  expect(queue.clips.at(-1)?.start).toBe(tokens.at(-1)?.start);
});

it('does no work until play, fetches repeated readings once, and highlights the correct occurrence', async () => {
  expect(fetch).not.toHaveBeenCalled();
  expect(Context.instances).toHaveLength(0);
  player.play(playlist(annotate('你你')).clips);
  await flush();
  const context = Context.instances[0]!;
  expect(state).toMatchObject({ status: 'playing', activeStart: 0 });
  expect(fetch).toHaveBeenCalledTimes(1);
  context.sources[0]!.onended?.(); await flush();
  expect(state.activeStart).toBe(1);
  context.sources[1]!.onended?.(); await flush();
  expect(state).toMatchObject({ status: 'idle', activeStart: null });
});

it('prefetches only the current clip and next two', async () => {
  player.play(playlist(annotate('你好多謝')).clips);
  await flush();
  expect(fetch).toHaveBeenCalledTimes(3);
  Context.instances[0]!.sources[0]!.onended?.(); await flush();
  expect(fetch).toHaveBeenCalledTimes(4);
});

it('retains highlight on pause and resumes the same source', async () => {
  player.play(playlist(annotate('你好')).clips); await flush();
  const context = Context.instances[0]!;
  player.pause(); await flush();
  expect(state).toMatchObject({ status: 'paused', activeStart: 0 });
  expect(context.state).toBe('suspended');
  player.resume(); await flush();
  expect(state.status).toBe('playing');
  expect(context.sources).toHaveLength(1);
  player.stop();
  expect(context.sources[0]!.stop).toHaveBeenCalled();
  expect(state.activeStart).toBeNull();
});

it('does not start a loaded clip while paused during download', async () => {
  let release!: (value: ReturnType<typeof response>) => void;
  vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { release = resolve as typeof release; }));
  player.play(playlist(annotate('你')).clips); await flush();
  player.pause();
  release(response()); await flush();
  expect(Context.instances[0]!.sources).toHaveLength(0);
  expect(state).toMatchObject({ status: 'paused', activeStart: null });
  player.resume(); await flush();
  expect(state).toMatchObject({ status: 'playing', activeStart: 0 });
});

it('ignores late downloads after stop and after starting a replacement reading', async () => {
  let release!: (value: ReturnType<typeof response>) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { release = resolve as typeof release; }));
  player.play(playlist(annotate('你')).clips); await flush();
  const old = Context.instances[0]!;
  player.stop();
  player.play(playlist(annotate('好')).clips); await flush();
  release(response()); await flush();
  expect(old.sources).toHaveLength(0);
  expect(state.status).toBe('playing');
  expect(Context.instances[1]!.sources).toHaveLength(1);
});

it('stops on HTTP or decode failure and permits retry', async () => {
  vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
  const clips = playlist(annotate('你')).clips;
  player.play(clips); await flush();
  expect(state.status).toBe('error');
  player.play(clips);
  Context.instances[1]!.decodeAudioData.mockRejectedValueOnce(new Error('Invalid audio'));
  await flush(); expect(state.status).toBe('error');
  player.play(clips); await flush();
  expect(state.status).toBe('playing');
});

it('times out hanging downloads and does not remain loading', async () => {
  vi.useFakeTimers();
  vi.mocked(fetch).mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
  }));
  player.play(playlist(annotate('你')).clips); await flush();
  await vi.advanceTimersByTimeAsync(15_000);
  expect(state).toMatchObject({ status: 'error', activeStart: null });
});

it('reset releases the cache and invalidates old completion callbacks', async () => {
  const clips = playlist(annotate('你好')).clips;
  player.play(clips); await flush();
  const callback = Context.instances[0]!.sources[0]!.onended;
  player.reset(); callback?.(); await flush();
  expect(state.status).toBe('idle');
  expect(Context.instances[0]!.sources).toHaveLength(1);
  player.play(clips); await flush();
  expect(fetch).toHaveBeenCalledTimes(4);
});
