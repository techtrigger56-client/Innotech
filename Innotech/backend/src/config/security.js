export const securityConfig = {
  allowedOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
};
