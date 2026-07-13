import Image from "next/image";

import { useTheme } from "@/components/ui/theme-provider";

import styles from "./today-workspace.module.css";

export function IdeaSculptureFallback({ reason = "loading" }: { reason?: string }) {
  const { resolvedTheme } = useTheme();

  return (
    <div
      aria-hidden="true"
      className={styles.sculptureFallback}
      data-fallback-reason={reason}
      data-renderer="static"
    >
      <Image
        alt=""
        className={styles.sculptureFallbackImage}
        fill
        loading="eager"
        sizes="(max-width: 780px) 100vw, 330px"
        src={`/assets/idea-sculpture-${resolvedTheme}.png`}
      />
    </div>
  );
}
