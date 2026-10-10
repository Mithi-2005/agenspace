const env = import.meta.env;
export const brandConfig = {
  appName: env.VITE_APP_NAME || "Kosway",
  assistantName: env.VITE_AI_ASSISTANT_NAME || "Moon",
  logoUrl: env.VITE_BRAND_LOGO_URL || "/brand/kosway-mark.svg",
} as const;
