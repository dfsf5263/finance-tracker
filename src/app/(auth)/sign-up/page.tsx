import { redirect } from 'next/navigation'
import { SignUpForm } from '@/components/auth/sign-up-form'
import { safeRedirectUrl, REDIRECT_PARAM } from '@/lib/redirect-utils'

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const raw = typeof params[REDIRECT_PARAM] === 'string' ? params[REDIRECT_PARAM] : undefined
  const redirectTo = safeRedirectUrl(raw) ?? undefined

  if (process.env.DISABLE_SIGNUPS === 'true') {
    const signInUrl = redirectTo
      ? `/sign-in?${REDIRECT_PARAM}=${encodeURIComponent(redirectTo)}`
      : '/sign-in'
    redirect(signInUrl)
  }

  return <SignUpForm redirectTo={redirectTo} />
}
