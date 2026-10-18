// "Lembrar de mim" do login.
// O Supabase guarda a sessão no localStorage, então por padrão ela sobreviveria a fechar o navegador.
// - Marcado: a sessão continua mesmo fechando e abrindo o navegador.
// - Desmarcado: um cookie de sessão (sem data de validade) marca que o navegador ainda está aberto;
//   o navegador apaga esse cookie ao ser fechado e, na próxima visita, a pessoa é deslogada.
//   O cookie vale para todas as abas, então abrir o painel em outra aba não desloga.

const CHAVE = "setec-lembrar";
const COOKIE = "setec_sessao_aberta";

function cookieAtivo() {
  return document.cookie.split("; ").some((c) => c === `${COOKIE}=1`);
}

/** Chamar logo após o login, com a escolha da caixinha. */
export function registrarLembrar(lembrar: boolean) {
  try {
    localStorage.setItem(CHAVE, lembrar ? "1" : "0");
  } catch {
    /* armazenamento bloqueado */
  }
  document.cookie = `${COOKIE}=1; path=/; SameSite=Lax`;
}

/** true se a pessoa escolheu não ser lembrada e o navegador foi fechado desde o login. */
export function sessaoExpirouPorFecharNavegador() {
  if (typeof window === "undefined") return false;
  let lembrar: string | null = null;
  try {
    lembrar = localStorage.getItem(CHAVE);
  } catch {
    return false;
  }
  return lembrar === "0" && !cookieAtivo();
}

/** Última escolha da caixinha (marcada por padrão na primeira vez). */
export function ultimaEscolhaLembrar() {
  try {
    return localStorage.getItem(CHAVE) !== "0";
  } catch {
    return true;
  }
}
