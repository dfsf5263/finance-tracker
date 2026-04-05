import { redirect } from 'next/navigation'
import { SignUpForm } from '@/components/auth/sign-up-form'

export default function SignUpPage() {
  if (process.env.DISABLE_SIGNUPS === 'true') {
    redirect('/sign-in')
  }

  return <SignUpForm />
}
