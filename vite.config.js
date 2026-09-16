import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Phone cameras require HTTPS, so the dev server uses a self-signed cert.
// Set NO_SSL=1 to serve over plain http (e.g. for local screenshot tooling).
export default defineConfig({
  base: './',
  plugins: process.env.NO_SSL ? [] : [basicSsl()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 4000,
  },
});
