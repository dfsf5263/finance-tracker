import { SignInForm } from '@/components/auth/sign-in-form'

export default function SignInPage() {
  const signupsEnabled = process.env.DISABLE_SIGNUPS !== 'true'
  const emailEnabled = !!process.env.RESEND_API_KEY

  return <SignInForm signupsEnabled={signupsEnabled} emailEnabled={emailEnabled} />
}
