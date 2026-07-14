/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ALIVE_BUILD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __ALIVE_BUILD__: string;
