'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Shield, Smartphone, HelpCircle, Mail } from 'lucide-react'
import { TotpSetupWizard } from '@/components/settings/totp-setup-wizard'
import { toast } from 'sonner'

export default function SecurityPage() {
  const { data: session } = authClient.useSession()
  const [isEnabling, setIsEnabling] = useState(false)
  const [isDisabling, setIsDisabling] = useState(false)
  const [showSetupWizard, setShowSetupWizard] = useState(false)
  const [password, setPassword] = useState('')

  const user = session?.user
  const twoFactorEnabled = user?.twoFactorEnabled ?? false

  const handleEnable2FA = async () => {
    if (!password) {
      return
    }

    setIsEnabling(true)
    try {
      const result = await authClient.twoFactor.enable({
        password,
      })

      if (result.error) {
        throw new Error(result.error.message)
      }

      setShowSetupWizard(true)
      setPassword('')
      toast.success('Two-factor authentication setup initiated')
    } catch (error) {
      console.error('Failed to enable 2FA:', error)
      toast.error('Failed to enable 2FA. Please check your password.')
    } finally {
      setIsEnabling(false)
    }
  }

  const handleDisable2FA = async () => {
    if (!password) {
      return
    }

    setIsDisabling(true)
    try {
      const result = await authClient.twoFactor.disable({
        password,
      })

      if (result.error) {
        throw new Error(result.error.message)
      }

      setPassword('')
      toast.success('Two-factor authentication has been disabled')
      window.location.reload() // Refresh to update user session
    } catch (error) {
      console.error('Failed to disable 2FA:', error)
      toast.error('Failed to disable 2FA. Please check your password.')
    } finally {
      setIsDisabling(false)
    }
  }

  return (
    <div className="space-y-6 p-4">
      {/* Two-Factor Authentication Section */}
      <Card className="p-4">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Two-Factor Authentication</CardTitle>
            {twoFactorEnabled && (
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              >
                Enabled
              </Badge>
            )}
          </div>
          <CardDescription>
            Add an extra layer of security to your account by requiring a code from your phone in
            addition to your password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Authenticator App</Label>
              <p className="text-sm text-muted-foreground">
                Use an authenticator app like Google Authenticator or Authy to generate verification
                codes.
              </p>
            </div>
            <Switch checked={twoFactorEnabled} disabled={isEnabling || isDisabling} />
          </div>

          {!twoFactorEnabled && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 text-blue-600" />
                <div className="space-y-2 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Secure Your Financial Data with Two-Factor Authentication
                  </p>
                  <p className="text-sm text-muted-foreground">
                    To enable two-factor authentication, you&apos;ll need to:
                  </p>
                  <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                    <li>Install an authenticator app on your phone</li>
                    <li>Enter your password to confirm your identity</li>
                    <li>Scan the QR code with your authenticator app</li>
                    <li>Save your backup codes securely (shown only once)</li>
                    <li>Enter the verification code to complete setup</li>
                  </ol>
                </div>
              </div>

              {/* Security Benefits */}
              <div className="bg-blue-50 dark:bg-blue-950/50 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 mt-0.5 text-blue-600" />
                  <div>
                    <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                      Why Enable 2FA?
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Protects your sensitive financial data even if your password is compromised.
                      Recommended for all accounts containing personal financial information.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Current Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your current password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button
                onClick={handleEnable2FA}
                disabled={!password || isEnabling}
                className="w-full"
              >
                <Smartphone className="h-4 w-4 mr-2" />
                {isEnabling ? 'Setting up...' : 'Enable Two-Factor Authentication'}
              </Button>
            </div>
          )}

          {twoFactorEnabled && (
            <div className="space-y-4 p-4 bg-green-50 dark:bg-green-950/50 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 text-green-600" />
                <div className="space-y-2 flex-1">
                  <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                    Two-factor authentication is active
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Your account is protected with an additional security layer. You&apos;ll be
                    asked for a code from your authenticator app when signing in.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="disable-password">Current Password</Label>
                <Input
                  id="disable-password"
                  type="password"
                  placeholder="Enter your current password to disable 2FA"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button
                variant="destructive"
                onClick={handleDisable2FA}
                disabled={!password || isDisabling}
                className="w-full"
              >
                {isDisabling ? 'Disabling...' : 'Disable Two-Factor Authentication'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Recovery Information */}
      {twoFactorEnabled && (
        <Card className="p-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Account Recovery
            </CardTitle>
            <CardDescription>
              Important information about accessing your account if you lose your authenticator
              device.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Security Notice */}
            <div className="bg-blue-50 dark:bg-blue-950/50 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 text-blue-600" />
                <div className="space-y-2">
                  <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                    Your Backup Codes
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Your backup codes were shown only once during setup for maximum security. They
                    cannot be viewed again through this interface.
                  </p>
                </div>
              </div>
            </div>

            {/* Recovery Options */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">If you lose access to your authenticator app:</h4>

              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">1.</span>
                  <span>Use one of your saved backup codes to sign in</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">2.</span>
                  <span>
                    Once signed in, you can disable 2FA and set it up again with a new device
                  </span>
                </div>
              </div>
            </div>

            {/* Emergency Recovery */}
            <div className="bg-amber-50 dark:bg-amber-950/50 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600" />
                <div className="space-y-2">
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                    Lost Both Authenticator & Backup Codes?
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Contact our support team with proof of identity. We can disable 2FA for your
                    account after verification for security purposes.
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <a
                      href="mailto:support@mail.crowland.us"
                      className="text-xs text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 flex items-center gap-1"
                    >
                      <Mail className="h-3 w-3" />
                      support@mail.crowland.us
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Best Practices */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Security Tip:</p>
              <p>
                Consider storing backup codes in multiple secure locations (password manager +
                printed copy) to prevent complete lockout.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TOTP Setup Wizard Modal */}
      {showSetupWizard && (
        <TotpSetupWizard
          open={showSetupWizard}
          onOpenChange={setShowSetupWizard}
          onComplete={() => {
            setShowSetupWizard(false)
            window.location.reload() // Refresh to update user session
          }}
        />
      )}
    </div>
  )
}
