import { redirect } from 'next/navigation'
import ForgotPasswordForm from './forgot-password-form'

export default function ForgotPasswordPage() {
  if (!process.env.RESEND_API_KEY) {
    redirect('/sign-in')
  }

  return <ForgotPasswordForm />
}
