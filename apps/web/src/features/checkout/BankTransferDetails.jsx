import Modal from "../../components/Modal";

const DEMO_ACCOUNT = {
  bank: "ShopMart Demo Bank (fictional)",
  title: "ShopMart Test Store",
  account: "0000 0000 0000",
  iban: "PK00-DEMO-0000-0000-0000",
  whatsapp: "923263101049",
};

export default function BankTransferDetails({ total, name, phone, onBack, onClose }) {
  const message = `Hello ShopMart, I have made a demo bank transfer. Name: ${name || ""}. Phone: ${phone || ""}. Cart total: PKR ${Number(total || 0).toLocaleString("en-PK")}. I will attach the transfer receipt here.`;
  const whatsappUrl = `https://wa.me/${DEMO_ACCOUNT.whatsapp}?text=${encodeURIComponent(message)}`;

  return (
    <Modal onClose={onClose} labelledBy="bank-transfer-title" size="md">
      <section className="p-5 sm:p-7">
        <p className="m-0 text-xs font-bold uppercase tracking-wide text-violet-700">Demo payment details</p>
        <h2 id="bank-transfer-title" className="mb-2 mt-2 text-2xl font-extrabold">Bank transfer</h2>
        <p className="mt-0 text-sm leading-6 text-slate-600">Transfer the amount, then send a screenshot or receipt to ShopMart on WhatsApp. Include your name and phone number so we can match it.</p>
        <dl className="grid gap-3 rounded-2xl bg-violet-50 p-4 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Bank</dt><dd className="m-0 font-bold">{DEMO_ACCOUNT.bank}</dd></div>
          <div><dt className="text-xs text-slate-500">Account title</dt><dd className="m-0 font-bold">{DEMO_ACCOUNT.title}</dd></div>
          <div><dt className="text-xs text-slate-500">Account number</dt><dd className="m-0 font-bold">{DEMO_ACCOUNT.account}</dd></div>
          <div><dt className="text-xs text-slate-500">IBAN (demo)</dt><dd className="m-0 break-all font-bold">{DEMO_ACCOUNT.iban}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Amount to transfer</dt><dd className="m-0 text-lg font-extrabold text-violet-700">PKR {Number(total || 0).toLocaleString("en-PK")}</dd></div>
        </dl>
        <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900"><strong>Mock details only:</strong> this fictional account cannot receive money. No order or payment is created from this demo page.</p>
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onBack} className="rounded-xl border-0 bg-slate-100 px-4 py-3 font-semibold text-slate-700">Back to checkout</button>
          <a href={whatsappUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white">Send receipt on WhatsApp · 0326 3101049</a>
        </div>
      </section>
    </Modal>
  );
}
