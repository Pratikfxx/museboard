"use client";

import { BookOpenText, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import type { CraftGuide } from "@/lib/providers/opportunities";

import styles from "./opportunities.module.css";

export function CraftGuideDrawer({ guides }: { guides: CraftGuide[] }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        triggerRef.current?.focus();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <>
      <button
        aria-label="Craft guide"
        aria-haspopup="dialog"
        className={styles.guideTrigger}
        onClick={() => setOpen(true)}
        ref={triggerRef}
        type="button"
      >
        <BookOpenText aria-hidden="true" size={20} />
        Craft guide
        <span>{guides.length}</span>
      </button>
      {open ? (
        <div className={styles.drawerBackdrop} onMouseDown={close}>
          <div
            aria-labelledby="craft-guide-title"
            aria-modal="true"
            className={styles.guideDrawer}
            onMouseDown={(event) => event.stopPropagation()}
            ref={dialogRef}
            role="dialog"
          >
            <header>
              <div>
                <p>Contextual practice</p>
                <h2 id="craft-guide-title">Craft guide</h2>
              </div>
              <button aria-label="Close craft guide" onClick={close} type="button">
                <X aria-hidden="true" size={21} />
              </button>
            </header>
            {guides.length ? (
              guides.slice(0, 2).map((guide) => (
                <article key={guide.id}>
                  <p>{guide.stage} · {guide.platform.replaceAll("_", " ")}</p>
                  <h3>{guide.title}</h3>
                  <p>{guide.guidance}</p>
                  <small>
                    {guide.provenance.source} · {guide.provenance.author} · Reviewed{" "}
                    {guide.provenance.reviewedAt}
                  </small>
                </article>
              ))
            ) : (
              <p className={styles.drawerEmpty}>
                No reviewed guide matches this exact stage and format yet.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
