/** One row of the before/after table of an approval (`form.changes`). */
export interface ApprovalChange {
  key: string
  label?: string
  before?: unknown
  after?: unknown
}

/** Placeholder shown when a value is null or undefined. */
export const CHANGE_EMPTY_PLACEHOLDER = '—'

export function formatChangeValue(value: unknown): string {
  if (value === undefined || value === null) return CHANGE_EMPTY_PLACEHOLDER
  // Objects and arrays would print as [object Object]; show them as compact JSON.
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

/** Returns `form.changes` when it is a non-empty array, otherwise an empty array. */
export function readChanges(form: Record<string, any> | null | undefined): ApprovalChange[] {
  const changes = form?.changes
  return Array.isArray(changes) && changes.length > 0 ? changes : []
}
