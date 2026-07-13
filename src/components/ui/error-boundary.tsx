"use client";

import styles from "./experience-state.module.css";

export function ErrorBoundaryState({ reset }: { reset: () => void }) {
  return (
    <section className={styles.state} role="alert">
      <p>Workspace recovery</p>
      <h1>This view hit a snag.</h1>
      <p>Your saved sample work is still on this device. Retry the view when you’re ready.</p>
      <button onClick={reset} type="button">Try again</button>
    </section>
  );
}
