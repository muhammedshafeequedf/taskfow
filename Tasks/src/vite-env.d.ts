/// <reference types="vite/client" />

/** Injected by Vite `define` from `package.json` (see vite.config.ts). */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  readonly VITE_MONITOR_BASE_URL?: string;
  readonly VITE_MONITOR_KEY?: string;
  readonly VITE_MONITOR_RELEASE?: string;
  readonly VITE_MONITOR_ENABLED?: string;
}
