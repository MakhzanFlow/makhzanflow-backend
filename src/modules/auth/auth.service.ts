import { UserRepository, VerificationTokenRepository, RefreshTokenRepository } from './auth.repository.js';
import { hashPassword, comparePassword } from '../../shared/utils/password.js';
import { generateAccessToken, generateRefreshToken } from '../../shared/utils/jwt.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { IEmailService } from '../../types/email-service.js';
import type { UserResponse, LoginResponse, VerifyEmailResponse } from './auth.dto.js';

export class AuthService {
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  constructor(
    private userRepository: UserRepository,
    private verificationTokenRepo: VerificationTokenRepository,
    private refreshTokenRepo: RefreshTokenRepository,
    private emailService: IEmailService
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
      token,
      expires_at: expiresAt,
      users: { connect: { id: user.id } },
    });

    await this.emailService.sendVerificationEmail(user.email, user.name, token);

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

    const verificationToken = await this.verificationTokenRepo.findByUserId(user.id);
    if (!verificationToken) {
      throw new AppError(400, 'No verification code found. Please request a new one.', 'errors.invalidVerificationToken');
    }

    if (verificationToken.expires_at < new Date()) {
      await this.verificationTokenRepo.deleteByUserId(user.id);
      throw new AppError(400, 'Verification code has expired. Please request a new one.', 'errors.invalidVerificationToken');
    }

    if (verificationToken.token !== token) {
      throw new AppError(400, 'Invalid verification code', 'errors.invalidVerificationToken');
    }

    const updatedUser = await this.userRepository.update(user.id, {
      is_verified: true,
      verified_at: new Date(),
    });

    await this.verificationTokenRepo.deleteByUserId(user.id);

    const payload = { id: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.refreshTokenRepo.create({
      token: refreshToken,
      expires_at: expiresAt,
      users: { connect: { id: user.id } },
    });

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
      token,
      expires_at: expiresAt,
      users: { connect: { id: user.id } },
    });

    await this.emailService.sendVerificationEmail(user.email, user.name, token);
  }

  async login(data: any): Promise<LoginResponse> {
    const user = await this.userRepository.findByEmail(data.email);
    if (!user) {
      throw new AppError(401, 'Invalid email or password', 'errors.invalidCredentials');
    }

    const isMatch = await comparePassword(data.password, user.password_hash);
    if (!isMatch) {
      throw new AppError(401, 'Invalid email or password', 'errors.invalidCredentials');
    }

    if (!user.is_verified) {
      throw new AppError(403, 'Please verify your email before logging in', 'errors.emailNotVerified');
    }

    const payload = { id: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.refreshTokenRepo.create({
      token: refreshToken,
      expires_at: expiresAt,
      users: { connect: { id: user.id } },
    });

    return { accessToken, refreshToken, user: this.toUserResponse(user) };
  }

  async refreshToken(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshTokenDoc = await this.refreshTokenRepo.findByToken(token);
    if (!refreshTokenDoc) {
      throw new AppError(401, 'Invalid refresh token', 'errors.invalidRefreshToken');
    }

    if (refreshTokenDoc.expires_at < new Date()) {
      await this.refreshTokenRepo.deleteByToken(token);
      throw new AppError(401, 'Refresh token expired', 'errors.invalidRefreshToken');
    }

    const user = await this.userRepository.findById(refreshTokenDoc.user_id);
    if (!user) {
      throw new AppError(401, 'User not found', 'errors.invalidRefreshToken');
    }

    await this.refreshTokenRepo.deleteByToken(token);

    const payload = { id: user.id, email: user.email };
    const accessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.refreshTokenRepo.create({
      token: newRefreshToken,
      expires_at: expiresAt,
      users: { connect: { id: user.id } },
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(token: string): Promise<void> {
    await this.refreshTokenRepo.deleteByToken(token);
  }

  async getProfile(userId: string): Promise<UserResponse> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, 'User not found', 'errors.userNotFound');
    }
    return this.toUserResponse(user);
  }
}
