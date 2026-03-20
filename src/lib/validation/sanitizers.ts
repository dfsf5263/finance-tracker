// Prevent XSS and SQL injection
export function sanitizeText(text: string): string {
  return text
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/['";\\]/g, '') // Remove SQL/JS dangerous chars
    .replace(/\0/g, '') // Remove null bytes
    .trim()
}

// Validate amounts
export function isValidAmount(amount: string): boolean {
  const num = parseFloat(amount)
  return !isNaN(num) && isFinite(num)
}

export function reasonableAmount(amount: string): boolean {
  const num = parseFloat(amount)
  return Math.abs(num) <= 1000000 // Max 1 million
}
