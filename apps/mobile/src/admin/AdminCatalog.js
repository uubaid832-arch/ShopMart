import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Switch, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import {
  adminRequest,
  imageUrl,
  loadCategories,
  money,
  useAdminResource,
} from "./adminApi";
import {
  Badge,
  Button,
  Card,
  check,
  Choice,
  confirm,
  Field,
  Form,
  Notice,
  Page,
  PagedList,
  ui,
  useMutation,
} from "./adminUi";

function useCategories(revision) {
  const [result, setResult] = useState({
    loading: true,
    data: null,
    error: "",
  });
  useEffect(() => {
    const controller = new AbortController();
    setResult({ loading: true, data: null, error: "" });
    loadCategories(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({ loading: false, data, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({ loading: false, data: null, error: error.message });
      });
    return () => controller.abort();
  }, [revision]);
  return result;
}
function ProductEditor({ product, categories, op, onSaved }) {
  const [name, setName] = useState(product?.name || "");
  const [categoryId, setCategoryId] = useState(product?.categoryId || "");
  const [price, setPrice] = useState(product?.price || "");
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [description, setDescription] = useState(product?.description || "");
  const [active, setActive] = useState(product?.active ?? true);
  return (
    <Form>
      <Notice op={op} />
      <Card
        title={product ? "Edit product" : "New product"}
        subtitle="Prices are in PKR. Stock changes use the current product version."
      >
        <Field
          label="Product name"
          value={name}
          onChangeText={setName}
          maxLength={150}
          editable={!op.blocked}
        />
        {categories.loading ? (
          <ActivityIndicator color="#7c3aed" />
        ) : categories.error ? (
          <Text style={ui.error}>{categories.error}</Text>
        ) : (
          <Choice
            label="Category"
            value={categoryId}
            options={(categories.data || []).map((item) => ({
              value: item.id,
              label: item.name,
            }))}
            onChange={setCategoryId}
            disabled={op.blocked}
          />
        )}
        <Field
          label="Price (PKR)"
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          editable={!op.blocked}
        />
        <Field
          label="Stock quantity"
          value={stock}
          onChangeText={setStock}
          keyboardType="number-pad"
          editable={!op.blocked}
        />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={4000}
          editable={!op.blocked}
        />
        <View style={ui.switchRow}>
          <Text style={ui.body}>Visible in customer catalog</Text>
          <Switch
            accessibilityLabel="Product active"
            value={active}
            onValueChange={setActive}
            disabled={op.blocked}
            trackColor={{ false: "#ddd4e7", true: "#b995f1" }}
            thumbColor={active ? "#7c3aed" : "#fff"}
          />
        </View>
        <Button
          title="Save product"
          icon="check"
          disabled={
            op.blocked || categories.loading || Boolean(categories.error)
          }
          onPress={() =>
            onSaved({
              name,
              categoryId,
              price,
              stock,
              active,
              description,
              version: product?.version ?? 0,
            })
          }
        />
      </Card>
    </Form>
  );
}
function Photos({ session, product, onClose, onBack, onChanged }) {
  const [revision, setRevision] = useState(0);
  const result = useAdminResource(
    session.accessToken,
    `/products/${product.id}/images`,
    revision,
  );
  const refresh = () => setRevision((v) => v + 1);
  const op = useMutation(() => {
    refresh();
    onChanged();
  });
  async function choose() {
    await op.run(async () => {
      const available = 6 - (result.data?.length || 0);
      check(
        available > 0,
        "A product can have at most six photos. Remove one first.",
      );
      const selected = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.85,
      });
      if (selected.canceled) return { cancelled: true };
      const asset = selected.assets[0];
      // Convert HEIC/WEBP and large camera photos to a bounded JPEG.
      const context = ImageManipulator.manipulate(asset.uri);
      context.resize(
        asset.width >= asset.height
          ? { width: Math.min(asset.width, 1600) }
          : { height: Math.min(asset.height, 1600) },
      );
      const rendered = await context.renderAsync();
      let photo;
      try {
        photo = await rendered.saveAsync({
          format: SaveFormat.JPEG,
          compress: 0.8,
        });
      } finally {
        rendered.release();
        context.release();
      }
      const file = new File(photo.uri);
      try {
        check(
          file.size > 0 && file.size <= 5 * 1024 * 1024,
          "Use a photo smaller than 5 MB after compression.",
        );
        const form = new FormData();
        form.append("files", {
          uri: photo.uri,
          name: "product.jpg",
          type: "image/jpeg",
        });
        return await adminRequest(
          session.accessToken,
          `/products/${product.id}/images`,
          { method: "POST", formData: form },
        );
      } finally {
        if (file.exists) file.delete();
      }
    }, "Photo uploaded.");
  }
  return (
    <Page
      title="Product photos"
      onClose={onClose}
      onBack={onBack}
      busy={op.busy}
      onRefresh={() => {
        op.reset();
        refresh();
      }}
    >
      <Form>
        <Text style={ui.title}>{product.name}</Text>
        <Text style={ui.muted}>
          Up to 6 JPEG/PNG photos · maximum 5 MB each. The first photo is the
          primary image.
        </Text>
        <Notice op={op} />
        <Button
          title="Choose and upload photo"
          icon="image"
          disabled={
            op.blocked ||
            result.loading ||
            Boolean(result.error) ||
            (result.data?.length || 0) >= 6
          }
          onPress={choose}
        />
        {result.loading ? (
          <ActivityIndicator color="#7c3aed" style={ui.loader} />
        ) : result.error ? (
          <Text style={ui.error}>{result.error}</Text>
        ) : (
          (result.data || []).map((photo, index) => (
            <Card
              key={photo.id}
              title={index === 0 ? "Primary photo" : `Photo ${index + 1}`}
            >
              <Image
                source={{ uri: imageUrl(photo.url) }}
                accessibilityLabel={`${product.name} photo ${index + 1}`}
                resizeMode="contain"
                style={ui.photo}
              />
              <View style={ui.row}>
                {index > 0 && (
                  <Button
                    title="Make primary"
                    icon="star"
                    secondary
                    disabled={op.blocked}
                    onPress={() =>
                      op.run(
                        () =>
                          adminRequest(
                            session.accessToken,
                            `/products/${product.id}/images/${photo.id}/primary`,
                            { method: "PATCH" },
                          ),
                        "Primary photo changed.",
                      )
                    }
                  />
                )}
                <Button
                  title="Remove"
                  icon="trash"
                  danger
                  disabled={op.blocked}
                  onPress={() =>
                    confirm(
                      "Remove photo?",
                      "Remove this product photo?",
                      () =>
                        op.run(
                          () =>
                            adminRequest(
                              session.accessToken,
                              `/products/${product.id}/images/${photo.id}`,
                              { method: "DELETE" },
                            ),
                          "Photo removed.",
                        ),
                      true,
                    )
                  }
                />
              </View>
            </Card>
          ))
        )}
      </Form>
    </Page>
  );
}
export function ProductsModule({
  session,
  onClose,
  onChanged,
  initialLowStock = false,
}) {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState(null);
  const [photos, setPhotos] = useState(null);
  const [category, setCategory] = useState("");
  const [lowStock, setLowStock] = useState(initialLowStock);
  const result = useAdminResource(
    session.accessToken,
    `/products?page=${page}&size=15${category ? `&categoryId=${encodeURIComponent(category)}` : ""}&lowStock=${lowStock}`,
    revision,
  );
  const categories = useCategories(revision);
  const refresh = () => setRevision((v) => v + 1);
  const op = useMutation(() => {
    refresh();
    onChanged();
  });
  function back() {
    op.reset();
    setEditor(null);
  }
  if (photos)
    return (
      <Photos
        session={session}
        product={photos}
        onClose={onClose}
        onBack={() => setPhotos(null)}
        onChanged={onChanged}
      />
    );
  return (
    <Page
      primaryAction={
        !editor
          ? {
              title: "Add product",
              icon: "plus",
              disabled: op.blocked,
              onPress: () => {
                op.reset();
                setEditor("NEW");
              },
            }
          : undefined
      }
      title={
        editor
          ? editor === "NEW"
            ? "Add product"
            : "Edit product"
          : "Products"
      }
      onClose={onClose}
      busy={op.busy}
      onBack={editor ? back : undefined}
      onRefresh={
        !editor
          ? () => {
              op.reset();
              refresh();
            }
          : undefined
      }
    >
      {editor ? (
        <ProductEditor
          key={editor.id || "new"}
          product={editor === "NEW" ? null : editor}
          categories={categories}
          op={op}
          onSaved={(values) =>
            op.run(
              () => {
                check(values.name.trim(), "Enter a product name.");
                check(values.categoryId, "Choose a category.");
                check(
                  /^\d{1,10}(\.\d{1,2})?$/.test(values.price) &&
                    Number(values.price) > 0,
                  "Enter a positive price with at most two decimal places.",
                );
                check(
                  /^\d+$/.test(values.stock) &&
                    Number.isSafeInteger(Number(values.stock)) &&
                    Number(values.stock) <= 2147483647,
                  "Enter a valid whole stock quantity.",
                );
                return adminRequest(
                  session.accessToken,
                  editor === "NEW" ? "/products" : `/products/${editor.id}`,
                  {
                    method: editor === "NEW" ? "POST" : "PUT",
                    values: {
                      ...values,
                      name: values.name.trim(),
                      stock: Number(values.stock),
                    },
                  },
                );
              },
              "Product saved.",
              () => setEditor(null),
            )
          }
        />
      ) : (
        <>
          <View style={ui.toolbar}>
            <Notice op={op} />
            <Choice
              label="Product category"
              value={category}
              options={[
                { value: "", label: "All categories" },
                ...(categories.data || []).map((c) => ({
                  value: c.id,
                  label: c.name,
                })),
              ]}
              onChange={(value) => {
                setCategory(value);
                setPage(0);
              }}
            />
            <Choice
              label="Stock"
              value={lowStock ? "LOW" : "ALL"}
              options={[
                { value: "ALL", label: "All stock levels" },
                { value: "LOW", label: "Low stock (5 or fewer)" },
              ]}
              onChange={(value) => {
                setLowStock(value === "LOW");
                setPage(0);
              }}
            />
          </View>
          <PagedList
            result={result}
            page={page}
            onPage={setPage}
            search={search}
            onSearch={setSearch}
            renderItem={(product) => (
              <Card title={product.name} subtitle={product.category}>
                <View style={ui.between}>
                  <Text style={ui.amount}>{money(product.price)}</Text>
                  <Badge value={product.active ? "Active" : "Hidden"} />
                </View>
                <Text style={ui.body}>Stock: {product.stock}</Text>
                <View style={ui.row}>
                  <Button
                    title="Edit"
                    icon="edit"
                    secondary
                    disabled={op.blocked}
                    onPress={() => {
                      op.reset();
                      setEditor(product);
                    }}
                  />
                  <Button
                    title="Photos"
                    icon="image"
                    secondary
                    disabled={op.blocked}
                    onPress={() => setPhotos(product)}
                  />
                  <Button
                    title="Delete"
                    icon="trash"
                    danger
                    disabled={op.blocked}
                    onPress={() =>
                      confirm(
                        "Delete product?",
                        "Orders may prevent deletion. You can hide the product by turning off catalog visibility instead.",
                        () =>
                          op.run(
                            () =>
                              adminRequest(
                                session.accessToken,
                                `/products/${product.id}?version=${product.version}`,
                                { method: "DELETE" },
                              ),
                            "Product deleted.",
                          ),
                        true,
                      )
                    }
                  />
                </View>
              </Card>
            )}
          />
        </>
      )}
    </Page>
  );
}
export function CategoriesModule({ session, onClose, onChanged }) {
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState(null);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const result = useCategories(revision);
  const refresh = () => setRevision((v) => v + 1);
  const op = useMutation(() => {
    refresh();
    onChanged();
  });
  return (
    <Page
      footerAction={
        !editor ? (
          <Button
            title="Add category"
            icon="plus"
            disabled={op.blocked}
            onPress={() => {
              op.reset();
              setName("");
              setEditor("NEW");
            }}
          />
        ) : null
      }
      title="Categories"
      onClose={onClose}
      busy={op.busy}
      onBack={
        editor
          ? () => {
              op.reset();
              setEditor(null);
            }
          : undefined
      }
      onRefresh={() => {
        op.reset();
        refresh();
      }}
    >
      {editor ? (
        <Form>
          <Notice op={op} />
          <Card title={editor === "NEW" ? "Add category" : "Edit category"}>
            <Field
              label="Category name"
              value={name}
              onChangeText={setName}
              maxLength={80}
              editable={!op.blocked}
            />
            <Button
              title="Save category"
              icon="check"
              disabled={op.blocked}
              onPress={() =>
                op.run(
                  () => {
                    check(name.trim(), "Enter a category name.");
                    return adminRequest(
                      session.accessToken,
                      editor === "NEW"
                        ? "/categories"
                        : `/categories/${editor.id}`,
                      {
                        method: editor === "NEW" ? "POST" : "PUT",
                        values: { name: name.trim() },
                      },
                    );
                  },
                  "Category saved.",
                  () => setEditor(null),
                )
              }
            />
          </Card>
        </Form>
      ) : (
        <>
          <View style={ui.toolbar}>
            <Notice op={op} />
          </View>
          <PagedList
            result={result}
            page={0}
            onPage={() => {}}
            search={search}
            onSearch={setSearch}
            renderItem={(item) => (
              <Card title={item.name}>
                <View style={ui.row}>
                  <Button
                    title="Edit"
                    icon="edit"
                    secondary
                    disabled={op.blocked}
                    onPress={() => {
                      op.reset();
                      setName(item.name);
                      setEditor(item);
                    }}
                  />
                  <Button
                    title="Delete"
                    icon="trash"
                    danger
                    disabled={op.blocked}
                    onPress={() =>
                      confirm(
                        "Delete category?",
                        "Only unused categories can be deleted. Products or child categories may prevent this action.",
                        () =>
                          op.run(
                            () =>
                              adminRequest(
                                session.accessToken,
                                `/categories/${item.id}`,
                                { method: "DELETE" },
                              ),
                            "Category deleted.",
                          ),
                        true,
                      )
                    }
                  />
                </View>
              </Card>
            )}
          />
        </>
      )}
    </Page>
  );
}
