import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Solicitação pública de acesso: cria a conta bloqueada, aguardando liberação de um administrador. */
export const solicitarAcesso = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string }) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
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


/** Remove definitivamente uma conta (somente administradores ativos). */
export const removerAcesso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => ({ userId: String(input?.userId ?? "") }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("is_active_admin", {
      _user_id: context.userId,
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error("Apenas administradores podem remover acessos");
    if (data.userId === context.userId) throw new Error("Você não pode remover a própria conta aqui");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
