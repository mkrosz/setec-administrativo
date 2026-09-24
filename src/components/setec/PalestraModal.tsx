import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { CATEGORIAS, uploadFile, resolveUrl, type Palestra } from "@/lib/setec";

const label = "block text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground";
const pill = "field-pill h-10 w-full px-4 text-sm";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  palestra?: Palestra | null;
  onSaved: () => void;
};

type ImageItem = {
  id: string;
  url: string | null;
  file: File | null;
  preview: string;
};

export function PalestraModal({ open, onOpenChange, palestra, onSaved }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<ImageItem[]>([]);

  const [form, setForm] = useState({
    nome_completo: "",
    cargo: "",
    titulo: "",
    categoria: "",
    data: "",
    hora_inicio: "",
    hora_fim: "",
    local: "",
    sobre_palestra: "",
    sobre_palestrante: "",
  });

  useEffect(() => {
    if (!open) return;

    setForm({
      nome_completo: palestra?.nome_completo ?? "",
      cargo: palestra?.cargo ?? "",
      titulo: palestra?.titulo ?? "",
      categoria: palestra?.categoria ?? "",
      data: palestra?.data ?? "",
      hora_inicio: palestra?.hora_inicio?.slice(0, 5) ?? "",
      hora_fim: palestra?.hora_fim?.slice(0, 5) ?? "",
      local: palestra?.local ?? "FATEC Sorocaba - P11",
      sobre_palestra: palestra?.sobre_palestra ?? "",
      sobre_palestrante: palestra?.sobre_palestrante ?? "",
    });

    const rawUrls: string[] = Array.isArray(palestra?.foto_url)
      ? palestra.foto_url
      : typeof palestra?.foto_url === "string" && palestra.foto_url
      ? [palestra.foto_url]
      : [];

    Promise.all(
      rawUrls.map(async (path) => ({
        id: Math.random().toString(),
        url: path,
        file: null,
        preview: (await resolveUrl(path)) || "",
      }))
    ).then(setImages);
  }, [open, palestra]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newItems: ImageItem[] = files.map((file) => ({
      id: Math.random().toString(),
      url: null,
      file,
      preview: URL.createObjectURL(file),
    }));

    setImages((prev) => [...prev, ...newItems]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((item) => item.id !== id));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const finalUrls: string[] = [];

      for (const img of images) {
        if (img.url) {
          finalUrls.push(img.url);
        } else if (img.file) {
          const uploadedPath = await uploadFile(img.file, "palestrantes");
          if (uploadedPath) finalUrls.push(uploadedPath);
        }
      }

      const payload = {
        ...form,
        cargo: form.cargo || null,
        categoria: form.categoria || null,
        data: form.data || null,
        hora_inicio: form.hora_inicio || null,
        hora_fim: form.hora_fim || null,
        local: form.local || null,
        sobre_palestra: form.sobre_palestra || null,
        sobre_palestrante: form.sobre_palestrante || null,
        foto_url: finalUrls,
      };

      const { error } = palestra
        ? await supabase.from("palestras").update(payload).eq("id", palestra.id)
        : await supabase.from("palestras").insert(payload);

      if (error) throw error;

      toast.success(palestra ? "Palestra atualizada" : "Palestra cadastrada");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar palestra");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[min(900px,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[26px] border border-border/60 bg-card shadow-[0_40px_90px_-20px_rgba(0,0,0,0.85)]">
          <div className="px-7 pb-4 pt-5">
            <Dialog.Title className="font-display text-2xl font-bold text-foreground">
              {palestra ? "Atualizar Palestra" : "Cadastrar Palestra"}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              {palestra
                ? "Ajuste os detalhes desta sessão do cronograma."
                : "Preencha os detalhes da nova sessão para o cronograma."}
            </Dialog.Description>
          </div>
          <div className="border-t border-border/60" />

          <form id="palestra-form" onSubmit={onSubmit} className="space-y-4 px-7 py-5">
            {/* Seção de Fotos Múltiplas */}
            <div className="space-y-2">
              <span className={label}>Fotos dos Palestrantes ({images.length})</span>
              <div className="flex flex-wrap gap-3">
                {images.map((img) => (
                  <div key={img.id} className="relative h-20 w-20 rounded-2xl border border-border/70 overflow-hidden group">
                    <img src={img.preview} alt="Palestrante" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-90 hover:bg-red-600 transition-colors"
                      title="Remover foto"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border/70 bg-field text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                >
                  <Camera className="h-5 w-5" />
                  <span className="text-[10px] tracking-[0.14em]">+ FOTO</span>
                </button>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className={label}>Nome(s) Completo(s)</span>
                <input
                  required
                  maxLength={120}
                  value={form.nome_completo}
                  onChange={(e) => set("nome_completo", e.target.value)}
                  placeholder="Ex: Dr. Alan Turing, Ada Lovelace"
                  className={pill}
                />
              </div>
              <div className="space-y-1.5">
                <span className={label}>Cargo / Instituição</span>
                <input
                  required
                  maxLength={140}
                  value={form.cargo}
                  onChange={(e) => set("cargo", e.target.value)}
                  placeholder="Ex: Pesquisadores do MIT"
                  className={pill}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <span className={label}>Título da palestra</span>
              <input
                required
                maxLength={160}
                value={form.titulo}
                onChange={(e) => set("titulo", e.target.value)}
                placeholder="O Futuro da IA no Design"
                className="field-pill h-12 w-full px-5 text-base"
              />
            </div>

            <div className="space-y-1.5">
              <span className={label}>Categoria / Tag</span>
              <div className="relative">
                <select
                  required
                  value={form.categoria}
                  onChange={(e) => set("categoria", e.target.value)}
                  className={`${pill} appearance-none pr-11`}
                >
                  <option value="" disabled>
                    Selecione...
                  </option>
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <span className="block text-xs text-muted-foreground">Data</span>
                <input
                  type="text"
                  required
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  value={
                    form.data && form.data.includes("-")
                      ? form.data.split("-").reverse().join("/")
                      : form.data
                  }
                  onChange={(e) => {
                    let val = e.target.value.replace(/\D/g, "");
                    if (val.length > 2) val = val.slice(0, 2) + "/" + val.slice(2);
                    if (val.length > 5) val = val.slice(0, 5) + "/" + val.slice(5, 9);
                    
                    if (val.length === 10) {
                      const parts = val.split("/");
                      set("data", `${parts[2]}-${parts[1]}-${parts[0]}`);
                    } else {
                      set("data", val);
                    }
                  }}
                  className={pill}
                />
              </div>
              <div className="space-y-1.5">
                <span className="block text-xs text-muted-foreground">Início (HH:MM)</span>
                <input
                  type="text"
                  required
                  placeholder="13:00"
                  maxLength={5}
                  value={form.hora_inicio}
                  onChange={(e) => {
                    let val = e.target.value.replace(/\D/g, "");
                    if (val.length > 2) val = val.slice(0, 2) + ":" + val.slice(2, 4);
                    set("hora_inicio", val);
                  }}
                  className={pill}
                />
              </div>
              <div className="space-y-1.5">
                <span className="block text-xs text-muted-foreground">Término (HH:MM)</span>
                <input
                  type="text"
                  required
                  placeholder="13:40"
                  maxLength={5}
                  value={form.hora_fim}
                  onChange={(e) => {
                    let val = e.target.value.replace(/\D/g, "");
                    if (val.length > 2) val = val.slice(0, 2) + ":" + val.slice(2, 4);
                    set("hora_fim", val);
                  }}
                  className={pill}
                />
              </div>
              <div className="space-y-1.5">
                <span className="block text-xs text-muted-foreground">Local</span>
                <input
                  maxLength={80}
                  value={form.local}
                  onChange={(e) => set("local", e.target.value)}
                  placeholder="Auditório A"
                  className={pill}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className={label}>Sobre a palestra</span>
                <textarea
                  required
                  rows={3}
                  maxLength={1200}
                  value={form.sobre_palestra}
                  onChange={(e) => set("sobre_palestra", e.target.value)}
                  placeholder="Descreva os tópicos..."
                  className="field-pill w-full resize-none rounded-2xl px-5 py-3 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <span className={label}>Sobre o(s) palestrante(s)</span>
                <textarea
                  required
                  rows={3}
                  maxLength={1200}
                  value={form.sobre_palestrante}
                  onChange={(e) => set("sobre_palestrante", e.target.value)}
                  placeholder="Breve biografia..."
                  className="field-pill w-full resize-none rounded-2xl px-5 py-3 text-sm"
                />
              </div>
            </div>
          </form>

          <div className="border-t border-border/60" />
          <div className="flex items-center justify-end gap-6 px-7 py-4">
            <Dialog.Close className="text-sm font-medium text-foreground/90 transition-opacity hover:opacity-70">
              Cancelar
            </Dialog.Close>
            <button
              type="submit"
              form="palestra-form"
              disabled={saving}
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {palestra ? "Atualizar" : "Salvar Palestra"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}