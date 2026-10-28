import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, Loader2, Plus, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  CATEGORIAS,
  LINK_TYPES,
  normalizeUrl,
  palestrantesDe,
  uploadFile,
  resolveUrl,
  type LinkType,
  type Minicurso,
  type Palestra,
  type Palestrante,
  mensagemErro,
} from "@/lib/setec";

const label = "block text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground";
const pill = "field-pill h-10 w-full px-4 text-sm";
/** Valor da opção "Outra" no select de categoria (abre um campo para digitar). */
const OUTRA = "__outra__";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  palestra?: Palestra | null;
  onSaved: () => void;
  /** "minicurso" usa o mesmo formulário, com vagas e textos próprios (tabela minicursos). */
  tipo?: "palestra" | "minicurso";
  minicurso?: Minicurso | null;
};

const TEXTOS = {
  palestra: {
    nome: "Palestra",
    artigo: "a",
    titulo: "Título da palestra",
    sobre: "Sobre a palestra",
    pessoa: "Palestrante",
    pessoas: "Palestrantes",
    sobrePessoa: "Sobre o palestrante",
    pasta: "palestrantes",
  },
  minicurso: {
    nome: "Minicurso",
    artigo: "o",
    titulo: "Título do minicurso",
    sobre: "Sobre o minicurso",
    pessoa: "Ministrante",
    pessoas: "Ministrantes",
    sobrePessoa: "Sobre o ministrante",
    pasta: "ministrantes",
  },
} as const;

type PalestranteItem = {
  id: string;
  nome: string;
  cargo: string;
  sobre: string;
  /** Caminho já salvo no storage (null se não houver ou se foi trocada). */
  fotoPath: string | null;
  /** Nova foto escolhida, enviada ao salvar. */
  file: File | null;
  preview: string;
};

function novoPalestrante(): PalestranteItem {
  return {
    id: crypto.randomUUID(),
    nome: "",
    cargo: "",
    sobre: "",
    fotoPath: null,
    file: null,
    preview: "",
  };
}

function palestranteVazio(p: PalestranteItem) {
  return !p.nome.trim() && !p.cargo.trim() && !p.sobre.trim() && !p.fotoPath && !p.file;
}

type LinkItem = {
  id: string;
  type: LinkType;
  url: string;
};

