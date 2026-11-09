import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  registrarLembrar,
  sessaoExpirouPorFecharNavegador,
  ultimaEscolhaLembrar,
} from "@/lib/lembrar";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  });
  let cookie = "";
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      get cookie() {
        return cookie;
      },
      set cookie(v: string) {
        const nome = v.split("=")[0] ?? "";
        if (v.includes("=;")) {
          cookie = cookie
            .split("; ")
            .filter((c) => c && !c.startsWith(`${nome}=`))
            .join("; ");
          return;
        }
        const parte = v.split(";")[0] ?? "";
        const outros = cookie.split("; ").filter((c) => c && !c.startsWith(`${nome}=`));
        cookie = [...outros, parte].filter(Boolean).join("; ");
      },
    },
  });
  vi.stubGlobal("window", {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lembrar de mim", () => {
  it("045 - ultimaEscolhaLembrar começa marcada (padrão true)", () => {
    expect(ultimaEscolhaLembrar()).toBe(true);
  });

  it("046 - registrarLembrar(false) grava escolha e cookie de sessão", () => {
    registrarLembrar(false);
    expect(store.get("setec-lembrar")).toBe("0");
    expect(document.cookie).toContain("setec_sessao_aberta=1");
    expect(ultimaEscolhaLembrar()).toBe(false);
  });

  it("047 - registrarLembrar(true) grava 1 e mantém escolha marcada", () => {
    registrarLembrar(true);
    expect(store.get("setec-lembrar")).toBe("1");
    expect(ultimaEscolhaLembrar()).toBe(true);
  });

  it("048 - sessão não expirou enquanto o cookie de sessão existe", () => {
    registrarLembrar(false);
    expect(sessaoExpirouPorFecharNavegador()).toBe(false);
  });

  it("049 - sessão expira se não lembrar e o cookie sumiu (navegador fechado)", () => {
    store.set("setec-lembrar", "0");
    // cookie vazio = navegador reaberto
    expect(document.cookie).toBe("");
    expect(sessaoExpirouPorFecharNavegador()).toBe(true);
  });

  it("050 - com lembrar marcado a sessão não expira sem cookie", () => {
    store.set("setec-lembrar", "1");
    expect(sessaoExpirouPorFecharNavegador()).toBe(false);
  });

  it("051 - sem window retorna false na checagem de expiração", () => {
    vi.stubGlobal("window", undefined);
    expect(sessaoExpirouPorFecharNavegador()).toBe(false);
  });
});
