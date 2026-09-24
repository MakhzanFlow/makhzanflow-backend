import { injectable, inject } from 'tsyringe';
import { createHash, timingSafeEqual } from 'node:crypto';
import { UserRepository, VerificationTokenRepository, RefreshTokenRepository } from './auth.repository.js';
import { hashPassword, comparePassword } from '../../shared/utils/password.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../shared/utils/jwt.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { IEmailService } from '../../types/email-service.js';
import type { UserResponse, LoginResponse, VerifyEmailResponse } from './auth.dto.js';
import type { ICacheService } from '../../shared/cache/cache.interface.js';
import { CacheService } from '../../shared/cache/cache.service.js';
import { CacheKeys } from '../../shared/cache/cache-keys.js';
import { CACHE_TTL } from '../../shared/cache/constants.js';
import { ResendEmailService } from '../../shared/utils/email-resend.js';
import { randomInt } from 'node:crypto';
import { logger } from '../../config/logger.js';

const OTP_MAX_ATTEMPTS = 5;
const OTP_ATTEMPT_TTL = 15 * 60;

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

@injectable()
export class AuthService {
  private generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }
  constructor(
    @inject(UserRepository) private userRepository: UserRepository,
    @inject(VerificationTokenRepository) private verificationTokenRepo: VerificationTokenRepository,
    @inject(RefreshTokenRepository) private refreshTokenRepo: RefreshTokenRepository,
    @inject(ResendEmailService) private emailService: IEmailService,
    @inject(CacheService) private cache: ICacheService
  ) {}

  private toUserResponse(user: { id: string; name: string; email: string; is_verified: boolean; verified_at: Date | null; created_at: Date | null; updated_at: Date | null }): UserResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      is_verified: user.is_verified,
      verified_at: user.verified_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  private otpAttemptKey(userId: string): string {
    return `auth:otp-attempts:${userId}`;
  }

  private async checkOtpAttempts(userId: string): Promise<void> {
    const attempts = await this.cache.get<number>(this.otpAttemptKey(userId));
    if (attempts !== null && attempts >= OTP_MAX_ATTEMPTS) {
      throw new AppError(429, 'Too many verification attempts. Please request a new code.', 'errors.tooManyAttempts');
    }
  }

  private async recordOtpFailure(userId: string): Promise<void> {
    const current = (await this.cache.get<number>(this.otpAttemptKey(userId))) ?? 0;
    await this.cache.set(this.otpAttemptKey(userId), current + 1, OTP_ATTEMPT_TTL);
  }

  private async clearOtpAttempts(userId: string): Promise<void> {
    await this.cache.del(this.otpAttemptKey(userId));
  }

  async register(data: any): Promise<UserResponse> {
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new AppError(409, 'Email is already in use', 'errors.emailExists');
    }

    const hashedPassword = await hashPassword(data.password);
    const user = await this.userRepository.create({
      name: data.name,
      email: data.email,
      password_hash: hashedPassword,
    });

    const token = this.generateOtp();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    await this.verificationTokenRepo.create({
      token: sha256Hex(token),
      expires_at: expiresAt,
      users: { connect: { id: user.id } },
    });

    await this.emailService.sendVerificationEmail(user.email, user.name, token);

    await this.cache.set(CacheKeys.auth.profile(user.id), this.toUserResponse(user), CACHE_TTL.MEDIUM);

    return this.toUserResponse(user);
  }

  async verifyEmail(email: string, token: string): Promise<VerifyEmailResponse> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new AppError(404, 'No account found with this email', 'errors.emailNotFound');
    }

    if (user.is_verified) {
      throw new AppError(400, 'Email is already verified', 'errors.alreadyVerified');
    }

    await this.checkOtpAttempts(user.id);

    const verificationToken = await this.verificationTokenRepo.findByUserId(user.id);
    if (!verificationToken) {
      throw new AppError(400, 'No verification code found. Please request a new one.', 'errors.invalidVerificationToken');
    }

    if (verificationToken.expires_at < new Date()) {
      await this.verificationTokenRepo.deleteByUserId(user.id);
      await this.clearOtpAttempts(user.id);
      throw new AppError(400, 'Verification code has expired. Please request a new one.', 'errors.invalidVerificationToken');
    }

    if (!safeEqualHex(verificationToken.token, sha256Hex(token))) {
      await this.recordOtpFailure(user.id);
      throw new AppError(400, 'Invalid verification code', 'errors.invalidVerificationToken');
    }

    const updatedUser = await this.userRepository.update(user.id, {
      is_verified: true,
      verified_at: new Date(),
    });

    await this.verificationTokenRepo.deleteByUserId(user.id);
    await this.clearOtpAttempts(user.id);

    const payload = { id: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.refreshTokenRepo.create({
      token: sha256Hex(refreshToken),
      expires_at: expiresAt,
      users: { connect: { id: user.id } },
    });

    await this.cache.del(CacheKeys.auth.profile(user.id));

    return { accessToken, refreshToken, user: this.toUserResponse(updatedUser) };
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new AppError(404, 'User not found', 'errors.userNotFound');
    }

    if (user.is_verified) {
      throw new AppError(400, 'Email is already verified', 'errors.alreadyVerified');
    }

    await this.verificationTokenRepo.deleteByUserId(user.id);

    const token = this.generateOtp();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    await this.verificationTokenRepo.create({
      token: sha256Hex(token),
      expires_at: expiresAt,
      users: { connect: { id: user.id } },
    });

    await this.clearOtpAttempts(user.id);
    await this.emailService.sendVerificationEmail(user.email, user.name, token);
  }

  async login(data: any, meta?: { ip?: string | undefined }): Promise<LoginResponse> {
    const user = await this.userRepository.findByEmail(data.email);
    if (!user) {
      logger.warn('Login failed: unknown email', { email: data.email, ip: meta?.ip });
      throw new AppError(401, 'Invalid email or password', 'errors.invalidCredentials');
    }

    const isMatch = await comparePassword(data.password, user.password_hash);
    if (!isMatch) {
      logger.warn('Login failed: bad password', { email: data.email, ip: meta?.ip });
      throw new AppError(401, 'Invalid email or password', 'errors.invalidCredentials');
    }

    if (!user.is_verified) {
      logger.warn('Login blocked: unverified email', { email: data.email, ip: meta?.ip });
      throw new AppError(403, 'Please verify your email before logging in', 'errors.emailNotVerified');
    }

    logger.info('Login success', { userId: user.id, ip: meta?.ip });

    const payload = { id: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.refreshTokenRepo.create({
      token: sha256Hex(refreshToken),
      expires_at: expiresAt,
      users: { connect: { id: user.id } },
    });

    return { accessToken, refreshToken, user: this.toUserResponse(user) };
  }

  async refreshToken(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = sha256Hex(token);
    const graceKey = `refresh_grace:${tokenHash}`;

    const cachedGrace = await this.cache.get<{ accessToken: string; refreshToken: string }>(graceKey);
    if (cachedGrace) {
      return cachedGrace;
    }

    const refreshTokenDoc = await this.refreshTokenRepo.findByToken(tokenHash);
    if (!refreshTokenDoc) {
      try {
        const decoded: any = verifyRefreshToken(token);
        if (decoded?.id) {
          const revokedMarker = await this.cache.get<string>(`refresh_revoked:${tokenHash}`);
          if (revokedMarker) {
            await this.refreshTokenRepo.deleteByUserId(decoded.id).catch(() => {});
            throw new AppError(401, 'Session revoked. Please log in again.', 'errors.invalidRefreshToken');
          }
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
      }
      throw new AppError(401, 'Invalid refresh token', 'errors.invalidRefreshToken');
    }

    if (refreshTokenDoc.expires_at < new Date()) {
      await this.refreshTokenRepo.deleteByToken(tokenHash).catch(() => {});
      throw new AppError(401, 'Refresh token expired', 'errors.invalidRefreshToken');
    }

    const user = await this.userRepository.findById(refreshTokenDoc.user_id);
    if (!user) {
      throw new AppError(401, 'User not found', 'errors.invalidRefreshToken');
    }

    const payload = { id: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);
    const newHash = sha256Hex(newRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.refreshTokenRepo.deleteByToken(tokenHash).catch(() => {});
    await this.refreshTokenRepo.create({
      token: newHash,
      expires_at: expiresAt,
      users: { connect: { id: user.id } },
    });

    await this.cache.set(`refresh_revoked:${tokenHash}`, user.id, 30 * 24 * 3600).catch(() => {});

    const result = { accessToken, refreshToken: newRefreshToken };
    await this.cache.set(graceKey, result, 60).catch(() => {});

    return result;
  }

  async logout(token: string): Promise<void> {
    try {
      await this.refreshTokenRepo.deleteByToken(sha256Hex(token));
    } catch {
      // already deleted / invalid — still clear grace
    }
    await this.cache.del(`refresh_grace:${sha256Hex(token)}`).catch(() => {});
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenRepo.deleteByUserId(userId);
    await this.cache.del(CacheKeys.auth.profile(userId)).catch(() => {});
  }

  async getProfile(userId: string): Promise<UserResponse> {
    const cacheKey = CacheKeys.auth.profile(userId);
    const cached = await this.cache.get<UserResponse>(cacheKey);
    if (cached) return cached;

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, 'User not found', 'errors.userNotFound');
    }
    const response = this.toUserResponse(user);
    await this.cache.set(cacheKey, response, CACHE_TTL.MEDIUM);
    return response;
  }
}
