"use client";

import { DownloadSimple, ShieldWarning } from "@phosphor-icons/react";
import { useState } from "react";

import { useMuseboardStore } from "@/lib/store/museboard-store";

import styles from "./recovery-center.module.css";

export function RecoveryCenter() {
  const notice = useMuseboardStore((state) => state.recoveryNotice);
  const clearRecoveryNotice = useMuseboardStore((state) => state.clearRecoveryNotice);
  const resetDemo = useMuseboardStore((state) => state.resetDemo);
  const [message, setMessage] = useState("");

  if (!notice) return null;
  const activeNotice = notice;

  function downloadBackup() {
    if (!activeNotice.backupKey) return;
    try {
      const raw = window.localStorage.getItem(activeNotice.backupKey);
      if (!raw) {
        setMessage("The protected copy is only available in this browser tab.");
        return;
      }
      const blob = new Blob([raw], { type: "application/json" });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `museboard-recovery-${activeNotice.detectedAt.slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(href);
      setMessage("Recovery copy downloaded.");
    } catch {
      setMessage("Your browser blocked the download. Keep this tab open while you copy your work.");
    }
  }

  function continueFresh() {
    if (activeNotice.backupKey) {
      try {
        window.localStorage.removeItem(activeNotice.backupKey);
      } catch {
        // The visible notice can still be cleared for this tab.
      }
      resetDemo();
    }
    clearRecoveryNotice();
  }

  return (
    <section className={styles.center} role="status">
      <div className={styles.icon}><ShieldWarning aria-hidden="true" size={24} weight="fill" /></div>
      <div className={styles.copy}>
        <strong>{notice.title}</strong>
        <p>{notice.detail}</p>
        {message ? <small>{message}</small> : null}
      </div>
      <div className={styles.actions}>
        {notice.backupKey ? (
          <button className={styles.secondary} onClick={downloadBackup} type="button">
            <DownloadSimple aria-hidden="true" size={17} /> Download backup
          </button>
        ) : null}
        <button className={styles.primary} onClick={continueFresh} type="button">
          {notice.backupKey ? "Continue with fresh workspace" : "I understand"}
        </button>
      </div>
    </section>
  );
}
