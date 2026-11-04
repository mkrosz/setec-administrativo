import { beforeEach, describe, expect, it, vi } from "vitest";

// Cliente do Supabase simulado: os testes conferem como o código conversa com o Storage.
const storage = vi.hoisted(() => ({
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
  createSignedUrl: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: storage.from } },
}));

import { BUCKET, uploadFile } from "@/lib/setec";

beforeEach(() => {
  storage.from.mockReturnValue({
    upload: storage.upload,
    getPublicUrl: storage.getPublicUrl,
    createSignedUrl: storage.createSignedUrl,
  });
});

describe("uploadFile (Supabase Storage)", () => {
  it("069 - envia o arquivo para a pasta certa com nome único e devolve o caminho", async () => {
    storage.upload.mockResolvedValue({ data: {}, error: null });
    const arquivo = new File(["conteudo"], "foto.png", { type: "image/png" });

    const caminho = await uploadFile(arquivo, "palestrantes");

    expect(storage.from).toHaveBeenCalledWith(BUCKET);
    expect(caminho).toMatch(/^palestrantes\/[0-9a-f-]{36}\.png$/);
    expect(storage.upload).toHaveBeenCalledWith(caminho, arquivo, {
      cacheControl: "3600",
      upsert: false,
    });

    const outro = await uploadFile(arquivo, "palestrantes");
    expect(outro).not.toBe(caminho);
  });
});
