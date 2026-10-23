import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) } },
}));

import { AiUnavailableError, InvalidImageError, generateCaption } from "./ai";

const file = new File([new Uint8Array([1, 2, 3])], "scan.png", { type: "image/png" });
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("generateCaption", () => {
  it("returns the trimmed caption and sends the bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { caption: "  findings  " }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateCaption(file, "xray")).resolves.toBe("findings");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });

  it("maps image rejections to InvalidImageError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(422, { code: "INVALID_IMAGE", message: "nope" })));
    await expect(generateCaption(file, "xray")).rejects.toBeInstanceOf(InvalidImageError);
  });

  it("maps 503 and 401 to AiUnavailableError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(503, { code: "ANALYZER_UNAVAILABLE", message: "down" })));
    await expect(generateCaption(file, "ct")).rejects.toBeInstanceOf(AiUnavailableError);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(401, { code: "UNAUTHORIZED", message: "x" })));
    await expect(generateCaption(file, "ct")).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it("treats a network failure as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(generateCaption(file, "xray")).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it("rejects an empty caption", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(200, { caption: "   " })));
    await expect(generateCaption(file, "xray")).rejects.toThrow(/empty/);
  });

  it("propagates a caller abort instead of reporting the service as down", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal!.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
          );
        })
      )
    );
    const pending = generateCaption(file, "xray", controller.signal);
    // Let generateCaption get past its session lookup and into fetch.
    await new Promise((r) => setTimeout(r, 0));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
