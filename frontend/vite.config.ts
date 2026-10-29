import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
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
  },
  preview: {
    port: 4173,
    // `vite preview` serves only static files, so proxy /api back to the
    // backend — this keeps `npm run preview` working even when the previewed
    // bundle is an embedded (same-origin) build.
    proxy: { '/api': 'http://localhost:8000' },
  },
})
