async function addressRequest(accessToken, method, id, values) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  if (method !== "GET") {
    const response = await fetch("/api/auth/csrf", {
      credentials: "same-origin",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Could not prepare the secure request.");
    }

    const csrf = await response.json();
    headers[csrf.headerName] = csrf.token;
  }

  if (values !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`/api/addresses${id ? `/${id}` : ""}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers,
    body: values === undefined ? undefined : JSON.stringify(values),
  });

  if (!response.ok) {
    const messages = {
      400: "Please check your address details.",
      401: "Please sign in again.",
      403: "The security check failed. Please try again.",
      404: "This address is no longer available.",
    };

    throw new Error(
      messages[response.status] ??
        "Could not complete the address request. Please try again.",
    );
  }

  return response.status === 204 ? null : response.json();
}

export const getAddresses = (token) => addressRequest(token, "GET");

export const addAddress = (token, values) =>
  addressRequest(token, "POST", null, values);

export const editAddress = (token, id, values) =>
  addressRequest(token, "PUT", id, values);

export const deleteAddress = (token, id) => addressRequest(token, "DELETE", id);
