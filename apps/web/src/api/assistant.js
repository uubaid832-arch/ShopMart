export async function sendAssistantMessage(language, messages) {
  const csrfResponse = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!csrfResponse.ok) {
    throw new Error("Could not prepare the secure assistant request.");
  }

  const csrf = await csrfResponse.json();
  const response = await fetch("/api/assistant/chat", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      [csrf.headerName]: csrf.token,
    },
    body: JSON.stringify({ language, messages: messages.slice(-12) }),
  });

  if (!response.ok) {
    throw new Error(
      response.status === 429 || response.status === 503
        ? "The assistant is busy right now. Please wait a moment and try again."
        : "Could not get an assistant reply. Please try again.",
    );
  }

  const result = await response.json();
  if (typeof result.reply !== "string" || !result.reply.trim()) {
    throw new Error("The assistant returned an empty reply.");
  }
  return result.reply.trim();
}
