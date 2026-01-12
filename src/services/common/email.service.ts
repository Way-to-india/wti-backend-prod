import { getVerificationEmailTemplate } from '@/constants/email-templates/verification-template';
import { Resend } from 'resend';

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

  static async sendCustomEmail(
    to: string,
    subject: string,
    htmlContent: string,
    userName?: string
  ): Promise<void> {
    try {
      await resend.emails.send({
        from: 'Way to India <noreply@waytoindia.com>',
        to: [to],
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${userName ? `<p style="font-size: 16px;">Hello ${userName},</p>` : ''}
            <div style="margin: 20px 0;">
              ${htmlContent}
            </div>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;" />
            <p style="color: #666; font-size: 12px; text-align: center;">
              This email was sent from Way To India Admin Panel.
            </p>
          </div>
        `,
      });

      console.log('Custom email sent to:', to);
    } catch (error) {
      console.error('Error sending custom email:', error);
      throw new Error('Failed to send email');
    }
  }
}
