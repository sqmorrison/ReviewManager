import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/studentRegister': 'http://localhost:8000',
      '/login': 'http://localhost:8000',
      '/mfa': 'http://localhost:8000'
    }
  },
  build: {
      outDir: 'dist',
    },
    plugins: [
        tailwindcss()
      ],
});