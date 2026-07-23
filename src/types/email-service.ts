export interface IEmailService {
  sendVerificationEmail(email: string, name: string, token: string): Promise<void>;
}
