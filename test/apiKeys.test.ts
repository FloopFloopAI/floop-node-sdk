import { describe, it, expect } from "vitest";
import { FloopClient } from "../src/client.js";
import { ApiKeys } from "../src/resources/apiKeys.js";
import { createMockFetch } from "./helpers/mock-fetch.js";

function client(mock: ReturnType<typeof createMockFetch>) {
  return new FloopClient({ apiKey: "flp_x", fetch: mock.fetch });
}

describe("ApiKeys", () => {
  it("list unwraps .keys", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: { keys: [{ id: "k1", name: "ci", keyPrefix: "flp_ab", scopes: [], lastUsedAt: null, createdAt: "" }] } } });
    const items = await new ApiKeys(client(mock)).list();
    expect(items[0]!.keyPrefix).toBe("flp_ab");
  });

  it("create posts a name and returns the issued key", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: { id: "k2", rawKey: "flp_secret", keyPrefix: "flp_se" } } });
    const issued = await new ApiKeys(client(mock)).create({ name: "ci" });
    expect(issued.rawKey).toBe("flp_secret");
    expect(JSON.parse(mock.requests[0]!.body!)).toEqual({ name: "ci" });
  });

  it("remove by id calls DELETE /api-keys/:id", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: { keys: [{ id: "k1", name: "ci", keyPrefix: "flp_ab", scopes: [], lastUsedAt: null, createdAt: "" }] } } });
    mock.enqueue({ status: 200, body: { data: { success: true } } });
    await new ApiKeys(client(mock)).remove("k1");
    expect(mock.requests[1]!.method).toBe("DELETE");
    expect(mock.requests[1]!.url).toBe("https://www.floopfloop.com/api/v1/api-keys/k1");
  });

  it("remove by name resolves via list first", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: { keys: [{ id: "k9", name: "ci", keyPrefix: "flp_ab", scopes: [], lastUsedAt: null, createdAt: "" }] } } });
    mock.enqueue({ status: 200, body: { data: { success: true } } });
    await new ApiKeys(client(mock)).remove("ci");
    expect(mock.requests[1]!.url).toBe("https://www.floopfloop.com/api/v1/api-keys/k9");
  });

  it("remove throws NOT_FOUND when neither id nor name matches", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: { keys: [] } } });
    await expect(new ApiKeys(client(mock)).remove("nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
