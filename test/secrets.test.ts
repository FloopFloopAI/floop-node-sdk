import { describe, it, expect } from "vitest";
import { FloopClient } from "../src/client.js";
import { Secrets } from "../src/resources/secrets.js";
import { createMockFetch } from "./helpers/mock-fetch.js";

function client(mock: ReturnType<typeof createMockFetch>) {
  return new FloopClient({ apiKey: "flp_x", fetch: mock.fetch });
}

describe("Secrets", () => {
  it("list unwraps .secrets from the response", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: { secrets: [{ key: "K", lastFour: "abcd", createdAt: "", updatedAt: "" }] } } });
    const items = await new Secrets(client(mock)).list("p1");
    expect(items).toHaveLength(1);
    expect(items[0]!.key).toBe("K");
    expect(mock.requests[0]!.url).toBe("https://www.floopfloop.com/api/v1/projects/p1/secrets");
  });

  it("set POSTs key + value and returns the summary", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: { secret: { key: "K", lastFour: "wxyz", createdAt: "", updatedAt: "" } } } });
    const summary = await new Secrets(client(mock)).set("p1", "K", "v");
    expect(summary.lastFour).toBe("wxyz");
    expect(JSON.parse(mock.requests[0]!.body!)).toEqual({ key: "K", value: "v" });
  });

  it("remove DELETEs /secrets/:key", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: { success: true, existed: true } } });
    const res = await new Secrets(client(mock)).remove("p1", "K");
    expect(res.existed).toBe(true);
    expect(mock.requests[0]!.method).toBe("DELETE");
    expect(mock.requests[0]!.url).toBe("https://www.floopfloop.com/api/v1/projects/p1/secrets/K");
  });
});
