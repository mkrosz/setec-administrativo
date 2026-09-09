import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Paperclip, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { NIVEIS, uploadFile, type Patrocinador } from "@/lib/setec";

const label = "block text-sm font-medium text-foreground";
const pill = "field-pill h-12 w-full px-5 text-sm";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patrocinador?: Patrocinador | null;
  nivelPadrao?: string;
  onSaved: () => void;
};

export function PatrocinadorModal({
  open,
  onOpenChange,
  patrocinador,
  nivelPadrao = "MASTER",
  onSaved,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [nome, setNome] = useState("");
  const [nivel, setNivel] = useState("");

  useEffect(() => {
    if (!open) return;
    setLogo(null);
    setNome(patrocinador?.nome_empresa ?? "");
    setNivel(patrocinador?.nivel ?? "");
  }, [open, patrocinador, nivelPadrao]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let logo_url = patrocinador?.logo_url ?? null;
      if (logo) logo_url = await uploadFile(logo, "patrocinadores");
      if (!logo_url) throw new Error("Anexe o logotipo do apoiador");

      const payload = { nome_empresa: nome, nivel: nivel || nivelPadrao, logo_url };
      const { error } = patrocinador
        ? await supabase.from("patrocinadores").update(payload).eq("id", patrocinador.id)
        : await supabase.from("patrocinadores").insert(payload);
      if (error) throw error;

      toast.success(patrocinador ? "Apoiador atualizado" : "Apoiador adicionado");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar apoiador");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(508px,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[22px] border border-border/60 bg-card shadow-[0_40px_90px_-20px_rgba(0,0,0,0.85)]">
          <Dialog.Title className="sr-only">Adicionar apoiador</Dialog.Title>
          <Dialog.Description className="sr-only">
            Informe a empresa, o logotipo e o nível de apoio.
          </Dialog.Description>

          <form id="apoiador-form" onSubmit={onSubmit} className="space-y-5 px-8 pb-7 pt-8">
            <div className="space-y-2">
              <span className={label}>Nome da Empresa</span>
              <input
                required
                maxLength={120}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Tech Corp Solutions"
                className={pill}
              />
            </div>

            <div className="space-y-2">
              <span className={label}>Logotipo</span>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="field-pill flex h-12 w-full items-center gap-3 px-5 text-left text-sm text-foreground/90"
              >
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">
                  {logo ? logo.name : "Anexar Logo da Empresa (PNG, SVG, JPG)"}
                </span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/svg+xml,image/jpeg"
                className="hidden"
                onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="space-y-2">
              <span className={label}>Nível de Apoio</span>
              <div className="relative">
                <select
                  required
                  value={nivel}
                  onChange={(e) => setNivel(e.target.value)}
                  className={`${pill} appearance-none pr-12`}
                >
                  <option value="" disabled>
                    Selecione um nível
                  </option>
                  {NIVEIS.map((n) => (
                    <option key={n} value={n}>
                      {n.charAt(0) + n.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </form>

          <div className="border-t border-border/60" />
          <div className="flex items-center justify-end gap-6 px-8 py-5">
            <Dialog.Close className="text-sm font-semibold text-foreground/90 transition-opacity hover:opacity-70">
              Cancelar
            </Dialog.Close>
            <button
              type="submit"
              form="apoiador-form"
              disabled={saving}
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : !patrocinador && <Plus className="h-4 w-4" />}
              {patrocinador ? "Atualizar" : "Adicionar Apoiador"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
