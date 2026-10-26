/** Live location is available only during dispatch, never after completion.
 * @param {string | undefined} status
 * @returns {boolean}
 */
export function canTrackLive(status) {
  return status === "DISPATCHED";
}
