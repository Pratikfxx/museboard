"use client";

import { CloudArrowUp, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";

import type { CanonicalWorkspaceSnapshot } from "@/lib/workspace/repository";
import {
  useMuseboardStore,
  workspacePayloadFromState,
} from "@/lib/store/museboard-store";

type SyncState = "saved" | "saving" | "conflict" | "error";

export function LiveWorkspaceProvider({
  children,
  initialSnapshot,
  organizationId,
}: {
  children: ReactNode;
  initialSnapshot: CanonicalWorkspaceSnapshot;
  organizationId: string;
}) {
  const [syncState, setSyncState] = useState<SyncState>(() =>
    useMuseboardStore.getState().hydrateLiveWorkspace(initialSnapshot.payload)
      ? "saved"
      : "error",
  );

  useEffect(() => {
    let revision = initialSnapshot.revision;
    let dirtyVersion = 0;
    let savedVersion = 0;
    let saving = false;
    let blocked = false;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function flush() {
      if (stopped || blocked || saving || dirtyVersion === savedVersion) return;
      saving = true;
      const saveVersion = dirtyVersion;
      setSyncState("saving");
      try {
        const response = await fetch("/api/workspace", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId,
            expectedRevision: revision,
            payload: workspacePayloadFromState(useMuseboardStore.getState()),
          }),
        });
        if (response.status === 409) {
          blocked = true;
          setSyncState("conflict");
          return;
        }
        const result = (await response.json()) as { revision?: number };
        if (!response.ok || !result.revision) throw new Error("Workspace save failed");
        revision = result.revision;
        savedVersion = saveVersion;
        setSyncState(dirtyVersion === savedVersion ? "saved" : "saving");
      } catch {
        setSyncState("error");
      } finally {
        saving = false;
        if (!blocked && !stopped && dirtyVersion > savedVersion) {
          timer = setTimeout(() => void flush(), 500);
        }
      }
    }

    const unsubscribe = useMuseboardStore.subscribe(() => {
      if (blocked || stopped) return;
      dirtyVersion += 1;
      setSyncState("saving");
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), 500);
    });

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [initialSnapshot, organizationId]);

  if (syncState === "conflict") {
    return (
      <div className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-warning/40 bg-butter/15 p-4 text-sm" role="alert">
        <WarningCircle aria-hidden="true" className="mt-0.5 shrink-0 text-warning" size={20} />
        <div>
          <strong>This workspace changed on another device.</strong>
          <p className="mt-1 text-muted">Reload to use the newest version. Museboard stopped autosaving to avoid overwriting it.</p>
          <button className="mt-3 font-bold text-cobalt underline" onClick={() => window.location.reload()} type="button">Reload workspace</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="flex min-h-9 items-center justify-center gap-2 border-b border-cobalt/15 bg-cobalt/5 px-4 text-xs font-semibold text-muted"
        role="status"
      >
        <CloudArrowUp aria-hidden="true" className="text-cobalt" size={16} />
        {syncState === "saved"
          ? "All changes saved"
          : syncState === "saving"
            ? "Saving to your workspace…"
            : "Cloud saving paused. Your current tab is still usable."}
      </div>
      {children}
    </>
  );
}
