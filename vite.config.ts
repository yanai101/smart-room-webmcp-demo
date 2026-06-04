import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5174,
    strictPort: false,
    watch: {
      // Prevent test-results and dist from triggering HMR reloads during tests
      ignored: ['**/test-results/**', '**/dist/**', '**/.playwright/**'],
    },
  },
});
