# Cookbook

Concrete `@floopfloop/sdk` patterns you can copy-paste. Every snippet uses only the SDK's public surface and the types it exports — no undocumented endpoints, no private helpers.

For the basics (install, client setup, resource tour) see the [README](../README.md). This file is the **"I know the basics, now how do I actually build X"** layer.

---

## 1. Ship a project from prompt to live URL

The canonical one-call flow: create, wait, done. Rejects with `BUILD_FAILED` / `BUILD_CANCELLED` / `TIMEOUT` instead of silently returning a half-built project, so a plain `try/catch` is enough.

```ts
import { FloopClient, FloopError } from "@floopfloop/sdk";

const floop = new FloopClient({ apiKey: process.env.FLOOP_API_KEY! });

async function ship(prompt: string, subdomain: string) {
  const { project } = await floop.projects.create({
    prompt,
    subdomain,
    botType: "site",
  });

  try {
    // Polls status every 2s and resolves when status === "live".
    // The signal lets you impose a wall-clock timeout from the outside.
    const live = await floop.projects.waitForLive(project.id, {
      signal: AbortSignal.timeout(10 * 60_000), // 10 min max
    });
    return live.url!;
  } catch (err) {
    if (err instanceof FloopError && err.code === "BUILD_FAILED") {
      console.error(`Build failed: ${err.message}`);
    }
    throw err;
  }
}

const url = await ship(
  "A single-page portfolio for a landscape photographer",
  "landscape-portfolio",
);
console.log(`Live at ${url}`);
```

**When to prefer `stream()` over `waitForLive()`:** if you want to show progress to a user (spinner, status line). `waitForLive` just resolves at the end — no visibility into what the build is doing.

---

## 2. Watch a build progress in real time

`projects.stream(ref)` is an async iterator that yields `ProjectStatusEvent` objects as the status changes. It de-duplicates identical consecutive snapshots (same status / step / progress / queuePosition), so you can iterate it naively without spamming the UI on every poll.

```ts
import { FloopClient } from "@floopfloop/sdk";

const floop = new FloopClient({ apiKey: process.env.FLOOP_API_KEY! });

const { project } = await floop.projects.create({
  prompt: "A recipe blog with a dark theme",
  subdomain: "recipe-blog",
  botType: "site",
});

for await (const event of floop.projects.stream(project.id)) {
  const progress = event.progress !== null ? ` ${event.progress}%` : "";
  const step = event.step ? ` — ${event.step}` : "";
  console.log(`[${event.status}]${progress}${step}`);

  // Iteration ends automatically on terminal state:
  //   live / failed / cancelled / archived
}

// Fetch the full project once the stream completes:
const done = await floop.projects.get(project.id);
console.log("Live at", done.url);
```

**Early abort.** Pass an `AbortSignal` to stop polling from the outside:

```ts
const ctl = new AbortController();
setTimeout(() => ctl.abort(), 5 * 60_000); // 5 min cap

for await (const event of floop.projects.stream(project.id, { signal: ctl.signal })) {
  // ...
}
```

---

## 3. Refine a project, even when it's mid-build

`projects.refine()` returns a discriminated union that tells you *what happened* to your follow-up message without you having to re-poll:

- `{ queued: true, messageId }` — the project is currently deploying; your message is queued and will be processed when the current build finishes.
- `{ processing: true, deploymentId, queuePriority }` — your message triggered a new build immediately.
- `{ queued: false }` — the message was saved as a conversation entry without triggering a build (e.g. pure chat).

```ts
import { FloopClient } from "@floopfloop/sdk";

const floop = new FloopClient({ apiKey: process.env.FLOOP_API_KEY! });

const result = await floop.projects.refine("recipe-blog", {
  message: "Add a search bar to the header",
});

if ("processing" in result) {
  console.log(`Build started (deployment ${result.deploymentId})`);
  await floop.projects.waitForLive("recipe-blog");
} else if ("queued" in result && result.queued) {
  console.log(`Queued behind current build (message ${result.messageId})`);
  // Poll the project once — when it's back to "live", your queued
  // message has already been picked up and processed.
  await floop.projects.waitForLive("recipe-blog");
} else {
  console.log("Saved as a chat message, no build triggered");
}
```

**Shortcut for fire-and-forget.** Pass `wait: true` and `refine()` will return the live Project once the resulting build finishes (or throw `BUILD_FAILED`). It handles the queued-vs-processing distinction internally:

```ts
const liveProject = await floop.projects.refine("recipe-blog", {
  message: "Add a search bar to the header",
  wait: true,
});
```

---

## 4. Upload an image and refine with it as context

Uploads are two-step: `uploads.create()` presigns an S3 URL and does the direct PUT for you, returning the descriptor you pass to the next API call. The descriptor is an opaque bag of fields — don't try to construct one by hand.

