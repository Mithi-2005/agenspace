/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_AI_ASSISTANT_NAME?: string;
  readonly VITE_BRAND_LOGO_URL?: string;
  readonly VITE_PUBLIC_URL?: string;
  readonly VITE_OG_IMAGE_URL?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv; }
