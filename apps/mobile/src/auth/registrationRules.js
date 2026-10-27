/** @param {{challengeId?: string, expiresAt?: string, resendAt?: string} | null | undefined} value */
export function isRegistrationChallenge(value) {
  return Boolean(value?.challengeId && Number.isFinite(Date.parse(value.expiresAt || '')) && Number.isFinite(Date.parse(value.resendAt || '')));
}
/** @param {string | undefined} role
 * @param {string | undefined} userId
 * @param {string | null} previewId */
export function canPreviewStore(role, userId, previewId) {
  return role === 'ADMIN' && Boolean(userId) && userId === previewId;
}
