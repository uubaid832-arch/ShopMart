import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ProductReviews from "./ProductReviews";

const baseUrl = (process.env.EXPO_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

function absoluteUrl(url) {
  if (!url) return null;
  return /^https?:\/\//i.test(url)
    ? url
    : `${baseUrl}/${url.replace(/^\/+/, "")}`;
}

function Photo({ uri, name }) {
  const [failed, setFailed] = useState(false);

  return uri && !failed ? (
    <Image
      source={{ uri }}
      accessibilityLabel={name}
      resizeMode="contain"
      style={styles.photo}
      onError={() => setFailed(true)}
    />
  ) : (
    <View style={[styles.photo, styles.placeholder]}>
      <Text>Photo unavailable</Text>
    </View>
  );
}
export default function ProductDetailsModal({ product, session, onClose }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(
          `${baseUrl}/api/product-images?productIds=${encodeURIComponent(product.id)}`,
          { signal: controller.signal },
        );

        if (!response.ok) throw new Error("Could not load the photo gallery.");

        const data = await response.json();

        if (!controller.signal.aborted) {
          setPhotos(
            [...data]
              .sort((a, b) => a.position - b.position)
              .map((photo) => absoluteUrl(photo.url))
              .filter(Boolean),
          );
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [product.id]);

  const gallery = photos.length
    ? photos
    : product.imageUrl
      ? [product.imageUrl]
      : [];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.heading}>Product details</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={styles.close}
          >
            <Text style={styles.link}>Close</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {loading && <ActivityIndicator color="#7c3aed" />}

          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}

          {gallery.length ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                contentContainerStyle={styles.gallery}
              >
                {gallery.map((uri) => (
                  <Photo key={uri} uri={uri} name={product.name} />
                ))}
              </ScrollView>
              <Text style={styles.muted}>
                {gallery.length} photo(s) — swipe to browse
              </Text>
            </>
          ) : !loading ? (
            <Text style={styles.muted}>No photos available.</Text>
          ) : null}

          <Text style={styles.category}>{product.category}</Text>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>
            PKR {Number(product.price).toLocaleString("en-PK")}
          </Text>

          <View style={styles.stock}>
            <Text>
              {product.stock > 0
                ? `In stock · ${product.stock} available`
                : "Out of stock"}
            </Text>
          </View>

          <Text style={styles.heading}>Description</Text>
          <Text style={styles.description}>
            {product.description || "No description available."}
          </Text>
          <ProductReviews
            key={`${product.id}:${session?.user.id || "guest"}`}
            productId={product.id}
            session={session}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  heading: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  close: { padding: 12, backgroundColor: "#f5f3ff", borderRadius: 12 },
  link: { color: "#7c3aed", fontWeight: "700" },
  content: { padding: 20, paddingBottom: 40 },
  gallery: { gap: 12 },
  photo: {
    width: 260,
    height: 250,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
  },
  placeholder: { alignItems: "center", justifyContent: "center" },
  muted: { color: "#64748b", marginTop: 10, fontSize: 12 },
  category: { color: "#7c3aed", marginTop: 24, fontWeight: "600" },
  name: {
    color: "#0f172a",
    fontSize: 26,
    fontWeight: "800",
    marginTop: 8,
  },
  price: {
    color: "#7c3aed",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 12,
  },
  stock: {
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 14,
    marginVertical: 20,
  },
  description: { color: "#475569", lineHeight: 24, marginTop: 10 },
  error: { color: "#be123c", marginBottom: 12 },
});
