const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

export async function sendAssistantMessage(messages, language = "en") {
  if (!baseUrl) throw new Error("The ShopMart API address is not configured.");
  const response = await fetch(`${baseUrl}/api/mobile/assistant/chat`, {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language, messages }),
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
          ? "The assistant is unavailable or busy. Please try again shortly."
          : "Could not get a reply. Please try again."),
    );
  }
  if (typeof result?.reply !== "string" || !result.reply.trim()) {
    throw new Error("The assistant returned an empty reply. Please try again.");
  }
  return result.reply;
}
