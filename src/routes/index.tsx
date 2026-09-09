import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { SetecLogo } from "@/components/setec/SetecLogo";
import { useForceDarkTheme } from "@/hooks/use-theme";
import { solicitarAcesso } from "@/lib/access.functions";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Acesso Restrito | Painel SETEC" },
      {
        name: "description",
        content:
          "Área restrita da Semana de Tecnologia: entre no painel de controle para gerenciar palestras, apoiadores e informações da edição.",
      },
      { property: "og:title", content: "Acesso Restrito | Painel SETEC" },
      {
        property: "og:description",
        content: "Painel de controle da Semana de Tecnologia (SETEC).",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const pedirAcesso = useServerFn(solicitarAcesso);
  useForceDarkTheme();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const res = await pedirAcesso({ data: { email, password: senha } });
        if (res?.autoAprovado) {
          const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
          if (error) throw error;
          toast.success("Conta criada como administrador do sistema.");
          navigate({ to: "/painel", replace: true });
          return;
        }
        toast.success(
          "Solicitação enviada. Um administrador precisa liberar seu acesso antes do primeiro login.",
        );
        setMode("login");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;

      const { data: userData } = await supabase.auth.getUser();
      const { data: perfil } = await supabase
        .from("profiles")
        .select("ativo")
        .eq("id", userData.user?.id ?? "")
        .maybeSingle();

      if (!perfil?.ativo) {
        await supabase.auth.signOut();
        toast.error("Seu acesso ainda não foi liberado por um administrador.");
        return;
      }
      navigate({ to: "/painel", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível entrar");
    } finally {
      setLoading(false);
    }
  }


  async function onForgot() {
    if (!email) {
      toast.error("Informe o e-mail corporativo primeiro");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Enviamos um link de redefinição para o seu e-mail");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[oklch(0.09_0.01_285)] px-4">
      <div className="amethyst-glow pointer-events-none absolute left-1/2 top-1/2 h-[1100px] w-[1100px] -translate-x-1/2 -translate-y-1/2" />
      <section className="relative w-full max-w-[386px] rounded-2xl bg-card p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex justify-center">
          <SetecLogo />
        </div>

        <h1 className="mt-7 text-center font-display text-2xl font-medium tracking-[0.02em] text-foreground">
          ACESSO RESTRITO
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Painel de Controle <span className="mx-1">▪</span> SETEC
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail corporativo"
              className="field-pill h-12 w-full pl-12 pr-4 text-sm"
            />
          </div>

          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
            <input
              type={show ? "text" : "password"}
              required
              minLength={6}
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha"
              className="field-pill h-12 w-full pl-12 pr-12 text-sm"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {show ? <Eye className="h-[18px] w-[18px]" /> : <EyeOff className="h-[18px] w-[18px]" />}
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 text-sm">
            <label className="flex cursor-pointer items-center gap-2 text-foreground/90">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 appearance-none rounded-[3px] border border-border bg-transparent checked:border-primary checked:bg-primary"
              />
              Lembrar de mim
            </label>
            <button
              type="button"
              onClick={onForgot}
              className="text-primary-glow transition-opacity hover:opacity-80"
            >
              Esqueceu a senha?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {mode === "login" ? "Entrar no Painel Administrativo" : "Solicitar acesso"}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
          className="mt-4 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {mode === "login" ? "Primeiro acesso? Solicitar liberação" : "Já tenho acesso — entrar"}
        </button>
      </section>
    </main>
  );
}
