import { ChartLineUp, NotePencil, Play } from "@phosphor-icons/react";

import styles from "./today-workspace.module.css";

export function SignalPostPreview({
  animated = false,
  title = "A useful idea, ready to become your next post.",
}: {
  animated?: boolean;
  title?: string;
}) {
  return (
    <div className={styles.signalPostPreview} data-animated={animated}>
      <svg aria-hidden="true" className={styles.signalPaths} viewBox="0 0 330 400">
        <path d="M42 87 C112 87 112 132 166 151" />
        <path d="M42 201 C108 201 120 196 166 195" />
        <path d="M42 318 C108 318 119 253 166 238" />
      </svg>

      <div className={styles.signalNodes}>
        <div data-tone="cobalt">
          <ChartLineUp aria-hidden="true" size={17} />
          <span><small>Audience signal</small><b>1.8× saves</b></span>
        </div>
        <div data-tone="warning">
          <NotePencil aria-hidden="true" size={17} />
          <span><small>Your angle</small><b>Honest process</b></span>
        </div>
        <div data-tone="coral">
          <Play aria-hidden="true" size={17} weight="fill" />
          <span><small>Format</small><b>18 sec reel</b></span>
        </div>
      </div>

      <article className={styles.postPreviewCard}>
        <header><span>POST 01</span><b>READY TO SHAPE</b></header>
        <div className={styles.postPreviewFrame}>
          <span className={styles.playMark}><Play aria-hidden="true" size={20} weight="fill" /></span>
          <div aria-hidden="true" className={styles.waveform}>
            {[18, 34, 24, 46, 30, 52, 22, 40, 28].map((height, index) => (
              <i key={`${height}-${index}`} style={{ height }} />
            ))}
          </div>
        </div>
        <p>{title}</p>
        <footer><span>Hook</span><i aria-hidden="true" /><span>Outline</span><i aria-hidden="true" /><b>Plan</b></footer>
      </article>
    </div>
  );
}

export function IdeaSculptureFallback({
  reason = "loading",
  title,
}: {
  reason?: string;
  title?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={styles.sculptureFallback}
      data-fallback-reason={reason}
      data-renderer="static"
    >
      <SignalPostPreview title={title} />
    </div>
  );
}
