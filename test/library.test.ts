import { describe, it, expect } from "vitest";
import { FloopClient } from "../src/client.js";
import { Library } from "../src/resources/library.js";
import { createMockFetch } from "./helpers/mock-fetch.js";

function client(mock: ReturnType<typeof createMockFetch>) {
  return new FloopClient({ apiKey: "flp_x", fetch: mock.fetch });
}

describe("Library", () => {
  it("list accepts filters and returns a flat array", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: [{ id: "l1", name: "A", description: null, subdomain: "a", botType: "site", cloneCount: 0, createdAt: "" }] } });
    const items = await new Library(client(mock)).list({ botType: "site", sort: "popular", limit: 5 });
    expect(items).toHaveLength(1);
    expect(mock.requests[0]!.url).toBe(
      "https://www.floopfloop.com/api/v1/library?botType=site&sort=popular&limit=5",
    );
  });

  it("list handles a paged {items} wrapper transparently", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: { items: [{ id: "l2", name: "B", description: null, subdomain: "b", botType: null, cloneCount: 1, createdAt: "" }], total: 1 } } });
    const items = await new Library(client(mock)).list();
    expect(items[0]!.id).toBe("l2");
  });

  it("clone POSTs the target subdomain", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: { id: "p9", name: "B", subdomain: "my-b", status: "queued" } } });
    const cloned = await new Library(client(mock)).clone("l2", { subdomain: "my-b" });
    expect(cloned.id).toBe("p9");
    expect(mock.requests[0]!.url).toBe("https://www.floopfloop.com/api/v1/library/l2/clone");
    expect(JSON.parse(mock.requests[0]!.body!)).toEqual({ subdomain: "my-b" });
  });
});
