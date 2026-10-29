export function whatsappNumber(value) {
  let digits = String(value || "")
    .trim()
    .replace(/[\s()+-]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^03\d{9}$/.test(digits)) digits = `92${digits.slice(1)}`;
  if (!/^[1-9]\d{7,14}$/.test(digits))
    throw new Error(
      "Enter a valid mobile number with country code, for example +923001234567.",
    );
  return digits;
}
export function customerMessage({
  mode,
  orderNumber,
  customerName,
  productName,
  status,
  warehouse,
  rejectionReason,
  refundChoice = "ACCOUNT",
}) {
  const hello = `Assalam o Alaikum ${customerName || ""},\n\nThis is ShopMart regarding order ${orderNumber}.`;
  if (mode === "refund") {
    const next = refundChoice === "VOUCHER"
      ? "Would you prefer a ShopMart voucher for a future purchase instead of an account refund? Please reply to confirm your preference. We will confirm the voucher amount, terms and code separately."
      : "Please confirm whether you prefer an account refund or a ShopMart voucher for a future purchase. For an account refund, reply with the account holder name, bank or wallet name, and IBAN/account number needed to receive it. Never send a card number, PIN, password, CVV or OTP.";
    return `${hello}\nProduct: ${productName}\n\nYour returned item has been accepted after inspection. ${next}\n\nThis message requests your preference only; your refund or voucher is not yet issued. We will confirm completion separately. Thank you, ShopMart.`;
  }
  if (mode === "return") {
    if (status === "REJECTED")
      return `${hello}\nProduct: ${productName}\n\nAfter inspecting the received product, we are unable to accept the return. Reason: ${rejectionReason || "Please contact ShopMart for the inspection details."}\n\nYour product will be shipped back to your delivery address soon. We will share dispatch details when available. Please contact us if your address has changed. Thank you, ShopMart.`;
    if (!warehouse || warehouse.trim().length < 10)
      throw new Error("Enter the complete warehouse return address first.");
    return `${hello}\nProduct: ${productName}\n\nYour return request has been received. Please follow these steps to send the product for inspection. Acceptance and refund eligibility will be decided after we receive and inspect it.\n\n1. Pack the return item securely with its accessories and the order number inside.\n2. Send it through any courier company of your choice, or deliver it personally, to:\n\n${warehouse.trim()}\n\n3. If using a courier, reply with the courier name and tracking number. If delivering personally, contact us first to arrange a suitable time.\n4. Keep your courier receipt. We will inspect the returned item and update you about the refund after receiving it.\n\nPlease contact us before sending if you have any questions. Thank you, ShopMart.`;
  }
  return `${hello}\n\nThe rider reported an unsuccessful delivery. Please confirm your full name, active phone number, complete delivery address (including area, street/house number, nearest landmark and city), and a suitable time to contact you. You may also share your current location on WhatsApp.\n\nWould you like to cancel this order, or would you prefer another delivery attempt with your updated details? Please reply with your choice. If you choose another delivery, send the corrected details above so we can verify them and arrange it. We will confirm the new delivery separately. Thank you, ShopMart.`;
}
export function customerContactUrl(channel, recipient, subject, body) {
  if (channel === "whatsapp")
    return `https://wa.me/${whatsappNumber(recipient)}?text=${encodeURIComponent(body)}`;
  const email = String(recipient || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Enter a valid customer email address.");
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject.replace(/[\r\n]/g, " "))}&body=${encodeURIComponent(body)}`;
}
