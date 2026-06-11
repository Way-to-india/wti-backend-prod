import rateLimit from 'express-rate-limit';

/**
 * Rate limiters for sensitive auth endpoints (anti-brute-force).
 * Uses the default in-memory store. If running multiple backend instances,
 * swap in a shared store (e.g. rate-limit-redis) so limits are global.
 */

const handler = (_req: any, res: any) =>
  res.deliver(429, false, undefined, 'Too many attempts. Please try again later.');

// Login: 10 attempts / 15 min per IP
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

// Forgot password: 5 requests / 15 min per IP (prevents reset-email spam)
export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

// Reset password: 10 attempts / 15 min per IP
export const resetPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

// Change password (authenticated): 10 attempts / 15 min per IP
export const changePasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});
