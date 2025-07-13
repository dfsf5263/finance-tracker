'use client'

import { DeDupePage } from '@/components/dedupe-page'

export default function DedupePageRoute() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <DeDupePage />
        </div>
      </div>
    </div>
  )
}
