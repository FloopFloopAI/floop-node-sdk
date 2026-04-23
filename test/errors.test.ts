import { describe, it, expect } from "vitest";
import { FloopError } from "../src/errors.js";

describe("FloopError", () => {
  it("captures code, status, message, and request id", () => {
    const err = new FloopError({
      code: "NOT_FOUND",
      message: "project not found",
      status: 404,
      requestId: "req_abc",
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(FloopError);
    expect(err.name).toBe("FloopError");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.status).toBe(404);
    expect(err.message).toBe("project not found");
    expect(err.requestId).toBe("req_abc");
  });

  it("allows unknown string codes to pass through typed", () => {
    const err = new FloopError({
      code: "SOMETHING_NEW_ON_SERVER" as never,
      message: "weird",
      status: 418,
    });
    expect(err.code).toBe("SOMETHING_NEW_ON_SERVER");
  });

  it("carries retryAfterMs when provided", () => {
    const err = new FloopError({
      code: "RATE_LIMITED",
      message: "slow down",
      status: 429,
      retryAfterMs: 4000,
    });
    expect(err.retryAfterMs).toBe(4000);
  });
});
