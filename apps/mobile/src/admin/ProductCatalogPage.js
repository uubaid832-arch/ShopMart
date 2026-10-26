import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { apiBaseUrl, imageUrl } from "./adminApi";
import { Notice } from "./adminUi";

const paths = {
  refresh:
    "M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2",
  close: "m6 6 12 12M6 18 18 6",
  plus: "M12 5v14M5 12h14",
  search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  tag: "M3 12 12 3h8v8l-9 10-8-9ZM16 7h.01",
  box: "m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 10 9-5M12 13 3 8m9 5v9",
  down: "m5 9 7 7 7-7",
  check: "m5 12 4 4L19 6",
  edit: "m16 3 5 5-12 12-6 1 1-6L16 3Zm-2 2 5 5",
  image: "M3 3h18v18H3V3Zm0 12 5-5 6 7 3-3 4 4M17 7h.01",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  back: "m15 5-7 7 7 7",
  arrow: "m9 5 7 7-7 7",
};
function Icon({ name, size = 20, color = "#7c3aed" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={paths[name]}
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
function Action({ icon, label, onPress, disabled, danger, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.action, style, (pressed || disabled) && s.dim]}
    >
      <Icon name={icon} color={danger ? "#bd365c" : "#7c3aed"} />
      <Text style={[s.actionText, danger && { color: "#bd365c" }]}>
        {label}
      </Text>
    </Pressable>
  );
}
function Thumbnail({ uri, name, onPress }) {
  const [failed, setFailed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View photos of ${name}`}
      style={s.thumbnail}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={s.image}
          resizeMode="contain"
          accessibilityLabel={name}
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon name="image" size={30} color="#b9a6cc" />
      )}
    </Pressable>
  );
}
export default function ProductCatalogPage({
  result,
  categories,
  category,
  onCategory,
  lowStock,
  onStock,
  page,
  onPage,
  search,
  onSearch,
  onClose,
  onRefresh,
  onAdd,
  onEdit,
  onPhotos,
  onDelete,
  op,
  revision,
}) {
  const [picker, setPicker] = useState("");
  const [photos, setPhotos] = useState({ key: "", values: {} });
  const items = result.data?.items || [];
  const ids = items
    .map((p) => p.id)
    .sort()
    .join(",");
  const photoKey = `${ids}:${revision}`;
  useEffect(() => {
    if (!ids) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    fetch(
      `${apiBaseUrl}/api/product-images?productIds=${encodeURIComponent(ids)}`,
      { signal: controller.signal, credentials: "omit" },
    )
      .then((response) => {
        if (!response.ok) throw new Error("Photos unavailable");
        return response.json();
      })
      .then((data) => {
        const values = {};
        for (const photo of [...data].sort((a, b) => a.position - b.position)) {
          if (!values[photo.productId])
            values[photo.productId] = imageUrl(photo.url);
        }
        if (!controller.signal.aborted) setPhotos({ key: photoKey, values });
      })
      .catch(() => {
        /* Keep product actions available when thumbnail loading fails. */
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [ids, photoKey]);
  const options =
    picker === "category"
      ? [
          { value: "", label: "All categories" },
          ...(categories.data || []).map((c) => ({
            value: c.id,
            label: c.name,
          })),
        ]
      : [
          { value: "ALL", label: "All stock" },
          { value: "LOW", label: "Low stock (5 or fewer)" },
        ];
  const selected = picker === "category" ? category : lowStock ? "LOW" : "ALL";
  const query = search.trim().toLowerCase();
  const filtered = items.filter(
    (p) => !query || `${p.name} ${p.category}`.toLowerCase().includes(query),
  );
  const totalPages = Math.max(1, result.data?.totalPages || 1);
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => {
        if (!op.busy) onClose();
      }}
    >
      <SafeAreaView style={s.screen}>
        <View style={s.topActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh products"
            onPress={onRefresh}
            disabled={op.busy || result.loading}
            style={s.iconButton}
          >
            <Icon name="refresh" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close products"
            onPress={onClose}
            disabled={op.busy}
            style={s.iconButton}
          >
            <Icon name="close" />
          </Pressable>
        </View>
        <View style={s.headingRow}>
          <View style={s.grow}>
            <Text style={s.eyebrow}>SHOPMART ADMIN</Text>
            <Text style={s.heading}>Products</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add product"
            disabled={op.blocked}
            onPress={onAdd}
            style={({ pressed }) => [s.add, (pressed || op.blocked) && s.dim]}
          >
            <Icon name="plus" color="#fff" size={22} />
            <Text style={s.addText}>Add</Text>
          </Pressable>
        </View>
        <View style={s.search}>
          <Icon name="search" size={23} />
          <TextInput
            accessibilityLabel="Search products on this page"
            value={search}
            onChangeText={onSearch}
            placeholder="Search products"
            placeholderTextColor="#968aa7"
            style={s.searchInput}
            autoCorrect={false}
          />
        </View>
        <View style={s.filters}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filter by category"
            disabled={categories.loading || Boolean(categories.error)}
            onPress={() => setPicker("category")}
            style={s.filter}
          >
            <Icon name="tag" />
            <Text numberOfLines={1} style={s.filterLabel}>
              {categories.data?.find((c) => c.id === category)?.name ||
                "All categories"}
            </Text>
            <Icon name="down" size={17} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filter by stock"
            onPress={() => setPicker("stock")}
            style={s.filter}
          >
            <Icon name="box" />
            <Text numberOfLines={1} style={s.filterLabel}>
              {lowStock ? "Low stock" : "All stock"}
            </Text>
            <Icon name="down" size={17} />
          </Pressable>
        </View>
        <View style={s.notice}>
          <Notice op={op} />
          {categories.error ? (
            <Text style={s.error}>{categories.error}</Text>
          ) : null}
        </View>
        <Text style={s.count}>
          {query
            ? `${filtered.length} matches on this page`
            : `${result.data?.totalItems ?? 0} products`}
        </Text>
        {result.loading ? (
          <ActivityIndicator color="#7c3aed" size="large" style={s.loader} />
        ) : result.error ? (
          <View style={s.empty}>
            <Text style={s.error}>{result.error}</Text>
            <Action icon="refresh" label="Try again" onPress={onRefresh} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(p) => p.id}
            style={s.grow}
            contentContainerStyle={s.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={s.empty}>
                <Icon name="box" size={38} />
                <Text style={s.emptyTitle}>No products found</Text>
                <Text style={s.category}>
                  Try another category or stock filter.
                </Text>
              </View>
            }
            renderItem={({ item: product }) => {
              const uri =
                photos.key === photoKey ? photos.values[product.id] : null;
              return (
                <View style={s.card}>
                  <View style={s.productRow}>
                    <Thumbnail
                      key={`${product.id}:${uri || "none"}`}
                      uri={uri}
                      name={product.name}
                      onPress={() => onPhotos(product)}
                    />
                    <View style={s.grow}>
                      <View style={s.nameRow}>
                        <Text style={s.name}>{product.name}</Text>
                        <View style={s.badge}>
                          <View
                            style={[
                              s.dot,
                              !product.active && { backgroundColor: "#9a8ba8" },
                            ]}
                          />
                          <Text style={s.badgeText}>
                            {product.active ? "Active" : "Hidden"}
                          </Text>
                        </View>
                      </View>
                      <Text style={s.category}>{product.category}</Text>
                      <Text style={s.price}>
                        Rs{" "}
                        {Number(product.price).toLocaleString("en-PK", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </Text>
                      <View style={s.stock}>
                        <Icon name="box" size={17} color="#897b9c" />
                        <Text style={s.stockText}>Stock: {product.stock}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={s.cardActions}>
                    <Action
                      icon="edit"
                      label="Edit"
                      disabled={op.blocked}
                      onPress={() => onEdit(product)}
                    />
                    <View style={s.divider} />
                    <Action
                      icon="image"
                      label="Photos"
                      disabled={op.blocked}
                      onPress={() => onPhotos(product)}
                    />
                    <View style={s.grow} />
                    <Action
                      icon="trash"
                      label="Delete"
                      danger
                      disabled={op.blocked}
                      onPress={() => onDelete(product)}
                    />
                  </View>
                </View>
              );
            }}
          />
        )}
        <View style={s.pagination}>
          <Action
            icon="back"
            label="Previous"
            style={s.pageButton}
            disabled={op.busy || result.loading || page === 0}
            onPress={() => onPage(page - 1)}
          />
          <Text style={s.pageNumber}>
            {page + 1} / {totalPages}
          </Text>
          <Action
            icon="arrow"
            label="Next"
            style={s.pageButton}
            disabled={
              op.busy ||
              result.loading ||
              !result.data ||
              page + 1 >= totalPages
            }
            onPress={() => onPage(page + 1)}
          />
        </View>
      </SafeAreaView>
      {!!picker && (
        <Modal
          transparent
          visible
          animationType="fade"
          onRequestClose={() => setPicker("")}
        >
          <SafeAreaView style={s.overlay}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss filters"
              style={StyleSheet.absoluteFillObject}
              onPress={() => setPicker("")}
            />
            <View style={s.sheet}>
              <View style={s.sheetTitle}>
                <Text style={s.emptyTitle}>
                  {picker === "category"
                    ? "Choose category"
                    : "Stock availability"}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close filter"
                  style={s.iconButton}
                  onPress={() => setPicker("")}
                >
                  <Icon name="close" />
                </Pressable>
              </View>
              <FlatList
                data={options}
                keyExtractor={(o) => o.value}
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected === item.value }}
                    onPress={() => {
                      if (picker === "category") onCategory(item.value);
                      else onStock(item.value === "LOW");
                      setPicker("");
                    }}
                    style={[s.option, selected === item.value && s.selected]}
                  >
                    <Text style={[s.filterLabel, s.grow]}>{item.label}</Text>
                    {selected === item.value && <Icon name="check" />}
                  </Pressable>
                )}
              />
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </Modal>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#faf8ff" },
  grow: { flex: 1 },
  topActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 9,
    paddingHorizontal: 18,
    paddingTop: 9,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0eafa",
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 19,
    paddingTop: 9,
    paddingBottom: 19,
    gap: 12,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.2,
    color: "#b7a0d3",
    marginBottom: 7,
  },
  heading: { fontSize: 29, fontWeight: "900", color: "#2f174c" },
  add: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7c3aed",
    paddingHorizontal: 16,
    height: 43,
    borderRadius: 12,
  },
  addText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  search: {
    marginHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#e1dce9",
    borderRadius: 13,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    height: 49,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#342047", paddingVertical: 10 },
  filters: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 18,
    marginTop: 12,
  },
  filter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e1dce9",
    borderRadius: 12,
    backgroundColor: "#fff",
    height: 45,
    paddingHorizontal: 11,
  },
  filterLabel: { flex: 1, fontSize: 12, color: "#422b5b", fontWeight: "500" },
  notice: { paddingHorizontal: 18 },
  count: {
    fontSize: 13,
    color: "#9789a5",
    marginHorizontal: 19,
    marginTop: 14,
    marginBottom: 13,
  },
  list: { paddingHorizontal: 17, paddingBottom: 10, gap: 13 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7e1ed",
    borderRadius: 15,
    padding: 12,
  },
  productRow: { flexDirection: "row", gap: 13 },
  thumbnail: {
    width: 84,
    height: 87,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#f0eff2",
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", height: "100%" },
  nameRow: { flexDirection: "row", alignItems: "flex-start", gap: 5 },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: "#33204d",
    lineHeight: 20,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 11,
    backgroundColor: "#f2ecfc",
  },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#7c3aed" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#2ac563" },
  category: { fontSize: 13, color: "#9587a4", marginTop: 4 },
  price: { fontSize: 18, fontWeight: "800", color: "#7c3aed", marginTop: 6 },
  stock: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  stockText: { fontSize: 12, color: "#8d809d" },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: "#f0ecf5",
    paddingTop: 7,
    marginTop: 12,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 39,
    paddingHorizontal: 3,
  },
  actionText: { fontSize: 12, fontWeight: "600", color: "#7c3aed" },
  divider: {
    height: 22,
    width: 1,
    backgroundColor: "#f0ecf5",
    marginHorizontal: 5,
  },
  dim: { opacity: 0.4 },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 25,
    paddingVertical: 13,
    gap: 10,
  },
  pageButton: {
    backgroundColor: "#f1ebfb",
    paddingHorizontal: 13,
    borderRadius: 12,
  },
  pageNumber: { fontSize: 13, color: "#92839f" },
  loader: { flex: 1 },
  empty: { padding: 25, alignItems: "center", gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: "#37234d" },
  error: { color: "#bc3457", fontSize: 13 },
  overlay: {
    flex: 1,
    backgroundColor: "#24103666",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 17,
    maxHeight: "70%",
  },
  sheetTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 15,
  },
  option: {
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    marginBottom: 5,
  },
  selected: { backgroundColor: "#f2ebfc" },
});
