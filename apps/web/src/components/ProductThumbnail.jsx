import { useState } from "react";
import { Package } from "lucide-react";

export default function ProductThumbnail({ product }) {
  const [failedImages, setFailedImages] = useState([]);

  const images = Array.isArray(product?.images) ? product.images : [];

  const urls = [
    ...new Set(
      [product?.imageUrl, ...images.map((image) => image.url)].filter(Boolean),
    ),
  ];

  const src = urls.find((url) => !failedImages.includes(url));
  const name = product?.name ?? "Product";

  return (
    <div
      role={src ? undefined : "img"}
      aria-label={src ? undefined : `No photo available for ${name}`}
      className="box-border grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-solid border-slate-200 bg-white p-1.5 sm:size-20"
    >
      {src ? (
        <img
          key={src}
          src={src}
          alt={name}
          width={80}
          height={80}
          loading="lazy"
          decoding="async"
          onError={() =>
            setFailedImages((current) =>
              current.includes(src) ? current : [...current, src],
            )
          }
          className="h-full w-full object-contain"
        />
      ) : (
        <Package
          size={28}
          strokeWidth={1.5}
          aria-hidden="true"
          className="text-slate-400"
        />
      )}
    </div>
  );
}
