/** Live location is available only during dispatch, never after completion.
 * @param {string | undefined} status
 * @returns {boolean}
 */
export function canTrackLive(status) {
  return status === "DISPATCHED";
}

export function isProcessingOrder(status) {
  return ["PENDING", "CONFIRMED", "DISPATCHED"].includes(status);
}

export function hasFinalOrderHistory(status) {
  return ["DELIVERED", "RETURNED", "CANCELLED"].includes(status);
}
