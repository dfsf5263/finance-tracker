import { Resend } from 'resend'
import { formatCurrency } from '@/lib/utils'
import type { HouseholdSummaryData } from '@/lib/weekly-summary'

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

export interface SendWeeklySummaryEmailParams {
  to: string
  userName: string
  summaries: HouseholdSummaryData[]
}

export async function sendWeeklySummaryEmail({
  to,
  userName,
  summaries,
}: SendWeeklySummaryEmailParams) {
  if (!resend) {
    console.warn('Resend API key not configured - skipping email send')
    return { success: false, error: 'Email service not configured' }
  }

  if (summaries.length === 0) {
    return { success: false, error: 'No summaries to send' }
  }

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const replyToEmail = process.env.RESEND_REPLY_TO_EMAIL

    // Determine subject based on report type
    const firstSummary = summaries[0]
    const isMonthlyReview = firstSummary.period.type === 'review'
    const subject = isMonthlyReview
      ? `${firstSummary.period.monthName} ${firstSummary.period.year} In Review - Finance Tracker`
      : `Weekly Summary - Finance Tracker`

    const emailConfig: {
      from: string
      to: string
      subject: string
      replyTo?: string
    } = {
      from: `Finance Tracker <${fromEmail}>`,
      to,
      subject,
    }

    if (replyToEmail) {
      emailConfig.replyTo = replyToEmail
    }

    const { data, error } = await resend.emails.send({
      ...emailConfig,
      html: generateSummaryEmailHtml(userName, summaries, isMonthlyReview),
    })

    if (error) {
      console.error('Failed to send weekly summary email:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Error sending weekly summary email:', error)
    return { success: false, error }
  }
}

function generateSummaryEmailHtml(
  userName: string,
  summaries: HouseholdSummaryData[],
  isMonthlyReview: boolean
): string {
  const title = isMonthlyReview
    ? `${summaries[0].period.monthName} ${summaries[0].period.year} In Review`
    : 'Weekly Summary'

  const householdSections = summaries
    .map((summary) => generateHouseholdSection(summary))
    .join(
      '<tr><td style="padding: 20px 0;"><hr style="border: 0; border-top: 1px solid #e5e7eb;"></td></tr>'
    )

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
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
                    <h2 style="margin: 10px 0 0 0; font-size: 22px; font-weight: 500; color: #333;">${title}</h2>
                  </td>
                </tr>
                
                <!-- Greeting -->
                <tr>
                  <td style="padding: 0 40px 20px 40px;">
                    <p style="margin: 0; font-size: 16px;">
                      Hi ${userName},
                    </p>
                    <p style="margin: 10px 0 0 0; font-size: 16px;">
                      ${
                        isMonthlyReview
                          ? `Here's your complete financial summary for ${summaries[0].period.monthName} ${summaries[0].period.year}:`
                          : `Here's your financial summary for ${summaries[0].period.monthName} ${summaries[0].period.year} (month to date):`
                      }
                    </p>
                  </td>
                </tr>
                
                <!-- Household Summaries -->
                ${householdSections}
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 40px; background-color: #f8f9fa; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding-bottom: 20px;">
                          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">View Full Dashboard</a>
                        </td>
                      </tr>
                      <tr>
                        <td align="center">
                          <p style="margin: 0; font-size: 12px; color: #999;">
                            You're receiving this because you have weekly summaries enabled.
                            <br>
                            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/settings/email-subscriptions" style="color: #2563eb;">Manage email preferences</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}

function generateHouseholdSection(summary: HouseholdSummaryData): string {
  const { householdName, spending, budgetPerformance, topCategories, cashFlow, budgetAlerts } =
    summary

  // Generate budget alerts HTML
  const alertsHtml =
    budgetAlerts.length > 0
      ? `
    <div style="margin-top: 20px;">
      <h4 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">Budget Alerts</h4>
      ${budgetAlerts.map((alert) => generateAlertHtml(alert)).join('')}
    </div>
  `
      : ''

  return `
    <tr>
      <td style="padding: 20px 40px;">
        <h3 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #1f2937;">${householdName}</h3>
        
        <!-- Summary Cards Grid -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
          <tr>
            <td width="48%" style="background-color: #f8f9fa; padding: 16px; border-radius: 6px; vertical-align: top;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; font-weight: 500;">Total Spending</p>
              <p style="margin: 0 0 4px 0; font-size: 20px; font-weight: 600; color: #111827;">${formatCurrency(spending.currentTotal)}</p>
              <p style="margin: 0; font-size: 12px; color: ${spending.trend === 'up' ? '#dc2626' : '#059669'};">
                ${spending.trend === 'up' ? '↑' : '↓'} ${spending.percentageChange.toFixed(1)}% vs last month
              </p>
            </td>
            <td width="4%"></td>
            <td width="48%" style="background-color: #f8f9fa; padding: 16px; border-radius: 6px; vertical-align: top;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; font-weight: 500;">Budget Status</p>
              ${
                budgetPerformance
                  ? `
                    <p style="margin: 0 0 4px 0; font-size: 20px; font-weight: 600; color: ${
                      budgetPerformance.status === 'over-budget'
                        ? '#dc2626'
                        : budgetPerformance.status === 'warning'
                          ? '#f59e0b'
                          : '#059669'
                    };">${budgetPerformance.percentageUsed.toFixed(1)}%</p>
                    <p style="margin: 0; font-size: 12px; color: #6b7280;">
                      ${formatCurrency(budgetPerformance.budgetUsed)} of ${formatCurrency(budgetPerformance.totalBudget)}
                    </p>
                  `
                  : '<p style="margin: 0; font-size: 14px; color: #6b7280;">No budget set</p>'
              }
            </td>
          </tr>
          <tr>
            <td colspan="3" style="padding-top: 12px;"></td>
          </tr>
          <tr>
            <td width="48%" style="background-color: #f8f9fa; padding: 16px; border-radius: 6px; vertical-align: top;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; font-weight: 500;">Net Cash Flow</p>
              <p style="margin: 0 0 4px 0; font-size: 20px; font-weight: 600; color: ${cashFlow.isPositive ? '#059669' : '#dc2626'};">
                ${formatCurrency(cashFlow.netFlow)}
              </p>
              <p style="margin: 0; font-size: 12px; color: #6b7280;">
                Income: ${formatCurrency(cashFlow.income)}
              </p>
            </td>
            <td width="4%"></td>
            <td width="48%" style="background-color: #f8f9fa; padding: 16px; border-radius: 6px; vertical-align: top;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; font-weight: 500;">Top Categories</p>
              ${topCategories
                .slice(0, 3)
                .map(
                  (cat) => `
                <p style="margin: 0 0 2px 0; font-size: 12px; color: #374151;">
                  <strong>${cat.name}:</strong> ${formatCurrency(cat.amount)}
                </p>
              `
                )
                .join('')}
            </td>
          </tr>
        </table>

        ${alertsHtml}
      </td>
    </tr>
  `
}

