/** Domínios mais usados pelos alunos e professores. */
const DOMINIOS_COMUNS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "outlook.com.br",
  "live.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "msn.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
  "fatec.sp.gov.br",
  "cps.sp.gov.br",
  "aluno.cps.sp.gov.br",
];

function distancia(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return d[a.length]![b.length]!;
}

/**
 * Se o domínio parece um erro de digitação de um domínio comum (ex.: "gmqil.com",
 * "hotmal.com", "gmail.con"), devolve o e-mail corrigido; senão, null.
 * Importante: vários desses domínios errados existem de verdade e aceitam e-mail,
 * então o envio "funciona" mas vai para um estranho.
 */
export function sugerirEmail(email: string): string | null {
  const [usuario, dominio] = email.trim().toLowerCase().split("@");
  if (!usuario || !dominio || DOMINIOS_COMUNS.includes(dominio)) return null;
  let melhor: { dominio: string; dist: number } | null = null;
  for (const d of DOMINIOS_COMUNS) {
    const dist = distancia(dominio, d);
    if (dist <= 2 && (!melhor || dist < melhor.dist)) melhor = { dominio: d, dist };
  }
  return melhor ? `${usuario}@${melhor.dominio}` : null;
}
