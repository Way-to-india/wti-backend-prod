import axios from 'axios';

/**
 * Verify reCAPTCHA token
 */
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

export async function verifyRecaptcha(token: string, remoteIp?: string): Promise<boolean> {
  try {
    const response = await axios.post(RECAPTCHA_VERIFY_URL, null, {
      params: {
        secret: RECAPTCHA_SECRET_KEY,
        response: token,
        remoteip: remoteIp,
      },
    });

    const { success, score, action } = response.data;

    if (success && score >= 0.5) {
      return true;
    }

    console.warn('reCAPTCHA verification failed:', {
      success,
      score,
      action,
    });

    return false;
  } catch (error) {
    console.error('Error verifying reCAPTCHA:', error);
    return false;
  }
}
