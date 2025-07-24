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

export interface EmailVerificationOptions {
  to: string
  firstName: string
  verificationUrl: string
}

/**
 * Send email verification email using Resend
 */
export async function sendEmailVerification({
  to,
  firstName,
  verificationUrl,
}: EmailVerificationOptions): Promise<{ success: boolean; error?: string }> {
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
      subject: 'Verify your email address - Finance Tracker',
      html: getEmailVerificationHtml({ firstName, verificationUrl }),
      text: getEmailVerificationText({ firstName, verificationUrl }),
    })

    if (error) {
      console.error('Failed to send email verification:', error)
      return {
        success: false,
        error: error.message || 'Failed to send email',
      }
    }

    console.log('Email verification sent successfully:', data?.id)
    return { success: true }
  } catch (error) {
    console.error('Error sending email verification:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Generate HTML version of email verification email
 */
function getEmailVerificationHtml({
  firstName,
  verificationUrl,
}: {
  firstName: string
  verificationUrl: string
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email address</title>
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
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Finance Tracker</div>
  </div>
  
  <div class="content">
    <h1>Welcome to Finance Tracker, ${firstName}!</h1>
    
    <p>Thank you for signing up for Finance Tracker. To complete your account setup and start managing your finances, please verify your email address by clicking the button below:</p>
    
    <p style="text-align: center;">
      <a href="${verificationUrl}" class="button">Verify Email Address</a>
    </p>
    
    <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
    <p style="word-break: break-all; font-family: monospace; background-color: #f3f4f6; padding: 10px; border-radius: 4px;">
      ${verificationUrl}
    </p>
    
    <div class="warning">
      <strong>Important:</strong> This verification link will expire in 24 hours. If you didn't create an account with Finance Tracker, please ignore this email.
    </div>
    
    <p>Once verified, you'll be able to:</p>
    <ul>
      <li>Track your income and expenses</li>
      <li>View financial analytics and insights</li>
      <li>Manage multiple households</li>
      <li>Import transactions from CSV files</li>
    </ul>
    
    <p>If you have any questions or need assistance, feel free to contact our support team.</p>
    
    <p>Welcome to your financial journey!</p>
    <p><strong>The Finance Tracker Team</strong></p>
  </div>
  
  <div class="footer">
    <p>This email was sent to ${firstName} because you created an account on Finance Tracker.</p>
    <p>If you believe this was sent in error, please ignore this email.</p>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Generate text version of email verification email
 */
function getEmailVerificationText({
  firstName,
  verificationUrl,
}: {
  firstName: string
  verificationUrl: string
}): string {
  return `
Welcome to Finance Tracker, ${firstName}!

Thank you for signing up for Finance Tracker. To complete your account setup and start managing your finances, please verify your email address by visiting:

${verificationUrl}

IMPORTANT: This verification link will expire in 24 hours. If you didn't create an account with Finance Tracker, please ignore this email.

Once verified, you'll be able to:
• Track your income and expenses
• View financial analytics and insights  
• Manage multiple households
• Import transactions from CSV files

If you have any questions or need assistance, feel free to contact our support team.

Welcome to your financial journey!

The Finance Tracker Team

---
This email was sent because you created an account on Finance Tracker.
If you believe this was sent in error, please ignore this email.
  `.trim()
}
