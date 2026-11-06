import { describe, expect, it } from "vitest";

import { renderErrorPage } from "@/lib/error-page";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("041 - mescla classes sem conflito trivial", () => {
    expect(cn("px-2", "py-1")).toContain("px-2");
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("042 - ignora valores falsy", () => {
    const cond = false;
    expect(cn("a", cond && "b", null, undefined, "c")).toBe("a c");
  });
});

describe("renderErrorPage", () => {
  it("043 - devolve HTML completo com título e ações", () => {
    const html = renderErrorPage();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("This page didn't load");
    expect(html).toContain("Try again");
    expect(html).toContain('href="/"');
  });

  it("044 - inclui viewport e charset", () => {
    const html = renderErrorPage();
    expect(html).toContain("charset");
    expect(html).toContain("viewport");
  });
});
