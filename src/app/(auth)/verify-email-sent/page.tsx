'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MailIcon } from 'lucide-react'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')

  return (
    <Card className="mx-auto max-w-sm border-border p-4">
      <CardHeader>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <MailIcon className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-center text-2xl">Check your email</CardTitle>
        <CardDescription className="text-center">
          We sent a verification link to {email || 'your email'}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <p className="mb-4 text-sm text-muted-foreground">
          Click the link in your email to verify your account. The link will expire in 24 hours.
        </p>
        <p className="mb-6 text-sm text-muted-foreground">
          Didn&apos;t receive the email? Check your spam folder or sign up again to resend.
        </p>
        <div className="space-y-2">
          <Button asChild variant="outline" className="w-full">
            <Link href="/sign-in">Back to sign in</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function VerifyEmailSentPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  )
}
