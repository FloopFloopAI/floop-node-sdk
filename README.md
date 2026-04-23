# @floopfloop/sdk

Official Node.js SDK for the [FloopFloop](https://www.floopfloop.com) API.
Build a project, chat with it, manage secrets and API keys from any Node
20+ codebase.

## Install

```bash
npm install @floopfloop/sdk
```

## Quickstart

Grab an API key: `floop keys create my-sdk` (via the [floop CLI](https://github.com/FloopFloopAI/floop-cli)) or the dashboard → Account → API Keys. Business plan required to mint new keys.

```ts
import { FloopClient } from "@floopfloop/sdk";

const floop = new FloopClient({ apiKey: process.env.FLOOP_API_KEY! });

// Create a project and wait for it to go live.
const { project } = await floop.projects.create({
  prompt: "A landing page for a cat cafe with a sign-up form",
  name: "Cat Cafe",
  subdomain: "cat-cafe",
  botType: "site",
});
const live = await floop.projects.waitForLive(project.id);
console.log("Live at:", live.url);
```

## Streaming progress

```ts
for await (const event of floop.projects.stream(project.id)) {
  console.log(`${event.status} (${event.step}/${event.totalSteps}) — ${event.message}`);
}
```

## Error handling

Every call throws `FloopError` on non-2xx. Switch on `.code`:

```ts
import { FloopError } from "@floopfloop/sdk";

try {
  await floop.projects.create({ prompt: "..." });
} catch (err) {
  if (err instanceof FloopError) {
    if (err.code === "RATE_LIMITED") {
      await new Promise((r) => setTimeout(r, err.retryAfterMs ?? 5000));
    } else if (err.code === "UNAUTHORIZED") {
      console.error("Check your FLOOP_API_KEY.");
    } else {
      console.error(`[${err.requestId}] ${err.code}: ${err.message}`);
    }
  }
  throw err;
}
```

## Resources

| Namespace      | Methods |
|---|---|
| `floop.projects`  | `create`, `list`, `get`, `status`, `cancel`, `reactivate`, `refine`, `conversations`, `stream`, `waitForLive` |
| `floop.secrets`   | `list`, `set`, `remove` |
| `floop.apiKeys`   | `list`, `create`, `remove` |
| `floop.library`   | `list`, `clone` |
| `floop.subdomains`| `check`, `suggest` |
| `floop.uploads`   | `create` (for attaching files to `projects.refine`) |
| `floop.usage`     | `summary` |
| `floop.user`      | `me` |

## Authentication

Two token shapes are accepted on `apiKey`:

| Prefix       | Source                          | Plan gate         |
|---|---|---|
| `flp_…`      | Dashboard → API Keys, `floop keys create` | Business (to mint) |
| `flp_cli_…`  | `floop login` device token       | Free (unlimited)   |

CLI device tokens (`flp_cli_…`) work here too — handy for local scripts that
already logged in through the CLI.

## Configuration

```ts
new FloopClient({
  apiKey: "flp_...",
  baseUrl: "https://www.floopfloop.com",    // override for staging
  timeoutMs: 30_000,
  pollIntervalMs: 2_000,
  userAgent: "myapp/1.2.3",                  // appended to User-Agent
  fetch: customFetchImpl,                    // for proxies / tests
});
```

## License

MIT. See [LICENSE](./LICENSE).

## Related

- [floop-cli](https://github.com/FloopFloopAI/floop-cli) — the CLI that ships the same backend surface as a terminal UI.
- [Customer docs](https://www.floopfloop.com/docs) — API reference, dashboard walkthroughs.
