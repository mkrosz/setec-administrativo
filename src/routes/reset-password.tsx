import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { SetecLogo } from "@/components/setec/SetecLogo";
import { useForceDarkTheme } from "@/hooks/use-theme";


export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha | Painel SETEC" },
      {
        name: "description",
        content: "Defina uma nova senha para acessar o painel administrativo da Semana de Tecnologia.",
      },
      { property: "og:title", content: "Redefinir senha | Painel SETEC" },
      { property: "og:description", content: "Nova senha de acesso ao painel SETEC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  useForceDarkTheme();

  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada");
    navigate({ to: "/painel", replace: true });
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[oklch(0.09_0.01_285)] px-4">
      <div className="amethyst-glow pointer-events-none absolute left-1/2 top-1/2 h-[1100px] w-[1100px] -translate-x-1/2 -translate-y-1/2" />
      <section className="relative w-full max-w-[386px] rounded-2xl bg-card p-8">
        <div className="flex justify-center">
          <SetecLogo />
        </div>
        <h1 className="mt-7 text-center font-display text-2xl font-medium tracking-[0.02em]">
          NOVA SENHA
        </h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
            <input
              type="password"
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Nova senha"
              className="field-pill h-12 w-full pl-12 pr-4 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar nova senha"}
          </button>
        </form>
      </section>
    </main>
  );
}
