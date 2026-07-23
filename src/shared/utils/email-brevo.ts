import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { IEmailService } from '../../types/email-service.js';

const transporter = nodemailer.createTransport({
  host: env.BREVO_SMTP_HOST,
  port: env.BREVO_SMTP_PORT,
  secure: env.BREVO_SMTP_PORT === 465,
  auth: {
    user: env.BREVO_SMTP_USER,
    pass: env.BREVO_SMTP_PASS,
  },
});

export class BrevoEmailService implements IEmailService {
  private readonly appName: string;

  constructor(appName?: string) {
    this.appName = appName ?? env.APP_NAME;
  }

  async sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
    const fromEmail = env.EMAIL_FROM ?? env.BREVO_SMTP_USER;

    try {
      await transporter.sendMail({
        from: `${this.appName} <${fromEmail}>`,
        to: email,
        subject: `Your ${this.appName} verification code`,
        html: this.buildVerificationHtml(name, token),
      });

      logger.info(`[Email-Brevo] Verification email sent to ${email}`);
    } catch (error) {
      logger.error(`[Email-Brevo] Failed to send to ${email}:`, error);
      throw error;
    }
  }

  private buildVerificationHtml(name: string, token: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#1f2937;margin-bottom:8px;">Hi ${name}</h2>
        <p style="color:#6b7280;margin-bottom:24px;">Use the 6-digit code below to verify your email address. It expires in <strong>10 minutes</strong>.</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px;">
          <span style="font-size:40px;font-weight:bold;letter-spacing:12px;color:#111827;">${token}</span>
        </div>
        <p style="color:#9ca3af;font-size:13px;">If you did not create an account, you can safely ignore this email.</p>
      </div>
    `;
  }
}

export const brevoEmailService = new BrevoEmailService();
