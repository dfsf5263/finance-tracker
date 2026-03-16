import { getAuth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const dynamic = 'force-dynamic'

let handlers: ReturnType<typeof toNextJsHandler> | null = null

function getHandlers() {
  if (!handlers) {
    handlers = toNextJsHandler(getAuth())
  }
  return handlers
}

export async function GET(request: Request) {
  return getHandlers().GET(request)
}

export async function POST(request: Request) {
  return getHandlers().POST(request)
}
