import { describe, it, expect } from "vitest";
import { FloopClient } from "../src/client.js";
import { pollProjectStatus } from "../src/util/poll.js";
import { createMockFetch } from "./helpers/mock-fetch.js";

function queueStatus(
  mock: ReturnType<typeof createMockFetch>,
  status: string,
  extra: Record<string, unknown> = {},
) {
  mock.enqueue({
    status: 200,
    body: {
      data: {
        step: 1,
        totalSteps: 3,
        status,
        message: `status=${status}`,
        ...extra,
      },
    },
  });
}

describe("pollProjectStatus", () => {
  it("yields state transitions and stops at a terminal state", async () => {
    const mock = createMockFetch();
    queueStatus(mock, "queued");
    queueStatus(mock, "generating", { progress: 0.3 });
    queueStatus(mock, "generating", { progress: 0.3 }); // duplicate → deduped
    queueStatus(mock, "deploying");
    queueStatus(mock, "live");

    const client = new FloopClient({ apiKey: "flp_x", fetch: mock.fetch, pollIntervalMs: 1 });
    const events = [];
    for await (const ev of pollProjectStatus(client, "p_1")) events.push(ev.status);

    expect(events).toEqual(["queued", "generating", "deploying", "live"]);
    expect(mock.requests).toHaveLength(5);
    expect(mock.requests[0]!.url).toBe("https://www.floopfloop.com/api/v1/projects/p_1/status");
  });

  it("terminates on failed + cancelled too", async () => {
    const mock = createMockFetch();
    queueStatus(mock, "failed");
    const client = new FloopClient({ apiKey: "flp_x", fetch: mock.fetch, pollIntervalMs: 1 });
    const events = [];
    for await (const ev of pollProjectStatus(client, "p_1")) events.push(ev.status);
    expect(events).toEqual(["failed"]);
  });

  it("propagates AbortSignal — for-await breaks out cleanly", async () => {
    const mock = createMockFetch();
    queueStatus(mock, "queued");
    queueStatus(mock, "generating");
    const client = new FloopClient({ apiKey: "flp_x", fetch: mock.fetch, pollIntervalMs: 1 });
    const ac = new AbortController();

    const events: string[] = [];
    const p = (async () => {
      for await (const ev of pollProjectStatus(client, "p_1", { signal: ac.signal })) {
        events.push(ev.status);
        if (events.length === 1) ac.abort();
      }
    })();
    await expect(p).rejects.toThrow();
    expect(events).toEqual(["queued"]);
  });
});
