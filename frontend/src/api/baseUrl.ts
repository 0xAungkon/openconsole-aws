/**
 * Base URL for every backend request — deliberately empty by default.
 *
 * The frontend never needs to know the backend's hostname or port: requests
 * are relative (`/api/...`), so they land on whatever origin served the page.
 * That is what lets the embedded bundle work unchanged on localhost, a LAN or
 * tailnet IP, or a public domain, on any port, with nothing baked in at build
 * time.
 *
 * `npm run dev` and `npm run preview` proxy `/api` to the backend for exactly
 * the same reason (see `vite.config.ts`), so development is same-origin too
 * and no CORS entry is needed.
 *
 * Set `VITE_API_URL` only when the API genuinely lives on a *different*
 * origin — a frontend deployed separately from the backend, e.g.
 *
 *     VITE_API_URL=https://api.example.com npm run build
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? ''
