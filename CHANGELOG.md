# Changelog

All notable changes to `@floopfloop/sdk` are documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This SDK follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
