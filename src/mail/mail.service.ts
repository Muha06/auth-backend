import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly resend: Resend;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(
      this.configService.getOrThrow<string>('RESEND_API_KEY'),
    );
  }
  private readonly logger = new Logger(MailService.name);

  async sendPasswordResetEmail(email: string, username: string, token: string) {
    const resetLink = `${this.configService.getOrThrow('APP_URL')}reset-password?token=${token}`;

    this.logger.log(resetLink);

    const html = `
  <h2>Password Reset</h2>

  <p>Hello ${username},</p>

  <p>You requested to reset your password.</p>

  <p>
    <a href="${resetLink}">
      Reset Password
    </a>
  </p>

  <p>This link expires in 15 minutes.</p>

  <p>If you didn't request this, you can safely ignore this email.</p>
`;

    try {
      await this.resend.emails.send({
        from: 'Auth <onboarding@resend.dev>',
        to: email,
        subject: 'Reset your password',
        html,
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to send password reset email.',
      );
    }
  }
}
