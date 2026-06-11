import prisma from '@/config/db';
import { EmailService } from '../common/email.service';
import { ValidationUtil } from '@/utils/validation.util';

// Twilio Verify for phone OTP
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID || '';

// Rate limits
const MAX_OTP_REQUESTS_PER_HOUR = 5;
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export class VerificationService {

  /**
   * Send email OTP
   */
  static async sendEmailOtp(email: string) {
    const sanitizedEmail = ValidationUtil.sanitizeEmail(email);

    if (!ValidationUtil.isValidEmail(sanitizedEmail)) {
      throw new Error('Invalid email format');
    }

    // Check if email is already registered
    const existingUser = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });
    if (existingUser) {
      throw new Error('This email is already registered. Please login instead.');
    }

    // Get or create verification session
    let session = await prisma.verificationSession.findUnique({
      where: { email: sanitizedEmail },
    });

    // Rate limiting: check if too many attempts in the last hour
    if (session) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (session.updatedAt > oneHourAgo && session.emailAttempts >= MAX_OTP_REQUESTS_PER_HOUR) {
        throw new Error('Too many OTP requests. Please try again after some time.');
      }
    }

    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    if (session) {
      // Reset attempts if it's been more than an hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const newAttempts = session.updatedAt > oneHourAgo ? session.emailAttempts + 1 : 1;

      session = await prisma.verificationSession.update({
        where: { email: sanitizedEmail },
        data: {
          emailOtp: otp,
          emailOtpExpiry: otpExpiry,
          emailAttempts: newAttempts,
          emailVerified: false,
        },
      });
    } else {
      session = await prisma.verificationSession.create({
        data: {
          email: sanitizedEmail,
          emailOtp: otp,
          emailOtpExpiry: otpExpiry,
          emailAttempts: 1,
        },
      });
    }

    // Send OTP via email
    await EmailService.sendOtpEmail(sanitizedEmail, otp);

    return { message: 'OTP sent to your email address.' };
  }

  /**
   * Verify email OTP
   */
  static async verifyEmailOtp(email: string, otp: string) {
    const sanitizedEmail = ValidationUtil.sanitizeEmail(email);

    const session = await prisma.verificationSession.findUnique({
      where: { email: sanitizedEmail },
    });

    if (!session) {
      throw new Error('No verification session found. Please request an OTP first.');
    }

    if (session.emailVerified) {
      return { message: 'Email already verified.', emailVerified: true };
    }

    if (session.emailAttempts >= MAX_OTP_ATTEMPTS) {
      throw new Error('Too many failed attempts. Please request a new OTP.');
    }

    if (!session.emailOtp || !session.emailOtpExpiry) {
      throw new Error('No OTP found. Please request a new one.');
    }

    if (new Date() > session.emailOtpExpiry) {
      throw new Error('OTP has expired. Please request a new one.');
    }

    if (session.emailOtp !== otp) {
      // Increment attempts
      await prisma.verificationSession.update({
        where: { email: sanitizedEmail },
        data: { emailAttempts: { increment: 1 } },
      });
      throw new Error('Invalid OTP. Please try again.');
    }

    // Mark email as verified
    await prisma.verificationSession.update({
      where: { email: sanitizedEmail },
      data: {
        emailVerified: true,
        emailOtp: null,
        emailOtpExpiry: null,
      },
    });

    return { message: 'Email verified successfully.', emailVerified: true };
  }

  /**
   * Send phone OTP via Twilio Verify
   */
  static async sendPhoneOtp(email: string, phone: string) {
    const sanitizedEmail = ValidationUtil.sanitizeEmail(email);

    if (!ValidationUtil.isValidPhone(phone)) {
      throw new Error('Invalid phone number format. Use international format like +919876543210');
    }

    // Normalize phone to E.164
    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;

    // Session must exist and email must be verified first
    const session = await prisma.verificationSession.findUnique({
      where: { email: sanitizedEmail },
    });

    if (!session) {
      throw new Error('Please verify your email first.');
    }

    if (!session.emailVerified) {
      throw new Error('Please verify your email before phone verification.');
    }

    // Check if phone is already registered to a different user
    const existingUser = await prisma.user.findFirst({
      where: { phone: normalizedPhone },
    });
    if (existingUser) {
      throw new Error('This phone number is already registered. Please login instead.');
    }

    // Rate limiting for phone
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (session.updatedAt > oneHourAgo && session.phoneAttempts >= MAX_OTP_REQUESTS_PER_HOUR) {
      throw new Error('Too many phone OTP requests. Please try again after some time.');
    }

    // Send via Twilio Verify
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
      throw new Error('Phone verification service is not configured. Please contact support.');
    }

    const twilioUrl = `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/Verifications`;
    const authHeader = 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: normalizedPhone,
        Channel: 'sms',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Twilio Verify error:', errorData);
      throw new Error('Failed to send phone OTP. Please check the phone number and try again.');
    }

    // Update session with phone number and increment attempts
    const newAttempts = session.updatedAt > oneHourAgo ? session.phoneAttempts + 1 : 1;
    await prisma.verificationSession.update({
      where: { email: sanitizedEmail },
      data: {
        phone: normalizedPhone,
        phoneAttempts: newAttempts,
        phoneVerified: false,
      },
    });

    return { message: 'OTP sent to your phone number.' };
  }

  /**
   * Verify phone OTP via Twilio Verify
   */
  static async verifyPhoneOtp(email: string, otp: string) {
    const sanitizedEmail = ValidationUtil.sanitizeEmail(email);

    const session = await prisma.verificationSession.findUnique({
      where: { email: sanitizedEmail },
    });

    if (!session) {
      throw new Error('No verification session found. Please start the verification process.');
    }

    if (!session.emailVerified) {
      throw new Error('Please verify your email first.');
    }

    if (session.phoneVerified) {
      return { message: 'Phone already verified.', phoneVerified: true };
    }

    if (!session.phone) {
      throw new Error('No phone number found. Please request a phone OTP first.');
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
      throw new Error('Phone verification service is not configured.');
    }

    // Check via Twilio Verify
    const twilioUrl = `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`;
    const authHeader = 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: session.phone,
        Code: otp,
      }),
    });

    const result = await response.json() as { status?: string };

    if (!response.ok || result.status !== 'approved') {
      // Increment attempts
      await prisma.verificationSession.update({
        where: { email: sanitizedEmail },
        data: { phoneAttempts: { increment: 1 } },
      });
      throw new Error('Invalid OTP. Please try again.');
    }

    // Mark phone as verified
    await prisma.verificationSession.update({
      where: { email: sanitizedEmail },
      data: { phoneVerified: true },
    });

    return { message: 'Phone verified successfully.', phoneVerified: true };
  }

  /**
   * Get verification status for an email
   */
  static async getStatus(email: string) {
    const sanitizedEmail = ValidationUtil.sanitizeEmail(email);

    const session = await prisma.verificationSession.findUnique({
      where: { email: sanitizedEmail },
    });

    if (!session) {
      return {
        emailVerified: false,
        phoneVerified: false,
        phone: null,
      };
    }

    return {
      emailVerified: session.emailVerified,
      phoneVerified: session.phoneVerified,
      phone: session.phone ? session.phone.replace(/(\+\d{2})\d+(\d{4})/, '$1****$2') : null,
    };
  }

  /**
   * Clean up a verification session after successful registration
   */
  static async cleanup(email: string) {
    const sanitizedEmail = ValidationUtil.sanitizeEmail(email);
    try {
      await prisma.verificationSession.delete({
        where: { email: sanitizedEmail },
      });
    } catch {
      // Ignore if session doesn't exist
    }
  }
}
