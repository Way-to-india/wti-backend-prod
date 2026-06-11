export const getPasswordResetEmailTemplate = (name: string, resetUrl: string): string => {
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
          .header-title { color: white; font-size: 24px; font-weight: 700; }
          .header-subtitle { color: rgba(255, 255, 255, 0.9); font-size: 14px; margin-top: 6px; }
          .body { padding: 32px 30px; }
          .greeting { font-size: 16px; margin-bottom: 16px; }
          .text { font-size: 15px; color: #374151; margin-bottom: 24px; }
          .button-wrap { text-align: center; margin: 28px 0; }
          .button {
            display: inline-block; background: linear-gradient(135deg, #ea580c 0%, #f97316 100%);
            color: white !important; text-decoration: none; font-weight: 600; font-size: 15px;
            padding: 14px 36px; border-radius: 10px;
          }
          .link-fallback { font-size: 12px; color: #6b7280; word-break: break-all; margin-top: 8px; }
          .note { font-size: 13px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a;
            border-radius: 8px; padding: 12px 14px; margin-top: 20px; }
          .footer { padding: 20px 30px; text-align: center; color: #9ca3af; font-size: 12px;
            border-top: 1px solid #f3f4f6; }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <div class="header-title">Way to India — Admin</div>
            <div class="header-subtitle">Password reset request</div>
          </div>
          <div class="body">
            <p class="greeting">Hello ${name || 'Admin'},</p>
            <p class="text">
              We received a request to reset the password for your Way to India admin account.
              Click the button below to choose a new password. This link expires in
              <strong>30 minutes</strong> and can be used only once.
            </p>
            <div class="button-wrap">
              <a class="button" href="${resetUrl}" target="_blank" rel="noopener">Reset Password</a>
            </div>
            <p class="link-fallback">If the button doesn't work, copy and paste this URL:<br/>${resetUrl}</p>
            <div class="note">
              If you did not request this, you can safely ignore this email — your password will
              not change. For your security, consider reviewing recent account activity.
            </div>
          </div>
          <div class="footer">
            This email was sent from the Way To India Admin Panel. Please do not reply.
          </div>
        </div>
      </body>
    </html>
  `;
};