function generateAlertHtml(alert: {
  type: string
  severity: string
  name?: string
  message?: string
  budgetUsed: number
  totalBudget: number
  percentageUsed: number
  overspendAmount?: number
}): string {
  const colors = {
    critical: { border: '#dc2626', bg: '#fef2f2', text: '#dc2626', icon: '⚠️' },
    warning: { border: '#f59e0b', bg: '#fffbeb', text: '#f59e0b', icon: '⚠️' },
    info: { border: '#10b981', bg: '#f0fdf4', text: '#10b981', icon: 'ℹ️' },
  }

  const style = colors[alert.severity as keyof typeof colors] || colors.info

  let title = ''
  if (alert.type === 'household') {
    title = alert.message || 'Household Budget Alert'
  } else if (alert.type === 'category') {
    title = alert.overspendAmount
      ? `${alert.name} exceeded budget by ${formatCurrency(alert.overspendAmount)}`
      : alert.severity === 'info'
        ? `${alert.name} has exceeded 50% of budget`
        : `${alert.name} approaching budget limit`
  } else if (alert.type === 'user') {
    title = alert.overspendAmount
      ? `${alert.name} exceeded personal budget by ${formatCurrency(alert.overspendAmount)}`
      : alert.severity === 'info'
        ? `${alert.name} has exceeded 50% of personal budget`
        : `${alert.name} approaching personal budget limit`
  }

  return `
    <div style="border-left: 4px solid ${style.border}; background: ${style.bg}; padding: 12px; margin: 8px 0; border-radius: 4px;">
      <p style="margin: 0 0 4px 0; font-weight: 600; color: ${style.text}; font-size: 14px;">
        ${style.icon} ${title}
      </p>
      <p style="margin: 0; font-size: 12px; color: #374151;">
        ${formatCurrency(alert.budgetUsed)} of ${formatCurrency(alert.totalBudget)} (${alert.percentageUsed.toFixed(1)}%)
      </p>
    </div>
  `
}
