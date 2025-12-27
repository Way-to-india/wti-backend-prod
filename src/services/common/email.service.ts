import { Resend } from 'resend';
import { getVerificationEmailTemplate } from '@/constants/email-templates/verification-template';

const resend = new Resend(process.env.RESEND_API_KEY);

export class EmailService {

  static async sendVerificationEmail(email: string, token: string, name: string): Promise<void> {

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    try {
      const htmlTemplate = getVerificationEmailTemplate(name, verificationUrl);

      await resend.emails.send({
        from: 'Way to India <noreply@waytoindia.com>',
        to: [email],
        subject: '🎉 Welcome to Way to India - Verify Your Email',
        html: htmlTemplate,
      });
    } catch (error) {
      console.error('Email send error:', error);
      throw new Error('Failed to send verification email');
    }
  }
}