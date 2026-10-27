import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router";
import "./index.css";
import App from "./App.jsx";
import AdminLayout from "./features/admin/AdminLayout";
import AdminDashboard from "./features/admin/AdminDashboard";
import AdminProductsPage from "./features/admin/AdminProductsPage";
import AdminCategories from "./features/admin/AdminCategories";
import AdminOrdersPage from "./features/admin/AdminOrdersPage";
import AdminDeliveries from "./features/admin/AdminDeliveries";
import AdminReviews from "./features/admin/AdminReviews";
import AdminReturns from "./features/admin/AdminReturns";
import RiderLayout from "./features/rider/RiderLayout";
import RiderCash from "./features/rider/RiderCash";
import RiderDeliveries from "./features/rider/RiderDeliveries";
import SessionProvider from "./features/auth/SessionProvider";
import LanguageProvider from "./features/language/LanguageProvider";
import AdminUsers from "./features/admin/AdminUsers";
import AdminVouchers from "./features/vouchers/AdminVouchers";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LanguageProvider>
      <SessionProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="products" element={<AdminProductsPage />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="orders" element={<AdminOrdersPage />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="vouchers" element={<AdminVouchers />} />
              <Route path="deliveries" element={<AdminDeliveries />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="returns" element={<AdminReturns />} />
            </Route>
            <Route path="/rider" element={<RiderLayout />}>
              <Route index element={<RiderDeliveries />} />
              <Route path="cash" element={<RiderCash />} />
            </Route>

            <Route
              path="*"
              element={
                <main className="grid min-h-screen place-items-center p-6 text-center">
                  <div>
                    <p className="m-0 text-6xl font-extrabold text-violet-600">
                      404
                    </p>
                    <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
                    <p className="mb-6 text-slate-500">
                      The page you requested does not exist.
                    </p>
                    <Link
                      to="/"
                      className="inline-block rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-700"
                    >
                      Back to ShopMart
                    </Link>
                  </div>
                </main>
              }
            />
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    </LanguageProvider>
  </StrictMode>,
);
