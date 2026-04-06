/** Query parameter name used across auth pages to thread the post-auth destination. */
export const REDIRECT_PARAM = 'redirect'

/** sessionStorage key used to bridge the redirect through the 2FA hard-navigation. */
export const REDIRECT_STORAGE_KEY = 'auth_redirect'

/**
 * Validate and sanitise a redirect URL to prevent open-redirect attacks.
 *
 * Accepts only relative paths that start with `/` (no protocol-relative `//`).
 * Returns the sanitised `pathname + search + hash`, or `null` when the input
 * is missing, empty, or fails validation.
 */
export function safeRedirectUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null

  // Only accept paths that start with a single slash
  if (!url.startsWith('/') || url.startsWith('//')) return null

  try {
    // Parse against a throwaway base — only relative paths will keep that origin
    const parsed = new URL(url, 'http://localhost')
    if (parsed.origin !== 'http://localhost') return null

    // Re-check that the reconstructed path doesn't start with //
    const result = `${parsed.pathname}${parsed.search}${parsed.hash}`
    if (result.startsWith('//')) return null

    return result
  } catch {
    return null
  }
}
