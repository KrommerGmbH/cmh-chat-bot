/** Helpers shared by the approval parts for reading the response of `client.decideApproval`. */

/**
 * The server can answer HTTP 200 with `ok: false` / `success: false`. That is a failed decision:
 * throw so the caller's catch block shows the message and the card is not marked decided.
 */
export function assertDecideOk(result: any, fallbackMessage: string): void {
  if (result && (result.ok === false || result.success === false)) {
    const message = typeof result.message === 'string' && result.message ? result.message : fallbackMessage
    throw new Error(message)
  }
}

/** Returns a warning text when the approval was saved but follow-up tasks were not (all) created. */
export function readDispatchWarning(
  result: any,
  t: (key: any, params?: Record<string, any>) => string,
): string {
  const dispatch = result?.dispatch
  const skipped: unknown[] = Array.isArray(dispatch?.skipped) ? dispatch.skipped : []
  if (dispatch?.error || skipped.length > 0) {
    return t('approvalDispatchIncomplete', {
      created: dispatch.created ?? 0,
      skipped: skipped.join(', ') || '-',
      error: dispatch.error || '-',
    })
  }
  return ''
}
