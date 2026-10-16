import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { CirclePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { TURMA_NA, mensagemErro, type Turma } from "@/lib/setec";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  turmas: Turma[];
  onSaved: () => void;
};

/** Cadastro das turmas que o aluno pode escolher ao confirmar presença. */
export function TurmasModal({ open, onOpenChange, turmas, onSaved }: Props) {
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const limpo = nome.trim().replace(/\s+/g, " ");
    if (!limpo) return;
    if (limpo.toUpperCase() === TURMA_NA) {
      toast.error("N/A já aparece sempre para os alunos");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("presenca_turmas" as any).insert({ nome: limpo } as any);
    setSaving(false);
    if (error) {
      toast.error(error.code === "23505" ? "Essa turma já existe" : mensagemErro(error));
      return;
    }
    setNome("");
    onSaved();
  }

  async function remover(t: Turma) {
    const { error } = await supabase
      .from("presenca_turmas" as any)
      .delete()
      .eq("id", t.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onSaved();
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,94vw)] -translate-x-1/2 -translate-y-1/2 rounded-[26px] border border-border/60 bg-card shadow-[0_40px_90px_-20px_rgba(0,0,0,0.85)]">
          <div className="px-7 pb-4 pt-5">
            <Dialog.Title className="font-display text-2xl font-bold text-foreground">
              Turmas
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              Turmas que o aluno pode escolher ao confirmar presença. Remover uma turma não apaga as
              presenças já registradas.
            </Dialog.Description>
          </div>
          <div className="border-t border-border/60" />

          <div className="space-y-5 px-7 py-5">
            <div className="flex flex-wrap gap-2">
              {turmas.map((t) => (
                <span
                  key={t.id}
                  className="flex items-center gap-1 rounded-full border border-border/60 bg-field py-1.5 pl-4 pr-1.5 text-sm text-foreground"
                >
                  {t.nome}
                  <button
                    aria-label={`Remover ${t.nome}`}
                    onClick={() => remover(t)}
                    className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              <span
                title="Sempre disponível"
                className="rounded-full border border-dashed border-border/60 px-4 py-1.5 text-sm text-muted-foreground"
              >
                N/A
              </span>
            </div>

            <form onSubmit={adicionar} className="flex gap-2">
              <input
                autoFocus
                maxLength={60}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: 3º ano, Logística"
                className="field-pill h-10 flex-1 px-4 text-sm"
              />
              <button
                type="submit"
                disabled={saving || !nome.trim()}
                className="flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CirclePlus className="h-4 w-4" />
                )}
                Adicionar
              </button>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
