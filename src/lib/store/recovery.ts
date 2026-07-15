import type { WorkspaceRecoveryNotice } from "@/domain/creator-intelligence";

export const MUSEBOARD_RECOVERY_BACKUP_KEY = "museboard-recovery-backup-v1";
export const MAX_RECOVERY_BACKUP_BYTES = 1_000_000;

type RecoveryResult =
  | { ok: true; raw: string }
  | {
      ok: false;
      rawBackup: string;
      notice: WorkspaceRecoveryNotice;
    };

function boundedBackup(raw: string): string {
  return raw.slice(-MAX_RECOVERY_BACKUP_BYTES);
}

function recoveryNotice(
  kind: WorkspaceRecoveryNotice["kind"],
  detectedAt: string,
): WorkspaceRecoveryNotice {
  const invalidWorkspace = kind === "invalid_workspace";
  return {
    id: `recovery-${detectedAt}`,
    kind,
    title: invalidWorkspace
      ? "Your saved workspace needs recovery"
      : "We protected a copy of your saved workspace",
    detail: invalidWorkspace
      ? "Museboard could not safely read the saved workspace. A backup is available before you continue with a fresh local workspace."
      : "The local save was incomplete or damaged. Museboard kept a backup so the issue is visible and recoverable.",
    backupKey: MUSEBOARD_RECOVERY_BACKUP_KEY,
    detectedAt,
  };
}

export function inspectPersistedWorkspaceEnvelope(
  raw: string,
  validateWorkspace: (payload: unknown) => boolean,
  detectedAt = new Date().toISOString(),
): RecoveryResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      rawBackup: boundedBackup(raw),
      notice: recoveryNotice("corrupt_json", detectedAt),
    };
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("state" in parsed) ||
    !validateWorkspace((parsed as { state: unknown }).state)
  ) {
    return {
      ok: false,
      rawBackup: boundedBackup(raw),
      notice: recoveryNotice("invalid_workspace", detectedAt),
    };
  }

  return { ok: true, raw };
}
