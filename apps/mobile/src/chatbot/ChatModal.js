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
import { sendAssistantMessage } from "./assistantApi";

const suggestions = [
  "Show available products",
  "Track my order",
  "Returns and refunds",
  "Forgot password",
];

const ignored = new Set([
  "show", "available", "catalog", "product", "products", "price", "prices",
  "stock", "the", "and", "with", "for", "about", "what", "which", "please",
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
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(value = input) {
    const question = value.trim().slice(0, 500);
    if (!question || sending.current) return;

    sending.current = true;
    setBusy(true);
    setError("");
    setInput("");

    const words = question
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((word) => word && word.length > 1 && !ignored.has(word));

    const matches = words.length
      ? products.filter((product) => {
          const searchable =
            `${product.name} ${product.category}`.toLowerCase();
          return words.every((word) => searchable.includes(word));
        })
      : [];

    let found = [];

    if (matches.length) {
      found = matches.slice(0, 6);
    } else if (
      /\b(show|available|catalog|all)\b/i.test(question)
    ) {
      found = products.filter((product) => product.stock > 0).slice(0, 6);
    }

    const userId = nextId.current++;
    setMessages((current) =>
      [...current, { id: userId, text: question, mine: true }].slice(-60),
    );

    const history = [
      ...messages.slice(-10).map((message) => ({
        role: message.mine ? "user" : "assistant",
        content: message.text,
      })),
      { role: "user", content: question },
    ];

    try {
      const reply = await sendAssistantMessage("en", history);
      setMessages((current) =>
        [...current, { id: nextId.current++, text: reply, products: found }].slice(-60),
      );
    } catch (failure) {
      setError(failure.message || "The assistant is temporarily unavailable.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
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
              <Text style={styles.caption}>AI product finder & shopping help</Text>
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
              AI-powered shopping support. Messages are processed by our AI
              provider. Do not enter passwords, verification codes, or payment
              details.
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
            {busy ? (
              <Text accessibilityRole="text" style={styles.caption}>
                Preparing a reply…
              </Text>
            ) : null}
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
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
              disabled={!input.trim() || busy}
              onPress={() => send()}
              style={[styles.send, (!input.trim() || busy) && styles.disabled]}
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
  error: { color: "#b42318", fontSize: 12, lineHeight: 18, marginTop: 8 },
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
