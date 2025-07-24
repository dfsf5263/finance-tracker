'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function TwoFactorPage() {
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { data, error } = await authClient.twoFactor.verifyTotp({
        code,
      })

      if (error) {
        toast.error(error.message || 'Invalid verification code')
        return
      }

      if (data) {
        toast.success('Successfully authenticated!')
        router.push('/dashboard')
      }
    } catch (error) {
      toast.error('An unexpected error occurred')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="mx-auto max-w-sm border-border p-4">
      <CardHeader>
        <CardTitle className="text-2xl">Two-Factor Authentication</CardTitle>
        <CardDescription>Enter the 6-digit code from your authenticator app</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="code">Verification Code</Label>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={(value) => setCode(value)}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isLoading || code.length !== 6}>
            {isLoading ? 'Verifying...' : 'Verify'}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          <p>Lost access to your authenticator?</p>
          <p>Contact support for help with account recovery.</p>
        </div>
      </CardContent>
    </Card>
  )
}
