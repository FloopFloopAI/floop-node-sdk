export { FloopClient } from "./client.js";
export type { FloopClientOptions, RequestOptions } from "./client.js";
export { FloopError } from "./errors.js";
export type { FloopErrorCode, KnownFloopErrorCode } from "./errors.js";
export { CURRENT_VERSION } from "./version.js";

export type {
  ProjectStatus,
  BotType,
  ProjectStatusEvent,
} from "./util/types.js";

export type {
  Project,
  CreateProjectInput,
  CreatedProject,
  RefineInput,
  RefineResult,
  ConversationMessage,
  ConversationsResult,
} from "./resources/projects.js";

export type { ProjectSecretSummary } from "./resources/secrets.js";
export type { ApiKeySummary, IssuedApiKey } from "./resources/apiKeys.js";
export type {
  LibraryProject,
  LibraryListOptions,
  ClonedProject,
} from "./resources/library.js";
export type {
  SubdomainCheckResult,
  SubdomainSuggestResult,
} from "./resources/subdomains.js";
export type { UsageSummary } from "./resources/usage.js";
export type { MeUser, MeResult } from "./resources/user.js";
export type {
  UploadedAttachment,
  CreateUploadInput,
} from "./resources/uploads.js";
