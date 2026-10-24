import { useEffect, useRef, useState } from "react";
import { useSession } from "../auth/useSession";
import {
  getAdminProductImages,
  uploadProductImages,
  setPrimaryProductImage,
  deleteProductImage,
} from "../../api/productImages";

export default function ProductImages({
  productId,
  disabled = false,
  onBusyChange,
}) {
  const { session } = useSession();
  const token = session?.accessToken;

  const [result, setResult] = useState(null);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const inputRef = useRef(null);
  const previewUrls = useRef([]);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    getAdminProductImages(token, productId, controller.signal)
      .then((images) => {
        if (!controller.signal.aborted) {
          setResult({ token, productId, reload, images, error: "" });
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) {
          setResult({
            token,
            productId,
            reload,
            images: [],
            error: failure.message,
          });
        }
      });

    return () => controller.abort();
  }, [token, productId, reload]);

  useEffect(() => {
    return () => {
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const current =
    result?.token === token &&
    result?.productId === productId &&
    result?.reload === reload;

  const loading = !current;
  const images = current ? result.images : [];
  const loadError = current ? result.error : "";
  const locked = disabled || Boolean(busy) || loading;

  function clearSelection() {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current = [];
    setSelected([]);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function chooseFiles(event) {
    const files = Array.from(event.target.files ?? []);

    clearSelection();
    setError("");
    setFeedback("");

    if (!files.length) return;

    if (images.length + files.length > 6) {
      setError(`You can add ${Math.max(0, 6 - images.length)} more photo(s).`);
      return;
    }

    if (
      files.some(
        (file) =>
          !["image/jpeg", "image/png"].includes(file.type) ||
          file.size === 0 ||
          file.size > 5 * 1024 * 1024,
      )
    ) {
      setError("Select JPEG or PNG photos, each 5 MB or less.");
      return;
    }

    const previews = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));

    previewUrls.current = previews.map((item) => item.url);
    setSelected(previews);
  }

  async function mutate(key, request, message) {
    if (inFlight.current || disabled) return;

    inFlight.current = true;
    setBusy(key);
    setError("");
    setFeedback("");
    onBusyChange?.(true);

    try {
      const updated = await request();

      setResult({
        token,
        productId,
        reload,
        images: updated,
        error: "",
      });

      if (key === "upload") clearSelection();

      setFeedback(message);
    } catch (failure) {
      setError(failure.message);
    } finally {
      inFlight.current = false;
      setBusy("");
      onBusyChange?.(false);
    }
  }

  function remove(image) {
    if (
      inFlight.current ||
      disabled ||
      !window.confirm("Delete this product photo?")
    ) {
      return;
    }

    mutate(
      `delete:${image.id}`,
      () => deleteProductImage(token, productId, image.id),
      "Photo deleted.",
    );
  }

  return (
    <section
      className="mt-6 border-0 border-t border-solid border-slate-200 pt-5"
      aria-busy={loading || Boolean(busy)}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 text-lg font-bold">Product photos</h3>

        <span className="text-xs text-slate-500">
          {loading ? "Loading…" : `${images.length} / 6`}
        </span>
      </div>

      <p className="mb-4 mt-2 text-xs leading-5 text-slate-500">
        Photos save immediately. The main photo appears first. JPEG/PNG, up to 5
        MB each.
      </p>

      {loading ? (
        <p role="status" className="text-sm text-slate-500">
          Loading photos…
        </p>
      ) : loadError ? (
        <div>
          <p role="alert" className="text-sm text-rose-700">
            {loadError}
          </p>
          <button
            type="button"
            disabled={disabled || Boolean(busy)}
            onClick={() => setReload((value) => value + 1)}
            className="rounded-xl border-0 bg-violet-50 px-4 py-2 text-sm text-violet-700"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {images.length > 0 && (
            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0">
              {images.map((image, index) => (
                <li
                  key={image.id}
                  className="overflow-hidden rounded-xl border border-solid border-slate-200 p-2"
                >
                  <img
                    src={image.url}
                    alt={`Product photo ${index + 1}`}
                    width={160}
                    height={160}
                    className="h-28 w-full rounded-lg bg-white object-contain"
                  />

                  <div className="mt-2 grid gap-2">
                    {index === 0 ? (
                      <span className="rounded-lg bg-violet-50 px-2 py-2 text-center text-xs font-semibold text-violet-700">
                        Main photo
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() =>
                          mutate(
                            `primary:${image.id}`,
                            () =>
                              setPrimaryProductImage(
                                token,
                                productId,
                                image.id,
                              ),
                            "Main photo updated.",
                          )
                        }
                        className="rounded-lg border-0 bg-violet-50 px-2 py-2 text-xs font-semibold text-violet-700 disabled:opacity-50"
                      >
                        Make main
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => remove(image)}
                      className="rounded-lg border-0 bg-rose-50 px-2 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {images.length === 0 && (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              No photos uploaded yet.
            </p>
          )}

          {images.length < 6 && (
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-semibold">
                Choose photos
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  multiple
                  disabled={locked}
                  onChange={chooseFiles}
                  className="box-border w-full rounded-xl border border-solid border-slate-200 p-3 text-xs"
                />
              </label>

              {selected.length > 0 && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {selected.map((item) => (
                      <img
                        key={item.url}
                        src={item.url}
                        alt={`Selected: ${item.file.name}`}
                        className="h-20 w-full rounded-lg bg-white object-contain"
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      mutate(
                        "upload",
                        () =>
                          uploadProductImages(
                            token,
                            productId,
                            selected.map((item) => item.file),
                          ),
                        "Photos uploaded.",
                      )
                    }
                    className="rounded-xl border-0 bg-violet-600 p-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {busy === "upload"
                      ? "Uploading…"
                      : `Upload ${selected.length} photo(s)`}
                  </button>

                  <button
                    type="button"
                    disabled={locked}
                    onClick={clearSelection}
                    className="rounded-xl border-0 bg-slate-100 p-2 text-sm text-slate-600 disabled:opacity-50"
                  >
                    Clear selection
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      {busy && (
        <p role="status" className="text-sm text-slate-500">
          Updating photos…
        </p>
      )}
      {feedback && (
        <p role="status" className="mb-0 text-sm text-emerald-700">
          {feedback}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-0 text-sm text-rose-700">
          {error}
        </p>
      )}
    </section>
  );
}
