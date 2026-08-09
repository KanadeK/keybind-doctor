import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/keybind-doctor/' : '/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'site-dist',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
    },
  },
});
