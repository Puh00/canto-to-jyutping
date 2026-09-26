import type { Page, TestInfo } from '@playwright/test';

/** Windows Playwright WebKit omits Web Audio. Simulate its clock for UI tests only. */
export async function supportMissingWebAudio(page: Page, info: TestInfo) {
  if (await page.evaluate(() => typeof AudioContext !== 'undefined')) return;
  info.annotations.push({ type: 'audio-simulation', description: 'This browser build has no Web Audio. Playback timing is simulated; decoding and sound require native-browser verification.' });
  await page.addInitScript(() => {
    class Context {
      state = 'suspended';
      destination = {};
      nodes = new Set<Source>();
      async resume() { this.state = 'running'; this.nodes.forEach(node => node.schedule()); }
      async suspend() { this.state = 'suspended'; this.nodes.forEach(node => node.freeze()); }
      async close() { this.state = 'closed'; this.nodes.forEach(node => node.stop()); }
      async decodeAudioData(bytes: ArrayBuffer) {
        const view = new DataView(bytes);
        if (view.byteLength < 44 || view.getUint32(0) !== 0x52494646) throw new Error('Invalid fixture');
        return { duration: view.getUint32(40, true) / view.getUint32(28, true) };
      }
      createBufferSource() { return new Source(this); }
    }
    class Source {
      buffer: { duration: number } | null = null;
      onended: (() => void) | null = null;
      remaining = 0;
      timer: ReturnType<typeof setTimeout> | undefined;
      started = 0;
      constructor(private context: Context) {}
      connect() {}
      disconnect() {}
      start() { this.remaining = this.buffer!.duration * 1000; this.context.nodes.add(this); this.schedule(); }
      schedule() {
        if (this.context.state !== 'running' || this.timer !== undefined) return;
        this.started = performance.now();
        this.timer = setTimeout(() => {
          this.timer = undefined; this.context.nodes.delete(this); this.onended?.();
        }, this.remaining);
      }
      freeze() {
        if (this.timer === undefined) return;
        clearTimeout(this.timer); this.timer = undefined;
        this.remaining = Math.max(0, this.remaining - (performance.now() - this.started));
      }
      stop() { clearTimeout(this.timer); this.timer = undefined; this.context.nodes.delete(this); }
    }
    Object.defineProperty(window, 'AudioContext', { value: Context, configurable: true });
  });
}
