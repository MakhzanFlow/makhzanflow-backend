import rateLimit from 'express-rate-limit';

const limitMessage = {
  success: false,
  message: 'Too many requests. Please try again later.',
  errors: [],
};

export const registerLimiter = (rateLimit as any)({
  windowMs: 60 * 1000, // 1 minute
  limit: 3,
  message: limitMessage,
});

export const loginLimiter = (rateLimit as any)({
  windowMs: 60 * 1000,
  limit: 5,
  message: limitMessage,
});

export const createProductLimiter = (rateLimit as any)({
  windowMs: 60 * 1000,
  limit: 10,
  message: limitMessage,
});

export const resendVerifyLimiter = (rateLimit as any)({
  windowMs: 60 * 1000,
  limit: 1,
  message: limitMessage,
});

export const verifyEmailLimiter = (rateLimit as any)({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: limitMessage,
});

export const refreshLimiter = (rateLimit as any)({
  windowMs: 60 * 1000,
  limit: 20,
  message: limitMessage,
});

export const joinLimiter = (rateLimit as any)({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: limitMessage,
});

export const lookupLimiter = (rateLimit as any)({
  windowMs: 60 * 1000,
  limit: 20,
  message: limitMessage,
});

export const createInvoiceLimiter = (rateLimit as any)({
  windowMs: 60 * 1000,
  limit: 10,
  message: limitMessage,
});

export const addPaymentLimiter = (rateLimit as any)({
  windowMs: 60 * 1000,
  limit: 15,
  message: limitMessage,
});
