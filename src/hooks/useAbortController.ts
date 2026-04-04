import { useCallback, useRef, useEffect } from 'react'

/**
 * Hook that manages an AbortController for cancelling in-flight fetch requests.
 *
 * Call `getSignal()` at the start of each fetch — it aborts the previous
 * request (if any) and returns a fresh AbortSignal.  The controller is also
 * aborted on unmount so no response is processed after the component is gone.
 */
export function useAbortController() {
  const controllerRef = useRef<AbortController | null>(null)

  const getSignal = useCallback((): AbortSignal => {
    // Abort any in-flight request
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    return controller.signal
  }, [])

  // Abort on unmount
  useEffect(() => {
    return () => {
      controllerRef.current?.abort()
    }
  }, [])

  return { getSignal }
}
