import { Resend } from 'resend';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { IEmailService } from '../../types/email-service.js';

export class ResendEmailService implements IEmailService {
  private readonly resend: Resend | null;

  constructor() {
    this.resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
    if (!this.resend) {
      logger.warn('[Email-Resend] RESEND_API_KEY not set — provider unavailable.');
    }
  }

  async sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
    if (!this.resend) {
      throw new Error('Resend API key not configured');
    }

    const fromEmail = env.EMAIL_FROM ?? 'onboarding@resend.dev';

    const { data, error } = await this.resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `Your ${env.APP_NAME} verification code`,
      html: this.buildVerificationHtml(name, token),
    });

    if (error) {
      logger.error('[Email-Resend] API error:', error);
      throw new Error(`Resend failed: ${error.message}`);
    }

    logger.info(`[Email-Resend] Verification email sent to ${email} — id: ${data?.id}`);
  }

  private buildVerificationHtml(name: string, token: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#1f2937;margin-bottom:8px;">Hi ${name} 👋</h2>
        <p style="color:#6b7280;margin-bottom:24px;">Use the 6-digit code below to verify your email address. It expires in <strong>10 minutes</strong>.</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px;">
          <span style="font-size:40px;font-weight:bold;letter-spacing:12px;color:#111827;">${token}</span>
        </div>
        <p style="color:#9ca3af;font-size:13px;">If you did not create an account, you can safely ignore this email.</p>
      </div>
    `;
  }
}
