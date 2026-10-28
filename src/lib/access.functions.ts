import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Solicitação pública de acesso: cria a conta bloqueada, aguardando liberação de um administrador. */
export const solicitarAcesso = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string }) => {
    const email = String(input?.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(input?.password ?? "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("E-mail inválido");
    if (password.length < 6) throw new Error("A senha precisa ter ao menos 6 caracteres");
    return { email, password };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Se ainda não existe nenhum administrador ativo, a nova conta vira admin liberado.
    const { count: adminCount, error: countError } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("ativo", true);
    if (countError) throw new Error(countError.message);
    const semAdmin = (adminCount ?? 0) === 0;

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) {
      throw new Error(error?.message ?? "Não foi possível registrar a solicitação");
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      email: data.email,
      role: semAdmin ? "admin" : "user",
      ativo: semAdmin,
    });
    if (profileError) throw new Error(profileError.message);

    return { ok: true, autoAprovado: semAdmin };
  });

/** Remove definitivamente uma conta (somente a master ou quem tem acesso total temporário). */
export const removerAcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => ({ userId: String(input?.userId ?? "") }))
  .handler(async ({ data, context }) => {
    const { data: podeExcluir, error: roleError } = await context.supabase.rpc(
      "tem_acesso_total" as any,
      { _user_id: context.userId } as any,
    );
    if (roleError) throw new Error(roleError.message);
    if (!podeExcluir) throw new Error("Apenas a conta master pode excluir contas");
    if (data.userId === context.userId)
      throw new Error("Você não pode remover a própria conta aqui");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: alvo } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", data.userId)
      .maybeSingle();
    if ((alvo as { master?: boolean } | null)?.master)
      throw new Error("A conta master não pode ser excluída");

    const { error: perfilError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", data.userId);
    if (perfilError) throw new Error(perfilError.message);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    // A exclusão roda com a chave de serviço, então o histórico é gravado aqui
    const { data: eu } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    await supabaseAdmin.from("auditoria" as any).insert({
      usuario_id: context.userId,
      usuario_email: eu?.user?.email ?? null,
      acao: "excluiu",
      tabela: "profiles",
      registro_id: data.userId,
      descricao: alvo?.email ?? null,
      antes: alvo,
    } as any);
    return { ok: true };
  });
