import { fetch as expoFetch } from "expo/fetch";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

export async function sendAssistantMessage(language, messages) {
  if (!baseUrl) throw new Error("The mobile API address is missing.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await expoFetch(`${baseUrl}/api/mobile/assistant/chat`, {
      method: "POST",
      credentials: "omit",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
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
  } finally {
    clearTimeout(timeout);
  }
}
