import { Alert } from "react-native";
import { useState } from "react";
import CartModal from "./CartModal";
import AuthModal from "../auth/AuthModal";
import CheckoutModal from "../checkout/CheckoutModal";

export default function CartFlow({ cart, auth, onClose, onPlaced, previewMode = false }) {
  const [screen, setScreen] = useState("cart");

  if (screen === "auth") {
    return (
      <AuthModal onSignIn={auth.signIn} onVerify={auth.verifySignIn} onClose={() => setScreen("cart")} />
    );
  }

  if (screen === "checkout") {
    return (
      <CheckoutModal
        cart={cart}
        session={auth.session}
        onClose={onClose}
        onPlaced={onPlaced}
      />
    );
  }

  return (
    <CartModal
      cart={cart}
      onClose={onClose}
      onCheckout={() => { if (previewMode) { Alert.alert("Store preview", "Browse products and preview the cart here. Use a customer account to place an order."); return; } setScreen(auth.session ? "checkout" : "auth"); }}
    />
  );
}
