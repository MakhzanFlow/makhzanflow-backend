import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  refreshSchema,
  logoutSchema
} from '../validators/auth.validator.js';
import { registerLimiter, loginLimiter, resendVerifyLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();

router.post('/register', registerLimiter, validate(registerSchema), authController.register);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);
router.post('/verify-email/resend', resendVerifyLimiter, authController.resendVerificationEmail);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', validate(logoutSchema), authController.logout);
router.get('/me', authenticate, authController.getProfile);

export default router;
