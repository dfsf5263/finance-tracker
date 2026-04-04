import type { Metadata } from 'next'
import { ExportPage } from '@/components/export-page'

export const metadata: Metadata = {
  title: 'Export Transactions',
}

export default function ExportPageRoute() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <ExportPage />
        </div>
      </div>
    </div>
  )
}
