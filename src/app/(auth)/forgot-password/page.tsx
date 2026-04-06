import { redirect } from 'next/navigation'
import ForgotPasswordForm from './forgot-password-form'
import { safeRedirectUrl, REDIRECT_PARAM } from '@/lib/redirect-utils'

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!process.env.RESEND_API_KEY) {
    redirect('/sign-in')
  }

  const params = await searchParams
  const rawRedirect =
    typeof params[REDIRECT_PARAM] === 'string' ? params[REDIRECT_PARAM] : undefined
  const redirectTo = rawRedirect ? (safeRedirectUrl(rawRedirect) ?? undefined) : undefined

  return <ForgotPasswordForm redirectTo={redirectTo} />
}
