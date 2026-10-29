/**
 * Base URL for every backend request.
 *
 * - Cross-origin flows (`npm run dev`, `npm run preview`) take it from
 *   `VITE_API_URL` in `.env`, e.g. `http://localhost:8000`.
 * - The embedded build (`vite build --mode embedded`, driven by the backend on
 *   startup) loads `.env.embedded`, which sets `VITE_API_URL` to "" so the
 *   bundle — served by FastAPI itself at "/" — talks to its own origin.
 *
 * Unset falls back to the dev server's default in dev, and to same-origin in a
 * production build (the correct default for a bundle served by the backend).
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : '')
