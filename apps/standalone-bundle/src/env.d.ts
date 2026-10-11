/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Prefix for API calls. Empty = same origin as the bundle. */
  readonly VITE_API_BASE?: string
  /** Comma separated origins that may embed this bundle from another origin (flow canvas). */
  readonly VITE_ALLOWED_PARENT_ORIGINS?: string
  /** Bearer token for opening the bundle directly in a browser during development. */
  readonly VITE_DEV_TOKEN?: string
}
