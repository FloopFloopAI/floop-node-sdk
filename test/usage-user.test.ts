import { describe, it, expect } from "vitest";
import { FloopClient } from "../src/client.js";
import { Usage } from "../src/resources/usage.js";
import { User } from "../src/resources/user.js";
import { createMockFetch } from "./helpers/mock-fetch.js";

function client(mock: ReturnType<typeof createMockFetch>) {
  return new FloopClient({ apiKey: "flp_x", fetch: mock.fetch });
}

describe("Usage + User", () => {
  it("usage.summary GETs /api/v1/usage/summary", async () => {
    const mock = createMockFetch();
    mock.enqueue({
      status: 200,
      body: {
        data: {
          plan: { name: "free", displayName: "Free", monthlyCredits: 10, maxProjects: 3, maxStorageMb: 50, maxBandwidthMb: 500 },
          credits: { currentCredits: 8, rolledOverCredits: 0, lifetimeCreditsUsed: 2, rolloverExpiresAt: null },
          currentPeriod: { start: "", end: "", projectsCreated: 1, buildsUsed: 2, refinementsUsed: 0, storageUsedMb: 1, bandwidthUsedMb: 5 },
        },
      },
    });
    const res = await new Usage(client(mock)).summary();
    expect(res.plan.name).toBe("free");
    expect(mock.requests[0]!.url).toBe("https://www.floopfloop.com/api/v1/usage/summary");
  });

  it("user.me GETs /api/v1/user/me and unwraps { user, source }", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: { user: { id: "u1", email: "a@b", role: "member" }, source: "api_key" } } });
    const res = await new User(client(mock)).me();
    expect(res.user.id).toBe("u1");
    expect(res.source).toBe("api_key");
  });
});