export function PalestraModal({
  open,
  onOpenChange,
  palestra: palestraProp,
  onSaved,
  tipo = "palestra",
  minicurso,
}: Props) {
  const isMini = tipo === "minicurso";
  const t = TEXTOS[tipo];
  // Campos em comum; "palestra" aqui é o registro em edição (palestra ou minicurso)
  const palestra = isMini ? minicurso : palestraProp;
  const [vagas, setVagas] = useState("30");
  const fileRef = useRef<HTMLInputElement>(null);
  const fotoAlvo = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [palestrantes, setPalestrantes] = useState<PalestranteItem[]>(() => [novoPalestrante()]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [categoriaOutra, setCategoriaOutra] = useState(false);

  const [form, setForm] = useState({
    titulo: "",
    categoria: "",
    data: "",
    hora_inicio: "",
    hora_fim: "",
    local: "",
    sobre_palestra: "",
  });

  useEffect(() => {
    if (!open) return;

    // Categoria salva que não está na lista padrão = foi digitada em "Outra"
    setCategoriaOutra(!!palestra?.categoria && !CATEGORIAS.includes(palestra.categoria));
    setForm({
      titulo: palestra?.titulo ?? "",
      categoria: palestra?.categoria ?? "",
      data: palestra?.data ?? "",
      hora_inicio: palestra?.hora_inicio?.slice(0, 5) ?? "",
      hora_fim: palestra?.hora_fim?.slice(0, 5) ?? "",
      local: palestra?.local ?? "FATEC Sorocaba - P11",
      sobre_palestra: (isMini ? minicurso?.sobre : palestraProp?.sobre_palestra) ?? "",
    });
    setVagas(String(minicurso?.vagas ?? 30));

    const rawLinks = Array.isArray(palestra?.links) ? palestra.links : [];
    setLinks(
      rawLinks.map((l) => ({
        id: crypto.randomUUID(),
        type: l.type,
        url: l.url ?? "",
      })),
    );

    const pessoas = isMini
      ? (minicurso?.ministrantes ?? [])
      : palestraProp
        ? palestrantesDe(palestraProp)
        : [];
    const itens: PalestranteItem[] = pessoas.map((x) => ({
      id: crypto.randomUUID(),
      nome: x.nome ?? "",
      cargo: x.cargo ?? "",
      sobre: x.sobre ?? "",
      fotoPath: x.foto_url,
      file: null,
      preview: "",
    }));
    setPalestrantes(itens.length ? itens : [novoPalestrante()]);

    let ativo = true;
    Promise.all(
      itens.map(async (it) => [it.id, (await resolveUrl(it.fotoPath)) ?? ""] as const),
    ).then((previews) => {
      if (!ativo) return;
      const mapa = new Map(previews);
      setPalestrantes((prev) =>
        prev.map((it) =>
          !it.file && it.fotoPath && mapa.get(it.id) ? { ...it, preview: mapa.get(it.id)! } : it,
        ),
      );
    });
    return () => {
      ativo = false;
    };
  }, [open, palestra, isMini, minicurso, palestraProp]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updatePalestrante(id: string, patch: Partial<Omit<PalestranteItem, "id">>) {
    setPalestrantes((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function addPalestrante() {
    setPalestrantes((prev) => [...prev, novoPalestrante()]);
  }

  function removePalestrante(id: string) {
    setPalestrantes((prev) => {
      const resto = prev.filter((p) => p.id !== id);
      return resto.length ? resto : [novoPalestrante()];
    });
  }

  function escolherFoto(id: string) {
    fotoAlvo.current = id;
    fileRef.current?.click();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const alvo = fotoAlvo.current;
    if (fileRef.current) fileRef.current.value = "";
    if (!file || !alvo) return;
    updatePalestrante(alvo, { file, fotoPath: null, preview: URL.createObjectURL(file) });
  }

  function removerFoto(id: string) {
    updatePalestrante(id, { file: null, fotoPath: null, preview: "" });
  }

  function addLink() {
    // O LinkedIn é sempre o tipo padrão de um novo link
    setLinks((prev) => [...prev, { id: crypto.randomUUID(), type: "linkedin", url: "" }]);
  }

  function updateLink(id: string, patch: Partial<Omit<LinkItem, "id">>) {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function removeLink(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    save(false);
  }

  async function save(asDraft: boolean) {
    const preenchidos = palestrantes.filter((p) => !palestranteVazio(p));

    if (asDraft && !form.titulo.trim() && !preenchidos.some((p) => p.nome.trim())) {
      toast.error("Preencha ao menos o título ou o nome para salvar o rascunho");
      return;
    }

    setSaving(true);
    try {
      if (!asDraft) {
        if (preenchidos.length === 0)
          throw new Error(`Adicione ao menos um ${t.pessoa.toLowerCase()}`);
        if (preenchidos.some((p) => !p.nome.trim())) {
          throw new Error(`Informe o nome de todos os ${t.pessoas.toLowerCase()}`);
        }
      }

      const vagasNum = Number.parseInt(vagas, 10);
      if (isMini && !(vagasNum >= 1 && vagasNum <= 10000)) {
        throw new Error("Informe o número de vagas (1 a 10000)");
      }

      const lista: Palestrante[] = [];
      for (const p of preenchidos) {
        const foto = p.file ? await uploadFile(p.file, t.pasta) : p.fotoPath;
        lista.push({
          nome: p.nome.trim(),
          cargo: p.cargo.trim() || null,
          foto_url: foto || null,
          sobre: p.sobre.trim() || null,
        });
      }

      const cleanLinks = links
        .map((l) => ({ type: l.type, url: normalizeUrl(l.url) }))
        .filter((l) => l.url);

      for (const l of cleanLinks) {
        try {
          new URL(l.url);
        } catch {
          throw new Error(`Link inválido: ${l.url}`);
        }
      }

      // Data e horas só são guardadas se estiverem completas (o banco recusa valores pela metade)
      // Data no formato do banco (AAAA-MM-DD) e que exista de verdade (ex.: 31/02 é recusado)
      const dataOk = (() => {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(form.data);
        if (!m) return false;
        const [a, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
        const d = new Date(a, mes - 1, dia);
        return d.getFullYear() === a && d.getMonth() === mes - 1 && d.getDate() === dia;
      })();
      const horaOk = (h: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
      const inicioOk = horaOk(form.hora_inicio);
      const fimOk = horaOk(form.hora_fim);

      if (!asDraft) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(form.data))
          throw new Error("Informe a data completa (DD/MM/AAAA)");
        if (!dataOk) throw new Error("Essa data não existe. Confira o dia e o mês (DD/MM/AAAA)");
        if (!inicioOk || !fimOk) throw new Error("Informe horários válidos (HH:MM)");
      }
      if (form.data && /^\d{4}-\d{2}-\d{2}$/.test(form.data) && !dataOk) {
        throw new Error("Essa data não existe. Confira o dia e o mês (DD/MM/AAAA)");
      }
      if (inicioOk && fimOk && form.hora_fim <= form.hora_inicio) {
        throw new Error("O horário de término precisa ser depois do horário de início");
      }

      const comum = {
        titulo: form.titulo,
        categoria: form.categoria.trim() || null,
        data: dataOk ? form.data : null,
        hora_inicio: inicioOk ? form.hora_inicio : null,
        hora_fim: fimOk ? form.hora_fim : null,
        local: form.local || null,
        links: cleanLinks,
        rascunho: asDraft,
      };

      // As colunas antigas também são recalculadas pelo trigger do banco (supabase/sql/palestrantes.sql)
      const payload = isMini
        ? { ...comum, ministrantes: lista, sobre: form.sobre_palestra || null, vagas: vagasNum }
        : {
            ...comum,
            sobre_palestra: form.sobre_palestra || null,
            palestrantes: lista,
            nome_completo: lista
              .map((p) => p.nome)
              .filter(Boolean)
              .join(", "),
            cargo: lista[0]?.cargo ?? null,
            sobre_palestrante: lista[0]?.sobre ?? null,
            foto_url: lista.flatMap((p) => (p.foto_url ? [p.foto_url] : [])),
          };

      const tabela = (isMini ? "minicursos" : "palestras") as "palestras";
      const { error } = palestra
        ? await supabase
            .from(tabela)
            .update(payload as any)
            .eq("id", palestra.id)
        : await supabase.from(tabela).insert(payload as any);

      if (error) throw error;

      if (asDraft) {
        const incompleto =
          (form.data && !dataOk) || (form.hora_inicio && !inicioOk) || (form.hora_fim && !fimOk);
        toast.success("Rascunho salvo");
        if (incompleto) toast.info("Data ou horário incompletos não foram guardados no rascunho");
      } else {
        toast.success(
          `${t.nome} ${palestra?.rascunho ? "publicad" : palestra ? "atualizad" : "cadastrad"}${t.artigo}`,
        );
      }

      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(mensagemErro(err, `Erro ao salvar ${t.nome.toLowerCase()}`));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[min(900px,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[26px] border border-border/60 bg-card shadow-[0_40px_90px_-20px_rgba(0,0,0,0.85)]">
          <div className="px-5 pb-4 pt-5 sm:px-7">
            <Dialog.Title className="font-display text-2xl font-bold text-foreground">
              {palestra?.rascunho
                ? "Editar rascunho"
                : palestra
                  ? `Editar ${t.nome.toLowerCase()}`
                  : `Adicionar ${t.nome.toLowerCase()}`}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              {palestra?.rascunho
                ? "Complete as informações e publique, ou salve novamente como rascunho."
                : palestra
                  ? "Ajuste os detalhes desta sessão do cronograma."
                  : "Preencha os detalhes da nova sessão para o cronograma."}
            </Dialog.Description>
          </div>
          <div className="border-t border-border/60" />

          <form id="palestra-form" onSubmit={onSubmit} className="space-y-4 px-5 sm:px-7 py-5">
            <div className="space-y-1.5">
              <span className={label}>{t.titulo}</span>
              <input
                required
                maxLength={160}
                value={form.titulo}
                onChange={(e) => set("titulo", e.target.value)}
                placeholder={isMini ? "Criando APIs com Node.js" : "O Futuro da IA no Design"}
                className="field-pill h-12 w-full px-5 text-base"
              />
            </div>

            <div className="space-y-1.5">
              <span className={label}>Categoria / Tag</span>
              <div className={categoriaOutra ? "grid gap-3 sm:grid-cols-2" : ""}>
                <div className="relative">
                  <select
                    required
                    value={categoriaOutra ? OUTRA : form.categoria}
                    onChange={(e) => {
                      const outra = e.target.value === OUTRA;
                      setCategoriaOutra(outra);
                      set("categoria", outra ? "" : e.target.value);
                    }}
                    className={`${pill} appearance-none pr-11`}
                  >
                    <option value="" disabled>
                      Selecione…
                    </option>
                    {CATEGORIAS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value={OUTRA}>Outra (digitar)…</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                {categoriaOutra && (
                  <input
                    required
                    autoFocus
                    maxLength={40}
                    value={form.categoria}
                    onChange={(e) => set("categoria", e.target.value)}
                    placeholder="Digite a categoria (ex: Robótica)"
                    className={pill}
                  />
                )}
              </div>
            </div>

            {isMini && (
              <div className="space-y-1.5">
                <span className={label}>Número de vagas</span>
                <input
                  required
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10000}
                  value={vagas}
                  onChange={(e) => setVagas(e.target.value.replace(/\D/g, ""))}
                  placeholder="30"
                  className={`${pill} sm:max-w-48`}
                />
              </div>
            )}

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

            <div className="space-y-1.5">
              <span className={label}>{t.sobre}</span>
              <textarea
                required
                rows={3}
                maxLength={1200}
                value={form.sobre_palestra}
                onChange={(e) => set("sobre_palestra", e.target.value)}
                placeholder="Descreva os tópicos…"
                className="field-pill w-full resize-none rounded-2xl px-5 py-3 text-sm"
              />
            </div>

            <div className="space-y-2">
              <span className={label}>
                {palestrantes.length > 1 ? `${t.pessoas} (${palestrantes.length})` : t.pessoa}
              </span>

              <div className="space-y-3">
                {palestrantes.map((p, i) => (
                  <div key={p.id} className="panel-surface space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm font-semibold text-foreground">
                        {t.pessoa} {i + 1}
                      </span>
                      {palestrantes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePalestrante(p.id)}
                          aria-label={`Remover ${t.pessoa.toLowerCase()} ${i + 1}`}
                          title={`Remover ${t.pessoa.toLowerCase()}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-red-600/20 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="relative h-20 w-20 shrink-0">
                        <button
                          type="button"
                          onClick={() => escolherFoto(p.id)}
                          title={p.preview ? "Trocar foto" : "Adicionar foto"}
                          className="flex h-20 w-20 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border border-dashed border-border/70 bg-field text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                        >
                          {p.preview ? (
                            <img
                              src={p.preview}
                              alt={p.nome || "Palestrante"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <>
                              <Camera className="h-5 w-5" />
                              <span className="text-[10px] tracking-[0.14em]">+ FOTO</span>
                            </>
                          )}
                        </button>
                        {p.preview && (
                          <button
                            type="button"
                            onClick={() => removerFoto(p.id)}
                            className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-90 transition-colors hover:bg-red-600"
                            title="Remover foto"
                            aria-label="Remover foto"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <span className={label}>Nome completo</span>
                          <input
                            required
                            maxLength={120}
                            value={p.nome}
                            onChange={(e) => updatePalestrante(p.id, { nome: e.target.value })}
                            placeholder="Ex.: Ada Lovelace"
                            className={pill}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <span className={label}>Cargo / Instituição</span>
                          <input
                            required
                            maxLength={140}
                            value={p.cargo}
                            onChange={(e) => updatePalestrante(p.id, { cargo: e.target.value })}
                            placeholder="Ex.: Pesquisadora do MIT"
                            className={pill}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className={label}>{t.sobrePessoa}</span>
                      <textarea
                        required
                        rows={3}
                        maxLength={1200}
                        value={p.sobre}
                        onChange={(e) => updatePalestrante(p.id, { sobre: e.target.value })}
                        placeholder="Breve biografia…"
                        className="field-pill w-full resize-none rounded-2xl px-5 py-3 text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addPalestrante}
                className="flex h-10 items-center gap-2 rounded-full border border-border/70 px-4 text-sm font-medium text-foreground transition-colors hover:border-primary/60"
              >
                <UserPlus className="h-4 w-4" />
                Adicionar {t.pessoa.toLowerCase()}
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            <div className="space-y-2">
              <span className={label}>Links (redes sociais e sites)</span>

              <div className="space-y-2">
                {links.map((l) => (
                  <div key={l.id} className="flex items-center gap-2">
                    <div className="relative w-40 shrink-0">
                      <select
                        value={l.type}
                        onChange={(e) => updateLink(l.id, { type: e.target.value as LinkType })}
                        className={`${pill} appearance-none pr-9`}
                      >
                        {LINK_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>

                    <input
                      inputMode="url"
                      value={l.url}
                      onChange={(e) => updateLink(l.id, { url: e.target.value })}
                      placeholder="https://…"
                      className={`${pill} min-w-0 flex-1`}
                    />

                    <button
                      type="button"
                      onClick={() => removeLink(l.id)}
                      aria-label="Remover link"
                      title="Remover link"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-red-600/20 hover:text-red-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addLink}
                className="flex h-10 items-center gap-2 rounded-full border border-border/70 px-4 text-sm font-medium text-foreground transition-colors hover:border-primary/60"
              >
                <Plus className="h-4 w-4" />
                Adicionar
              </button>
            </div>
          </form>

          <div className="border-t border-border/60" />
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-3 px-5 py-4 sm:px-7">
            <Dialog.Close className="text-sm font-medium text-foreground/90 transition-opacity hover:opacity-70">
              Cancelar
            </Dialog.Close>

            {/* Só aparece ao criar ou ao editar um rascunho; palestra já publicada não volta a rascunho */}
            {(!palestra || palestra.rascunho) && (
              <button
                type="button"
                onClick={() => save(true)}
                disabled={saving}
                className="flex h-11 flex-auto items-center justify-center whitespace-nowrap rounded-full sm:flex-none border border-border/70 px-6 text-sm font-medium text-foreground transition-colors hover:border-primary/60 disabled:opacity-60"
              >
                {palestra?.rascunho ? "Salvar rascunho" : "Salvar como rascunho"}
              </button>
            )}

            <button
              type="submit"
              form="palestra-form"
              disabled={saving}
              className="flex h-11 flex-auto items-center justify-center gap-2 whitespace-nowrap rounded-full sm:flex-none bg-primary px-7 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {palestra?.rascunho
                ? "Publicar"
                : palestra
                  ? "Salvar alterações"
                  : `Salvar ${t.nome.toLowerCase()}`}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
