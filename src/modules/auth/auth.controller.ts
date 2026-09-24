import { injectable, inject } from 'tsyringe';
import type { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import type { TFunction } from 'i18next';

@injectable()
export class AuthController {
  constructor(@inject(AuthService) private authService: AuthService) {}

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.authService.register(req.body);
      const t = req.t as TFunction;
      res.status(201).json({
        success: true,
        message: t ? t('register.success') : 'Registration successful',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, token } = req.body;
      const data = await this.authService.verifyEmail(email, token);
      const t = req.t as TFunction;
      res.status(200).json({
        success: true,
        message: t ? t('verify.success') : 'Email verified successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  resendVerificationEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      await this.authService.resendVerificationEmail(email);
      const t = req.t as TFunction;
      res.status(200).json({
        success: true,
        message: t ? t('verify.resent') : 'Verification email sent',
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.authService.login(req.body, { ip: req.ip });
      const t = req.t as TFunction;
      res.status(200).json({
        success: true,
        message: t ? t('login.success') : 'Login successful',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      const data = await this.authService.refreshToken(refreshToken);
      const t = req.t as TFunction;
      res.status(200).json({
        success: true,
        message: t ? t('refresh.success') : 'Session refreshed successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      await this.authService.logout(refreshToken);
      const t = req.t as TFunction;
      res.status(200).json({
        success: true,
        message: t ? t('logout.success') : 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  logoutAll = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await this.authService.logoutAll(req.user.id);
      const t = (req as Request).t as TFunction;
      res.status(200).json({
        success: true,
        message: t ? t('logout.success') : 'Logged out from all devices',
      });
    } catch (error) {
      next(error);
    }
  };

  getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.id;
      const data = await this.authService.getProfile(userId);
      const t = req.t as TFunction;
      res.status(200).json({
        success: true,
        message: t ? t('profile.success') : 'Profile loaded successfully',
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
