import rateLimit from 'express-rate-limit';

export const registerLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 3,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

export const createProductLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

export const resendVerifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 1,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

export const createInvoiceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

export const addPaymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});
