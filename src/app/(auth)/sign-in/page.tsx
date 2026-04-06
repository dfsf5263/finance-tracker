import { SignInForm } from '@/components/auth/sign-in-form'
import { safeRedirectUrl, REDIRECT_PARAM } from '@/lib/redirect-utils'

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const raw = typeof params[REDIRECT_PARAM] === 'string' ? params[REDIRECT_PARAM] : undefined
  const redirectTo = safeRedirectUrl(raw) ?? undefined

  return <SignInForm redirectTo={redirectTo} />
}
