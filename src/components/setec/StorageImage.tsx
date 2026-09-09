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

  useEffect(() => {
    let active = true;
    resolveUrl(path).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [path]);

  if (!url) return <>{fallback ?? null}</>;
  return <img src={url} alt={alt} loading="lazy" className={cn("object-contain", className)} />;
}
