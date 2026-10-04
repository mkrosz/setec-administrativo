import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { GRUPOS_COMISSAO, type GrupoComissao, type MembroComissao } from "@/lib/setec";

const label = "block text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground";
const pill = "field-pill h-10 w-full px-4 text-sm";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  membro?: MembroComissao | null;
  grupoPadrao: GrupoComissao;
  onSaved: () => void;
};

export function ComissaoModal({ open, onOpenChange, membro, grupoPadrao, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [grupo, setGrupo] = useState<GrupoComissao>(grupoPadrao);

  useEffect(() => {
    if (!open) return;
    setNome(membro?.nome ?? "");
    setEmail(membro?.email ?? "");
    setGrupo(membro?.grupo ?? grupoPadrao);
  }, [open, membro, grupoPadrao]);

  async function save(keepOpen: boolean) {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      toast.error("Informe o nome do membro");
      return;
    }

        const emailLimpo = email.trim();
    if (emailLimpo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
      toast.error("E-mail inválido");
      return;
    }

    setSaving(true);
    try {
      const payload = { nome: nomeLimpo, email: emailLimpo || null, grupo };
      const { error } = membro
        ? await supabase.from("comissao" as any).update(payload as any).eq("id", membro.id)
        : await supabase.from("comissao" as any).insert(payload as any);
      if (error) throw error;

      toast.success(membro ? "Membro atualizado" : "Membro adicionado");
      onSaved();

      if (keepOpen) {
        setNome("");
        setEmail("");
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar membro");
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
              {membro ? "Editar Membro" : "Adicionar Membro"}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              Membro da comissão organizadora da SETEC.
            </Dialog.Description>
          </div>
          <div className="border-t border-border/60" />

          <form
            id="comissao-form"
            onSubmit={(e) => {
              e.preventDefault();
              save(false);
            }}
            className="space-y-4 px-7 py-5"
          >
            <div className="space-y-1.5">
              <span className={label}>Nome</span>
              <input
                autoFocus
                maxLength={120}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo"
                className={pill}
              />
            </div>

            <div className="space-y-1.5">
              <span className={label}>
                E-mail <span className="normal-case tracking-normal opacity-60">(opcional)</span>
              </span>
              <input
                type="email"
                maxLength={160}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@exemplo.com"
                className={pill}
              />
            </div>

            <div className="space-y-1.5">
              <span className={label}>Grupo</span>
              <div className="relative">
                <select
                  value={grupo}
                  onChange={(e) => setGrupo(e.target.value as GrupoComissao)}
                  className={`${pill} appearance-none pr-11`}
                >
                  {GRUPOS_COMISSAO.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </form>

          <div className="border-t border-border/60" />
          <div className="flex items-center justify-end gap-4 px-7 py-4">
            <Dialog.Close className="text-sm font-medium text-foreground/90 transition-opacity hover:opacity-70">
              Cancelar
            </Dialog.Close>

            {!membro && (
              <button
                type="button"
                onClick={() => save(true)}
                disabled={saving}
                className="flex h-11 items-center justify-center rounded-full border border-border/70 px-6 text-sm font-medium text-foreground transition-colors hover:border-primary/60 disabled:opacity-60"
              >
                Salvar e adicionar outro
              </button>
            )}

            <button
              type="submit"
              form="comissao-form"
              disabled={saving}
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {membro ? "Atualizar" : "Salvar"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}