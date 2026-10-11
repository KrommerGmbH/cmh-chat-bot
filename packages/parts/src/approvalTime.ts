/**
 * Hour:minute label of an approval's creation time, in the given locale.
 * Returns '' for a missing or unparseable date so the caller can render nothing.
 */
export function formatApprovalTime(createdAt: string | null | undefined, locale: string): string {
  if (!createdAt) return ''
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ''
  try {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  } catch {
    // An invalid locale tag throws a RangeError; fall back to the runtime default.
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }
}
