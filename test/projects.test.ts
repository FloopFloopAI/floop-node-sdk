import { describe, it, expect } from "vitest";
import { FloopClient } from "../src/client.js";
import { Projects } from "../src/resources/projects.js";
import { createMockFetch } from "./helpers/mock-fetch.js";

function client(mock: ReturnType<typeof createMockFetch>) {
  return new FloopClient({ apiKey: "flp_x", fetch: mock.fetch, pollIntervalMs: 1 });
}

describe("Projects", () => {
  it("create POSTs to /api/v1/projects and returns the project + deployment", async () => {
    const mock = createMockFetch();
    mock.enqueue({
      status: 200,
      body: {
        data: {
          project: { id: "p1", name: "n", subdomain: "s", status: "queued" },
          deployment: { id: "d1", status: "queued", version: 1 },
        },
      },
    });
    const projects = new Projects(client(mock));
    const res = await projects.create({ prompt: "hi", name: "n", subdomain: "s" });

    expect(res.project.id).toBe("p1");
    expect(res.deployment.version).toBe(1);
    const req = mock.requests[0]!;
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://www.floopfloop.com/api/v1/projects");
    expect(JSON.parse(req.body!)).toEqual({ prompt: "hi", name: "n", subdomain: "s" });
  });

  it("list with teamId appends query string", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: [] } });
    await new Projects(client(mock)).list({ teamId: "team_42" });
    expect(mock.requests[0]!.url).toBe(
      "https://www.floopfloop.com/api/v1/projects?teamId=team_42",
    );
  });

  it("get resolves a subdomain by filtering the list", async () => {
    const mock = createMockFetch();
    mock.enqueue({
      status: 200,
      body: { data: [
        { id: "p1", subdomain: "foo", status: "live" },
        { id: "p2", subdomain: "bar", status: "live" },
      ] },
    });
    const got = await new Projects(client(mock)).get("bar");
    expect(got.id).toBe("p2");
  });

  it("get throws NOT_FOUND when no project matches", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: [] } });
    await expect(new Projects(client(mock)).get("nope")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("cancel POSTs to the /cancel route", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: { success: true } } });
    await new Projects(client(mock)).cancel("p1");
    expect(mock.requests[0]!.url).toBe(
      "https://www.floopfloop.com/api/v1/projects/p1/cancel",
    );
    expect(mock.requests[0]!.method).toBe("POST");
  });

  it("waitForLive resolves with the live project on success", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: { step: 1, totalSteps: 3, status: "queued", message: "" } } });
    mock.enqueue({ status: 200, body: { data: { step: 2, totalSteps: 3, status: "generating", message: "" } } });
    mock.enqueue({ status: 200, body: { data: { step: 3, totalSteps: 3, status: "live", message: "" } } });
    mock.enqueue({ status: 200, body: { data: [{ id: "p1", subdomain: "s", status: "live", url: "https://s.floop.tech" }] } });

    const proj = await new Projects(client(mock)).waitForLive("p1");
    expect(proj.status).toBe("live");
    expect(proj.url).toBe("https://s.floop.tech");
  });

  it("waitForLive throws BUILD_FAILED on a failed terminal state", async () => {
    const mock = createMockFetch();
    mock.enqueue({ status: 200, body: { data: { step: 1, totalSteps: 3, status: "failed", message: "oops" } } });
    await expect(new Projects(client(mock)).waitForLive("p1")).rejects.toMatchObject({
      code: "BUILD_FAILED",
    });
  });
});
