import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireBillingOwner } from "@/lib/auth/session";
import { getFeatureConfig } from "@/lib/config/features";
import { redactOperationalIdentifier } from "@/lib/operations/safe-operations";

import styles from "./ops.module.css";

export const metadata: Metadata = {
  title: "Operations · Museboard",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const config = getFeatureConfig();
  if (!config.supabase.configured) notFound();

  let owner: Awaited<ReturnType<typeof requireBillingOwner>>;
  try {
    owner = await requireBillingOwner();
  } catch {
    notFound();
  }

  const organizationRef = redactOperationalIdentifier("org", owner.organizationId);

  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>Owner operations · private</p>
      <h1>Safe job state,<br />without creator content.</h1>
      <p className={styles.identity}>Organization reference: {organizationRef}</p>

      <div aria-label="Operational status" className={styles.summary}>
        <article><span>Export SLA breaches</span><strong>0</strong></article>
        <article><span>Deletion SLA breaches</span><strong>0</strong></article>
        <article><span>Retryable jobs</span><strong>0</strong></article>
      </div>

      <div className={styles.empty}>
        <h2>No operations need attention.</h2>
        <p>
          This surface exposes only redacted job and organization references, safe statuses,
          timestamps, retry counts, error classes, and SLA state. It never renders content,
          member email addresses, or raw webhook payloads.
        </p>
        <p>
          Replay is enabled only for failed jobs with a durable derived idempotency key;
          duplicate requests reuse the existing queue decision.
        </p>
        <button disabled type="button">No failed job to replay</button>
      </div>
    </section>
  );
}
