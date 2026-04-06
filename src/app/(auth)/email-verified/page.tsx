'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircleIcon } from 'lucide-react'

function EmailVerifiedContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')

  const signInHref = redirect ? `/sign-in?redirect=${encodeURIComponent(redirect)}` : '/sign-in'

  useEffect(() => {
    // Redirect to sign-in after 5 seconds
    const timer = setTimeout(() => {
      router.push(signInHref)
    }, 5000)

    return () => clearTimeout(timer)
  }, [router, signInHref])

  return (
    <Card className="mx-auto max-w-sm border-border">
      <CardHeader>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <CheckCircleIcon className="h-6 w-6 text-green-600" />
        </div>
        <CardTitle className="text-center text-2xl">Email verified!</CardTitle>
        <CardDescription className="text-center">
          Your email has been successfully verified
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <p className="mb-6 text-sm text-muted-foreground">
          You can now sign in to your account. You&apos;ll be redirected automatically in a few
          seconds.
        </p>
        <Button asChild className="w-full">
          <Link href={signInHref}>Continue to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export default function EmailVerifiedPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EmailVerifiedContent />
    </Suspense>
  )
}
