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

import { BUCKET, resolveUrl, uploadFile } from "@/lib/setec";

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

describe("uploadFile - falha no Storage", () => {
  it("070 - repassa o erro do Storage para quem chamou (a tela mostra a mensagem)", async () => {
    const erro = { message: "Payload too large", statusCode: "413" };
    storage.upload.mockResolvedValue({ data: null, error: erro });
    const arquivo = new File(["x"], "grande.jpg", { type: "image/jpeg" });

    await expect(uploadFile(arquivo, "apoiadores")).rejects.toBe(erro);
  });
});

describe("resolveUrl - URL completa", () => {
  it("071 - devolve a URL igual quando ela já começa com http(s), sem consultar o Storage", async () => {
    const url = "https://cdn.exemplo.com/logo.png";

    await expect(resolveUrl(url)).resolves.toBe(url);
    await expect(resolveUrl("http://site.com/a.jpg")).resolves.toBe("http://site.com/a.jpg");
    expect(storage.from).not.toHaveBeenCalled();
  });
});

describe("resolveUrl - caminho do bucket", () => {
  it("072 - transforma o caminho salvo no banco na URL pública do Supabase", async () => {
    const publica = "https://projeto.supabase.co/storage/v1/object/public/setec-bucket/logos/a.png";
    storage.getPublicUrl.mockReturnValue({ data: { publicUrl: publica } });

    await expect(resolveUrl("/logos/a.png")).resolves.toBe(publica);
    expect(storage.from).toHaveBeenCalledWith(BUCKET);
    expect(storage.getPublicUrl).toHaveBeenCalledWith("logos/a.png");

    vi.stubEnv("VITE_SUPABASE_URL", "https://projeto.supabase.co");
    await expect(resolveUrl("storage/v1/object/public/setec-bucket/b.png")).resolves.toBe(
      "https://projeto.supabase.co/storage/v1/object/public/setec-bucket/b.png",
    );
  });
});

describe("resolveUrl - sem imagem", () => {
  it("073 - devolve null para valor vazio, nulo ou indefinido", async () => {
    await expect(resolveUrl("")).resolves.toBeNull();
    await expect(resolveUrl(null)).resolves.toBeNull();
    await expect(resolveUrl(undefined)).resolves.toBeNull();
    expect(storage.from).not.toHaveBeenCalled();
  });
});
