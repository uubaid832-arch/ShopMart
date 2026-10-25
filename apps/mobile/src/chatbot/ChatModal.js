import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const help = [
  [
    /\b(track|tracking|rider|delivery|shipping)\b/i,
    "Open Orders, select Track order, and view the delivery timeline. The rider map appears when the assigned rider shares a fresh location for a dispatched order. Google Maps directions are also available there.",
  ],
  [
    /\b(return|returns|refund|refunds|damaged|defective)\b/i,
    "Open Orders → Returns & refunds. Select an eligible purchased item, enter a reason, and submit. Follow progress under Your requests. A request does not automatically approve a return or issue a refund.",
  ],
  [
    /\b(password|forgot|reset)\b/i,
    "For a forgotten password, open Sign in → Forgot password and verify the code sent to your email. To change a known password, open Account → Change password.",
  ],
  [
    /\b(fingerprint|biometric|unlock)\b/i,
    "Open Account → Fingerprint & security to enable biometric unlock. This protects an existing session on your phone; it does not replace password sign-in or required OTP verification.",
  ],
  [
    /\b(payment|pay|cod|cash|card|jazzcash|easypaisa)\b/i,
    "Mobile checkout currently supports Cash on Delivery. Pay when your order arrives.",
  ],
  [
    /\b(address|addresses)\b/i,
    "At checkout, choose a saved address or tap Enter address manually. A manually entered address is used for that order and is not added to your address book.",
  ],
  [
    /\b(cart|checkout|buy|purchase)\b/i,
    "Add products to your cart using Add to cart. Review quantities, proceed to checkout, enter delivery details, and place your Cash on Delivery order.",
  ],
  [
    /\b(wishlist|favorite|favourite|saved)\b/i,
    "Tap a product's heart to save it, then open Wishlist. Saved products stay on this phone and are separated by account.",
  ],
  [
    /\b(review|reviews|rating|ratings)\b/i,
    "Open a product's details and scroll to Ratings & reviews. Eligible customers can submit a review after a verified delivered purchase.",
  ],
  [
    /\b(profile|phone|name|account|login|register|sign in)\b/i,
    "Open Account to sign in or create an account. Once signed in, choose Edit profile to update your name and phone number.",
  ],
  [
    /\b(cancel|cancellation)\b/i,
    "Contact the store administrator about cancelling an order. Availability depends on its current stage. This assistant cannot cancel orders.",
  ],
];

const suggestions = [
  "Show available products",
  "Track my order",
  "Returns and refunds",
  "Forgot password",
];

const ignored = new Set([
  "show",
  "me",
  "a",
  "an",
  "the",
  "some",
  "please",
  "find",
  "want",
  "need",
  "products",
  "product",
  "available",
  "stock",
  "price",
  "prices",
  "how",
  "much",
  "is",
  "are",
  "do",
  "you",
  "have",
  "in",
  "of",
  "for",
  "and",
  "what",
  "which",
  "tell",
  "about",
]);

