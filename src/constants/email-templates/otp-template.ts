export const getOtpEmailTemplate = (otp: string): string => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6; color: #1f2937;
            background: linear-gradient(135deg, #fff5f0 0%, #ffffff 50%, #fff5f0 100%);
            padding: 20px;
          }
          .email-wrapper {
            max-width: 500px; margin: 0 auto; background-color: #ffffff;
            border-radius: 16px; overflow: hidden;
            box-shadow: 0 10px 40px rgba(234, 88, 12, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #ea580c 0%, #f97316 100%);
            padding: 30px; text-align: center;
          }
          .header-title {
            color: white; font-size: 24px; font-weight: 700;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header-subtitle {
            color: rgba(255, 255, 255, 0.9); font-size: 14px; margin-top: 6px;
          }
          .content { padding: 35px 30px; text-align: center; }
          .message {
            color: #4b5563; font-size: 16px; margin-bottom: 24px;
          }
          .otp-box {
            background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%);
            border: 2px solid #fdba74; border-radius: 12px;
            padding: 24px; margin: 24px 0; display: inline-block;
          }
          .otp-code {
            font-size: 36px; font-weight: 700; letter-spacing: 8px;
            color: #ea580c; font-family: 'Courier New', monospace;
          }
          .expiry-note {
            color: #92400e; font-size: 13px; margin-top: 20px;
            background: #fef3c7; padding: 10px 16px; border-radius: 8px;
            border-left: 3px solid #f59e0b; text-align: left;
          }
          .warning {
            color: #6b7280; font-size: 13px; margin-top: 20px;
          }
          .footer {
            background-color: #1e293b; padding: 20px; text-align: center; color: #94a3b8;
          }
          .footer-text { font-size: 12px; }
          @media only screen and (max-width: 500px) {
            .content { padding: 25px 20px; }
            .otp-code { font-size: 28px; letter-spacing: 6px; }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <h1 class="header-title">Email Verification</h1>
            <p class="header-subtitle">Way to India - Your Journey Starts Here</p>
          </div>
          <div class="content">
            <p class="message">Use the following OTP to verify your email address:</p>
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
            </div>
            <div class="expiry-note">
              <strong>Important:</strong> This OTP expires in 10 minutes. Do not share it with anyone.
            </div>
            <p class="warning">
              If you didn't request this, please ignore this email.
            </p>
          </div>
          <div class="footer">
            <p class="footer-text">&copy; ${new Date().getFullYear()} Way to India. All Rights Reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
};
