import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { novoParticipanteManual, type ParticipanteManual } from "@/lib/sorteio";

type Props = {
  manuais: ParticipanteManual[];
  onIncluir: (participante: ParticipanteManual) => void;
  onRetirar: (id: string) => void;
};

const VAZIO = { nome: "", ano: "", curso: "" };

/** Inclui um aluno só na roleta (nome, ano e curso), sem registrar presença. */
export function IncluirNaRoleta({ manuais, onIncluir, onRetirar }: Props) {
  const [form, setForm] = useState(VAZIO);

  function incluir(e: React.FormEvent) {
    e.preventDefault();
    const novo = novoParticipanteManual(form, crypto.randomUUID());
    if (typeof novo === "string") {
      toast.error(novo);
      return;
    }
    onIncluir(novo);
    setForm(VAZIO);
    toast.success(`${novo.nome} entrou na roleta`);
  }

  return (
    <section className="panel-surface p-5">
      <h2 className="flex items-center gap-2 font-display text-base font-bold">
        <UserPlus className="h-4 w-4 text-primary-glow" />
        Incluir na roleta
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Entra só no sorteio, não na lista de presença.
      </p>
      <form onSubmit={incluir} className="mt-4 space-y-3">
        <label className="block space-y-1.5">
          <span className="block text-xs text-muted-foreground">Nome *</span>
          <input
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            maxLength={120}
            placeholder="Nome do aluno"
            className="field-pill h-11 w-full px-4 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="block text-xs text-muted-foreground">Ano</span>
            <input
              value={form.ano}
              onChange={(e) => setForm((f) => ({ ...f, ano: e.target.value }))}
              maxLength={30}
              placeholder="Ex.: 3º ano"
              className="field-pill h-11 w-full px-4 text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="block text-xs text-muted-foreground">Curso</span>
            <input
              value={form.curso}
              onChange={(e) => setForm((f) => ({ ...f, curso: e.target.value }))}
              maxLength={60}
              placeholder="Ex.: ADS"
              className="field-pill h-11 w-full px-4 text-sm"
            />
          </label>
        </div>
        <button
          type="submit"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-primary/60 bg-primary/10 text-sm font-medium text-foreground transition-colors hover:bg-primary/20"
        >
          <UserPlus className="h-4 w-4" />
          Adicionar à roleta
        </button>
      </form>

      {manuais.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-border/40 pt-4">
          {manuais.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {m.nome}
                <span className="ml-2 text-xs text-muted-foreground">
                  {[m.ano, m.curso].filter(Boolean).join(" · ")}
                </span>
              </span>
              <button
                onClick={() => onRetirar(m.id)}
                aria-label={`Retirar ${m.nome} da roleta`}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
