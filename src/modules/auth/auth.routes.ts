import { Router } from 'express';
import { container } from 'tsyringe';
import { AuthController } from './auth.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  refreshSchema,
  logoutSchema,
  resendVerifySchema
} from './auth.validation.js';
import { registerLimiter, loginLimiter, resendVerifyLimiter, verifyEmailLimiter, refreshLimiter } from '../../middleware/rate-limit.middleware.js';

const authController = container.resolve(AuthController);

const router = Router();

router.post('/register', registerLimiter, validate(registerSchema), authController.register);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/verify-email', verifyEmailLimiter, validate(verifyEmailSchema), authController.verifyEmail);
router.post('/verify-email/resend', resendVerifyLimiter, validate(resendVerifySchema), authController.resendVerificationEmail);
router.post('/refresh', refreshLimiter, validate(refreshSchema), authController.refresh);
router.post('/logout', validate(logoutSchema), authController.logout);
router.post('/logout-all', authenticate, authController.logoutAll);
router.get('/me', authenticate, authController.getProfile);

export default router;
