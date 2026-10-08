"use client";

import { loadGeneratedImage } from "@/lib/mascot-images";
import { useEffect, useState } from "react";

export function GeneratedImage({ url, fallback, alt, className }: { url?: string | null; fallback?: string | null; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(url ?? (fallback ? `data:image/svg+xml,${encodeURIComponent(fallback)}` : null));

  useEffect(() => {
    if (!url) {
      setSrc(fallback ? `data:image/svg+xml,${encodeURIComponent(fallback)}` : null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    void loadGeneratedImage(url).then((next) => {
      if (cancelled) {
        if (next.startsWith("blob:")) URL.revokeObjectURL(next);
        return;
      }
      objectUrl = next.startsWith("blob:") ? next : null;
      setSrc(next);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, fallback]);

  if (!src) return <div className={className} />;
  // Generated artwork is a remote Flux render or an in-memory blob, not a Next image.
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} src={src} className={className} />;
}
