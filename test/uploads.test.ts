import { describe, it, expect } from "vitest";
import { FloopClient } from "../src/client.js";
import { Uploads, guessMimeType } from "../src/resources/uploads.js";
import { createMockFetch } from "./helpers/mock-fetch.js";

function client(mock: ReturnType<typeof createMockFetch>) {
  return new FloopClient({ apiKey: "flp_x", fetch: mock.fetch });
}

describe("Uploads", () => {
  it("happy path: presign then PUT to S3", async () => {
    const mock = createMockFetch();
    mock.enqueue({
      status: 200,
      body: { data: { uploadUrl: "https://s3.example/upload", key: "k1", fileId: "f1" } },
    });
    mock.enqueue({ status: 200 }); // the PUT

    const file = Buffer.from("hello");
    const res = await new Uploads(client(mock)).create({ fileName: "hi.txt", file });
    expect(res.key).toBe("k1");
    expect(res.fileName).toBe("hi.txt");
    expect(res.fileType).toBe("text/plain");
    expect(res.fileSize).toBe(5);

    expect(mock.requests[0]!.url).toBe("https://www.floopfloop.com/api/v1/uploads");
    expect(mock.requests[1]!.method).toBe("PUT");
    expect(mock.requests[1]!.url).toBe("https://s3.example/upload");
    expect(mock.requests[1]!.headers["content-type"]).toBe("text/plain");
  });

  it("throws VALIDATION_ERROR for an unsupported extension", async () => {
    const mock = createMockFetch();
    await expect(
      new Uploads(client(mock)).create({ fileName: "weird.xyz", file: Buffer.from("") }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR when the file exceeds 5MB", async () => {
    const mock = createMockFetch();
    const huge = Buffer.alloc(6 * 1024 * 1024);
    await expect(
      new Uploads(client(mock)).create({ fileName: "big.png", file: huge }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("guessMimeType knows the allowlist", () => {
    expect(guessMimeType("a.pdf")).toBe("application/pdf");
    expect(guessMimeType("x.webp")).toBe("image/webp");
    expect(guessMimeType("n.unknown")).toBeNull();
  });

  it("maps a failed S3 PUT to a FloopError", async () => {
    const mock = createMockFetch();
    mock.enqueue({
      status: 200,
      body: { data: { uploadUrl: "https://s3.example/upload", key: "k1", fileId: "f1" } },
    });
    mock.enqueue({ status: 403 });
    await expect(
      new Uploads(client(mock)).create({ fileName: "hi.txt", file: Buffer.from("x") }),
    ).rejects.toMatchObject({ code: "UNKNOWN", status: 403 });
  });
});
