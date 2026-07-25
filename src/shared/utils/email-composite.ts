import type { IEmailService } from '../../types/email-service.js';
import { logger } from '../../config/logger.js';

export class CompositeEmailService implements IEmailService {
  constructor(private readonly providers: IEmailService[]) {}

  async sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
    const errors: unknown[] = [];

    for (const provider of this.providers) {
      try {
        await provider.sendVerificationEmail(email, name, token);
        return;
      } catch (error) {
        errors.push(error);
        logger.warn(`[Email-Composite] Provider failed, trying next:`, error);
      }
    }

    throw new Error(`All email providers failed. Errors: ${JSON.stringify(errors)}`);
  }
}
