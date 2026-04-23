# Changelog

All notable changes to `@floopfloop/sdk` are documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This SDK follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Distinguish user-initiated `AbortSignal` from timeout: requests aborted via
  a caller-supplied signal now throw `FloopError { code: "NETWORK_ERROR",
  message: "Request aborted" }` instead of being mislabeled as a timeout.
- `parseRetryAfter` now handles the RFC 7231 HTTP-date format in addition to
  `delta-seconds`, so `Retry-After: Wed, 21 Oct 2026 07:28:00 GMT` produces a
  usable `retryAfterMs` instead of `undefined`.
- `pollProjectStatus` no longer leaks an `abort` listener on the caller's
  signal on every poll iteration — the listener is removed when the sleep
  timer fires naturally.

## [0.1.0-alpha.1] — 2026-04-23

### Added
- `FloopClient` with bearer auth, configurable base URL, per-request timeouts,
  injectable `fetch` for proxies/tests.
- `FloopError` class with typed `.code` union + pass-through for unknown codes.
- Resources: `projects`, `secrets`, `apiKeys`, `library`, `subdomains`,
  `uploads`, `usage`, `user` — full parity with the floop CLI's backend calls.
- `projects.stream()` async iterator + `projects.waitForLive()` built on a
  shared polling engine that de-duplicates unchanged snapshots.
- Unit tests with mocked `fetch` covering transport, polling, aborts, and
  every resource method.
