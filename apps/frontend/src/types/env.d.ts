/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALIVE_BUILD?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __ALIVE_BUILD__: string;
