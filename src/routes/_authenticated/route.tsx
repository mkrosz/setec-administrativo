import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { sessaoExpirouPorFecharNavegador } from "@/lib/lembrar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // "Lembrar de mim" desmarcado e o navegador foi fechado: encerra a sessão
    if (sessaoExpirouPorFecharNavegador()) {
      await supabase.auth.signOut();
      throw redirect({ to: "/" });
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
