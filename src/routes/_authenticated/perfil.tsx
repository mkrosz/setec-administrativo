import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { SetecLogo } from "@/components/setec/SetecLogo";
import { deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Meu Perfil | Painel SETEC" },
      {
        name: "description",
        content:
          "Gerencie sua conta administrativa da Semana de Tecnologia: veja seu e-mail, troque a senha e exclua o perfil.",
      },
      { property: "og:title", content: "Meu Perfil | Painel SETEC" },
      {
        property: "og:description",
        content: "Conta administrativa da Semana de Tecnologia (SETEC).",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Perfil,
});

const fieldLabel = "text-[10px] uppercase tracking-[0.16em] text-muted-foreground";

function Perfil() {
  const navigate = useNavigate();
  const excluir = useServerFn(deleteMyAccount);

  const [email, setEmail] = useState("");
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    if (nova.length < 6) {
      toast.error("A nova senha precisa ter ao menos 6 caracteres");
      return;
    }
    if (nova !== confirma) {
      toast.error("A confirmação não corresponde à nova senha");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      password: nova,
      // current_password é exigido pelo backend em trocas autenticadas
      current_password: atual,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setAtual("");
    setNova("");
    setConfirma("");
    toast.success("Senha atualizada com sucesso");
  }

  async function excluirConta() {
    if (!confirm("Excluir seu perfil permanentemente? Esta ação não pode ser desfeita.")) return;
    setRemoving(true);
    try {
      await excluir({ data: undefined });
      await supabase.auth.signOut();
      toast.success("Perfil excluído");
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir o perfil");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 pb-24 pt-8 md:px-16">
      <header className="mx-auto flex max-w-[1160px] items-center justify-between">
        <SetecLogo />
        <Link
          to="/painel"
          className="flex h-10 items-center gap-2 rounded-full border border-border/70 px-5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao painel
        </Link>
      </header>

      <div className="mx-auto mt-14 max-w-[1160px]">
        <h1 className="title-gradient font-display text-5xl font-black uppercase leading-[0.95] tracking-[-0.01em] md:text-[56px]">
          Meu Perfil
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Consulte os dados da sua conta administrativa, altere sua senha de acesso ou exclua
          definitivamente o perfil.
        </p>

        <h2 className="mt-14 flex items-center gap-3 font-display text-xl font-bold">
          <UserRound className="h-5 w-5 text-primary-glow" />
          Dados da conta
        </h2>
        <section className="panel-surface mt-5 max-w-2xl p-7">
          <div className="flex h-[74px] flex-col justify-center gap-1 rounded-2xl border border-border/60 bg-field/60 px-5">
            <span className={fieldLabel}>E-mail cadastrado</span>
            <span className="flex items-center gap-2 text-[15px] text-foreground">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              {email || "—"}
            </span>
          </div>
        </section>

        <h2 className="mt-14 flex items-center gap-3 font-display text-xl font-bold">
          <Lock className="h-5 w-5 text-primary-glow" />
          Alterar senha
        </h2>
        <form onSubmit={trocarSenha} className="panel-surface mt-5 max-w-2xl p-7">
          <div className="grid gap-4">
            <PasswordField
              label="Senha atual"
              value={atual}
              onChange={setAtual}
              show={show}
              onToggle={() => setShow((s) => !s)}
            />
            <PasswordField label="Nova senha" value={nova} onChange={setNova} show={show} />
            <PasswordField
              label="Confirmar nova senha"
              value={confirma}
              onChange={setConfirma}
              show={show}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold uppercase tracking-[0.12em] text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar nova senha
          </button>
        </form>

        <h2 className="mt-14 flex items-center gap-3 font-display text-xl font-bold text-destructive">
          <Trash2 className="h-5 w-5" />
          Excluir perfil
        </h2>
        <section className="panel-surface mt-5 max-w-2xl border-destructive/40 p-7">
          <p className="text-sm leading-relaxed text-muted-foreground">
            A exclusão remove permanentemente sua conta de acesso ao painel. Os dados do evento
            (palestras e apoiadores) permanecem cadastrados.
          </p>
          <button
            onClick={excluirConta}
            disabled={removing}
            className="mt-6 flex h-12 items-center justify-center gap-2 rounded-full border border-destructive/60 px-7 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
          >
            {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Excluir meu perfil
          </button>
        </section>
      </div>
    </main>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle?: () => void;
}) {
  return (
    <label className="flex h-[74px] flex-col justify-center gap-1 rounded-2xl border border-border/60 bg-field/60 px-5">
      <span className={fieldLabel}>{label}</span>
      <span className="flex items-center gap-2">
        <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-[15px] text-foreground outline-none"
        />
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Alternar visibilidade das senhas"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </span>
    </label>
  );
}
