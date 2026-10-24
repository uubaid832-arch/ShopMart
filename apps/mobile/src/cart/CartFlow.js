import { useState } from "react";
import CartModal from "./CartModal";
import AuthModal from "../auth/AuthModal";
import CheckoutModal from "../checkout/CheckoutModal";

export default function CartFlow({ cart, auth, onClose, onPlaced }) {
  const [screen, setScreen] = useState("cart");

  if (screen === "auth") {
    return (
      <AuthModal onSignIn={auth.signIn} onClose={() => setScreen("cart")} />
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
      onCheckout={() => setScreen(auth.session ? "checkout" : "auth")}
    />
  );
}
