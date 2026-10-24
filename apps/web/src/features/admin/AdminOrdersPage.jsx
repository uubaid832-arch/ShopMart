import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useSession } from "../auth/useSession";
import { getAdminOrder, getAdminOrders } from "../../api/adminOrders";
import AdminOrders from "./AdminOrders";
import AdminOrderDetails from "./AdminOrderDetails";
import AdminManageOrder from "./AdminManageOrder";

const buttonStyle =
  "rounded-xl border-0 bg-violet-100 px-3 py-2 text-sm font-semibold text-violet-700 enabled:hover:bg-violet-200 disabled:opacity-40";

export default function AdminOrdersPage() {
  const { session } = useSession();
  const accessToken = session.accessToken;
  const [searchParams, setSearchParams] = useSearchParams();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detailResult, setDetailResult] = useState(null);

  const managingId = searchParams.get("manage");

  useEffect(() => {
    const controller = new AbortController();

    getAdminOrders(accessToken, page, controller.signal, pageSize)
      .then((data) => {
        if (controller.signal.aborted) return;

        const lastPage = Math.max(0, data.totalPages - 1);

        if (page > lastPage) {
          setPage(lastPage);
          return;
        }

        setResult({
          token: accessToken,
          page,
          pageSize,
          reload,
          data,
          error: "",
        });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({
            token: accessToken,
            page,
            pageSize,
            reload,
            data: null,
            error: error.message,
          });
        }
      });

    return () => controller.abort();
  }, [accessToken, page, pageSize, reload]);

  useEffect(() => {
    if (!selectedId) return;

    const controller = new AbortController();

    getAdminOrder(accessToken, selectedId, controller.signal)
      .then((order) => {
        if (!controller.signal.aborted) {
          setDetailResult({
            token: accessToken,
            id: selectedId,
            order,
            error: "",
          });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setDetailResult({
            token: accessToken,
            id: selectedId,
            order: null,
            error: error.message,
          });
        }
      });

    return () => controller.abort();
  }, [accessToken, selectedId]);

  const current =
    result?.token === accessToken &&
    result?.page === page &&
    result?.pageSize === pageSize &&
    result?.reload === reload;

  const loading = !current;
  const data = current ? result.data : null;
  const error = current ? result.error : "";

  const detailCurrent =
    detailResult?.token === accessToken && detailResult?.id === selectedId;

  const totalPages = data?.totalPages ?? 0;
  const totalItems = data?.totalItems ?? 0;
  const firstItem = totalItems > 0 ? page * pageSize + 1 : 0;
  const lastItem =
    totalItems > 0
      ? Math.min(page * pageSize + data.items.length, totalItems)
      : 0;

  const firstPageButton = Math.max(0, Math.min(page - 2, totalPages - 5));

  const pageNumbers = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => firstPageButton + index,
  );

  function openManage(order) {
    setSelectedId(null);

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("manage", order.id);
      return next;
    });
  }

  function closeManage() {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("manage");
        return next;
      },
      { replace: true },
    );

    setReload((current) => current + 1);
  }

  return (
    <div className="grid gap-4">
      <AdminOrders
        orders={data?.items ?? []}
        loading={loading}
        error={error}
        onView={(order) => setSelectedId(order.id)}
        onManage={openManage}
      />

      <section
        aria-label="Order pagination"
        aria-busy={loading}
        className="grid gap-4 rounded-2xl border border-solid border-slate-200 bg-white p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="m-0 text-sm text-slate-500">
            {loading
              ? "Loading orders…"
              : error
                ? "Order count unavailable."
                : `Showing ${firstItem}–${lastItem} of ${totalItems} orders`}
          </p>

          <label className="flex items-center gap-2 text-sm text-slate-500">
            Orders per page
            <select
              value={pageSize}
              disabled={loading}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(0);
              }}
              className="rounded-lg border border-solid border-slate-200 bg-white px-3 py-2 text-slate-800 disabled:opacity-50"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        <nav
          aria-label="Order pages"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <button
            type="button"
            disabled={loading || !data || page === 0}
            onClick={() => setPage((current) => current - 1)}
            className={buttonStyle}
          >
            ← Previous
          </button>

          <div className="flex flex-wrap items-center justify-center gap-1">
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                disabled={loading}
                aria-label={`Page ${pageNumber + 1}`}
                aria-current={page === pageNumber ? "page" : undefined}
                onClick={() => setPage(pageNumber)}
                className={`grid size-9 place-items-center rounded-lg border-0 text-sm font-semibold ${
                  page === pageNumber
                    ? "bg-violet-600 text-white"
                    : "bg-slate-100 text-slate-600 enabled:hover:bg-violet-100"
                }`}
              >
                {pageNumber + 1}
              </button>
            ))}

            {data && totalPages === 0 && (
              <span className="text-xs text-slate-500">No orders</span>
            )}
          </div>

          <button
            type="button"
            disabled={loading || !data || page + 1 >= totalPages}
            onClick={() => setPage((current) => current + 1)}
            className={buttonStyle}
          >
            Next →
          </button>
        </nav>
      </section>

      {selectedId &&
        !managingId &&
        (!detailCurrent ? (
          <p role="status" className="text-sm text-slate-500">
            Loading order details…
          </p>
        ) : detailResult.error ? (
          <p role="alert" className="text-sm text-rose-700">
            {detailResult.error}
          </p>
        ) : (
          <AdminOrderDetails
            order={detailResult.order}
            onClose={() => {
              setSelectedId(null);
              setDetailResult(null);
            }}
          />
        ))}

      {managingId && (
        <AdminManageOrder
          key={managingId}
          id={managingId}
          onClose={closeManage}
        />
      )}
    </div>
  );
}
