import { afterEach, describe, expect, it, vi } from "vitest";

import { obterPosicao } from "@/lib/geo";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("obterPosicao", () => {
  it("082 - rejeita quando geolocation não existe", async () => {
    vi.stubGlobal("navigator", {});
    await expect(obterPosicao()).rejects.toThrow(/não permite obter a localização/i);
  });

  it("083 - resolve com coordenadas do navegador", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) => {
          ok({
            coords: {
              latitude: -23.55,
              longitude: -46.63,
              accuracy: 8,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON() {
                return this;
              },
            },
            timestamp: Date.now(),
            toJSON() {
              return this;
            },
          } as GeolocationPosition);
        },
      },
    });
    await expect(obterPosicao()).resolves.toEqual({
      latitude: -23.55,
      longitude: -46.63,
      precisao: 8,
    });
  });

  it("084 - traduz PERMISSION_DENIED", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (_ok: PositionCallback, err: PositionErrorCallback) => {
          err({
            code: 1,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
            message: "denied",
          } as GeolocationPositionError);
        },
      },
    });
    await expect(obterPosicao()).rejects.toThrow(/Permita o acesso à localização/i);
  });

  it("085 - traduz outros erros de GPS", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (_ok: PositionCallback, err: PositionErrorCallback) => {
          err({
            code: 2,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
            message: "unavailable",
          } as GeolocationPositionError);
        },
      },
    });
    await expect(obterPosicao()).rejects.toThrow(/GPS/i);
  });
});
