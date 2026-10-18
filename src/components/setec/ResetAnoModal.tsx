import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  Download,
  GraduationCap,
  Handshake,
  Loader2,
  Mic,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  apagarDadosDoAno,
  criarPontoRestauracao,
  exportarJSON,
  exportarPDF,
  registrarAtividade,
} from "@/lib/backup";
import { mensagemErro } from "@/lib/setec";

const PALAVRA = "RESETAR";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

/** Conta as linhas de uma tabela; tabela inexistente (SQL não rodado) conta como 0. */
async function contar(tabela: string) {
  const { count, error } = await supabase.from(tabela as any).select("id", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}

/** Reset do ano: mostra o que será apagado e oferece backup (PDF + JSON) antes de apagar. */
export function ResetAnoModal({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [confirmacao, setConfirmacao] = useState("");
  const [etapa, setEtapa] = useState<null | "backup" | "apagando">(null);
  const [comBackupAtivo, setComBackupAtivo] = useState(false);

  useEffect(() => {
    if (open) setConfirmacao("");
  }, [open]);

  const totais = useQuery({
    queryKey: ["reset-ano-totais"],
    enabled: open,
    staleTime: 0,
    queryFn: async () => {
      const [palestras, presencas, minicursos, inscricoes, apoiadores, comissao] = await Promise.all([
        contar("palestras"),
        contar("presencas"),
        contar("minicursos"),
        contar("minicurso_inscricoes"),
        contar("patrocinadores"),
        contar("comissao"),
      ]);
      return { palestras, presencas, minicursos, inscricoes, apoiadores, comissao };
    },
  });

  const t = totais.data;
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  const itens = [
    {
      icone: Mic,
      titulo: "Palestras",
      total: t?.palestras,
      detalhe: t ? `com ${plural(t.presencas, "presença", "presenças")} e QR Codes` : "com presenças e QR Codes",
    },
    {
      icone: GraduationCap,
      titulo: "Minicursos",
      total: t?.minicursos,
      detalhe: t ? `com ${plural(t.inscricoes, "inscrição", "inscrições")}` : "com inscrições",
    },
    { icone: Handshake, titulo: "Apoiadores", total: t?.apoiadores, detalhe: "" },
    { icone: Users, titulo: "Comissão", total: t?.comissao, detalhe: "" },
  ];

  const liberado = confirmacao.trim().toUpperCase() === PALAVRA;
  const ocupado = etapa !== null;

  async function resetar(comBackup: boolean) {
    if (!liberado || ocupado) return;
    setComBackupAtivo(comBackup);
    let fase: "backup" | "apagando" = "backup";
    try {
      if (comBackup) {
        setEtapa("backup");
        await exportarPDF();
        await exportarJSON();
      }
      fase = "apagando";
      setEtapa("apagando");
      // Cópia automática que a conta master pode restaurar depois
      await criarPontoRestauracao("Antes do reset dos dados do ano");
      // Presenças/QR Codes e inscrições saem junto (ON DELETE CASCADE)
      await apagarDadosDoAno();
      await registrarAtividade("resetou", "Dados do ano");
      queryClient.invalidateQueries();
      toast.success("Dados do ano resetados", {
        description: comBackup ? "O PDF e o JSON do backup foram baixados." : undefined,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(
        fase === "backup"
          ? `Backup não concluído — nada foi apagado. ${mensagemErro(err)}`
          : mensagemErro(err, "Erro ao resetar os dados"),
      );
      queryClient.invalidateQueries();
    } finally {
      setEtapa(null);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !ocupado && onOpenChange(v)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[min(480px,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[26px] border border-border/60 bg-card p-7 shadow-[0_40px_90px_-20px_rgba(0,0,0,0.85)]">
          <Dialog.Close
            disabled={ocupado}
            aria-label="Fechar"
            className="absolute right-5 top-5 rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>

          <AlertTriangle className="h-6 w-6 text-destructive" />
          <Dialog.Title className="mt-3 font-display text-xl font-bold text-foreground">Resetar dados do ano</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Isto apaga permanentemente:
          </Dialog.Description>

          {/* O que será apagado */}
          <ul className="mt-4 divide-y divide-border/40 border-y border-border/40">
            {itens.map((it) => (
              <li key={it.titulo} className="flex items-center gap-3 py-2.5">
                <it.icone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm text-foreground">{it.titulo}</span>
                {it.detalhe && <span className="truncate text-xs text-muted-foreground">{it.detalhe}</span>}
                <span className="ml-auto font-display text-sm font-semibold tabular-nums text-destructive">
                  {totais.isLoading ? "…" : (it.total ?? 0)}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Continuam salvos: informações do evento, turmas da presença e contas de acesso. As fotos e logos
            ficam guardadas e são apagadas automaticamente após 12 meses sem uso.
          </p>

          {/* Confirmação digitada */}
          <div className="relative mt-5">
            <input
              id="reset-confirmacao"
              aria-label={`Digite ${PALAVRA} para confirmar`}
              autoComplete="off"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              disabled={ocupado}
              placeholder={`Digite ${PALAVRA} para confirmar`}
              className={`field-pill h-10 w-full px-5 text-sm placeholder:normal-case placeholder:tracking-normal ${
                confirmacao ? "font-mono uppercase tracking-[0.2em]" : ""
              } ${liberado ? "border-destructive/60" : ""}`}
            />
            {liberado && (
              <Check className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-destructive" />
            )}
          </div>

          {/* Ações */}
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => resetar(true)}
              disabled={!liberado || ocupado}
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-glow disabled:cursor-not-allowed disabled:opacity-40"
            >
              {ocupado && comBackupAtivo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {ocupado && comBackupAtivo
                ? etapa === "backup"
                  ? "Baixando backup..."
                  : "Apagando..."
                : "Baixar backup e apagar"}
            </button>
            <div className="flex items-center justify-between">
              <Dialog.Close
                disabled={ocupado}
                className="h-9 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                Cancelar
              </Dialog.Close>
              <button
                type="button"
                onClick={() => resetar(false)}
                disabled={!liberado || ocupado}
                className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {ocupado && !comBackupAtivo ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {ocupado && !comBackupAtivo ? "Apagando..." : "Apagar sem backup"}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
