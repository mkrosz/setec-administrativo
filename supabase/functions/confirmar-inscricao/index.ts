// Supabase Edge Function: envia o e-mail de confirmação de inscrição em minicurso.
//
// Chamada pelo banco (trigger em minicurso_inscricoes, ver supabase/sql/minicursos-email.sql)
// com { "id": "<id da inscrição>" }. Busca os dados com a service role e só envia uma vez
// por inscrição (email_enviado_em), então chamadas repetidas ou forjadas não geram spam.
//
// Segredos (Edge Functions → Secrets):
//   RESEND_API_KEY + EMAIL_FROM   → usa o Resend (ex.: EMAIL_FROM="SETEC <setec@seudominio.com>")
//   GMAIL_USER + GMAIL_APP_PASSWORD → senão, usa o Gmail (SMTP 465 com senha de app)
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem automaticamente.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.16";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const DIAS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

function dataExtenso(data: string | null) {
  if (!data) return "Data a definir";
  const [a, m, d] = data.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return `${DIAS[dt.getUTCDay()]}, ${d} de ${MESES[m - 1]} de ${a}`;
}

const hora = (h: string | null) => (h ? h.slice(0, 5) : "");

function montarEmail(insc: Record<string, any>, mc: Record<string, any>, edicao: string) {
  const nome1 = String(insc.nome_completo).split(" ")[0] ?? "";
  const primeiroNome = nome1.charAt(0).toUpperCase() + nome1.slice(1).toLowerCase();
  const ministrantes = (Array.isArray(mc.ministrantes) ? mc.ministrantes : [])
    .map((m: any) => m?.nome)
    .filter(Boolean)
    .join(", ");
  const horario = mc.hora_inicio
    ? `${hora(mc.hora_inicio)}${mc.hora_fim ? ` às ${hora(mc.hora_fim)}` : ""}`
    : "A definir";

  const linhas: [string, string][] = [
    ["Data", dataExtenso(mc.data)],
    ["Horário", horario],
    ["Local", mc.local || "A definir"],
    ...(ministrantes
      ? [
          ["Ministrante" + (ministrantes.includes(",") ? "s" : ""), ministrantes] as [
            string,
            string,
          ],
        ]
      : []),
    ["Inscrito", `${insc.nome_completo} • RA ${insc.ra} • ${insc.turma}`],
  ];

  const assunto = `Inscrição confirmada: ${mc.titulo} — SETEC`;

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f4f1fb;font-family:Arial,Helvetica,sans-serif;color:#18181f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e6e1f3">
        <tr><td style="background:#7048c8;padding:26px 30px;color:#ffffff">
          <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.85">Semana de Tecnologia${edicao ? ` • ${esc(edicao)}` : ""}</div>
          <div style="font-size:24px;font-weight:bold;margin-top:6px">Inscrição confirmada!</div>
        </td></tr>
        <tr><td style="padding:28px 30px">
          <p style="margin:0 0 14px;font-size:15px">Olá, <strong>${esc(primeiroNome)}</strong>!</p>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.55">Sua vaga no minicurso abaixo está garantida. Guarde este e-mail.</p>
          <div style="font-size:19px;font-weight:bold;color:#7048c8;margin-bottom:14px">${esc(mc.titulo)}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse">
            ${linhas
              .map(
                ([k, v]) => `<tr>
              <td style="padding:9px 0;border-top:1px solid #efeaf9;color:#6e6e78;width:110px;vertical-align:top">${esc(k)}</td>
              <td style="padding:9px 0;border-top:1px solid #efeaf9;font-weight:bold">${esc(v)}</td>
            </tr>`,
              )
              .join("")}
          </table>
          <p style="margin:22px 0 0;font-size:13px;line-height:1.55;color:#6e6e78">Chegue com alguns minutos de antecedência. Se não puder comparecer, avise a organização para liberarmos a vaga para outra pessoa.</p>
        </td></tr>
        <tr><td style="padding:16px 30px;background:#faf9fd;font-size:11px;color:#9a9aa5;text-align:center">SETEC • FATEC Sorocaba — este é um e-mail automático.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const texto = [
    `Olá, ${primeiroNome}!`,
    "",
    `Sua inscrição no minicurso "${mc.titulo}" está confirmada.`,
    "",
    ...linhas.map(([k, v]) => `${k}: ${v}`),
    "",
    "SETEC • FATEC Sorocaba",
  ].join("\n");

  return { assunto, html, texto };
}

