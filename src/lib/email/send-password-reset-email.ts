import { Resend } from 'resend'

// Lazy-initialized Resend client to avoid build-time errors
let resendClient: Resend | null = null

/**
 * Get or create the Resend client instance
 * This lazy initialization prevents build-time errors when environment variables aren't available
 */
function getResendClient(): Resend {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not configured')
    }
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

export interface PasswordResetOptions {
  to: string
  firstName: string
  resetUrl: string
}

/**
 * Send password reset email using Resend
 */
export async function sendPasswordResetEmail({
  to,
  firstName,
  resetUrl,
}: PasswordResetOptions): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_FROM_EMAIL) {
      throw new Error('RESEND_FROM_EMAIL environment variable is not configured')
    }

    const resend = getResendClient() // Lazy initialization
    const fromAddress = process.env.RESEND_FROM_EMAIL
    const replyToAddress = process.env.RESEND_REPLY_TO_EMAIL || process.env.RESEND_FROM_EMAIL

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      replyTo: replyToAddress,
      subject: 'Reset your password - Finance Tracker',
      html: getPasswordResetHtml({ firstName, resetUrl }),
      text: getPasswordResetText({ firstName, resetUrl }),
    })

    if (error) {
      console.error('Failed to send password reset email:', error)
      return {
        success: false,
        error: error.message || 'Failed to send email',
      }
    }

    console.log('Password reset email sent successfully:', data?.id)
    return { success: true }
  } catch (error) {
    console.error('Error sending password reset email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Generate HTML version of password reset email
 */
function getPasswordResetHtml({
  firstName,
  resetUrl,
}: {
  firstName: string
  resetUrl: string
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      padding: 20px 0;
      border-bottom: 1px solid #e5e5e5;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #0f172a;
    }
    .content {
      margin: 30px 0;
    }
    .button {
      display: inline-block;
      background-color: #0f172a;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
    .button:hover {
      background-color: #1e293b;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
      font-size: 14px;
      color: #666;
      text-align: center;
    }
    .warning {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .security-notice {
      background-color: #f0f9ff;
      border-left: 4px solid #0ea5e9;
      padding: 12px;
      margin: 20px 0;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Finance Tracker</div>
  </div>
  
  <div class="content">
    <h1>Reset your password</h1>
    
    <p>Hello ${firstName},</p>
    
    <p>We received a request to reset your password for your Finance Tracker account. If you made this request, click the button below to create a new password:</p>
    
    <p style="text-align: center;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </p>
    
    <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
    <p style="word-break: break-all; font-family: monospace; background-color: #f3f4f6; padding: 10px; border-radius: 4px;">
      ${resetUrl}
    </p>
    
    <div class="warning">
      <strong>Important:</strong> This password reset link will expire in 1 hour for security reasons.
    </div>
    
    <div class="security-notice">
      <strong>Security Notice:</strong> If you didn't request a password reset, please ignore this email. Your account remains secure and no changes have been made.
    </div>
    
    <p>For your security, please make sure to:</p>
    <ul>
      <li>Choose a strong, unique password</li>
      <li>Don't share your password with anyone</li>
      <li>Log out of shared computers after use</li>
      <li>Contact support if you notice any suspicious activity</li>
    </ul>
    
    <p>If you have any questions or need assistance, feel free to contact our support team.</p>
    
    <p>Stay secure,</p>
    <p><strong>The Finance Tracker Team</strong></p>
  </div>
  
  <div class="footer">
    <p>This email was sent to ${firstName} because a password reset was requested for your Finance Tracker account.</p>
    <p>If you believe this was sent in error, please ignore this email or contact support.</p>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Generate text version of password reset email
 */
function getPasswordResetText({
  firstName,
  resetUrl,
}: {
  firstName: string
  resetUrl: string
}): string {
  return `
Reset your password - Finance Tracker

Hello ${firstName},

We received a request to reset your password for your Finance Tracker account. If you made this request, visit the following link to create a new password:

${resetUrl}

IMPORTANT: This password reset link will expire in 1 hour for security reasons.

SECURITY NOTICE: If you didn't request a password reset, please ignore this email. Your account remains secure and no changes have been made.

For your security, please make sure to:
• Choose a strong, unique password
• Don't share your password with anyone
• Log out of shared computers after use
• Contact support if you notice any suspicious activity

If you have any questions or need assistance, feel free to contact our support team.

Stay secure,

The Finance Tracker Team

---
This email was sent because a password reset was requested for your Finance Tracker account.
If you believe this was sent in error, please ignore this email or contact support.
  `.trim()
}
