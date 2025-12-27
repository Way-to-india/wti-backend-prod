export class ValidationUtil {

  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidPassword(password: string): boolean {
    return password.length >= 8;
  }
  
  static isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    return phoneRegex.test(phone.replace(/[\s-]/g, ''));
  }

  static sanitizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }
}
