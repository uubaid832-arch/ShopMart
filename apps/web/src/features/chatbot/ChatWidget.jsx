import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import Modal from "../../components/Modal";
import { useLanguage } from "../language/useLanguage";

const suggestions = [
  ["Show available products", "دستیاب مصنوعات دکھائیں"],
  ["How do I track my order?", "اپنے آرڈر کی صورتحال کیسے دیکھوں؟"],
  ["How do returns work?", "مصنوع واپس کیسے کروں؟"],
  [
    "What payment methods are available?",
    "ادائیگی کے کون سے طریقے دستیاب ہیں؟",
  ],
];

const formatPrice = (value) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(Number(value));

const topics = [
  {
    english: /\b(track|tracking|where.*order|order status)\b/,
    urdu: /ٹریک|آرڈر.*(کہاں|حیثیت|صورتحال)|آرڈر کی پیش رفت/,
    reply: [
      "Sign in, open the account menu, then choose Track Order. Select your purchase to see its recorded status and updates. Live rider location is not connected yet.",
      "سائن اِن کریں، اکاؤنٹ مینو کھولیں اور آرڈر کی صورتحال منتخب کریں۔ اپنی خریداری منتخب کرکے درج شدہ صورتحال اور پیش رفت دیکھیں۔ رائیڈر کی براہِ راست لوکیشن ابھی دستیاب نہیں۔",
    ],
  },
  {
    english: /\b(return|returns|refund|refunds|damaged|defective)\b/,
    urdu: /واپس|واپسی|ریفنڈ|خراب|نقصان/,
    reply: [
      "Sign in and open Returns & Refunds from the account menu. Select an eligible purchased item, explain the reason and submit your request. Follow its status in the same section. Submitting a request does not automatically approve a return or issue a refund.",
      "سائن اِن کرکے اکاؤنٹ مینو سے واپسی اور رقم کی واپسی کھولیں۔ اہل خریدی گئی مصنوع منتخب کریں، وجہ لکھیں اور درخواست جمع کریں۔ اسی حصے میں درخواست کی حیثیت دیکھ سکتے ہیں۔ درخواست جمع ہونے سے واپسی خودکار طور پر منظور نہیں ہوتی اور رقم بھی خودکار طور پر واپس نہیں ہوتی۔",
    ],
  },
  {
    english: /\b(payment|payments|pay|cod|cash|card|jazzcash|easypaisa)\b/,
    urdu: /ادائیگی|نقد|کیش|کارڈ|جاز|ایزی پیسہ/,
    reply: [
      "The current checkout supports Cash on Delivery (COD). Pay the order amount when you receive the delivery. Online card and wallet payments are not connected.",
      "فی الحال چیک آؤٹ میں وصولی پر نقد ادائیگی (COD) دستیاب ہے۔ آرڈر وصول کرتے وقت رقم ادا کریں۔ آن لائن کارڈ اور والٹ ادائیگیاں ابھی دستیاب نہیں۔",
    ],
  },
  {
    english: /\b(cancel|cancellation|address|wrong details|change.*order)\b/,
    urdu: /منسوخ|پتہ|پتے|تفصیلات.*(غلط|تبدیل)|غلط.*تفصیلات/,
    reply: [
      "Contact the store administrator for cancellation or delivery-detail corrections. Changes depend on the order's current stage. This assistant cannot change or cancel orders.",
      "آرڈر منسوخ کرنے یا ڈیلیوری کی تفصیلات درست کروانے کے لیے اسٹور ایڈمن سے رابطہ کریں۔ تبدیلی آرڈر کی موجودہ حیثیت پر منحصر ہے۔ یہ معاون آرڈر تبدیل یا منسوخ نہیں کر سکتا۔",
    ],
  },
  {
    english: /\b(delivery|shipping|shipment|rider)\b/,
    urdu: /ڈیلیوری|ڈلیوری|رائیڈر|شپنگ/,
    reply: [
      "After your order is confirmed, an administrator assigns a rider and dispatches it. The assigned rider records delivery completion. Use Track Order for recorded updates. I cannot provide a guaranteed delivery time or shipping fee.",
      "آرڈر کی تصدیق کے بعد ایڈمن رائیڈر مقرر کرکے آرڈر روانہ کرتا ہے۔ مقررہ رائیڈر ڈیلیوری مکمل ہونے کی تصدیق کرتا ہے۔ تازہ صورتحال کے لیے آرڈر کی صورتحال والا حصہ دیکھیں۔ میں یقینی ڈیلیوری وقت یا چارجز نہیں بتا سکتا۔",
    ],
  },
  {
    english: /\b(login|log in|sign in|register|account|password)\b/,
    urdu: /لاگ|سائن|رجسٹر|اکاؤنٹ|پاس ورڈ/,
    reply: [
      "Open the account menu and choose Login / Register. After signing in, you can access your profile, orders, tracking and returns. Never share your password in this chat.",
      "اکاؤنٹ مینو کھولیں اور لاگ اِن / رجسٹر منتخب کریں۔ سائن اِن کے بعد پروفائل، آرڈرز، آرڈر کی صورتحال اور واپسی کی درخواستیں دیکھ سکتے ہیں۔ اس چیٹ میں اپنا پاس ورڈ شیئر نہ کریں۔",
    ],
  },
  {
    english: /\b(cart|checkout|buy|purchase)\b/,
    urdu: /ٹوکری|چیک آؤٹ|خرید/,
    reply: [
      "Choose a product and select Add to cart. Open the cart to review quantities, then choose Proceed to checkout. Sign in and enter your delivery details to place a COD order. Stock and prices are checked by the server.",
      "مصنوع منتخب کرکے ٹوکری میں شامل کریں۔ ٹوکری کھول کر مقدار چیک کریں، پھر چیک آؤٹ کی طرف جائیں۔ سائن اِن کرکے ڈیلیوری کی تفصیلات درج کریں اور COD آرڈر جمع کریں۔ اسٹاک اور قیمتوں کی جانچ سرور کرتا ہے۔",
    ],
  },
  {
    english: /\b(wishlist|favourite|favorites|favourites)\b/,
    urdu: /پسندیدہ|دل کا نشان/,
    reply: [
      "Select the heart on a product to save it. Open the wishlist icon in the navbar to review saved products or add them to your cart.",
      "مصنوع محفوظ کرنے کے لیے دل کے نشان پر کلک کریں۔ نیویگیشن بار سے پسندیدہ مصنوعات کھول کر محفوظ مصنوعات دیکھیں یا ٹوکری میں شامل کریں۔",
    ],
  },
  {
    english: /\b(review|reviews|rating|ratings)\b/,
    urdu: /تبصر|ریویو|ریٹنگ|درجہ بندی/,
    reply: [
      "Open a product's View details popup to read its ratings and reviews. Eligible signed-in customers can submit a review after a verified delivered purchase.",
      "درجہ بندی اور تبصرے پڑھنے کے لیے مصنوع کی تفصیلات کھولیں۔ تصدیق شدہ خریداری کی ڈیلیوری کے بعد اہل سائن اِن صارفین تبصرہ جمع کر سکتے ہیں۔",
    ],
  },
  {
    english: /\b(hello|hi|hey|salam|assalam)\b/,
    urdu: /سلام|ہیلو/,
    reply: [
      "Hello! Ask me about products, prices, stock, checkout, tracking or returns.",
      "السلام علیکم! مصنوعات، قیمتوں، اسٹاک، چیک آؤٹ، آرڈر کی صورتحال یا واپسی کے بارے میں پوچھیں۔",
    ],
  },
  {
    english: /\b(thanks|thank you)\b/,
    urdu: /شکریہ|مہربانی/,
    reply: [
      "You're welcome! Let me know if you need more shopping help.",
      "خوش رہیں! خریداری کے بارے میں مزید مدد چاہیے تو بتائیں۔",
    ],
  },
];

