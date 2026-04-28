import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production' || process.env.ENV === 'production';

if (!process.env.TOKEN_SECRET) {
  if (isProduction) {
    throw new Error('[config] TOKEN_SECRET must be set as an environment variable in production.');
  }
  console.warn('[config] TOKEN_SECRET is not set — using insecure default. Set it in .env for production.');
}

export const config = {
  tokenSecret: process.env.TOKEN_SECRET || 'default-secret-for-dev',
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  refreshTokenExpiryMs: 7 * 24 * 60 * 60 * 1000,
  allowedOrigin: process.env.ALLOWED_ORIGIN
    ? process.env.ALLOWED_ORIGIN.split(',').map((o: string) => o.trim())
    : undefined,
  port: parseInt(process.env.PORT || '3000', 10),
};
