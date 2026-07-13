import { createHash } from "node:crypto";

export type OperationalJobKind =
  | "account_export"
  | "account_deletion"
  | "stripe_webhook";
export type OperationalJobStatus =
  | "queued"
  | "running"
  | "failed"
  | "dead_letter"
  | "complete";

export interface OperationalJobInput {
  id: string;
  organizationId: string;
  kind: OperationalJobKind;
  status: OperationalJobStatus;
  createdAt: string;
  updatedAt: string;
  slaDueAt: string;
  retryCount: number;
  lastErrorClass?: string;
}

function hashRef(prefix: "job" | "org", value: string): string {
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 12);
  return `${prefix}_${digest}`;
}

function safeErrorClass(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return /^[A-Z][A-Za-z0-9_.:-]{0,63}$/u.test(value)
    ? value
    : "RedactedError";
}

export function redactOperationalIdentifier(
  prefix: "job" | "org",
  value: string,
): string {
  return hashRef(prefix, value);
}

export function toSafeOperationalJob(job: OperationalJobInput) {
  return {
    jobRef: hashRef("job", job.id),
    organizationRef: hashRef("org", job.organizationId),
    kind: job.kind,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    slaDueAt: job.slaDueAt,
    retryCount: job.retryCount,
    lastErrorClass: safeErrorClass(job.lastErrorClass),
  };
}

export function decideReplay(
  job: OperationalJobInput,
  queuedIdempotencyKeys: readonly string[],
) {
  const idempotencyKey = `replay_${createHash("sha256")
    .update(`${job.id}:${job.retryCount}:${job.updatedAt}`)
    .digest("hex")}`;
  if (job.status !== "failed" && job.status !== "dead_letter") {
    return { accepted: false as const, outcome: "not_retryable" as const, idempotencyKey };
  }
  if (queuedIdempotencyKeys.includes(idempotencyKey)) {
    return { accepted: false as const, outcome: "already_queued" as const, idempotencyKey };
  }
  return { accepted: true as const, outcome: "queued" as const, idempotencyKey };
}
