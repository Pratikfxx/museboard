import Link from "next/link";

import styles from "./experience-state.module.css";

export function EmptyState({
  title,
  detail,
  actionHref,
  actionLabel,
}: {
  title: string;
  detail: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <section className={styles.state}>
      <h1>{title}</h1>
      <p>{detail}</p>
      {actionHref && actionLabel ? <Link href={actionHref}>{actionLabel}</Link> : null}
    </section>
  );
}
