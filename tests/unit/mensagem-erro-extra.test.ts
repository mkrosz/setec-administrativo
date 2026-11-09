import { describe, expect, it, vi } from "vitest";

import { mensagemErro } from "@/lib/setec";

describe("mensagemErro - demais traduções", () => {
  it("064 - e-mail não confirmado e conta já registrada", () => {
    expect(mensagemErro({ message: "Email not confirmed" })).toMatch(/não foi confirmado/i);
    expect(mensagemErro({ message: "User already registered" })).toMatch(/Já existe uma conta/i);
  });

  it("065 - regras de senha", () => {
    expect(mensagemErro({ message: "Password should be at least 6 characters" })).toMatch(
      /pelo menos 6/i,
    );
    expect(
      mensagemErro({ message: "New password should be different from the old password" }),
    ).toMatch(/diferente da atual/i);
  });

  it("066 - foreign key e check constraint", () => {
    expect(mensagemErro({ message: "violates foreign key constraint", code: "23503" })).toMatch(
      /ligado a outros/i,
    );
    expect(mensagemErro({ message: "invalid input syntax", code: "22P02" })).toMatch(
      /formato inválido/i,
    );
  });

  it("067 - schema cache / tabela inexistente", () => {
    expect(mensagemErro({ message: "Could not find the table", code: "PGRST205" })).toMatch(
      /não está disponível/i,
    );
  });

  it("068 - timeout e JSON inválido", () => {
    expect(mensagemErro({ message: "Request timed out" })).toMatch(/demorou/i);
    expect(mensagemErro({ message: "Unexpected token < in JSON" })).toMatch(
      /Não foi possível ler/i,
    );
  });

  it("076 - usa só o code quando message vazia e code casa com tradução", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(mensagemErro({ message: "", code: "23505" })).toMatch(/já existe/i);
    warn.mockRestore();
  });
});
