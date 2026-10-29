import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/

// Where the dev server and `vite preview` forward `/api`. The bundle itself
// never knows this — it issues relative requests and relies on whatever origin
// served it (FastAPI when embedded, this proxy in development).
const BACKEND = process.env.AWS_OPENCONSOLE_API ?? 'http://localhost:4567'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    // Land the bundle inside the package so `aws-openconsole` can serve it at
    // "/" — it also ships in the wheel, which is why this directory is
    // committed rather than gitignored.
    outDir: '../aws_openconsole/frontend_dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Same-origin during development: the bundle asks for `/api/...` relative
    // to itself, and we forward it. Without a proxy Vite would answer those
    // paths with index.html instead of reaching the backend.
    proxy: { '/api': BACKEND },
  },
  preview: {
    port: 4173,
    // `vite preview` serves only static files, so it needs the same forwarding
    // to keep working when the previewed bundle is an embedded build.
    proxy: { '/api': BACKEND },
  },
})
