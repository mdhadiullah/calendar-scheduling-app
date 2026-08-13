import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    // Keep the bundle lean — no source maps in production output, split
    // vendor chunks so browsers cache them across deploys.
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          calendar: ['react-big-calendar', 'date-fns'],
        },
      },
    },
  },
});
