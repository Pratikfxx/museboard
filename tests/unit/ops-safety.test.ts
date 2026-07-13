import { describe, expect, it } from "vitest";

import {
  decideReplay,
  toSafeOperationalJob,
} from "@/lib/operations/safe-operations";

describe("owner operations safety boundary", () => {
  const failedJob = {
    id: "job_01J00000000000000000000001",
    organizationId: "org_01J00000000000000000000001",
    kind: "account_export" as const,
    status: "failed" as const,
    createdAt: "2026-07-13T10:00:00.000Z",
    updatedAt: "2026-07-13T10:03:00.000Z",
    slaDueAt: "2026-07-14T10:00:00.000Z",
    retryCount: 1,
    lastErrorClass: "StorageUnavailable",
    email: "creator@example.com",
    contentBody: "private creator script",
    rawWebhookPayload: { secret: "private" },
  };

  it("projects only redacted IDs, safe statuses, timestamps, and SLA metadata", () => {
    const safe = toSafeOperationalJob(failedJob);
    const serialized = JSON.stringify(safe);

    expect(safe).toMatchObject({
      jobRef: expect.stringMatching(/^job_[a-f0-9]{12}$/u),
      organizationRef: expect.stringMatching(/^org_[a-f0-9]{12}$/u),
      kind: "account_export",
      status: "failed",
      retryCount: 1,
      lastErrorClass: "StorageUnavailable",
    });
    expect(serialized).not.toContain(failedJob.id);
    expect(serialized).not.toContain(failedJob.organizationId);
    expect(serialized).not.toContain(failedJob.email);
    expect(serialized).not.toContain(failedJob.contentBody);
    expect(serialized).not.toContain("rawWebhookPayload");
  });

  it("does not let a verbose error string cross the safe error-class boundary", () => {
    const safe = toSafeOperationalJob({
      ...failedJob,
      lastErrorClass:
        "Storage failed for creator@example.com while exporting private creator script",
    });

    expect(safe.lastErrorClass).toBe("RedactedError");
    expect(JSON.stringify(safe)).not.toContain("creator@example.com");
    expect(JSON.stringify(safe)).not.toContain("private creator script");
  });

  it("accepts one replay per derived idempotency key and reuses duplicates", () => {
    const first = decideReplay(failedJob, []);
    const duplicate = decideReplay(failedJob, [first.idempotencyKey]);

    expect(first).toMatchObject({ accepted: true, outcome: "queued" });
    expect(duplicate).toEqual({
      accepted: false,
      outcome: "already_queued",
      idempotencyKey: first.idempotencyKey,
    });
  });

  it("refuses replay for a job that is not in a retryable state", () => {
    const decision = decideReplay({ ...failedJob, status: "complete" }, []);

    expect(decision).toMatchObject({ accepted: false, outcome: "not_retryable" });
  });
});
