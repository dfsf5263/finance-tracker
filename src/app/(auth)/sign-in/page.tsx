import { SignInForm } from '@/components/auth/sign-in-form'

export default function SignInPage() {
  const signupsEnabled = process.env.DISABLE_SIGNUPS !== 'true'

  return <SignInForm signupsEnabled={signupsEnabled} />
}
