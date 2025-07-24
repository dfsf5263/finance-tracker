'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import QRCode from 'react-qr-code'
import {
  Check,
  Copy,
  Download,
  Smartphone,
  Shield,
  AlertCircle,
  AlertTriangle,
  Lock,
} from 'lucide-react'

interface TotpSetupWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

export function TotpSetupWizard({ open, onOpenChange, onComplete }: TotpSetupWizardProps) {
  const [step, setStep] = useState(1)
  const [qrCodeUri, setQrCodeUri] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verificationCode, setVerificationCode] = useState('')
  const [password, setPassword] = useState('')
  const [isGeneratingQR, setIsGeneratingQR] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)

  const generateQRCode = async () => {
    if (!password) return

    setIsGeneratingQR(true)
    try {
      const result = await authClient.twoFactor.enable({
        password,
      })

      if (result.error) {
        throw new Error(result.error.message)
      }

      if (result.data?.totpURI) {
        setQrCodeUri(result.data.totpURI)
        setStep(2)
      }
    } catch (error) {
      console.error('Failed to generate QR code:', error)
      toast.error('Failed to generate QR code. Please check your password.')
    } finally {
      setIsGeneratingQR(false)
    }
  }

  const verifyTOTP = async () => {
    if (verificationCode.length !== 6) return

    setIsVerifying(true)
    try {
      const result = await authClient.twoFactor.verifyTotp({
        code: verificationCode,
      })

      if (result.error) {
        const errorMessage =
          result.error.message ||
          result.error.toString() ||
          'TOTP verification failed - please check your code and try again'
        throw new Error(errorMessage)
      }

      // Generate real backup codes after successful TOTP verification
      const backupResult = await authClient.twoFactor.generateBackupCodes({
        password,
      })

      if (backupResult.error) {
        const backupErrorMessage =
          backupResult.error.message ||
          backupResult.error.toString() ||
          'Failed to generate backup codes'
        throw new Error(`Failed to generate backup codes: ${backupErrorMessage}`)
      }

      if (backupResult.data?.backupCodes) {
        setBackupCodes(backupResult.data.backupCodes)
      } else {
        throw new Error('No backup codes received from server')
      }

      toast.success('Two-factor authentication has been enabled successfully!')
      setStep(3)
    } catch (error) {
      console.error('Failed to verify TOTP or generate backup codes:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to complete 2FA setup')
    } finally {
      setIsVerifying(false)
    }
  }

  const copyBackupCodes = async () => {
    const codesText = backupCodes.join('\n')
    try {
      await navigator.clipboard.writeText(codesText)
      setCopiedCodes(true)
      setTimeout(() => setCopiedCodes(false), 2000)
    } catch {
      toast.error('Failed to copy backup codes')
    }
  }

  const downloadBackupCodes = () => {
    const codesText = backupCodes.join('\n')
    const blob = new Blob(
      [
        `Finance Tracker - Backup Recovery Codes\n\nThese codes can be used to access your account if you lose your authenticator device.\nEach code can only be used once.\n\n${codesText}\n\nGenerated on: ${new Date().toLocaleDateString()}`,
      ],
      { type: 'text/plain' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'finance-tracker-backup-codes.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleComplete = () => {
    onComplete()
    // Reset wizard state
    setStep(1)
    setQrCodeUri('')
    setBackupCodes([])
    setVerificationCode('')
    setPassword('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Set Up Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>Step {step} of 3</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          {/* Step 1: Password Confirmation */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="setup-password">Confirm Your Password</Label>
                <Input
                  id="setup-password"
                  type="password"
                  placeholder="Enter your current password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  We need to verify your identity before setting up two-factor authentication.
                </p>
              </div>

              <Button
                onClick={generateQRCode}
                disabled={!password || isGeneratingQR}
                className="w-full"
              >
                {isGeneratingQR ? 'Generating...' : 'Continue'}
              </Button>
            </div>
          )}

          {/* Step 2: QR Code Scanning */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <h3 className="font-semibold">Scan QR Code</h3>
                <p className="text-sm text-muted-foreground">
                  Use your authenticator app to scan this QR code
                </p>
              </div>

              <Card>
                <CardContent className="p-4">
                  <div className="flex justify-center">
                    <div className="bg-white p-4 rounded-lg">
                      <QRCode value={qrCodeUri} size={200} level="M" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label>Authenticator Apps</Label>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Google Authenticator</Badge>
                  <Badge variant="secondary">Authy</Badge>
                  <Badge variant="secondary">Microsoft Authenticator</Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Enter Verification Code</Label>
                <InputOTP maxLength={6} value={verificationCode} onChange={setVerificationCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              <Button
                onClick={verifyTOTP}
                disabled={verificationCode.length !== 6 || isVerifying}
                className="w-full"
              >
                <Smartphone className="h-4 w-4 mr-2" />
                {isVerifying ? 'Verifying...' : 'Verify & Enable'}
              </Button>
            </div>
          )}

          {/* Step 3: Backup Codes */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <div className="flex justify-center">
                  <div className="bg-green-100 p-3 rounded-full">
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <h3 className="font-semibold text-green-800">2FA Enabled!</h3>
                <p className="text-sm text-muted-foreground">
                  Your account is now protected with two-factor authentication
                </p>
              </div>

              {/* Critical Security Warning */}
              <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 mt-0.5 text-red-600 flex-shrink-0" />
                  <div className="space-y-2">
                    <p className="text-sm text-red-800 font-bold">
                      ⚠️ CRITICAL: These codes will NEVER be shown again!
                    </p>
                    <p className="text-sm text-red-700">
                      Once you close this window, these backup codes cannot be recovered or viewed
                      again. Save them securely NOW or you may lose access to your account.
                    </p>
                  </div>
                </div>
              </div>

              {/* Storage Guidance */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <Lock className="h-4 w-4 mt-0.5 text-blue-600" />
                  <div className="space-y-2">
                    <p className="text-sm text-blue-800 font-medium">
                      How to Store These Codes Safely
                    </p>
                    <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                      <li>Save in a password manager (1Password, Bitwarden, LastPass)</li>
                      <li>Store in encrypted notes or secure notes app</li>
                      <li>Print and keep in a safe physical location</li>
                      <li>Do NOT save as screenshots or plain text files</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                    {backupCodes.map((code, index) => (
                      <div key={index} className="p-2 bg-muted rounded text-center">
                        {code}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button variant="outline" onClick={copyBackupCodes} className="flex-1">
                  {copiedCodes ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  {copiedCodes ? 'Copied!' : 'Copy'}
                </Button>
                <Button variant="outline" onClick={downloadBackupCodes} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>

              {/* Final Security Reminder */}
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <p className="text-sm text-amber-800 font-medium">
                    By completing setup, you confirm these codes are saved securely
                  </p>
                </div>
              </div>

              <Button onClick={handleComplete} className="w-full">
                <Shield className="h-4 w-4 mr-2" />I Have Saved These Codes Securely - Complete
                Setup
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
