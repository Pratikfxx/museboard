import Image from "next/image";

import styles from "./today-workspace.module.css";

export function IdeaSculptureFallback({ reason = "loading" }: { reason?: string }) {
  return (
    <div
      aria-hidden="true"
      className={styles.sculptureFallback}
      data-fallback-reason={reason}
      data-renderer="static"
    >
      <Image
        alt=""
        className={`${styles.sculptureFallbackImage} ${styles.lightSculpture}`}
        fill
        priority
        sizes="(max-width: 780px) 100vw, 330px"
        src="/assets/idea-sculpture-light.png"
      />
      <Image
        alt=""
        className={`${styles.sculptureFallbackImage} ${styles.darkSculpture}`}
        fill
        priority
        sizes="(max-width: 780px) 100vw, 330px"
        src="/assets/idea-sculpture-dark.png"
      />
    </div>
  );
}
