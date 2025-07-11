import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <SignIn
      appearance={{
        elements: {
          rootBox: {
            width: '100%',
          },
          card: {
            width: '100%',
            boxShadow: 'none',
            border: '1px solid hsl(var(--border))',
          },
        },
      }}
    />
  )
}
