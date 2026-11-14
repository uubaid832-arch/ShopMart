export function warehouseAddressError(failure) {
  if (failure?.status === 403) {
    return "HTTP 403: The server denied warehouse settings access. Deploy the backend security update and confirm this is an enabled ADMIN account.";
  }
  if (failure?.status === 404) {
    return "HTTP 404: The warehouse settings endpoint is not on the deployed backend yet. Deploy the latest backend.";
  }
  if (failure?.status >= 500) {
    return `HTTP ${failure.status}: The backend could not read the warehouse setting. Check that Neon migration 021 was applied and review the Render logs.`;
  }
  return failure?.message || "Could not load or save the warehouse return address.";
}
