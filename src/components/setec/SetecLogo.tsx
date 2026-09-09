import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import logoLight from "@/assets/logo-light.png.asset.json";
import logoOnix from "@/assets/logo-onix.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { resolveUrl } from "@/lib/setec";

/** Hook personalizado para carregar a URL da logo vinda do banco (tabela event_config) */
function useEventLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLogo() {
      try {
        let { data } = await supabase
          .from("event_config")
          .select("logo_url")
          .limit(1)
          .maybeSingle();

        if (!data) {
          const res = await supabase
            .from("configuracoes")
            .select("logo_url")
            .limit(1)
            .maybeSingle();
          data = res.data;
        }

        if (data?.logo_url) {
          const url = await resolveUrl(data.logo_url);
          if (url) setLogoUrl(url);
        }
      } catch (e) {
        console.error("Erro ao carregar a logo do evento:", e);
      }
    }

    fetchLogo();
  }, []);

  return logoUrl;
}

/** Marca isolada / compacto (usada como marca d'água ou fallback) */
export function SetecMark({ className }: { className?: string }) {
  const customLogoUrl = useEventLogo();

  if (customLogoUrl) {
    return (
      <span className={cn("relative inline-flex h-8 w-11 items-center justify-center", className)}>
        <img
          src={customLogoUrl}
          alt="Logo do evento"
          className="h-full w-auto object-contain transition-all [.light_&]:invert dark:invert-0"
        />
      </span>
    );
  }

  return (
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
}

/** Logo completa exibida nas telas de Login, Redefinição de Senha, Perfil e Header */
export function SetecLogo({ className }: { className?: string }) {
  const customLogoUrl = useEventLogo();

  if (customLogoUrl) {
    return (
      <span className={cn("relative inline-flex items-center justify-center", className)}>
        <img
          src={customLogoUrl}
          alt="Semana de Tecnologia"
          className="h-11 w-auto max-w-[200px] object-contain transition-all [.light_&]:invert dark:invert-0"
        />
      </span>
    );
  }

  return (
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
}