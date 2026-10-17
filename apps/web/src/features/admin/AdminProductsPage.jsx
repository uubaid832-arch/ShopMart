import { useState } from "react";
import { demoProducts } from "../../data/demoProducts";
import AdminProducts from "./AdminProducts";
import ProductForm from "./ProductForm";

export default function AdminProductsPage() {
  const [form, setForm] = useState(null);

  return (
    <>
      <p className="mb-4 mt-0 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
        Sample catalog · These products are for UI testing. Changes are not
        saved.
      </p>

      <AdminProducts
        products={demoProducts}
        onCreate={() => setForm({ product: null })}
        onEdit={(product) => setForm({ product })}
      />

      {form && (
        <ProductForm product={form.product} onClose={() => setForm(null)} />
      )}
    </>
  );
}
