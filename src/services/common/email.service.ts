import { getVerificationEmailTemplate } from '@/constants/email-templates/verification-template';
import { getOtpEmailTemplate } from '@/constants/email-templates/otp-template';
import { getPasswordResetEmailTemplate } from '@/constants/email-templates/password-reset-template';
import { Resend } from 'resend';

// ---- Provider configuration ----
// Resend is the declared PRIMARY (its domain is verified). SendGrid is an
// explicit, checked FALLBACK that only participates when its key is present.
// Every provider response is verified; a silent failure is no longer possible.
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM || 'Way to India <noreply@waytoindia.com>';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const SENDGRID_SENDER = process.env.SENDGRID_SENDER_EMAIL || 'info@waytoindia.com';
// Optional: a non-email channel (Slack/Discord/generic incoming webhook) that
// gets pinged when EVERY provider fails — so ops hears about it immediately,
// without depending on email (which is exactly what's broken in that case).
const EMAIL_ALERT_WEBHOOK_URL = process.env.EMAIL_ALERT_WEBHOOK_URL || '';

const resend = new Resend(RESEND_API_KEY);

type SendResult = { ok: true; provider: string } | { ok: false; provider: string; error: string };

async function trySendViaResend(to: string, subject: string, html: string): Promise<SendResult> {
  if (!RESEND_API_KEY) return { ok: false, provider: 'resend', error: 'RESEND_API_KEY not set' };
  try {
    // Resend's SDK returns { data, error } instead of throwing — MUST be checked.
    const { data, error } = await resend.emails.send({ from: RESEND_FROM, to: [to], subject, html });
    if (error) return { ok: false, provider: 'resend', error: error.message || JSON.stringify(error) };
    if (!data?.id) return { ok: false, provider: 'resend', error: 'accepted but no message id returned' };
    return { ok: true, provider: 'resend' };
  } catch (e: any) {
    return { ok: false, provider: 'resend', error: e?.message || String(e) };
  }
}

async function trySendViaSendGrid(to: string, subject: string, html: string): Promise<SendResult> {
  if (!SENDGRID_API_KEY) return { ok: false, provider: 'sendgrid', error: 'SENDGRID_API_KEY not set' };
  try {
    const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: SENDGRID_SENDER, name: 'Way to India' },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });
    if (resp.status >= 200 && resp.status < 300) return { ok: true, provider: 'sendgrid' };
    const body = await resp.text().catch(() => '');
    return { ok: false, provider: 'sendgrid', error: `HTTP ${resp.status} ${body}`.trim() };
  } catch (e: any) {
    return { ok: false, provider: 'sendgrid', error: e?.message || String(e) };
  }
}

async function alertOps(kind: string, to: string, failures: SendResult[]): Promise<void> {
  if (!EMAIL_ALERT_WEBHOOK_URL) return;
  const detail = failures.map((f) => `${f.provider}: ${'error' in f ? f.error : ''}`).join(' | ');
  const text = `🚨 [EMAIL_DELIVERY_FAILURE] kind=${kind} to=${to} — all providers failed: ${detail}`;
  try {
    await fetch(EMAIL_ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `text` (Slack) and `content` (Discord) cover the common webhook shapes.
      body: JSON.stringify({ text, content: text }),
    });
  } catch {
    /* best-effort: alerting must never throw or block the request */
  }
}

/**
 * Single delivery core. Runs the provider chain (Resend primary -> SendGrid
 * fallback), verifying every response. On a clean fallback it logs a warning;
 * on TOTAL failure it logs a distinct `[EMAIL_DELIVERY_FAILURE]` marker
 * (alertable from logs), pings the ops webhook if configured, then throws.
 */
async function deliver(kind: string, to: string, subject: string, html: string): Promise<void> {
  const failures: SendResult[] = [];
  for (const attempt of [trySendViaResend, trySendViaSendGrid]) {
    const res = await attempt(to, subject, html);
    if (res.ok) {
      if (failures.length) {
        const tried = failures.map((f) => `${f.provider}(${'error' in f ? f.error : ''})`).join(', ');
        console.warn(`[EMAIL] ${kind} to ${to} sent via ${res.provider} after fallback. Prior failures: ${tried}`);
      } else {
        console.log(`[EMAIL] ${kind} sent via ${res.provider} to ${to}`);
      }
      return;
    }
    failures.push(res);
  }
  const detail = failures.map((f) => `${f.provider}: ${'error' in f ? f.error : ''}`).join(' | ');
  console.error(`[EMAIL_DELIVERY_FAILURE] ${kind} to ${to} — ALL providers failed: ${detail}`);
  await alertOps(kind, to, failures);
  throw new Error(`Failed to send ${kind} email`);
}

export class EmailService {
  static async sendVerificationEmail(email: string, token: string, name: string): Promise<void> {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    const html = getVerificationEmailTemplate(name, verificationUrl);
    await deliver('verification', email, '🎉 Welcome to Way to India - Verify Your Email', html);
  }

  static async sendOtpEmail(email: string, otp: string): Promise<void> {
    const html = getOtpEmailTemplate(otp);
    await deliver('otp', email, `${otp} - Your Way to India Verification Code`, html);
  }

  static async sendPasswordResetEmail(email: string, token: string, name: string): Promise<void> {
    const adminBaseUrl =
      process.env.ADMIN_URL || process.env.FRONTEND_URL || 'https://admin.waytoindia.com';
    const resetUrl = `${adminBaseUrl}/reset-password?token=${token}`;
    const html = getPasswordResetEmailTemplate(name, resetUrl);
    await deliver('password-reset', email, '🔐 Reset your Way to India admin password', html);
  }

  static async sendCustomEmail(
    to: string,
    subject: string,
    htmlContent: string,
    userName?: string
  ): Promise<void> {
    const html = `
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
        `;
    await deliver('custom', to, subject, html);
  }
}
