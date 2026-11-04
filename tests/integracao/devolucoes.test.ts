import type { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Edge Function "verificar-devolucoes" simulada.
const invoke = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

function criarQueryClient() {
  const invalidateQueries = vi.fn();
  return { client: { invalidateQueries } as unknown as QueryClient, invalidateQueries };
}

// O módulo guarda o horário da última verificação: cada teste usa uma cópia nova.
async function carregarModulo() {
  vi.resetModules();
  return import("@/lib/devolucoes");
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-04T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("verificarDevolucoes - limite de chamadas", () => {
  it("074 - chama a Edge Function no máximo uma vez a cada 30 segundos", async () => {
    invoke.mockResolvedValue({ data: { inscricoesMarcadas: 0 }, error: null });
    const { verificarDevolucoes } = await carregarModulo();
    const { client } = criarQueryClient();

    await verificarDevolucoes(client);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("verificar-devolucoes", { body: {} });

    vi.setSystemTime(new Date("2026-11-04T10:00:20Z"));
    await verificarDevolucoes(client);
    expect(invoke).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-11-04T10:00:31Z"));
    await verificarDevolucoes(client);
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
