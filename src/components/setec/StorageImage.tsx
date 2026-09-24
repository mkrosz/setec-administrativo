import { useEffect, useState } from "react";
import { resolveUrl } from "@/lib/setec";
import { cn } from "@/lib/utils";

export function StorageImage({
  path,
  alt,
  className,
  fallback,
}: {
  path: string | null;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    setHasError(false);

    if (path) {
      resolveUrl(path).then((u) => {
        if (active) setUrl(u);
      });
    } else {
      setUrl(null);
    }

    return () => {
      active = false;
    };
  }, [path]);

  if (!url || hasError) return <>{fallback ?? null}</>;

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setHasError(true)}
      className={cn("object-contain", className)}
    />
  );
}