/**
 * Confere se o domínio do e-mail existe e recebe e-mails (registro MX, ou A como alternativa),
 * usando DNS-over-HTTPS. Se a consulta falhar por instabilidade, deixa seguir.
 * Obs.: domínios de erro de digitação registrados por terceiros (ex.: gmqil.com) existem
 * de verdade e passam aqui; esses são barrados no formulário com a sugestão de correção.
 */
async function dominioRecebeEmail(email: string): Promise<boolean> {
  const dominio = email.split("@")[1]?.trim().toLowerCase();
  if (!dominio) return false;
  const consultar = async (tipo: "MX" | "A") => {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(dominio)}&type=${tipo}`,
    );
    if (!res.ok) throw new Error("DNS indisponível");
    const json = await res.json();
    if (json.Status === 3) return false; // NXDOMAIN: domínio não existe
    return Array.isArray(json.Answer) && json.Answer.length > 0;
  };
  try {
    return (await consultar("MX")) || (await consultar("A"));
  } catch {
    return true;
  }
}

async function enviar(para: string, assunto: string, html: string, texto: string) {
  if (!(await dominioRecebeEmail(para))) {
    throw new Error(
      `O domínio do e-mail "${para.split("@")[1] ?? ""}" não existe ou não recebe e-mails.`,
    );
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("EMAIL_FROM") ?? "SETEC <onboarding@resend.dev>",
        to: [para],
        subject: assunto,
        html,
        text: texto,
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    return;
  }

  const user = Deno.env.get("GMAIL_USER");
  const pass = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!user || !pass)
    throw new Error(
      "Nenhum serviço de e-mail configurado (RESEND_API_KEY ou GMAIL_USER/GMAIL_APP_PASSWORD).",
    );

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465, // as portas 25 e 587 são bloqueadas nas Edge Functions
    secure: true,
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: `SETEC <${user}>`,
    to: para,
    subject: assunto,
    html,
    text: texto,
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Método não permitido", { status: 405 });

  let id = "";
  try {
    id = String((await req.json())?.id ?? "");
  } catch {
    /* corpo inválido */
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("id inválido", { status: 400 });

  // "Reserva" o envio: só segue se ainda não foi enviado (evita e-mails duplicados)
  const { data: insc, error } = await supabase
    .from("minicurso_inscricoes")
    .update({ email_enviado_em: new Date().toISOString(), email_erro: null })
    .eq("id", id)
    .is("email_enviado_em", null)
    .select("*")
    .maybeSingle();
  if (error) return new Response(error.message, { status: 500 });
  if (!insc) return new Response("Nada a enviar", { status: 200 });

  try {
    const [{ data: mc, error: e1 }, { data: cfg }] = await Promise.all([
      supabase.from("minicursos").select("*").eq("id", insc.minicurso_id).single(),
      supabase.from("event_config").select("edicao").limit(1).maybeSingle(),
    ]);
    if (e1 || !mc) throw new Error(e1?.message ?? "Minicurso não encontrado");

    const { assunto, html, texto } = montarEmail(insc, mc, cfg?.edicao ?? "");
    await enviar(insc.email, assunto, html, texto);
    return new Response("Enviado", { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("minicurso_inscricoes")
      .update({ email_enviado_em: null, email_erro: msg.slice(0, 500) })
      .eq("id", id);
    console.error("confirmar-inscricao:", msg);
    return new Response(msg, { status: 500 });
  }
});
