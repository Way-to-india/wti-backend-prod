export const getVerificationEmailTemplate = (name: string, verificationUrl: string): string => {
  console.log(process.env.FRONTEND_URL + '/logo-white.png');
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6; 
            color: #1f2937; 
            background: linear-gradient(135deg, #fff5f0 0%, #ffffff 50%, #fff5f0 100%);
            padding: 20px;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(234, 88, 12, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #ea580c 0%, #f97316 100%);
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
            opacity: 0.3;
          }
          .logo-container {
            position: relative;
            z-index: 1;
            background-color: white;
            display: inline-block;
            padding: 12px 24px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            margin-bottom: 20px;
          }
          .logo {
            height: 40px;
            width: auto;
          }
          .header-title {
            position: relative;
            z-index: 1;
            color: white;
            font-size: 28px;
            font-weight: 700;
            margin: 0;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header-subtitle {
            position: relative;
            z-index: 1;
            color: rgba(255, 255, 255, 0.95);
            font-size: 16px;
            margin-top: 8px;
          }
          .content {
            padding: 40px 30px;
          }
          .greeting {
            font-size: 20px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 16px;
          }
          .message {
            color: #4b5563;
            font-size: 16px;
            margin-bottom: 16px;
          }
          .cta-container {
            text-align: center;
            margin: 35px 0;
          }
          .verify-button { 
            display: inline-block; 
            padding: 16px 40px; 
            background: linear-gradient(135deg, #ea580c 0%, #f97316 100%);
            color: white !important; 
            text-decoration: none; 
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 10px 30px rgba(234, 88, 12, 0.3);
            transition: all 0.3s ease;
          }
          .verify-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 40px rgba(234, 88, 12, 0.4);
          }
          .divider {
            text-align: center;
            margin: 30px 0;
            color: #9ca3af;
            font-size: 14px;
            position: relative;
          }
          .divider::before,
          .divider::after {
            content: '';
            position: absolute;
            top: 50%;
            width: 40%;
            height: 1px;
            background: linear-gradient(to right, transparent, #e5e7eb, transparent);
          }
          .divider::before {
            left: 0;
          }
          .divider::after {
            right: 0;
          }
          .link-box {
            background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%);
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
            border: 2px solid #fdba74;
            word-break: break-all;
          }
          .link-box p {
            margin-bottom: 10px;
            color: #9a3412;
            font-size: 14px;
            font-weight: 600;
          }
          .link-box a {
            color: #ea580c;
            font-size: 13px;
            word-break: break-all;
            text-decoration: none;
          }
          .info-box {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 16px 20px;
            border-radius: 8px;
            margin: 25px 0;
          }
          .info-box p {
            color: #92400e;
            font-size: 15px;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .features {
            background-color: #f9fafb;
            border-radius: 12px;
            padding: 25px;
            margin: 30px 0;
          }
          .features-title {
            font-size: 18px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 16px;
            text-align: center;
          }
          .feature-list {
            list-style: none;
            padding: 0;
          }
          .feature-item {
            padding: 12px 0;
            color: #4b5563;
            font-size: 15px;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .feature-item::before {
            content: '✈️';
            font-size: 20px;
          }
          .footer { 
            background-color: #1e293b;
            padding: 30px;
            text-align: center;
            color: #94a3b8;
          }
          .footer-logo {
            margin-bottom: 20px;
          }
          .footer-text {
            font-size: 14px;
            margin: 10px 0;
            line-height: 1.8;
          }
          .footer-links {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #334155;
          }
          .footer-links a {
            color: #f97316;
            text-decoration: none;
            margin: 0 12px;
            font-size: 13px;
          }
          .footer-links a:hover {
            color: #fb923c;
          }
          .social-links {
            margin-top: 20px;
          }
          .social-links a {
            display: inline-block;
            margin: 0 8px;
            color: #94a3b8;
            text-decoration: none;
            font-size: 24px;
          }
          @media only screen and (max-width: 600px) {
            .content {
              padding: 30px 20px;
            }
            .header {
              padding: 30px 20px;
            }
            .header-title {
              font-size: 24px;
            }
            .verify-button {
              padding: 14px 30px;
              font-size: 15px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <!-- Header -->
          <div class="header">
            <div class="logo-container">
              <img src="${process.env.FRONTEND_URL}/logo.png" alt="Way to India" class="logo">
            </div>
            <h1 class="header-title">Welcome Aboard! 🎉</h1>
            <p class="header-subtitle">Let's verify your email and start exploring</p>
          </div>

          <!-- Content -->
          <div class="content">
            <p class="greeting">Namaste ${name}! 🙏</p>
            
            <p class="message">
              Welcome to <strong>Way to India</strong>! We're thrilled to have you join our community of travel enthusiasts. You're just one step away from discovering incredible journeys across India's most mesmerizing destinations.
            </p>

            <p class="message">
              To unlock your account and start exploring our handpicked tour packages, please verify your email address:
            </p>

            <!-- CTA Button -->
            <div class="cta-container">
              <a href="${verificationUrl}" class="verify-button">
                ✓ Verify My Email Address
              </a>
            </div>

            <!-- Info Box -->
            <div class="info-box">
              <p>⏱ <strong>Important:</strong> This verification link expires in 24 hours for your security.</p>
            </div>

            <!-- Divider -->
            <div class="divider">Or copy the link below</div>

            <!-- Link Box -->
            <div class="link-box">
              <p>Verification Link:</p>
              <a href="${verificationUrl}">${verificationUrl}</a>
            </div>

            <!-- Features -->
            <div class="features">
              <h3 class="features-title">What's waiting for you:</h3>
              <ul class="feature-list">
                <li class="feature-item">Explore 365+ handcrafted tour packages</li>
                <li class="feature-item">Book hotels and transportation seamlessly</li>
                <li class="feature-item">Get personalized travel recommendations</li>
                <li class="feature-item">Access exclusive deals and offers</li>
                <li class="feature-item">24/7 customer support for your journey</li>
              </ul>
            </div>

            <p class="message" style="margin-top: 30px;">
              If you didn't create this account, you can safely ignore this email.
            </p>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div class="footer-logo">
              <img src="${process.env.FRONTEND_URL}/logo-white.png" alt="Way to India" style="height: 35px; opacity: 0.8;">
            </div>
            
            <p class="footer-text">
              <strong>Way to India</strong><br>
              Creating unforgettable journeys across incredible India
            </p>
            
            <p class="footer-text">
              📞 +91-8527253995 | 📧 info@waytoindia.com
            </p>

            <div class="footer-links">
              <a href="${process.env.FRONTEND_URL}/tours">Browse Tours</a>
              <a href="${process.env.FRONTEND_URL}/contact">Contact Us</a>
              <a href="${process.env.FRONTEND_URL}/privacy-policy">Privacy Policy</a>
            </div>

            <div class="social-links">
              <a href="#" title="Twitter">𝕏</a>
              <a href="#" title="Instagram">📷</a>
              <a href="#" title="Facebook">f</a>
            </div>

            <p class="footer-text" style="margin-top: 20px; font-size: 12px; opacity: 0.7;">
              © ${new Date().getFullYear()} Way to India. All Rights Reserved.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
};
