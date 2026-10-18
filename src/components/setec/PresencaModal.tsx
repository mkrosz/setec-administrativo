import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, GraduationCap, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { obterPosicao, type Posicao } from "@/lib/geo";
import { TURMA_NA, mensagemErro, type Palestra } from "@/lib/setec";

const label = "block text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground";
const pill = "field-pill h-10 w-full px-4 text-sm";

type EstadoLocal =
  | { status: "buscando" }
  | { status: "ok"; posicao: Posicao }
  | { status: "erro"; mensagem: string };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  palestra: Palestra | null;
  turmas: string[];
  onSaved: () => void;
};

/** Inclusão manual de um aluno; registra a localização de quem está adicionando. */
export function PresencaModal({ open, onOpenChange, palestra, turmas, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [ra, setRa] = useState("");
  const [turma, setTurma] = useState("");
  const [local, setLocal] = useState<EstadoLocal>({ status: "buscando" });

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
    if (!open) return;
    setNome("");
    setRa("");
    buscarLocal();
  }, [open, buscarLocal]);

  async function save(keepOpen: boolean) {
    if (!palestra) return;
    const nomeLimpo = nome.trim().replace(/\s+/g, " ");
    if (nomeLimpo.length < 3 || !nomeLimpo.includes(" ")) {
      toast.error("Informe o nome completo do aluno");
      return;
    }
    if (!/^\d{5,20}$/.test(ra)) {
      toast.error("RA inválido. Use apenas números.");
      return;
    }
    if (!turma) {
      toast.error("Selecione a turma do aluno");
      return;
    }

    setSaving(true);
    try {
      const posicao = local.status === "ok" ? local.posicao : null;
      const { error } = await supabase.from("presencas" as any).insert({
        palestra_id: palestra.id,
        nome_completo: nomeLimpo,
        ra,
        ano_turma: turma,
        origem: "manual",
        latitude: posicao?.latitude ?? null,
        longitude: posicao?.longitude ?? null,
        precisao_m: posicao?.precisao ?? null,
      } as any);
      if (error) {
        if (error.code === "23505") throw new Error("Este RA já está na lista desta palestra");
        throw error;
      }

      toast.success("Aluno adicionado à lista");
      onSaved();
      if (keepOpen) {
        setNome("");
        setRa("");
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      toast.error(mensagemErro(err, "Erro ao adicionar aluno"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(520px,94vw)] -translate-x-1/2 -translate-y-1/2 rounded-[26px] border border-border/60 bg-card shadow-[0_40px_90px_-20px_rgba(0,0,0,0.85)]">
          <div className="px-7 pb-4 pt-5">
            <Dialog.Title className="font-display text-2xl font-bold text-foreground">
              Adicionar aluno
            </Dialog.Title>
            <Dialog.Description className="mt-1 truncate text-sm text-muted-foreground">
              {palestra?.titulo ?? "Palestra"}
            </Dialog.Description>
          </div>
          <div className="border-t border-border/60" />

          <form
            id="presenca-form"
            onSubmit={(e) => {
              e.preventDefault();
              save(false);
            }}
            className="space-y-4 px-7 py-5"
          >
            <div className="space-y-1.5">
              <span className={label}>Nome completo</span>
              <input
                autoFocus
                required
                maxLength={160}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome e sobrenome"
                className={pill}
              />
            </div>

            <div className="space-y-1.5">
              <span className={label}>RA</span>
              <input
                required
                inputMode="numeric"
                maxLength={20}
                value={ra}
                onChange={(e) => setRa(e.target.value.replace(/\D/g, ""))}
                placeholder="0031432512022"
                className={pill}
              />
            </div>

            <div className="space-y-1.5">
              <span className={label}>Turma</span>
              <TurmaSelect turmas={turmas} value={turma} onChange={setTurma} />
            </div>

            <LocalStatus estado={local} onRetry={buscarLocal} />
          </form>

          <div className="border-t border-border/60" />
          <div className="flex flex-wrap items-center justify-end gap-4 px-7 py-4">
            <Dialog.Close className="text-sm font-medium text-foreground/90 transition-opacity hover:opacity-70">
              Cancelar
            </Dialog.Close>
            <button
              type="button"
              onClick={() => save(true)}
              disabled={saving}
              className="flex h-11 items-center justify-center rounded-full border border-border/70 px-6 text-sm font-medium text-foreground transition-colors hover:border-primary/60 disabled:opacity-60"
            >
              Salvar e adicionar outro
            </button>
            <button
              type="submit"
              form="presenca-form"
              disabled={saving}
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Pílula única para escolher a turma; "N/A" está sempre disponível. */
export function TurmaSelect({
  turmas,
  value,
  onChange,
  size = "md",
}: {
  turmas: string[];
  value: string;
  onChange: (v: string) => void;
  size?: "md" | "lg";
}) {
  const opcoes = turmas.filter((t) => t !== TURMA_NA);
  return (
    <div className="relative">
      <GraduationCap
        className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground ${
          size === "lg" ? "h-4.5 w-4.5" : "h-4 w-4"
        }`}
      />
      <select
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`field-pill w-full appearance-none pr-11 text-sm ${
          size === "lg" ? "h-12 pl-12" : "h-10 pl-11"
        } ${value ? "text-foreground" : "text-muted-foreground"}`}
      >
        <option value="" disabled>
          Selecione a turma
        </option>
        {opcoes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
        <option value={TURMA_NA}>N/A — não se aplica</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export function LocalStatus({ estado, onRetry }: { estado: EstadoLocal; onRetry: () => void }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-xs ${
        estado.status === "erro"
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : "border-border/60 bg-field/40 text-muted-foreground"
      }`}
    >
      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">
        {estado.status === "buscando" && "Obtendo a localização…"}
        {estado.status === "ok" &&
          `Localização obtida (precisão de ±${Math.round(estado.posicao.precisao)} m).`}
        {estado.status === "erro" && estado.mensagem}
      </span>
      {estado.status === "erro" && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 font-semibold underline-offset-2 hover:underline"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export type { EstadoLocal };
