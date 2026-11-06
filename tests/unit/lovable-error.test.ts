import { afterEach, describe, expect, it, vi } from "vitest";

import { reportLovableError } from "@/lib/lovable-error-reporting";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reportLovableError", () => {
  it("077 - não faz nada sem window (SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(() => reportLovableError(new Error("x"))).not.toThrow();
  });

  it("078 - encaminha Error para captureException e reportRuntimeError", () => {
    const captureException = vi.fn();
    const reportRuntime = vi.fn();
    vi.stubGlobal("window", {
      location: { pathname: "/painel" },
      __lovableEvents: { captureException },
      __lovableReportRuntimeError: reportRuntime,
    });

    const err = new Error("borda");
    reportLovableError(err, { extra: 1 });

    expect(captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ source: "react_error_boundary", route: "/painel", extra: 1 }),
      expect.objectContaining({ mechanism: "react_error_boundary" }),
    );
    expect(reportRuntime).toHaveBeenCalledWith(
      expect.objectContaining({ message: "borda", filename: "/painel" }),
    );
  });

  it("081 - formata Response com status e URL", () => {
    const reportRuntime = vi.fn();
    vi.stubGlobal("window", {
      location: { pathname: "/" },
      __lovableReportRuntimeError: reportRuntime,
    });
    reportLovableError(new Response(null, { status: 502, statusText: "Bad Gateway" }));
    expect(reportRuntime.mock.calls[0]?.[0]?.message).toMatch(/Response 502/);
  });
});
