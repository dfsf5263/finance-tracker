import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <SignUp
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
