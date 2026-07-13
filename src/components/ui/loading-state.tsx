import styles from "./experience-state.module.css";

export function LoadingState({ label }: { label: string }) {
  return (
    <section aria-label={label} className={styles.state} role="status">
      <span aria-hidden="true" className={styles.loader} />
      <p>{label}</p>
    </section>
  );
}
