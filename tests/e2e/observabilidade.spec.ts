import { expect, test } from "@playwright/test";

/**
 * Testes dos endpoints de observabilidade: /healthz e /metrics.
 * Não dependem de autenticação e rodam em qualquer ambiente (dev, Docker, preview).
 */
test.describe("Observabilidade - endpoints públicos", () => {
  test("115 - /healthz retorna status ok e uptime", async ({ request }) => {
    const res = await request.get("/healthz");
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      status: "ok",
      uptime_s: expect.any(Number),
      ts: expect.stringMatching(/^\d{4}-/),
    });
  });

  test("116 - /metrics retorna agregado de requisições", async ({ request }) => {
    const res = await request.get("/metrics");
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      uptime_s: expect.any(Number),
      requisicoes: expect.any(Number),
      erros: expect.any(Number),
      taxa_erro: expect.any(Number),
      duracao_media_ms: expect.any(Number),
      rotas: expect.any(Array),
      ultimos_erros: expect.any(Array),
    });
  });

  test("117 - /healthz e /metrics têm cache-control no-store", async ({ request }) => {
    const healthz = await request.get("/healthz");
    expect(healthz.headers()["cache-control"]).toBe("no-store");

    const metrics = await request.get("/metrics");
    expect(metrics.headers()["cache-control"]).toBe("no-store");
  });
});
