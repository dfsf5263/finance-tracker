import { Loader2 } from 'lucide-react'

interface LoadingOverlayProps {
  show: boolean
  message?: string
}

export function LoadingOverlay({ show, message = 'Loading...' }: LoadingOverlayProps) {
  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl p-8 shadow-lg flex flex-col items-center space-y-4 max-w-sm mx-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg font-medium text-foreground text-center">{message}</p>
      </div>
    </div>
  )
}