const ignoredWords = new Set([
  "a",
  "an",
  "the",
  "i",
  "want",
  "need",
  "show",
  "me",
  "please",
  "do",
  "you",
  "have",
  "is",
  "are",
  "there",
  "any",
  "what",
  "which",
  "product",
  "products",
  "price",
  "prices",
  "stock",
  "available",
  "availability",
  "in",
  "of",
  "for",
  "and",
  "about",
  "tell",
  "catalog",
  "مجھے",
  "میں",
  "آپ",
  "کی",
  "کا",
  "کے",
  "کو",
  "سے",
  "یہ",
  "وہ",
  "ہیں",
  "ہے",
  "کیا",
  "کون",
  "سی",
  "سا",
  "بھی",
  "اور",
  "براہ",
  "کرم",
  "بتائیں",
  "دکھائیں",
  "چاہیے",
  "مصنوع",
  "مصنوعات",
  "چیزیں",
  "دستیاب",
  "قیمت",
  "قیمتیں",
  "اسٹاک",
]);

const aliases = {
  ہیڈفون: ["headphone", "headphones"],
  ہیڈفونز: ["headphone", "headphones"],
  بیگ: ["bag", "backpack"],
  لیمپ: ["lamp"],
  کافی: ["coffee"],
  پرفیوم: ["perfume"],
  مائیکروویو: ["microwave"],
  الیکٹرانکس: ["electronics"],
  فیشن: ["fashion"],
};

