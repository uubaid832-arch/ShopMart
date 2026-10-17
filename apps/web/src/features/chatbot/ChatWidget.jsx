import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import Modal from "../../components/Modal";

export default function ChatWidget({ onSendMessage }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen, messages, sending]);

  async function handleSubmit(event) {
    event.preventDefault();

    const text = draft.trim();
    if (!text || !onSendMessage || sendingRef.current) return;

    sendingRef.current = true;
    setSending(true);
    setError("");

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");

    try {
      // The backend adapter should resolve to a plain-text reply.
      const reply = await onSendMessage({
        messages: nextMessages.map(({ role, content }) => ({
          role,
          content,
        })),
      });

      if (typeof reply !== "string" || !reply.trim()) {
        throw new Error("Empty response");
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: reply.trim(),
        },
      ]);
    } catch {
      setMessages((current) =>
        current.filter((message) => message.id !== userMessage.id),
      );
      setDraft(text);
      setError("Could not get a reply. Your message is ready to try again.");
    } finally {
      sendingRef.current = false;
      setSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Open ShopMart assistant"
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-30 grid size-14 place-items-center rounded-full border-0 bg-violet-600 text-white shadow-lg hover:bg-violet-700"
      >
        <MessageCircle size={25} aria-hidden="true" />
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        labelledBy="chat-title"
        size="md"
        fixedSections
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-0 border-b border-solid border-slate-200 p-5">
          <div>
            <h2 id="chat-title" className="m-0 text-xl font-bold">
              ShopMart Assistant
            </h2>
            <p className="mb-0 mt-1 text-xs text-slate-500">
              Ask about products and shopping.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close chat"
            onClick={() => setIsOpen(false)}
            className="grid size-10 place-items-center rounded-xl border-0 bg-slate-100 text-slate-600 hover:bg-violet-100"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              {onSendMessage
                ? "What would you like help with?"
                : "Chat is currently unavailable."}
            </p>
          )}

          <div
            role="log"
            aria-label="Chat messages"
            aria-relevant="additions"
            className="grid gap-3"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm ${
                  message.role === "user"
                    ? "justify-self-end bg-violet-600 text-white"
                    : "justify-self-start bg-slate-100 text-slate-800"
                }`}
              >
                <span className="sr-only">
                  {message.role === "user" ? "You: " : "Assistant: "}
                </span>
                {message.content}
              </div>
            ))}
          </div>

          {sending && (
            <p role="status" className="text-sm text-slate-500">
              Waiting for a reply…
            </p>
          )}

          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}

          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex shrink-0 items-end gap-2 border-0 border-t border-solid border-slate-200 p-4"
        >
          <label htmlFor="chat-message" className="sr-only">
            Your message
          </label>

          <textarea
            ref={inputRef}
            id="chat-message"
            rows={2}
            value={draft}
            disabled={!onSendMessage}
            readOnly={sending}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              onSendMessage ? "Type your message..." : "Chat unavailable"
            }
            className="box-border min-w-0 flex-1 resize-none rounded-xl border border-solid border-slate-200 bg-slate-50 p-3 font-[inherit] text-slate-800 disabled:opacity-50"
          />

          <button
            type="submit"
            aria-label="Send message"
            disabled={!onSendMessage || sending || !draft.trim()}
            className="grid size-11 shrink-0 place-items-center rounded-xl border-0 bg-violet-600 text-white enabled:hover:bg-violet-700 disabled:opacity-50"
          >
            <Send size={19} aria-hidden="true" />
          </button>
        </form>
      </Modal>
    </>
  );
}
