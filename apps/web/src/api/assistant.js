export async function sendAssistantMessage(language, messages, signal) {
  const response = await fetch("/api/assistant/chat", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language, messages: messages.slice(-20) }),
    signal,
  });

  let result = null;
  try {
    result = await response.json();
  } catch {
    // Use the status-based message below when the server sends no JSON body.
  }

  if (!response.ok) {
    throw new Error(
      result?.detail ||
        result?.message ||
        (response.status === 503
          ? "The AI assistant is unavailable or busy. Please try again shortly."
          : "Could not get a reply. Please try again."),
    );
  }

  if (typeof result?.reply !== "string" || !result.reply.trim()) {
    throw new Error("The assistant returned an empty reply. Please try again.");
  }
  return result.reply;
}
