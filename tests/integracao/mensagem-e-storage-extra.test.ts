import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
  createSignedUrl: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: storage.from } },
}));

import { resolveUrl, uploadFile } from "@/lib/setec";

beforeEach(() => {
  storage.from.mockReturnValue({
    upload: storage.upload,
    getPublicUrl: storage.getPublicUrl,
    createSignedUrl: storage.createSignedUrl,
  });
});

describe("uploadFile - extensões", () => {
  it("090 - usa a extensão do nome do arquivo no caminho", async () => {
    storage.upload.mockResolvedValue({ data: {}, error: null });
    const arquivo = new File(["x"], "doc.JPEG", { type: "image/jpeg" });
    const caminho = await uploadFile(arquivo, "apoiadores");
    expect(caminho).toMatch(/^apoiadores\/[0-9a-f-]{36}\.JPEG$/);
  });

  it("091 - nome sem ponto usa o próprio nome como 'extensão'", async () => {
    storage.upload.mockResolvedValue({ data: {}, error: null });
    const arquivo = new File(["x"], "semext", { type: "application/octet-stream" });
    const caminho = await uploadFile(arquivo, "palestrantes");
    expect(caminho).toMatch(/^palestrantes\/[0-9a-f-]{36}\.semext$/);
  });
});

describe("resolveUrl - signed URL", () => {
  it("092 - usa URL assinada quando a pública vem vazia", async () => {
    storage.getPublicUrl.mockReturnValue({ data: { publicUrl: "" } });
    storage.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://signed.example/a.png" },
      error: null,
    });

    await expect(resolveUrl("privado/a.png")).resolves.toBe("https://signed.example/a.png");
    expect(storage.createSignedUrl).toHaveBeenCalledWith("privado/a.png", 60 * 60 * 24);
  });
});
