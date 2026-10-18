const env = import.meta.env;
export const brandConfig = {
  appName: env.VITE_APP_NAME || "AgenSpace",
  assistantName: env.VITE_AI_ASSISTANT_NAME || "Moon",
  logoUrl: env.VITE_BRAND_LOGO_URL || "/brand/agenspace-mark.svg",
} as const;
