/**
 * Build-time configuration (see .env.example and docs/ARCHITECTURE.md).
 * Everything prefixed VITE_ is compiled into the public bundle - only
 * public values belong here, never a secret or a provider API key.
 */
interface ImportMetaEnv {
  /** base URL of the site's own API, once one exists, e.g. https://api.younestattoo.com */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
