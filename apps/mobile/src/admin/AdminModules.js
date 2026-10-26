import { Pressable, StyleSheet, Text, View } from "react-native";
import { ProductsModule, CategoriesModule } from "./AdminCatalog";
import PeopleModule from "./AdminPeople";
import LogisticsModule from "./AdminLogistics";
import { ReturnsModule, ReviewsModule } from "./AdminAfterSales";
import CashModule from "./AdminCash";
import VouchersModule from "./AdminVouchers";
import { Icon } from "./adminUi";

const modules = [
  {
    id: "vouchers",
    title: "Vouchers",
    caption: "Discount codes & limits",
    icon: "ticket",
    color: "#f0e7fd",
  },
  {
    id: "products",
    title: "Products",
    caption: "Stock, prices & photos",
    icon: "box",
    color: "#f0e7fd",
  },
  {
    id: "categories",
    title: "Categories",
    caption: "Organize your catalog",
    icon: "grid",
    color: "#fff0e3",
  },
  {
    id: "people",
    title: "Users & riders",
    caption: "Accounts & rider access",
    icon: "users",
    color: "#e9effc",
  },
  {
    id: "deliveries",
    title: "Deliveries",
    caption: "Assignments & warehouse",
    icon: "truck",
    color: "#e6f4ed",
  },
  {
    id: "returns",
    title: "Returns & refunds",
    caption: "Requests & paid refunds",
    icon: "return",
    color: "#fce9ef",
  },
  {
    id: "reviews",
    title: "Reviews",
    caption: "Customer feedback",
    icon: "star",
    color: "#fff3d7",
  },
  {
    id: "cash",
    title: "COD handovers",
    caption: "Check cash from riders",
    icon: "wallet",
    color: "#e9e3fb",
  },
];
export function AdminModuleMenu({ onOpen }) {
  return (
    <View style={s.section}>
      <Text style={s.heading}>Manage your store</Text>
      <Text style={s.caption}>Everything you need, in one place.</Text>
      <View style={s.grid}>
        {modules.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() => onOpen(item.id)}
            style={({ pressed }) => [
              s.tile,
              pressed && s.pressed,
              item.id === "cash" && s.cash,
            ]}
          >
            <View style={[s.icon, { backgroundColor: item.color }]}>
              <Icon name={item.icon} />
            </View>
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.caption}>{item.caption}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function AdminModule({ name, ...props }) {
  const Component = {
    products: ProductsModule,
    categories: CategoriesModule,
    people: PeopleModule,
    deliveries: LogisticsModule,
    returns: ReturnsModule,
    reviews: ReviewsModule,
    cash: CashModule,
    vouchers: VouchersModule,
  }[name];
  return Component ? <Component {...props} /> : null;
}
const s = StyleSheet.create({
  section: { marginTop: 21 },
  heading: { fontSize: 19, fontWeight: "800", color: "#3a2c4b" },
  caption: { fontSize: 10, lineHeight: 17, color: "#8b789e", marginTop: 5 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 16,
  },
  tile: {
    width: "47%",
    padding: 15,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eae3f2",
    borderRadius: 19,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: { fontSize: 13, fontWeight: "800", color: "#493451" },
  cash: { width: "100%", backgroundColor: "#f4edfd", borderColor: "#d9c6f4" },
  pressed: { opacity: 0.65 },
});
