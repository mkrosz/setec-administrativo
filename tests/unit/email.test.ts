import { describe, expect, it } from "vitest";

import { sugerirEmail } from "@/lib/email";

describe("sugerirEmail", () => {
  it("028 - não sugere quando o domínio já é comum", () => {
    expect(sugerirEmail("ana@gmail.com")).toBeNull();
    expect(sugerirEmail("prof@fatec.sp.gov.br")).toBeNull();
    expect(sugerirEmail("x@aluno.cps.sp.gov.br")).toBeNull();
  });

  it("029 - corrige erros de digitação próximos (distância ≤ 2)", () => {
    expect(sugerirEmail("ana@gmqil.com")).toBe("ana@gmail.com");
    expect(sugerirEmail("ana@hotmal.com")).toBe("ana@hotmail.com");
    expect(sugerirEmail("ana@gmail.con")).toBe("ana@gmail.com");
  });

  it("030 - ignora e-mail sem @ ou partes vazias", () => {
    expect(sugerirEmail("sem-arroba")).toBeNull();
    expect(sugerirEmail("@gmail.com")).toBeNull();
    expect(sugerirEmail("ana@")).toBeNull();
    expect(sugerirEmail("   ")).toBeNull();
  });

  it("031 - normaliza maiúsculas e espaços", () => {
    expect(sugerirEmail("  Ana@Gmqil.COM  ")).toBe("ana@gmail.com");
  });

  it("032 - não sugere domínio muito diferente", () => {
    expect(sugerirEmail("ana@empresa-unica-xyz.com.br")).toBeNull();
  });

  it("033 - corrige outlook e yahoo tipados errado", () => {
    expect(sugerirEmail("x@outlok.com")).toBe("x@outlook.com");
    expect(sugerirEmail("x@yaho.com")).toBe("x@yahoo.com");
  });
});
