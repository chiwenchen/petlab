// Cloudflare Workers binding types

export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;

  // vars
  APP_NAME: string;
  WEB_VIEWER_BASE: string;
  OTP_TTL_SECONDS: string;
  JWT_TTL_SECONDS: string;

  // secrets
  ANTHROPIC_API_KEY: string;
  RESEND_API_KEY: string;
  JWT_SECRET: string;
  OTP_FROM_EMAIL: string;
}

export interface AuthContext {
  userId: string;
  email: string;
}

// HonoContext variables
export type AppVariables = {
  auth: AuthContext;
};
