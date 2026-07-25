// import { describe, it, mock } from 'node:test';
// import assert from 'node:assert';
// import nodemailer from 'nodemailer';
// import type { SendMailOptions, TransportOptions } from 'nodemailer';

// const mockSendMail = mock.fn();
// const fakeTransporter = { sendMail: mockSendMail } as unknown as ReturnType<typeof nodemailer.createTransport>;
// mock.method(nodemailer, 'createTransport', () => fakeTransporter);

// const { env } = await import('../../src/config/env.js');
// const { BrevoEmailService } = await import('../../src/shared/utils/email-brevo.js');

// void describe('BrevoEmailService', () => {
//   void it('sends a verification email via nodemailer', async () => {
//     mockSendMail.mock.resetCalls();

//     const service = new BrevoEmailService('TestApp');
//     await service.sendVerificationEmail('test@example.com', 'Alice', '123456');

//     assert.strictEqual(mockSendMail.mock.callCount(), 1);

//     const [mailOptions] = mockSendMail.mock.calls[0].arguments as [SendMailOptions];
//     assert.match(mailOptions.to as string, /test@example\.com/);
//     assert.match(mailOptions.subject as string, /TestApp verification code/);
//     assert.match(mailOptions.html as string, /123456/);
//     assert.match(mailOptions.html as string, /Hi Alice/);
//     assert.match(mailOptions.from as string, /TestApp/);
//   });

//   void it('uses the correct SMTP config from env', () => {
//     const createTransportMock = nodemailer.createTransport as unknown as { mock: { calls: Array<{ arguments: unknown[] }> } };
//     const [smtpConfig] = createTransportMock.mock.calls[0].arguments as [TransportOptions];

//     assert.strictEqual(smtpConfig.host, env.BREVO_SMTP_HOST);
//     assert.strictEqual(smtpConfig.port, env.BREVO_SMTP_PORT);
//     assert.strictEqual((smtpConfig.auth as Record<string, string>).user, env.BREVO_SMTP_USER);
//     assert.strictEqual((smtpConfig.auth as Record<string, string>).pass, env.BREVO_SMTP_PASS);
//   });
// });
