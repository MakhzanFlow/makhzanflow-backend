import { Resend } from 'resend';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

if (!env.RESEND_API_KEY) {
  logger.warn('⚠️  RESEND_API_KEY is not set — emails will NOT be sent.');
}

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export const sendVerificationEmail = async (email: string, name: string, token: string): Promise<void> => {
  if (!resend) {
    logger.warn(`[Email] Skipped sending verification to ${email} — no Resend API key.`);
    return;
  }

  const fromEmail = env.EMAIL_FROM ?? 'onboarding@resend.dev';

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: 'Your MakhzanFlow verification code',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#1f2937;margin-bottom:8px;">Hi ${name} 👋</h2>
        <p style="color:#6b7280;margin-bottom:24px;">Use the 6-digit code below to verify your email address. It expires in <strong>10 minutes</strong>.</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px;">
          <span style="font-size:40px;font-weight:bold;letter-spacing:12px;color:#111827;">${token}</span>
        </div>
        <p style="color:#9ca3af;font-size:13px;">If you did not create an account, you can safely ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    logger.error('[Email] Resend API error:', error);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }

  logger.info(`[Email] Verification email sent to ${email} — id: ${data?.id}`);
};
