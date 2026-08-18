import rateLimit from 'express-rate-limit';

export const registerLimiter = (rateLimit as any)({
  windowMs: 60 * 1000, // 1 minute
  limit: 3,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

export const loginLimiter = (rateLimit as any)({
  windowMs: 60 * 1000,
  limit: 5,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

export const createProductLimiter = (rateLimit as any)({
  windowMs: 60 * 1000,
  limit: 10,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

export const resendVerifyLimiter = (rateLimit as any)({
  windowMs: 60 * 1000,
  limit: 1,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

export const createInvoiceLimiter = (rateLimit as any)({
  windowMs: 60 * 1000,
  limit: 10,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

export const addPaymentLimiter = (rateLimit as any)({
  windowMs: 60 * 1000,
  limit: 15,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});
