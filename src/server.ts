import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  logErro,
  normalizarCaminho,
  podeVerErros,
  registrarRequisicao,
  snapshotMetricas,
  statusSaude,
} from "./lib/observabilidade";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  const erro = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  logErro("ssr.swallowed", erro);
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

function respostaObservabilidade(request: Request): Response | null {
  const caminho = normalizarCaminho(request.url);
  if (caminho === "/healthz") {
    return Response.json(statusSaude(), {
      headers: { "cache-control": "no-store" },
    });
  }
  if (caminho === "/metrics") {
    return Response.json(snapshotMetricas({ incluirErros: podeVerErros(request) }), {
      headers: { "cache-control": "no-store" },
    });
  }
  return null;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const inicio = Date.now();
    const metodo = request.method || "GET";
    const caminho = normalizarCaminho(request.url);

    const observavel = respostaObservabilidade(request);
    if (observavel) {
      registrarRequisicao({
        metodo,
        caminho,
        status: observavel.status,
        duracaoMs: Date.now() - inicio,
      });
      return observavel;
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalizada = await normalizeCatastrophicSsrResponse(response);
      registrarRequisicao({
        metodo,
        caminho,
        status: normalizada.status,
        duracaoMs: Date.now() - inicio,
      });
      return normalizada;
    } catch (error) {
      logErro("server.fetch", error, { metodo, caminho });
      registrarRequisicao({
        metodo,
        caminho,
        status: 500,
        duracaoMs: Date.now() - inicio,
      });
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
