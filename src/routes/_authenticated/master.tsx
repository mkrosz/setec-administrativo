import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Crown, Moon, Sun } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SetecLogo } from "@/components/setec/SetecLogo";
import { MasterSection } from "@/components/setec/MasterSection";
import { useConfirmar } from "@/components/setec/ConfirmDialog";
import { useTheme } from "@/hooks/use-theme";

type Conta = { id: string; email: string; ativo: boolean; master?: boolean };

export const Route = createFileRoute("/_authenticated/master")({
  head: () => ({
    meta: [
      { title: "Área da Master | Painel SETEC" },
      {
        name: "description",
        content:
          "Histórico de alterações, pontos de restauração, congelamento do painel e transferência da conta master da Semana de Tecnologia.",
      },
      { property: "og:title", content: "Área da Master | Painel SETEC" },
      { property: "og:type", content: "website" },
    ],
  }),
  // Área da Master: só a conta master (as demais voltam para o painel)
  beforeLoad: async ({ context }) => {
    const { data } = await supabase
      .from("profiles")
      .select("master")
      .eq("id", context.user.id)
      .maybeSingle();
    if (!(data as { master?: boolean } | null)?.master) throw redirect({ to: "/painel" });
  },
  component: MasterPage,
});

function MasterPage() {
  const [dialogoConfirmar, confirmar] = useConfirmar();
  const { isLight, toggle } = useTheme();

  const contas = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Conta[];
    },
  });

  const controlePainel = useQuery({
    queryKey: ["painel_controle"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("painel_controle" as any)
        .select("congelado")
        .maybeSingle();
      if (error) return { congelado: false }; // SQL dos recursos da master ainda não rodado
      return (data ?? { congelado: false }) as unknown as { congelado: boolean };
    },
  });

  // Conta master primeiro, depois as demais em ordem alfabética
  const listaContas = [...(contas.data ?? [])].sort(
    (a, b) =>
      Number(!a.master) - Number(!b.master) ||
      a.email.localeCompare(b.email, "pt-BR", { sensitivity: "base" }),
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 pb-24 pt-8 sm:px-6 md:px-16">
      <header className="relative mx-auto flex max-w-290 flex-wrap items-center justify-between gap-4">
        <SetecLogo />
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            aria-label="Alternar tema"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {isLight ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>
          <Link
            to="/painel"
            className="flex h-10 items-center gap-2 rounded-full border border-border/70 px-5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao painel
          </Link>
        </div>
      </header>

      <div className="relative mx-auto mt-14 max-w-290">
        <h1 className="title-gradient font-display text-[clamp(1.5rem,9vw,3.75rem)] font-black uppercase leading-[0.95] tracking-[-0.01em] lg:text-[68px]">
          Área da
          <br />
          Master
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Veja quem fez o quê no painel e desfaça alterações, restaure os dados de antes de um reset
          ou importação, congele o painel durante o evento e transfira a conta master na troca de
          gestão.
        </p>

        <h2 className="mt-16 flex items-center gap-3 font-display text-xl font-bold">
          <Crown className="h-5 w-5 text-primary-glow" />
          Funções da master
        </h2>
        <MasterSection
          contas={listaContas}
          congelado={!!controlePainel.data?.congelado}
          confirmar={confirmar}
        />
      </div>

      {dialogoConfirmar}
    </main>
  );
}
