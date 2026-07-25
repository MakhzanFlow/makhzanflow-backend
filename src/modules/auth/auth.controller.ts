import type { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { UserRepository, VerificationTokenRepository, RefreshTokenRepository } from './auth.repository.js';
import { BrevoEmailService } from '../../shared/utils/email-brevo.js';
import { ResendEmailService } from '../../shared/utils/email-resend.js';
import { CompositeEmailService } from '../../shared/utils/email-composite.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import type { TFunction } from 'i18next';

// Instantiate dependencies (in a real app, use dependency injection container)
const userRepo = new UserRepository();
const verifyTokenRepo = new VerificationTokenRepository();
const refreshTokenRepo = new RefreshTokenRepository();
const emailService = new CompositeEmailService([
  new BrevoEmailService(),
  new ResendEmailService(),
]);
const authService = new AuthService(userRepo, verifyTokenRepo, refreshTokenRepo, emailService);

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.register(req.body);
      const t = req.t as TFunction;
      res.status(201).json({
        success: true,
        message: t ? t('register.success') : 'Registration successful',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, token } = req.body;
      const data = await authService.verifyEmail(email, token);
      const t = req.t as TFunction;
      res.status(200).json({
        success: true,
        message: t ? t('verify.success') : 'Email verified successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async resendVerificationEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      await authService.resendVerificationEmail(email);
      const t = req.t as TFunction;
      res.status(200).json({
        success: true,
        message: t ? t('verify.resent') : 'Verification email sent',
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await authService.login(req.body);
      const t = req.t as TFunction;
      res.status(200).json({
        success: true,
        message: t ? t('login.success') : 'Login successful',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const data = await authService.refreshToken(refreshToken);
      const t = req.t as TFunction;
      res.status(200).json({
        success: true,
        message: t ? t('refresh.success') : 'Session refreshed successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      await authService.logout(refreshToken);
      const t = req.t as TFunction;
      res.status(200).json({
        success: true,
        message: t ? t('logout.success') : 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user.id;
      const data = await authService.getProfile(userId);
      const t = req.t as TFunction;
      res.status(200).json({
        success: true,
        message: t ? t('profile.success') : 'Profile loaded successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
