import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export interface SendInvitationEmailParams {
  to: string
  inviterName: string
  householdName: string
  role: 'OWNER' | 'MEMBER' | 'VIEWER'
  invitationLink: string
  expiresAt: Date
}

export async function sendInvitationEmail({
  to,
  inviterName,
  householdName,
  role,
  invitationLink,
  expiresAt,
}: SendInvitationEmailParams) {
  if (!resend) {
    console.warn('Resend API key not configured - skipping email send')
    return { success: false, error: 'Email service not configured' }
  }

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const replyToEmail = process.env.RESEND_REPLY_TO_EMAIL

    const emailConfig: {
      from: string
      to: string
      subject: string
      replyTo?: string
    } = {
      from: `Finance Tracker <${fromEmail}>`,
      to,
      subject: `${inviterName} invited you to join the ${householdName} household!`,
    }

    // Add reply-to if configured
    if (replyToEmail) {
      emailConfig.replyTo = replyToEmail
    }

    const { data, error } = await resend.emails.send({
      ...emailConfig,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Household Invitation</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                      <td style="padding: 40px 40px 20px 40px; text-align: center;">
                        <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: #2563eb;">Finance Tracker</h1>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 20px 40px 40px 40px;">
                        <h2 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">You're invited to join the ${householdName} household!</h2>
                        
                        <p style="margin: 0 0 20px 0; font-size: 16px;">
                          <strong>${inviterName}</strong> has invited you to join their household in Finance Tracker as a <strong>${role}</strong>.
                        </p>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 0 0 20px 0;">
                          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
                            <strong>Your role permissions:</strong>
                          </p>
                          ${getRoleDescription(role)}
                        </div>
                        
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                          <tr>
                            <td align="center">
                              <a href="${invitationLink}" style="display: inline-block; padding: 14px 30px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">Accept Invitation</a>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
                          Or copy and paste this link into your browser:
                        </p>
                        <p style="margin: 0 0 20px 0; font-size: 14px; word-break: break-all;">
                          <a href="${invitationLink}" style="color: #2563eb;">${invitationLink}</a>
                        </p>
                        
                        <p style="margin: 0; font-size: 14px; color: #999;">
                          This invitation will expire on ${expiresAt.toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}.
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 20px 40px; background-color: #f8f9fa; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
                        <p style="margin: 0; font-size: 12px; color: #999; text-align: center;">
                          This email was sent by Finance Tracker. If you didn't request this invitation, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    })

    if (error) {
      console.error('Failed to send invitation email:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Error sending invitation email:', error)
    return { success: false, error }
  }
}

function getRoleDescription(role: string): string {
  switch (role) {
    case 'OWNER':
      return '<p style="margin: 0; font-size: 14px;">• Full control over household settings<br>• Can invite and remove members<br>• Can view and manage all transactions<br>• Can set and modify budgets</p>'
    case 'MEMBER':
      return '<p style="margin: 0; font-size: 14px;">• Can view all household data<br>• Can add and manage transactions<br>• Can view budgets and reports<br>• Cannot modify household settings</p>'
    case 'VIEWER':
      return '<p style="margin: 0; font-size: 14px;">• Read-only access to household data<br>• Can view transactions and reports<br>• Cannot add or modify any data<br>• Cannot access household settings</p>'
    default:
      return ''
  }
}
