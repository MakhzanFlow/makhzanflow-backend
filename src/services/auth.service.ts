import { UserRepository } from '../repositories/user.repository.js';
import { VerificationTokenRepository } from '../repositories/verification-token.repository.js';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import { sendVerificationEmail } from '../utils/email.js';
import { AppError } from '../errors/app-error.js';

export class AuthService {
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  constructor(
    private userRepository: UserRepository,
    private verificationTokenRepo: VerificationTokenRepository,
    private refreshTokenRepo: RefreshTokenRepository
  ) {}

  async register(data: any) {
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
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

    await this.verificationTokenRepo.create({
      token,
      expires_at: expiresAt,
      users: { connect: { id: user.id } },
    });

    await sendVerificationEmail(user.email, user.name, token);

    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async verifyEmail(email: string, token: string) {
    // 1. Find user by email
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new AppError(404, 'No account found with this email', 'errors.emailNotFound');
    }

    if (user.is_verified) {
      throw new AppError(400, 'Email is already verified', 'errors.alreadyVerified');
    }

    // 2. Find the verification token that belongs to THIS user
    const verificationToken = await this.verificationTokenRepo.findByUserId(user.id);
    if (!verificationToken) {
      throw new AppError(400, 'No verification code found. Please request a new one.', 'errors.invalidVerificationToken');
    }

    // 3. Check expiry
    if (verificationToken.expires_at < new Date()) {
      await this.verificationTokenRepo.deleteByUserId(user.id);
      throw new AppError(400, 'Verification code has expired. Please request a new one.', 'errors.invalidVerificationToken');
    }

    // 4. Match the code
    if (verificationToken.token !== token) {
      throw new AppError(400, 'Invalid verification code', 'errors.invalidVerificationToken');
    }

    // 5. Mark as verified
    const updatedUser = await this.userRepository.update(user.id, {
      is_verified: true,
      verified_at: new Date(),
    });

    await this.verificationTokenRepo.deleteByUserId(user.id);

    // 6. Auto-login: generate tokens so user doesn't need to log in again
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

    const { password_hash, ...userWithoutPassword } = updatedUser;
    return { accessToken, refreshToken, user: userWithoutPassword };
  }

  async resendVerificationEmail(email: string) {
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

    await sendVerificationEmail(user.email, user.name, token);
  }

  async login(data: any) {
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
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await this.refreshTokenRepo.create({
      token: refreshToken,
      expires_at: expiresAt,
      users: { connect: { id: user.id } },
    });

    const { password_hash, ...userWithoutPassword } = user;
    return { accessToken, refreshToken, user: userWithoutPassword };
  }

  async refreshToken(token: string) {
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

  async logout(token: string) {
    await this.refreshTokenRepo.deleteByToken(token);
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError(404, 'User not found', 'errors.userNotFound');
    }
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
