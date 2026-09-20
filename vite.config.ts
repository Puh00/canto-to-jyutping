import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    environment: 'jsdom',
    pool: 'threads',
    maxWorkers: 2,
    setupFiles: './tests/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
    css: true,
  },
});

