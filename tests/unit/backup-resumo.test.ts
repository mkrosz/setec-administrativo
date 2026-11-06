import { describe, expect, it } from "vitest";

import { resumoBackup, type BackupData } from "@/lib/backup";

describe("resumoBackup", () => {
  it("052 - conta zero quando campos estão ausentes", () => {
    const r = resumoBackup({});
    expect(r).toEqual({
      exportadoEm: null,
      evento: false,
      palestras: 0,
      presencas: 0,
      minicursos: 0,
      inscricoes: 0,
      apoiadores: 0,
      comissao: 0,
    });
  });

  it("053 - conta arrays e marca evento presente", () => {
    const dados = {
      exportado_em: "2026-11-04T12:00:00.000Z",
      evento: { id: "1" } as BackupData["evento"],
      palestras: [{ id: "a" }, { id: "b" }] as BackupData["palestras"],
      apoiadores: [{ id: "x" }] as BackupData["apoiadores"],
      comissao: [{}, {}] as BackupData["comissao"],
      minicursos: [{}] as BackupData["minicursos"],
      minicurso_inscricoes: [{}, {}, {}] as BackupData["minicurso_inscricoes"],
      presencas: [{}, {}] as BackupData["presencas"],
    } as any as Partial<BackupData>;
    const r = resumoBackup(dados);
    expect(r.evento).toBe(true);
    expect(r.palestras).toBe(2);
    expect(r.apoiadores).toBe(1);
    expect(r.comissao).toBe(2);
    expect(r.minicursos).toBe(1);
    expect(r.inscricoes).toBe(3);
    expect(r.presencas).toBe(2);
    expect(r.exportadoEm).toBeTruthy();
  });

  it("054 - trata valores não-array como zero", () => {
    const r = resumoBackup({
      palestras: "x" as unknown as BackupData["palestras"],
    });
    expect(r.palestras).toBe(0);
  });
});
