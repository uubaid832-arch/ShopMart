export async function saveAdminCategory(accessToken, id, name) {
  const csrfResponse = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!csrfResponse.ok) {
    throw new Error("Could not prepare the secure request.");
  }

  const csrf = await csrfResponse.json();

  const response = await fetch(`/api/admin/categories${id ? `/${id}` : ""}`, {
    method: id ? "PUT" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      [csrf.headerName]: csrf.token,
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const messages = {
      400: "Enter a category name of up to 80 characters.",
      401: "Please sign in again.",
      403: "Access denied. Check your administrator sign-in.",
      404: "Category not found.",
      409: "A category with this name already exists.",
    };

    throw new Error(
      messages[response.status] ??
        "Could not confirm the save. Refresh the list before trying again.",
    );
  }

  return response.json();
}
