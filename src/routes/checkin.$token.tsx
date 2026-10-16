import React, { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CircleCheck, CircleX, Clock, Hash, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { SetecLogo } from "@/components/setec/SetecLogo";
import { LocalStatus, TurmaSelect, type EstadoLocal } from "@/components/setec/PresencaModal";
import { useForceDarkTheme } from "@/hooks/use-theme";
import { obterPosicao } from "@/lib/geo";
import { compararTurmas, formatDia, formatHora, mensagemErro } from "@/lib/setec";

export const Route = createFileRoute("/checkin/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Confirmar Presença | SETEC" },
      {
        name: "description",
        content: "Confirme sua presença na palestra da Semana de Tecnologia (SETEC).",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckinPage,
});

type QrInfo = {
  titulo: string;
  palestrante: string;
  data: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  local: string | null;
  expira_em: string;
  ativo: boolean;
  agora: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const label = "block text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground";

function CheckinPage() {
  const { token } = Route.useParams();
  useForceDarkTheme();
  const chaveEnviado = `setec-presenca-${token}`;

  const info = useQuery({
    queryKey: ["checkin", token],
    retry: false,
    queryFn: async () => {
      if (!UUID.test(token)) return null;
      const { data, error } = await supabase.rpc(
        "presenca_qrcode_info" as any,
        {
          _token: token,
        } as any,
      );
      if (error) throw error;
      const linha = ((data ?? []) as unknown as QrInfo[])[0] ?? null;
      // Diferença entre o relógio do servidor e o do celular, para o cronômetro
      return linha ? { ...linha, offset: Date.parse(linha.agora) - Date.now() } : null;
    },
  });

  const turmas = useQuery({
    queryKey: ["checkin_turmas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("presenca_turmas" as any).select("nome");
      if (error) throw error;
      return ((data ?? []) as unknown as { nome: string }[])
        .map((t) => t.nome)
        .sort(compararTurmas);
    },
  });

  const [nome, setNome] = useState("");
  const [ra, setRa] = useState("");
  const [turma, setTurma] = useState("");
  const [local, setLocal] = useState<EstadoLocal>({ status: "buscando" });
  const [enviando, setEnviando] = useState(false);
  const [enviadoEm, setEnviadoEm] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(chaveEnviado);
    } catch {
      return null;
    }
  });
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const buscarLocal = useCallback(async () => {
    setLocal({ status: "buscando" });
    try {
      const posicao = await obterPosicao();
      setLocal({ status: "ok", posicao });
      return posicao;
    } catch (err) {
      setLocal({ status: "erro", mensagem: mensagemErro(err) });
      return null;
    }
  }, []);

  useEffect(() => {
    if (!enviadoEm) buscarLocal();
  }, [buscarLocal, enviadoEm]);

  const restante = info.data ? Date.parse(info.data.expira_em) - (agora + info.data.offset) : 0;
  const expirado = !!info.data && (!info.data.ativo || restante <= 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nomeLimpo = nome.trim().replace(/\s+/g, " ");
    if (nomeLimpo.length < 3 || !nomeLimpo.includes(" ")) {
      toast.error("Informe seu nome completo (nome e sobrenome).");
      return;
    }
    if (!/^\d{5,20}$/.test(ra)) {
      toast.error("Informe seu RA usando apenas números.");
      return;
    }
    if (!turma) {
      toast.error("Selecione a sua turma (ou N/A).");
      return;
    }

    setEnviando(true);
    try {
      const posicao = local.status === "ok" ? local.posicao : await buscarLocal();
      if (!posicao) throw new Error("Precisamos da sua localização para confirmar a presença.");

      const { data, error } = await supabase.rpc(
        "registrar_presenca" as any,
        {
          _token: token,
          _nome: nomeLimpo,
          _ra: ra,
          _ano: turma,
          _latitude: posicao.latitude,
          _longitude: posicao.longitude,
          _precisao: posicao.precisao,
        } as any,
      );
      if (error) throw error;

      const quando = typeof data === "string" ? data : new Date().toISOString();
      try {
        window.localStorage.setItem(chaveEnviado, quando);
      } catch {
        // sem armazenamento local: segue normalmente
      }
      setEnviadoEm(quando);
    } catch (err) {
      toast.error(mensagemErro(err, "Não foi possível registrar a presença."));
    } finally {
      setEnviando(false);
    }
  }

  const p = info.data;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[oklch(0.09_0.01_285)] px-4 py-10">
      <div className="amethyst-glow pointer-events-none absolute left-1/2 top-1/2 h-275 w-275 -translate-x-1/2 -translate-y-1/2" />
      <section className="relative w-full max-w-105 rounded-2xl bg-card p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex justify-center">
          <SetecLogo />
        </div>

        {info.isLoading ? (
          <p className="mt-10 flex items-center justify-center gap-2 pb-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando palestra…
          </p>
        ) : info.error ? (
          <Aviso
            icone={<CircleX className="h-10 w-10 text-destructive" />}
            titulo="Falha ao carregar"
            texto="Não foi possível carregar a palestra. Verifique sua conexão e recarregue a página."
          />
        ) : !p ? (
          <Aviso
            icone={<CircleX className="h-10 w-10 text-destructive" />}
            titulo="QR Code inválido"
            texto="Este link de presença não existe. Escaneie novamente o QR Code exibido na palestra."
          />
        ) : enviadoEm ? (
          <Aviso
            icone={<CircleCheck className="h-10 w-10 text-emerald-500" />}
            titulo="Presença confirmada!"
            texto={`Sua presença em "${p.titulo}" foi registrada às ${new Date(enviadoEm).toLocaleTimeString("pt-BR")}.`}
          />
        ) : (
          <>
            <h1 className="mt-7 text-center font-display text-2xl font-medium tracking-[0.02em] text-foreground">
              CONFIRMAR PRESENÇA
            </h1>
            <div className="mt-4 rounded-2xl border border-border/60 bg-field/60 px-5 py-4">
              <p className="text-[15px] font-medium leading-snug text-foreground">{p.titulo}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {[
                  p.palestrante,
                  p.data && formatDia(p.data),
                  p.hora_inicio &&
                    p.hora_fim &&
                    `${formatHora(p.hora_inicio)} - ${formatHora(p.hora_fim)}`,
                  p.local,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </p>
            </div>

            {expirado ? (
              <Aviso
                icone={<Clock className="h-10 w-10 text-amber-500" />}
                titulo="QR Code expirado"
                texto="O tempo para confirmar presença por este QR Code acabou. Procure a organização da palestra."
              />
            ) : (
              <form onSubmit={onSubmit} className="mt-5 space-y-4">
                <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Disponível por mais{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {Math.floor(restante / 60000)}:
                    {String(Math.floor((restante % 60000) / 1000)).padStart(2, "0")}
                  </span>
                </p>

                <div className="space-y-1.5">
                  <span className={label}>Nome completo *</span>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      required
                      autoComplete="name"
                      maxLength={160}
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Nome e sobrenome"
                      className="field-pill h-12 w-full pl-12 pr-4 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className={label}>RA *</span>
                  <div className="relative">
                    <Hash className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      required
                      inputMode="numeric"
                      maxLength={20}
                      value={ra}
                      onChange={(e) => setRa(e.target.value.replace(/\D/g, ""))}
                      placeholder="Ex.: 0031432512022"
                      className="field-pill h-12 w-full pl-12 pr-4 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className={label}>Turma *</span>
                  <TurmaSelect
                    turmas={turmas.data ?? []}
                    value={turma}
                    onChange={setTurma}
                    size="lg"
                  />
                </div>

                <LocalStatus estado={local} onRetry={buscarLocal} />

                <button
                  type="submit"
                  disabled={enviando}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-60"
                >
                  {enviando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Confirmar presença
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
                <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                  O horário de envio e a sua localização serão registrados junto com a presença.
                </p>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function Aviso({
  icone,
  titulo,
  texto,
}: {
  icone: React.ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="mt-8 flex flex-col items-center pb-2 text-center">
      {icone}
      <h2 className="mt-4 font-display text-xl font-bold text-foreground">{titulo}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{texto}</p>
    </div>
  );
}
