'use client'

import { CSVUploadPage } from '@/components/csv-upload-page'

export default function TransactionUploadPage() {
  const handleUploadComplete = () => {
    // Placeholder for upload completion handling
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="px-4 lg:px-6">
          <CSVUploadPage onUploadComplete={handleUploadComplete} />
        </div>
      </div>
    </div>
  )
}
