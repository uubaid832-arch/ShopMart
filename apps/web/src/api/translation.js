export async function translateBatchToUrdu(texts) {
  const values = [...new Set(texts.map((text) => String(text ?? "").trim()).filter(Boolean))];
  if (!values.length) return [];
  if (values.length > 50 || values.reduce((total, value) => total + value.length, 0) > 4000) {
    throw new Error("Translate a smaller batch of text at a time.");
  }

  const csrfResponse = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!csrfResponse.ok) throw new Error("Could not prepare the secure language request.");
  const csrf = await csrfResponse.json();

  const response = await fetch("/api/translate", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      [csrf.headerName]: csrf.token,
    },
    body: JSON.stringify({ texts: values }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data.detail || data.message ||
        (response.status === 503
          ? "Urdu language service is not configured yet."
          : "Could not switch the app language. Please try again."),
    );
  }
  if (!Array.isArray(data.translatedTexts) || data.translatedTexts.length !== values.length) {
    throw new Error("The language service returned an unexpected response.");
  }
  return data.translatedTexts;
}
