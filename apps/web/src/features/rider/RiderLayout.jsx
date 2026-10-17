import { NavLink, Outlet } from "react-router";

export default function RiderLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-0 border-b border-solid border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <NavLink to="/" className="text-2xl font-extrabold">
            Shop<span className="text-violet-600">Mart</span>
          </NavLink>

          <span className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Rider UI preview · Authentication not connected
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-5">
        <Outlet />
      </main>
    </div>
  );
}
