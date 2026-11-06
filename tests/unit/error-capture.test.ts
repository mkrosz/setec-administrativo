import { afterEach, describe, expect, it, vi } from "vitest";

import { consumeLastCapturedError, describeError } from "@/lib/error-capture";

afterEach(() => {
  // esvazia o buffer consumindo o que sobrou
  consumeLastCapturedError();
});

describe("describeError", () => {
  it("034 - formata Error com stack", () => {
    const err = new Error("falhou");
    const texto = describeError(err);
    expect(texto).toContain("falhou");
    expect(texto).toMatch(/Error/);
  });

  it("035 - inclui cadeia de causes", () => {
    const interno = new Error("raiz");
    const externo = new Error("capa", { cause: interno });
    const texto = describeError(externo);
    expect(texto).toContain("capa");
    expect(texto).toContain("caused by:");
    expect(texto).toContain("raiz");
  });

  it("036 - serializa valor não-Error", () => {
    expect(describeError("texto puro")).toBe("texto puro");
    expect(describeError({ code: 42 })).toContain("42");
  });

  it("037 - anexa status numérico quando existir", () => {
    const err = Object.assign(new Error("boom"), { status: 503 });
    expect(describeError(err)).toContain("(status 503)");
  });

  it("038 - limita tamanho da descrição", () => {
    const enorme = new Error("x".repeat(20_000));
    expect(describeError(enorme).length).toBeLessThanOrEqual(8_000);
  });
});

describe("consumeLastCapturedError", () => {
  it("039 - devolve undefined quando não há captura recente", () => {
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("040 - captura via console.error e consome uma vez", () => {
    const err = new Error("capturado");
    console.error(err);
    const primeiro = consumeLastCapturedError();
    expect(primeiro).toBe(err);
    expect(consumeLastCapturedError()).toBeUndefined();
  });
});