export default function ChatModal({ products = [], onViewProduct, onClose }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      id: 0,
      text: "Hi! I can help you find products and explain ShopMart features. What would you like to know?",
    },
  ]);
  const nextId = useRef(1);
  const scroll = useRef(null);

  function send(value = input) {
    const question = value.trim().slice(0, 500);
    if (!question) return;

    setInput("");

    const words = question
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((word) => word && !ignored.has(word));

    const matches = words.length
      ? products.filter((product) => {
          const searchable =
            `${product.name} ${product.category}`.toLowerCase();
          return words.every((word) => searchable.includes(word));
        })
      : [];

    let text;
    let found = [];

    if (matches.length) {
      found = matches.slice(0, 6);
      text = "Here are matching products from the loaded catalog:";
    } else if (
      /\b(show available products|catalog|all products)\b/i.test(question)
    ) {
      found = products.filter((product) => product.stock > 0).slice(0, 6);
      text = found.length
        ? "Here are some available products:"
        : "No available products are loaded. Close this chat and refresh the catalog.";
    } else {
      const topic = help.find(([pattern]) => pattern.test(question));
      text = topic
        ? topic[1]
        : /\b(hello|hi|hey|salam)\b/i.test(question)
          ? "Hello! Ask about a product, tracking, checkout, returns, or your account."
          : "Try a product name or category, or ask about tracking, returns, payments, or your account. I cannot modify orders or provide guaranteed delivery times.";
    }

    const userId = nextId.current++;
    const replyId = nextId.current++;

    setMessages((current) =>
      [
        ...current,
        { id: userId, text: question, mine: true },
        { id: replyId, text, products: found },
      ].slice(-60),
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.header}>
            <View style={styles.grow}>
              <Text style={styles.title}>ShopMart assistant</Text>
              <Text style={styles.caption}>Product finder & shopping help</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.close}
            >
              <Text style={styles.link}>Close</Text>
            </Pressable>
          </View>

          <ScrollView
            ref={scroll}
            style={styles.grow}
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              scroll.current?.scrollToEnd({ animated: true })
            }
          >
            <Text style={styles.notice}>
              Automated help using catalog matching and prepared answers. Do not
              enter passwords or verification codes.
            </Text>

            {messages.map((message) => (
              <View
                key={message.id}
                style={[styles.bubble, message.mine && styles.myBubble]}
              >
                <Text style={[styles.message, message.mine && styles.white]}>
                  {message.text}
                </Text>

                {message.products?.map((product) => (
                  <Pressable
                    key={product.id}
                    accessibilityRole="button"
                    onPress={() => onViewProduct(product)}
                    style={styles.product}
                  >
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.price}>
                      PKR {Number(product.price).toLocaleString("en-PK")}
                    </Text>
                    <Text style={styles.caption}>
                      {product.stock > 0 ? "In stock" : "Out of stock"}
                      {" · "}View details
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.suggestions}
            contentContainerStyle={styles.suggestionContent}
          >
            {suggestions.map((text) => (
              <Pressable
                key={text}
                accessibilityRole="button"
                onPress={() => send(text)}
                style={styles.suggestion}
              >
                <Text style={styles.link}>{text}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.composer}>
            <TextInput
              accessibilityLabel="Message the shopping assistant"
              value={input}
              onChangeText={setInput}
              placeholder="Ask about products or orders..."
              placeholderTextColor="#94a3b8"
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={() => send()}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!input.trim()}
              onPress={() => send()}
              style={[styles.send, !input.trim() && styles.disabled]}
            >
              <Text style={styles.white}>Send</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fbfaff" },
  grow: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    padding: 18,
  },
  title: { fontSize: 21, fontWeight: "800", color: "#25304a" },
  caption: { color: "#9299ab", fontSize: 11, marginTop: 5 },
  close: { padding: 13, borderRadius: 12, backgroundColor: "#f3effd" },
  link: { color: "#7c3aed", fontSize: 11, fontWeight: "700" },
  messages: { padding: 18 },
  notice: { color: "#9a92aa", fontSize: 11, lineHeight: 19, marginBottom: 20 },
  bubble: {
    maxWidth: "92%",
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ece6f6",
    padding: 15,
    borderRadius: 18,
    marginBottom: 13,
  },
  myBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#7c3aed",
    borderColor: "#7c3aed",
  },
  message: { color: "#535b72", fontSize: 13, lineHeight: 22 },
  white: { color: "#fff", fontWeight: "600" },
  product: {
    backgroundColor: "#f7f3ff",
    padding: 13,
    borderRadius: 12,
    marginTop: 10,
  },
  productName: { color: "#35405a", fontWeight: "700", fontSize: 13 },
  price: { color: "#7c3aed", fontWeight: "800", marginTop: 6 },
  suggestions: { flexGrow: 0, flexShrink: 0 },
  suggestionContent: { paddingHorizontal: 15, paddingVertical: 10, gap: 8 },
  suggestion: { backgroundColor: "#ede7fc", padding: 13, borderRadius: 12 },
  composer: {
    flexDirection: "row",
    gap: 9,
    padding: 14,
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#f5f3fa",
    borderRadius: 13,
    padding: 14,
    color: "#35405a",
    fontSize: 13,
  },
  send: {
    backgroundColor: "#7c3aed",
    borderRadius: 13,
    paddingHorizontal: 18,
    justifyContent: "center",
    minHeight: 48,
  },
  disabled: { opacity: 0.4 },
});
