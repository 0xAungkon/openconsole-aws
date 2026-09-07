/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the FastAPI backend, e.g. http://localhost:8000 */
  readonly VITE_API_URL: string
  /** Short badge next to the product name, e.g. "AWS" */
  readonly VITE_BRAND_BADGE: string
  /** Product name, e.g. "Open Console" */
  readonly VITE_BRAND_NAME: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
