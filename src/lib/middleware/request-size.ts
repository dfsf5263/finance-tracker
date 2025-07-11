import { NextRequest, NextResponse } from 'next/server'

export const requestSizeLimit = (maxSizeBytes: number) => {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    const contentLength = req.headers.get('content-length')

    if (contentLength && parseInt(contentLength) > maxSizeBytes) {
      return NextResponse.json(
        {
          error: `Request too large. Maximum size: ${maxSizeBytes / 1024 / 1024}MB`,
          maxSizeBytes,
          providedSizeBytes: parseInt(contentLength),
        },
        { status: 413 }
      )
    }

    return null
  }
}

// Pre-configured limits
export const bulkUploadSizeLimit = requestSizeLimit(10 * 1024 * 1024) // 10MB
export const standardApiSizeLimit = requestSizeLimit(1 * 1024 * 1024) // 1MB