function getStoreReply(message, products, language) {
  const urdu = language === "ur";
  const text = (en, ur) => (urdu ? ur : en);
  const query = message.toLowerCase().trim();

  const topic = topics.find(
    (entry) => entry.english.test(query) || entry.urdu.test(query),
  );

  if (topic) return text(...topic.reply);

  const catalog = products.filter((product) => product.active !== false);

  const words = query.match(/[\p{L}\p{N}]+/gu) ?? [];
  const keywords = words.filter((word) => !ignoredWords.has(word));

  const matches = catalog
    .map((product, index) => {
      const name = product.name.toLowerCase();
      const category = String(product.category ?? "").toLowerCase();

      const score = keywords.reduce((total, word) => {
        const terms = [word, ...(aliases[word] ?? [])];

        const matchScore = Math.max(
          ...terms.map((term) =>
            name.includes(term) ? 3 : category.includes(term) ? 1 : 0,
          ),
        );

        return total + matchScore;
      }, 0);

      return { product, score, index };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.product);

  const catalogQuestion =
    /\b(products?|catalog|available|stock|prices?)\b/.test(query) ||
    /مصنوع|چیزیں|دستیاب|قیمت|اسٹاک/.test(query);

  const generalCatalogQuestion = keywords.length === 0 && catalogQuestion;

  const selected = matches.length
    ? matches
    : generalCatalogQuestion
      ? catalog.filter((product) => product.stock > 0)
      : [];

  if (selected.length) {
    const lines = selected
      .slice(0, 4)
      .map(
        (product) =>
          `• ${product.name} — ${formatPrice(product.price)} — ${
            product.stock > 0
              ? text(`${product.stock} available`, `${product.stock} دستیاب`)
              : text("Out of stock", "اسٹاک ختم")
          }`,
      );

    return [
      text("Here are matching products:", "یہ متعلقہ مصنوعات ہیں:"),
      "",
      ...lines,
      "",
      text(
        "Use the storefront search and View details to see photos and more information. Prices and stock may change.",
        "تصاویر اور مزید معلومات کے لیے اسٹور کی تلاش اور تفصیلات دیکھیں استعمال کریں۔ قیمتیں اور اسٹاک تبدیل ہو سکتے ہیں۔",
      ),
    ].join("\n");
  }

  if (catalogQuestion) {
    return text(
      "No matching products are available in the current catalog. Try a product name or category in the storefront search.",
      "موجودہ فہرست میں متعلقہ مصنوعات نہیں ملیں۔ اسٹور کی تلاش میں مصنوع کا نام یا قسم لکھ کر کوشش کریں۔",
    );
  }

  return text(
    "I can help with catalog products, prices, stock, COD checkout, tracking, reviews and returns. Try a product name or choose a suggested question. I cannot access private order details or make account changes.",
    "میں مصنوعات، قیمتوں، اسٹاک، COD چیک آؤٹ، آرڈر کی صورتحال، تبصروں اور واپسی کے بارے میں مدد کر سکتا ہوں۔ مصنوع کا نام لکھیں یا تجویز کردہ سوال منتخب کریں۔ میں نجی آرڈر کی تفصیلات نہیں دیکھ سکتا اور اکاؤنٹ میں تبدیلی نہیں کر سکتا۔",
  );
}

export default function ChatWidget({ products = [], onSendMessage }) {
  const { language, direction } = useLanguage();
  const text = (en, ur) => (language === "ur" ? ur : en);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen, messages, sending]);

  async function sendMessage(value) {
    const content = value.trim();
    if (!content || sendingRef.current) return;

    sendingRef.current = true;
    setSending(true);
    setError(false);

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setDraft("");

    try {
      const reply = onSendMessage
        ? await onSendMessage({
            language,
            messages: nextMessages.map(({ role, content }) => ({
              role,
              content,
            })),
          })
        : getStoreReply(content, products, language);

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
      setDraft(content);
      setError(true);
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
        aria-label={text("Open ShopMart assistant", "شاپ مارٹ معاون کھولیں")}
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-30 grid size-14 place-items-center rounded-full border-0 bg-violet-600 text-white shadow-lg hover:bg-violet-700"
      >
        <MessageCircle size={25} aria-hidden="true" />
      </button>

      {isOpen && (
        <Modal
          onClose={() => setIsOpen(false)}
          labelledBy="chat-title"
          size="md"
          fixedSections
        >
          <header
            dir={direction}
            className="flex shrink-0 items-center justify-between gap-3 border-0 border-b border-solid border-slate-200 p-5"
          >
            <div>
              <h2 id="chat-title" className="m-0 text-xl font-bold">
                {text("ShopMart Assistant", "شاپ مارٹ معاون")}
              </h2>

              <p className="mb-0 mt-1 text-xs text-slate-500">
                {onSendMessage
                  ? text("Shopping assistance", "خریداری میں مدد")
                  : text(
                      "Automated catalog and shopping help",
                      "مصنوعات اور خریداری کے لیے خودکار مدد",
                    )}
              </p>
            </div>

            <button
              type="button"
              aria-label={text("Close chat", "چیٹ بند کریں")}
              onClick={() => setIsOpen(false)}
              className="grid size-10 place-items-center rounded-xl border-0 bg-slate-100 text-slate-600 hover:bg-violet-100"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </header>

          <div
            dir={direction}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5"
          >
            {messages.length === 0 && (
              <div className="mb-5">
                <p className="mt-0 text-sm leading-6 text-slate-600">
                  {text(
                    "Welcome! Ask about a product or select a question. Please do not share passwords or payment details.",
                    "خوش آمدید! کسی مصنوع کے بارے میں پوچھیں یا سوال منتخب کریں۔ اپنا پاس ورڈ یا ادائیگی کی نجی تفصیلات شیئر نہ کریں۔",
                  )}
                </p>

                <div className="flex flex-wrap gap-2">
                  {suggestions.map(([en, ur]) => {
                    const question = text(en, ur);

                    return (
                      <button
                        key={en}
                        type="button"
                        disabled={sending}
                        onClick={() => sendMessage(question)}
                        className="rounded-xl border border-solid border-violet-200 bg-violet-50 px-3 py-2 text-start text-xs font-semibold text-violet-700 disabled:opacity-50"
                      >
                        {question}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div
              role="log"
              aria-live="polite"
              aria-label={text("Chat messages", "چیٹ کے پیغامات")}
              aria-relevant="additions"
              className="grid gap-3"
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "justify-self-end bg-violet-600 text-white"
                      : "justify-self-start bg-slate-100 text-slate-800"
                  }`}
                >
                  <span className="sr-only">
                    {message.role === "user"
                      ? text("You: ", "آپ: ")
                      : text("Assistant: ", "معاون: ")}
                  </span>
                  <span dir="auto" className="block">
                    {message.content}
                  </span>
                </div>
              ))}
            </div>

            {sending && (
              <p role="status" className="text-sm text-slate-500">
                {text("Preparing a reply…", "جواب تیار ہو رہا ہے…")}
              </p>
            )}

            {error && (
              <p role="alert" className="text-sm text-rose-700">
                {text(
                  "Could not get a reply. Please try again.",
                  "جواب حاصل نہیں ہو سکا۔ دوبارہ کوشش کریں۔",
                )}
              </p>
            )}

            <div ref={bottomRef} />
          </div>

          <form
            dir={direction}
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage(draft);
            }}
            className="flex shrink-0 items-end gap-2 border-0 border-t border-solid border-slate-200 p-4"
          >
            <label htmlFor="chat-message" className="sr-only">
              {text("Your message", "آپ کا پیغام")}
            </label>

            <textarea
              ref={inputRef}
              id="chat-message"
              dir="auto"
              rows={2}
              maxLength={1000}
              value={draft}
              readOnly={sending}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={text(
                "Ask about products or your shopping options…",
                "مصنوعات یا خریداری کے بارے میں پوچھیں…",
              )}
              className="box-border min-w-0 flex-1 resize-none rounded-xl border border-solid border-slate-200 bg-slate-50 p-3 font-[inherit] text-slate-800"
            />

            <button
              type="submit"
              aria-label={text("Send message", "پیغام بھیجیں")}
              disabled={sending || !draft.trim()}
              className="grid size-11 shrink-0 place-items-center rounded-xl border-0 bg-violet-600 text-white enabled:hover:bg-violet-700 disabled:opacity-50"
            >
              <Send size={19} aria-hidden="true" />
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
