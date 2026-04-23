import { describe, it, expect } from "vitest";
import { FloopClient } from "../src/client.js";
import { Subdomains } from "../src/resources/subdomains.js";
import { createMockFetch } from "./helpers/mock-fetch.js";

function client(mock: ReturnType<typeof createMockFetch>) {
  return new FloopClient({ apiKey: "flp_x", fetch: mock.fetch });
}

describe("Subdomains", () => {
  it("check sends ?subdomain=<slug>", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: { valid: true, available: false } } });
    const res = await new Subdomains(client(mock)).check("taken");
    expect(res.available).toBe(false);
    expect(mock.requests[0]!.url).toBe(
      "https://www.floopfloop.com/api/v1/subdomains/check?subdomain=taken",
    );
  });

  it("suggest returns .suggestion", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: { suggestion: "joyful-panda-42" } } });
    const res = await new Subdomains(client(mock)).suggest("a joyful panda blog");
    expect(res.suggestion).toBe("joyful-panda-42");
  });
});
