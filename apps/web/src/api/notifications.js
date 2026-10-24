export async function getNotifications(token, page = 0, signal) {
  const response = await fetch(`/api/notifications?page=${page}&size=20`, {
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Please sign in again."
        : "Could not load notifications. Please try again.",
    );
  }

  return response.json();
}

async function markRead(token, path) {
  const csrfResponse = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!csrfResponse.ok) {
    throw new Error("Could not prepare the secure request.");
  }

  const csrf = await csrfResponse.json();

  const response = await fetch(`/api/notifications/${path}`, {
    method: "PATCH",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      [csrf.headerName]: csrf.token,
    },
  });

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Please sign in again."
        : "Could not update notifications. Please try again.",
    );
  }
}

export const markNotificationRead = (token, id) =>
  markRead(token, `${id}/read`);

export const markAllNotificationsRead = (token) => markRead(token, "read-all");
