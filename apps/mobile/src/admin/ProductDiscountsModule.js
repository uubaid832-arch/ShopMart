import { Text } from "../i18n/LocalizedNativeComponents.js";
import { useEffect, useState } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import { adminRequest, money, useAdminResource } from "./adminApi";
import { Badge, Button, Card, Choice, confirm, Field, Notice, ui, useMutation, check } from "./adminUi";

export default function ProductDiscountsModule({ session, onChanged }) {
  const [revision, setRevision] = useState(0);
  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [allDiscountKind, setAllDiscountKind] = useState("PERCENT");
  const [allDiscountValue, setAllDiscountValue] = useState("10");
  const [selected, setSelected] = useState({});
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [loadError, setLoadError] = useState("");
  const campaigns = useAdminResource(session.accessToken, "/product-discounts", revision);
  const op = useMutation(() => { setRevision((v) => v + 1); onChanged(); });
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const all = [];
        let page = 0;
        let totalPages = 1;
        do {
          const data = await adminRequest(session.accessToken, `/products?page=${page}&size=100`);
          all.push(...data.items);
          totalPages = data.totalPages;
          page++;
        } while (page < totalPages);
        if (active) setProducts(all);
      } catch (error) { if (active) setLoadError(error.message); }
    })();
    return () => { active = false; };
  }, [session.accessToken]);
  const activeIds = new Set((campaigns.data || []).filter((item) => item.enabled && item.id !== editing?.id).flatMap((item) => item.products.map((p) => p.productId)));
  const visible = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const eligibleProducts = products.filter((product) => product.active && !activeIds.has(product.id));
  function selectAllForDiscount() {
    const value = Number(allDiscountValue);
    const minimumPrice = Math.min(...eligibleProducts.map((product) => Number(product.price)));
    if (!eligibleProducts.length) { setLoadError("There are no active products available for a new campaign."); return; }
    if (!Number.isFinite(value) || value <= 0 || (allDiscountKind === "PERCENT" ? value > 99 : value >= minimumPrice)) {
      setLoadError(allDiscountKind === "PERCENT"
        ? "Enter a percentage greater than 0 and no more than 99."
        : `Enter a flat amount below the cheapest eligible product price (${money(minimumPrice)}).`);
      return;
    }
    setSelected(Object.fromEntries(eligibleProducts.map((product) => [product.id, { checked: true, kind: allDiscountKind, value: String(value) }])));
    setLoadError("");
  }
  async function createCampaign() {
    const choices = Object.entries(selected).filter(([, rule]) => rule.checked);
    await op.run(() => {
      check(choices.length > 0, "Select at least one product.");
      check(!choices.some(([, rule]) => !/^\d{1,10}(\.\d{1,2})?$/.test(rule.value) || Number(rule.value) <= 0 || (rule.kind === "PERCENT" && Number(rule.value) > 99)), "Enter valid discount values; percentages must be less than 100%.");
      return adminRequest(session.accessToken, editing ? `/product-discounts/${editing.id}` : "/product-discounts", { method: editing ? "PUT" : "POST", values: {
        ...(editing ? { version: editing.version } : { requestId: Crypto.randomUUID() }), name: name.trim() || null,
        products: choices.map(([productId, rule]) => ({ productId, kind: rule.kind, value: Number(rule.value) })),
      } });
    }, editing ? "Promotion updated." : "Automatic discount campaign created.");
    setName(""); setSelected({}); setEditing(null);
  }
  function editCampaign(campaign) {
    setEditing(campaign); setName(campaign.name || "");
    setSelected(Object.fromEntries(campaign.products.map((product) => [product.productId, { checked: true, kind: product.kind, value: String(product.value) }])));
  }
  return <View style={{ gap: 14 }}>
    <Notice op={op} />
    {loadError ? <Text style={ui.error}>{loadError}</Text> : null}
    <Card title={editing ? "Edit promotion" : "Automatic product discounts"} subtitle="Set a separate discount on each selected product. Voucher codes cannot discount these products again.">
      <Field label="Campaign name (optional)" value={name} onChangeText={setName} maxLength={100} />
      <Card title="Apply a discount to all available products" subtitle="Choose a percentage or flat PKR amount. Products already in another active campaign are excluded.">
        <Choice label="Discount type" value={allDiscountKind} onChange={setAllDiscountKind} options={[{ value: "PERCENT", label: "Percentage" }, { value: "FIXED", label: "Flat PKR amount" }]} />
        <Field label={allDiscountKind === "PERCENT" ? "Discount percentage (maximum 99%)" : "Flat discount per product (PKR)"} value={allDiscountValue} onChangeText={setAllDiscountValue} keyboardType="decimal-pad" />
        <Button title={`Apply to all available products (${eligibleProducts.length})`} secondary disabled={op.blocked} onPress={selectAllForDiscount} />
      </Card>
      <Field label="Search products" value={search} onChangeText={setSearch} />
      {visible.map((product) => {
        const rule = selected[product.id] || { checked: false, kind: "PERCENT", value: "10" };
        const locked = activeIds.has(product.id) || !product.active;
        return <Card key={product.id} title={product.name} subtitle={`${money(product.price)}${locked ? " · Already discounted" : ""}`}>
          <Button title={rule.checked ? "Selected" : "Select product"} secondary={!rule.checked} disabled={locked} onPress={() => setSelected({ ...selected, [product.id]: { ...rule, checked: !rule.checked } })} />
          {rule.checked && <>
            <Choice label="Discount type" value={rule.kind} onChange={(kind) => setSelected({ ...selected, [product.id]: { ...rule, kind } })} options={[{ value: "PERCENT", label: "Percentage" }, { value: "FIXED", label: "PKR amount" }]} />
            <Field label={rule.kind === "PERCENT" ? "Discount percent (maximum 99)" : "Discount amount (PKR)"} value={rule.value} onChangeText={(value) => setSelected({ ...selected, [product.id]: { ...rule, value } })} keyboardType="decimal-pad" />
          </>}
        </Card>;
      })}
      <Button title={editing ? "Save promotion" : "Create discount campaign"} icon="check" disabled={op.blocked} onPress={createCampaign} />
      {editing && <Button title="Cancel edit" secondary disabled={op.blocked} onPress={() => { setEditing(null); setName(""); setSelected({}); }} />}
    </Card>
    {campaigns.loading ? <Text style={ui.muted}>Loading campaigns…</Text> : campaigns.error ? <Text style={ui.error}>{campaigns.error}</Text> : (campaigns.data || []).map((campaign) => <Card key={campaign.id} title={campaign.name || "Unnamed sale promotion"} subtitle={`${campaign.products.length} included products`}>
      <Badge value={campaign.enabled ? "Active" : "Disabled"} />
      <Button title={expanded[campaign.id] ? "Hide included products" : "Show included products"} secondary onPress={() => setExpanded({ ...expanded, [campaign.id]: !expanded[campaign.id] })} />
      {expanded[campaign.id] && campaign.products.map((product) => <Text key={product.productId} style={ui.body}>{product.productName}: {product.kind === "PERCENT" ? `${Number(product.value)}% off` : `${money(product.value)} off`} · Original {money(product.price)}</Text>)}
      <Button title="Edit promotion" secondary disabled={op.blocked} onPress={() => editCampaign(campaign)} />
      <Button title={campaign.enabled ? "Disable campaign" : "Enable campaign"} danger={campaign.enabled} secondary={!campaign.enabled} disabled={op.blocked} onPress={() => op.run(() => adminRequest(session.accessToken, `/product-discounts/${campaign.id}`, { method: "PATCH", values: { enabled: !campaign.enabled, version: campaign.version } }), "Campaign status updated.")} />
      {!campaign.enabled && <Button title="Delete disabled campaign" danger disabled={op.blocked} onPress={() => confirm("Delete this disabled campaign?", "This removes the campaign and its discount rules. Past order prices stay unchanged.", () => op.run(() => adminRequest(session.accessToken, `/product-discounts/${campaign.id}`, { method: "DELETE" }), "Campaign deleted."), true)} />}
    </Card>)}
  </View>;
}
