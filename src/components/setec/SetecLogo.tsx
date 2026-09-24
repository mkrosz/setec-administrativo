import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import logoLight from "@/assets/logo-light.png.asset.json";
import logoOnix from "@/assets/logo-onix.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { resolveUrl } from "@/lib/setec";

/** Hook personalizado para carregar a URL da logo vinda do banco (tabela event_config ou configuracoes) */
function useEventLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchLogo() {
      try {
        // Aplica o `as any` no cliente `supabase` para permitir qualquer nome de tabela
        let { data } = await (supabase as any)
          .from("event_config")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (!data) {
          const res = await (supabase as any)
            .from("configuracoes")
            .select("*")
            .limit(1)
            .maybeSingle();
          data = res.data;
        }

        const rawLogo = data?.logo_url || data?.logoUrl || data?.logo;

        if (rawLogo && active) {
          const raw = Array.isArray(rawLogo) ? rawLogo[0] : rawLogo;
          const url = await resolveUrl(raw);
          if (url && active) setLogoUrl(url);
        }
      } catch (e) {
        console.error("Erro ao carregar a logo do evento:", e);
      }
    }

    fetchLogo();

    return () => {
      active = false;
    };
  }, []);

  return logoUrl;
}

/** Componente interno com suporte a onError para fazer fallback gracioso */
function CustomLogoImage({
  src,
  alt,
  className,
  fallback,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback: React.ReactNode;
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError) return <>{fallback}</>;

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className={className}
    />
  );
}

/** Marca isolada / compacto */
export function SetecMark({ className }: { className?: string }) {
  const customLogoUrl = useEventLogo();

  const defaultMark = (
    <span className={cn("relative inline-flex h-8 w-11 items-center", className)}>
      <img
        src={logoLight.url}
        alt=""
        aria-hidden="true"
        className="logo-on-dark h-full w-auto max-w-none object-contain object-left [clip-path:inset(0_64%_0_0)]"
      />
      <img
        src={logoOnix.url}
        alt=""
        aria-hidden="true"
        className="logo-on-light absolute inset-y-0 left-0 h-full w-auto max-w-none object-contain object-left [clip-path:inset(0_64%_0_0)]"
      />
    </span>
  );

  if (customLogoUrl) {
    return (
      <span className={cn("relative inline-flex h-8 w-11 items-center justify-center", className)}>
        <CustomLogoImage
          src={customLogoUrl}
          alt="Logo do evento"
          className="h-full w-auto object-contain transition-all in-[.light]:invert dark:invert-0"
          fallback={defaultMark}
        />
      </span>
    );
  }

  return defaultMark;
}

/** Logo completa exibida nas telas de Login, Redefinição de Senha, Perfil e Header */
export function SetecLogo({ className }: { className?: string }) {
  const customLogoUrl = useEventLogo();

  const defaultLogo = (
    <span className={cn("relative inline-flex items-center", className)}>
      <img
        src={logoLight.url}
        alt="Semana de Tecnologia"
        className="logo-on-dark h-11 w-auto object-contain"
      />
      <img
        src={logoOnix.url}
        alt="Semana de Tecnologia"
        className="logo-on-light absolute inset-0 h-11 w-auto object-contain"
      />
    </span>
  );

  if (customLogoUrl) {
    return (
      <span className={cn("relative inline-flex items-center justify-center", className)}>
        <CustomLogoImage
          src={customLogoUrl}
          alt="Semana de Tecnologia"
          className="h-11 w-auto max-w-50 object-contain transition-all in-[.light]:invert dark:invert-0"
          fallback={defaultLogo}
        />
      </span>
    );
  }

  return defaultLogo;
}