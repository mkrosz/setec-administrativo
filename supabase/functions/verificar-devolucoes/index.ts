// Supabase Edge Function: lê as devoluções de e-mail ("Mail Delivery Subsystem") na caixa
// de entrada do Gmail da SETEC e marca a inscrição correspondente com erro no painel.
//
// Quando o Gmail não consegue entregar (ex.: a caixa ninguem123@gmail.com não existe), ele aceita
// o envio e só depois manda uma mensagem de devolução para a conta remetente. Esta função lê
// essas mensagens por IMAP (mesma senha de app do envio), descobre o destinatário que falhou e
// grava o motivo em minicurso_inscricoes.email_erro (o painel mostra o ✗ vermelho).
//
// Chamada pelo painel administrativo ao abrir (e ao abrir a lista de inscritos de um minicurso).
// Usa os segredos GMAIL_USER e GMAIL_APP_PASSWORD.
// Cada devolução é marcada como lida depois de processada, então não é lida duas vezes.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { ImapFlow } from "npm:imapflow@1.7.8";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const REMETENTES_DEVOLUCAO = ["mailer-daemon@googlemail.com", "mailer-daemon@google.com", "postmaster"];

/** Extrai os destinatários que falharam e um motivo legível de uma mensagem de devolução. */
export function lerDevolucao(fonte: string): { emails: string[]; motivo: string } {
  const texto = fonte.replace(/=\r?\n/g, ""); // remove quebras do quoted-printable
  const emails = new Set<string>();

  // 1) Cabeçalho padrão do Gmail
  for (const m of texto.matchAll(/^X-Failed-Recipients:\s*(.+)$/gim)) {
    for (const e of m[1]!.split(",")) {
      const limpo = e.trim().toLowerCase();
      if (limpo.includes("@")) emails.add(limpo);
    }
  }
  // 2) Relatório técnico (DSN)
  for (const m of texto.matchAll(/^Final-Recipient:\s*rfc822;\s*(\S+@\S+)$/gim)) {
    emails.add(m[1]!.trim().toLowerCase().replace(/[<>]/g, ""));
  }

  let motivo = "o endereço não existe ou não pode receber e-mails";
  if (/550[ -]5\.1\.1|does not exist|doesn't exist|user unknown|no such user|address not found|não foi encontrado|endereço não encontrado/i.test(texto)) {
    motivo = "a caixa de e-mail não existe";
  } else if (/mailbox (is )?full|over quota|quota exceeded|caixa.*cheia/i.test(texto)) {
    motivo = "a caixa de e-mail do destinatário está cheia";
  } else if (/domain.*(not found|couldn't be found)|DNS Error|não foi possível encontrar o domínio/i.test(texto)) {
    motivo = "o domínio do e-mail não existe";
  }
  return { emails: [...emails], motivo };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Método não permitido", { status: 405 });

  const user = Deno.env.get("GMAIL_USER");
  const pass = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!user || !pass) return new Response("GMAIL_USER/GMAIL_APP_PASSWORD não configurados", { status: 200 });

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
    socketTimeout: 30_000,
  });

  let processadas = 0;
  let marcadas = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Só devoluções ainda não lidas dos últimos 14 dias
      const desde = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const uids = new Set<number>();
      for (const de of REMETENTES_DEVOLUCAO) {
        const achados = await client.search({ from: de, seen: false, since: desde }, { uid: true });
        for (const uid of achados || []) uids.add(uid);
      }

      for (const uid of uids) {
        const msg = await client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
        if (!msg || !msg.source) continue;
        const { emails, motivo } = lerDevolucao(msg.source.toString("utf8"));
        const recebidaEm = msg.envelope?.date ? new Date(msg.envelope.date) : new Date();

        for (const email of emails) {
          // Inscrições com esse e-mail cujo envio foi marcado como feito antes desta devolução
          const { data, error } = await supabase
            .from("minicurso_inscricoes")
            .update({
              email_enviado_em: null,
              email_erro: `E-mail devolvido pelo servidor: ${motivo}. Confira o endereço e reenvie.`,
            })
            .eq("email", email)
            .not("email_enviado_em", "is", null)
            .lte("email_enviado_em", recebidaEm.toISOString())
            .select("id");
          if (error) throw error;
          marcadas += data?.length ?? 0;
        }

        await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
        processadas++;
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("verificar-devolucoes:", msg);
    try {
      await client.logout();
    } catch {
      /* conexão já encerrada */
    }
    return new Response(JSON.stringify({ ok: false, erro: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, devolucoes: processadas, inscricoesMarcadas: marcadas }), {
    headers: { "Content-Type": "application/json" },
  });
});
