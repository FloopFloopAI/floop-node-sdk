import { describe, it, expect } from "vitest";
import { FloopClient } from "../src/client.js";
import { FloopError } from "../src/errors.js";
import { CURRENT_VERSION } from "../src/version.js";
import { createMockFetch } from "./helpers/mock-fetch.js";

describe("FloopClient transport", () => {
  it("sends bearer + user-agent and unwraps the {data} envelope", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: { hello: "world" } } });

    const client = new FloopClient({ apiKey: "flp_abc", fetch: mock.fetch });
    const result = await client.__request<{ hello: string }>("GET", "/api/v1/ping");

    expect(result).toEqual({ hello: "world" });
    expect(mock.requests).toHaveLength(1);
    const req = mock.requests[0]!;
    expect(req.url).toBe("https://www.floopfloop.com/api/v1/ping");
    expect(req.method).toBe("GET");
    expect(req.headers["authorization"]).toBe("Bearer flp_abc");
    expect(req.headers["user-agent"]).toBe(`floop-sdk/${CURRENT_VERSION}`);
  });

  it("attaches content-type only when a body is sent", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: {} } });
    const client = new FloopClient({ apiKey: "flp_abc", fetch: mock.fetch });

    await client.__request("POST", "/x", { foo: 1 });
    expect(mock.requests[0]!.headers["content-type"]).toBe("application/json");
    expect(mock.requests[0]!.body).toBe('{"foo":1}');
  });

  it("throws a typed FloopError on error envelope", async () => {
    const mock = createMockFetch();
    mock.enqueue({
      status: 404,
      body: { error: { code: "NOT_FOUND", message: "no such project" } },
      headers: { "x-request-id": "req_1" },
    });
    const client = new FloopClient({ apiKey: "flp_abc", fetch: mock.fetch });

    await expect(client.__request("GET", "/x")).rejects.toMatchObject({
      name: "FloopError",
      code: "NOT_FOUND",
      status: 404,
      requestId: "req_1",
      message: "no such project",
    });
  });

  it("parses retry-after on 429 into retryAfterMs", async () => {
    const mock = createMockFetch();
    mock.enqueue({
      status: 429,
      body: { error: { code: "RATE_LIMITED", message: "slow down" } },
      headers: { "retry-after": "5" },
    });
    const client = new FloopClient({ apiKey: "flp_abc", fetch: mock.fetch });

    try {
      await client.__request("GET", "/x");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(FloopError);
      const fe = err as FloopError;
      expect(fe.code).toBe("RATE_LIMITED");
      expect(fe.retryAfterMs).toBe(5000);
    }
  });

  it("maps a thrown fetch into NETWORK_ERROR with status 0", async () => {
    const mock = createMockFetch();
    mock.enqueueNetworkError("ECONNREFUSED");
    const client = new FloopClient({ apiKey: "flp_abc", fetch: mock.fetch });

    await expect(client.__request("GET", "/x")).rejects.toMatchObject({
      name: "FloopError",
      code: "NETWORK_ERROR",
      status: 0,
    });
  });

  it("falls back to SERVER_ERROR when the error body is non-JSON on 5xx", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 500 });
    const client = new FloopClient({ apiKey: "flp_abc", fetch: mock.fetch });

    await expect(client.__request("GET", "/x")).rejects.toMatchObject({
      code: "SERVER_ERROR",
      status: 500,
    });
  });

  it("honours a custom baseUrl", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: {} } });
    const client = new FloopClient({
      apiKey: "flp_abc",
      baseUrl: "https://staging.floopfloop.com/",
      fetch: mock.fetch,
    });
    await client.__request("GET", "/api/v1/ping");
    expect(mock.requests[0]!.url).toBe("https://staging.floopfloop.com/api/v1/ping");
  });

  it("distinguishes user-initiated abort from timeout", async () => {
    // Fetch that rejects with AbortError when the signal is aborted, so the
    // client sees the same failure shape real fetch produces.
    const fetchImpl: typeof fetch = async (_input, init) => {
      if (init?.signal?.aborted) {
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      }
      throw new Error("mock fetch: expected signal to be aborted");
    };
    const ac = new AbortController();
    ac.abort();
    const client = new FloopClient({ apiKey: "flp_x", fetch: fetchImpl });

    await expect(
      client.__request("GET", "/x", undefined, { signal: ac.signal }),
    ).rejects.toMatchObject({
      name: "FloopError",
      code: "NETWORK_ERROR",
      message: "Request aborted",
    });
  });

  it("parses retry-after when the server sends an HTTP-date", async () => {
    const mock = createMockFetch();
    const future = new Date(Date.now() + 3_000);
    mock.enqueue({
      status: 429,
      body: { error: { code: "RATE_LIMITED", message: "slow down" } },
      headers: { "retry-after": future.toUTCString() },
    });
    const client = new FloopClient({ apiKey: "flp_x", fetch: mock.fetch });

    try {
      await client.__request("GET", "/x");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(FloopError);
      const fe = err as FloopError;
      expect(fe.code).toBe("RATE_LIMITED");
      // UTCString strips milliseconds; allow generous bounds.
      expect(fe.retryAfterMs).toBeGreaterThanOrEqual(1_000);
      expect(fe.retryAfterMs).toBeLessThanOrEqual(4_000);
    }
  });
});
