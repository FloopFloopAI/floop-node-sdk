/**
 * Minimal queued fetch mock. Each call to the returned function consumes the
 * next queued response; assertions on outbound requests are recorded in
 * `requests`.
 */
export interface MockRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

export interface MockFetch {
  fetch: typeof fetch;
  enqueue(res: {
    status?: number;
    body?: unknown;
    headers?: Record<string, string>;
  }): void;
  enqueueNetworkError(message?: string): void;
  requests: MockRequest[];
}

export function createMockFetch(): MockFetch {
  type Queued =
    | { kind: "response"; status: number; body: unknown; headers: Record<string, string> }
    | { kind: "error"; message: string };
  const queue: Queued[] = [];
  const requests: MockRequest[] = [];

  const fetchImpl: typeof fetch = async (input, init) => {
    const next = queue.shift();
    if (!next) throw new Error("mock-fetch: no response queued");

    const url = typeof input === "string" ? input : (input as Request).url ?? String(input);
    const method = init?.method ?? "GET";
    const headers: Record<string, string> = {};
    const rawHeaders = init?.headers;
    if (rawHeaders instanceof Headers) {
      rawHeaders.forEach((v, k) => (headers[k.toLowerCase()] = v));
    } else if (rawHeaders && typeof rawHeaders === "object") {
      for (const [k, v] of Object.entries(rawHeaders as Record<string, string>)) {
        headers[k.toLowerCase()] = v;
      }
    }
    const body = init?.body === undefined ? undefined : String(init.body);
    requests.push({ url, method, headers, body });

    if (next.kind === "error") {
      throw new TypeError(next.message);
    }
    const bodyStr = next.body === undefined ? "" : JSON.stringify(next.body);
    return new Response(bodyStr, { status: next.status, headers: next.headers });
  };

  return {
    fetch: fetchImpl,
    enqueue: ({ status = 200, body, headers = {} }) => {
      queue.push({ kind: "response", status, body: body as unknown, headers });
    },
    enqueueNetworkError: (message = "fetch failed") => {
      queue.push({ kind: "error", message });
    },
    requests,
  };
}
