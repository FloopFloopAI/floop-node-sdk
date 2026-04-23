import { describe, it, expect } from "vitest";
import { FloopClient } from "../src/index.js";
import { createMockFetch } from "./helpers/mock-fetch.js";

describe("FloopClient end-to-end wiring", () => {
  it("exposes all eight namespaced resources", () => {
    const mock = createMockFetch();
    const floop = new FloopClient({ apiKey: "flp_x", fetch: mock.fetch });
    expect(floop.projects).toBeDefined();
    expect(floop.secrets).toBeDefined();
    expect(floop.apiKeys).toBeDefined();
    expect(floop.library).toBeDefined();
    expect(floop.subdomains).toBeDefined();
    expect(floop.uploads).toBeDefined();
    expect(floop.usage).toBeDefined();
    expect(floop.user).toBeDefined();
  });

  it("rejects construction without an apiKey", () => {
    // @ts-expect-error -- intentional for runtime guard coverage
    expect(() => new FloopClient({})).toThrow(/apiKey/);
  });
});
