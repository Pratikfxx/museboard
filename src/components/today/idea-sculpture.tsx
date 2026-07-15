"use client";

import { Pause, Play } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import {
  IdeaSculptureFallback,
  SignalPostPreview,
} from "@/components/today/idea-sculpture-fallback";

import styles from "./today-workspace.module.css";

type StaticReason = "loading" | "reduced-motion" | "small-screen" | "save-data";

type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean };
};

function staticReason(): StaticReason | null {
  if (typeof window === "undefined") return "loading";
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return "reduced-motion";
  }
  if (window.matchMedia?.("(max-width: 780px)").matches) {
    return "small-screen";
  }
  if ((window.navigator as NavigatorWithConnection).connection?.saveData) {
    return "save-data";
  }
  return null;
}

export default function IdeaSculpture({ title }: { title?: string }) {
  const figureRef = useRef<HTMLElement>(null);
  const [fallbackReason, setFallbackReason] = useState<StaticReason | null>(
    staticReason,
  );
  const [intersecting, setIntersecting] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const smallScreen = window.matchMedia?.("(max-width: 780px)");
    const updateReason = () => setFallbackReason(staticReason());
    motion?.addEventListener?.("change", updateReason);
    smallScreen?.addEventListener?.("change", updateReason);
    return () => {
      motion?.removeEventListener?.("change", updateReason);
      smallScreen?.removeEventListener?.("change", updateReason);
    };
  }, []);

  useEffect(() => {
    const element = figureRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setIntersecting(entry.isIntersecting),
      { rootMargin: "80px", threshold: 0.05 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(document.visibilityState !== "hidden");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  const active = !fallbackReason && !paused && intersecting && pageVisible;

  return (
    <figure
      aria-label="Woven paths from signal to idea"
      className={styles.sculptureFigure}
      data-motion={fallbackReason ? "static" : active ? "playing" : "paused"}
      ref={figureRef}
    >
      <div className={styles.sculptureCanvas}>
        {fallbackReason ? (
          <IdeaSculptureFallback reason={fallbackReason} title={title} />
        ) : (
          <SignalPostPreview animated={active} title={title} />
        )}
      </div>
      <figcaption className={styles.sculptureCaption}>
        Audience evidence, a creator angle, and a chosen format converge into one
        concrete post.
      </figcaption>
      {fallbackReason ? (
        <span className={styles.staticReason}>
          Still preview · {fallbackReason.replaceAll("-", " ")}
        </span>
      ) : (
        <button
          aria-label={paused ? "Resume idea sculpture" : "Pause idea sculpture"}
          className={styles.sculptureControl}
          onClick={() => setPaused((value) => !value)}
          type="button"
        >
          {paused ? <Play aria-hidden="true" size={18} weight="fill" /> : <Pause aria-hidden="true" size={18} weight="fill" />}
          {paused ? "Resume flow" : "Pause flow"}
        </button>
      )}
    </figure>
  );
}
