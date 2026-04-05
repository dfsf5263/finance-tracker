import { NextResponse } from 'next/server'
import { withApiLogging } from '@/lib/middleware/with-api-logging'

export const GET = withApiLogging(async () => {
  return NextResponse.json(
    {
      emailEnabled: !!process.env.RESEND_API_KEY,
      signupsEnabled: process.env.DISABLE_SIGNUPS !== 'true',
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    }
  )
}, 'debug')
