"use client";

import {
  ArrowLeft,
  DownloadSimple,
  HardDrives,
  ShieldCheck,
  Trash,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

import {
  SAMPLE_WORKSPACE_DELETE_PHRASE,
  createSampleWorkspaceExport,
} from "@/lib/account/sample-workspace";
import { useMuseboardStore } from "@/lib/store/museboard-store";
import { useThinkingRoomStore } from "@/lib/store/thinking-room-store";

import styles from "./account-data.module.css";

function downloadJson(payload: object, filename: string): void {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: "application/json;charset=utf-8",
  });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
}

export function AccountDataWorkspace() {
  const clearSampleWorkspace = useMuseboardStore(
    (state) => state.clearSampleWorkspace,
  );
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<string>();
  const confirmed = confirmation === SAMPLE_WORKSPACE_DELETE_PHRASE;

  const downloadWorkspace = () => {
    const exportedAt = new Date().toISOString();
    const payload = createSampleWorkspaceExport(
      useMuseboardStore.getState(),
      useThinkingRoomStore.getState(),
      exportedAt,
    );
    downloadJson(
      payload,
      `museboard-sample-workspace-${exportedAt.slice(0, 10)}.json`,
    );
    setStatus("Workspace JSON downloaded from this device. No cloud export job was created.");
  };

  const deleteWorkspace = () => {
    if (!confirmed) return;
    if (!clearSampleWorkspace()) {
      setStatus("Deletion was not available for this workspace.");
      return;
    }
    useThinkingRoomStore.getState().clearSample();
    setConfirmation("");
    setStatus(
      "Sample workspace deleted from this device. No cloud account or provider data was deleted.",
    );
  };

  return (
    <section className={styles.page}>
      <Link className={styles.backLink} href="/app/settings/billing">
        <ArrowLeft aria-hidden="true" size={17} />
        Billing settings
      </Link>

      <header className={styles.header}>
        <div>
          <p>Sample workspace · this device only</p>
          <h1>Keep your work<br />in your hands.</h1>
        </div>
        <div className={styles.disclosure}>
          <ShieldCheck aria-hidden="true" size={23} weight="duotone" />
          <span>
            This sample has no cloud account. Export and deletion happen locally in this browser,
            without contacting Museboard, Stripe, or a social platform.
          </span>
        </div>
      </header>

      <div className={styles.controlList}>
        <article className={styles.control}>
          <span className={styles.icon}><DownloadSimple aria-hidden="true" size={24} /></span>
          <div className={styles.copy}>
            <p>Portable sample</p>
            <h2>Download workspace JSON</h2>
            <span>
              Includes your sample profile, ideas, drafts, planner, team history, exports,
              receipts, metrics, and learnings in one inspectable file.
            </span>
          </div>
          <button className={styles.primaryButton} onClick={downloadWorkspace} type="button">
            Download workspace JSON
            <DownloadSimple aria-hidden="true" size={18} />
          </button>
        </article>

        <article className={`${styles.control} ${styles.dangerControl}`}>
          <span className={styles.icon}><Trash aria-hidden="true" size={24} /></span>
          <div className={styles.copy}>
            <p>Destructive · local only</p>
            <h2>Delete this sample workspace</h2>
            <span>
              Clears every sample draft, plan, collaborator record, receipt, metric, and learning
              saved by Museboard on this device. Your theme preference stays unchanged.
            </span>
            <label className={styles.confirmation}>
              <span>Type <strong>{SAMPLE_WORKSPACE_DELETE_PHRASE}</strong> to confirm</span>
              <input
                autoComplete="off"
                onChange={(event) => setConfirmation(event.target.value)}
                spellCheck="false"
                value={confirmation}
              />
            </label>
          </div>
          <button
            className={styles.dangerButton}
            disabled={!confirmed}
            onClick={deleteWorkspace}
            type="button"
          >
            Delete sample workspace from this device
          </button>
        </article>
      </div>

      <footer className={styles.footer}>
        <HardDrives aria-hidden="true" size={20} />
        <div>
          <strong>Production boundary</strong>
          <span>
            No cloud export job or deletion job is available until authenticated account
            persistence is connected. The account APIs fail closed in this sample.
          </span>
        </div>
      </footer>

      {status ? <p className={styles.status} role="status">{status}</p> : null}
    </section>
  );
}