```ts
import { readFile } from "node:fs/promises";
import { FloopClient } from "@floopfloop/sdk";

const floop = new FloopClient({ apiKey: process.env.FLOOP_API_KEY! });

const bytes = await readFile("./mockup.png");
const attachment = await floop.uploads.create({
  fileName: "mockup.png",
  file: bytes,
  // fileType: "image/png",  // optional — guessed from the extension
});

await floop.projects.refine("recipe-blog", {
  message: "Make the homepage look like this mockup.",
  attachments: [attachment],
  wait: true,
});
```

**Supported types:** `png`, `jpg/jpeg`, `gif`, `svg`, `webp`, `ico`, `pdf`, `txt`, `csv`, `doc`, `docx`. Max 5 MB per upload. The SDK validates client-side before hitting the network, so bad inputs throw `VALIDATION_ERROR` with no round-trip.

Attachments only flow through `refine` today — `create` doesn't accept them via the SDK. If you need to anchor a brand-new project against images, create with a prompt first, then refine with the attachments as a follow-up.

---

## 5. Rotate an API key from a CI job

Three-step rotation: create the new key, write it to your secret store, then revoke the old one. The order matters — you must revoke with a **different** key than the one making the call (the backend returns `400 VALIDATION_ERROR` if you try to revoke the key you're authenticated with).

```ts
import { FloopClient } from "@floopfloop/sdk";

async function rotate(victimName: string) {
  // Use a long-lived bootstrap key (stored as a CI secret) to do the
  // rotation. Don't use the key we're about to revoke — that hits the
  // self-revoke guard.
  const bootstrap = new FloopClient({ apiKey: process.env.FLOOP_BOOTSTRAP_KEY! });

  // 1. Find the key we want to rotate by its name. (Each name is unique
  //    per account because the dashboard enforces it; matching by name
  //    is more reliable than matching the prefix substring.)
  const keys = await bootstrap.apiKeys.list();
  const victim = keys.find((k) => k.name === victimName);
  if (!victim) throw new Error(`key not found: ${victimName}`);

  // 2. Mint the replacement.
  const fresh = await bootstrap.apiKeys.create({ name: `${victimName}-new` });
  await writeSecret("FLOOP_API_KEY", fresh.rawKey); // your secret-store helper

  // 3. Revoke the old one. apiKeys.remove() accepts an id OR a name.
  await bootstrap.apiKeys.remove(victim.id);
}
```

**Can't I just reuse the bootstrap key forever?** Technically yes — if it's tightly scoped and audited. In practice, a single long-lived "rotator key" is a common compromise: it only has permission to mint/list/revoke keys, never appears in application traffic, and itself gets rotated manually on a rare cadence (annually, or on compromise).

The 5-keys-per-account cap applies to active keys, so make sure to revoke old rotations rather than accumulating them.

---

## 6. Retry with backoff on `RATE_LIMITED` and `NETWORK_ERROR`

The SDK's `FloopError` carries everything you need to implement backoff correctly:

- `retryAfterMs` — present on `RATE_LIMITED`, set from the server's `Retry-After` header (parsed from delta-seconds OR HTTP-date).
- `code` — distinguishes retryable (`RATE_LIMITED`, `NETWORK_ERROR`, `TIMEOUT`, `SERVICE_UNAVAILABLE`) from permanent (`UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `BUILD_FAILED`, `BUILD_CANCELLED`).

```ts
import { FloopError, type FloopErrorCode } from "@floopfloop/sdk";

const RETRYABLE: readonly FloopErrorCode[] = [
  "RATE_LIMITED",
  "NETWORK_ERROR",
  "TIMEOUT",
  "SERVICE_UNAVAILABLE",
  "SERVER_ERROR",
] as const;

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (!(err instanceof FloopError) || !RETRYABLE.includes(err.code)) throw err;
      if (attempt >= maxAttempts) throw err;

      // Prefer the server's hint; fall back to exponential backoff with
      // jitter capped at 30 s.
      const serverHint = err.retryAfterMs;
      const expoBackoff = Math.min(30_000, 250 * 2 ** attempt);
      const jitter = Math.random() * 250;
      const wait = (serverHint ?? expoBackoff) + jitter;

      console.warn(
        `floop: ${err.code} (attempt ${attempt}/${maxAttempts}), retrying in ${Math.round(wait)}ms` +
          (err.requestId ? ` — request ${err.requestId}` : ""),
      );
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

// Wrap any SDK call:
const projects = await withRetry(() => floop.projects.list());
```

**Don't retry everything.** `VALIDATION_ERROR`, `UNAUTHORIZED`, and `FORBIDDEN` are not going to fix themselves between attempts — retrying them just burns rate-limit budget and delays the real error reaching your logs.

---

## Got a pattern worth adding?

Open an issue at [FloopFloopAI/floop-node-sdk/issues](https://github.com/FloopFloopAI/floop-node-sdk/issues) describing the use case. Recipes live in this file, not in `src/` — they're documentation, not shipped code.
