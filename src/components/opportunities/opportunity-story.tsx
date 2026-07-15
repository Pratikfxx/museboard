"use client";

import {
  BookmarkSimple,
  Compass,
  MagicWand,
  MapPin,
  Prohibit,
  ThumbsUp,
} from "@phosphor-icons/react";

import {
  OPPORTUNITY_RANKING_WEIGHTS,
  type Opportunity,
} from "@/domain/opportunities";
import { rankOpportunity } from "@/lib/providers/opportunities";

import styles from "./opportunities.module.css";

const platformLabels = {
  instagram_reels: "Instagram Reels",
  tiktok_video: "TikTok video",
  youtube_shorts: "YouTube Shorts",
} as const;

const factorLabels = {
  relevance: "Relevance",
  momentum: "Momentum",
  originality: "Originality",
  creatorFit: "Creator fit",
} as const;

function sourceClassLabel(value: Opportunity["provenance"]["sourceClass"]) {
  return value.replaceAll("_", " ");
}

function formattedDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function freshnessLabel(opportunity: Opportunity): string {
  const observed = new Date(opportunity.provenance.observedAt).getTime();
  const fetched = new Date(opportunity.provenance.fetchedAt).getTime();
  const hours = Math.max(0, Math.round((fetched - observed) / 3_600_000));
  if (hours < 1) return "Fresh now";
  if (hours < 24) return `Fresh ${hours}h ago`;
  return `Fresh ${Math.round(hours / 24)}d ago`;
}

export interface OpportunityStoryProps {
  opportunity: Opportunity;
  decision?: "saved" | "dismissed";
  shaped?: boolean;
  preview?: boolean;
  onSave?: () => void;
  onDismiss?: () => void;
  onMoreLikeThis?: () => void;
  onShape?: () => void;
  personalizedFit?: { score: number; adjustment: number; explanation: string };
}

export function OpportunityStory({
  opportunity,
  decision,
  shaped = false,
  preview = false,
  onSave,
  onDismiss,
  onMoreLikeThis,
  onShape,
  personalizedFit,
}: OpportunityStoryProps) {
  const titleId = `opportunity-${opportunity.id}-title`;
  const sourceId = `opportunity-${opportunity.id}-source`;
  const ranking = rankOpportunity(opportunity);

  return (
    <article aria-labelledby={titleId} className={styles.opportunityStory}>
      <div className={styles.storyHeading}>
        <div>
          <p className={styles.storyKicker}>
            <Compass aria-hidden="true" size={17} />
            {opportunity.goal} opportunity
          </p>
          <h2 id={titleId}>{opportunity.title}</h2>
        </div>
        <strong className={styles.score}>
          {personalizedFit?.score ?? ranking.score}
          <span>fit score</span>
        </strong>
      </div>

      <p className={styles.storySummary}>{opportunity.summary}</p>

      <div className={styles.signalMetadata}>
        <time
          aria-describedby={sourceId}
          dateTime={opportunity.provenance.observedAt}
        >
          {freshnessLabel(opportunity)}
        </time>
        <span>
          <MapPin aria-hidden="true" size={16} /> {opportunity.geography}
        </span>
        <span>{platformLabels[opportunity.platform]}</span>
        <span className={styles.sampleLabel}>
          {opportunity.provenance.mode === "sample"
            ? "Sample signal · not live"
            : `${opportunity.provenance.mode} source`}
        </span>
      </div>

      <p className={styles.sourceLine} id={sourceId}>
        Source {opportunity.provenance.sourceLabel} ·{" "}
        {sourceClassLabel(opportunity.provenance.sourceClass)} source class ·{" "}
        Observed{" "}
        {formattedDate(opportunity.provenance.observedAt)} · Expires{" "}
        {formattedDate(opportunity.provenance.expiresAt)}
        {opportunity.provenance.sourceUrl ? (
          <>
            {" · "}
            <a
              href={opportunity.provenance.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open source
            </a>
          </>
        ) : null}
      </p>

      <details className={styles.rankingDetails}>
        <summary>Why this fits · score explained</summary>
        <div aria-label="Ranking factor breakdown" className={styles.factorList} role="list">
          {Object.entries(ranking.factorBreakdown).map(([factor, contribution]) => {
            const factorKey = factor as keyof typeof factorLabels;
            const weight = OPPORTUNITY_RANKING_WEIGHTS[factorKey] * 100;
            const rawValue = opportunity.signals[factorKey];
            return (
              <div key={factor} role="listitem">
                <span>{factorLabels[factorKey]} · {weight}% weight</span>
                <strong>{contribution} points</strong>
                <span aria-hidden="true" className={styles.factorTrack}><span style={{ width: `${rawValue}%` }} /></span>
              </div>
            );
          })}
        </div>
      </details>

      <p className={styles.evidenceLine}>
        {opportunity.evidence[0]?.summary ??
          "Evidence is incomplete; ranking is capped until a source is added."}
      </p>

      {personalizedFit?.adjustment ? (
        <p className={styles.preferenceNote}>
          {personalizedFit.adjustment > 0
            ? "Your feedback raised this fit."
            : "Your feedback lowered this fit."} {personalizedFit.explanation}
        </p>
      ) : null}

      {!preview ? (
        <div className={styles.storyActions}>
          <button onClick={onMoreLikeThis} type="button">
            <ThumbsUp aria-hidden="true" size={18} /> More like this
          </button>
          <button
            aria-pressed={decision === "saved"}
            onClick={onSave}
            type="button"
          >
            <BookmarkSimple
              aria-hidden="true"
              size={18}
              weight={decision === "saved" ? "fill" : "regular"}
            />
            {decision === "saved" ? "Saved" : "Save"}
          </button>
          <button aria-label="Dismiss · Not for me" onClick={onDismiss} type="button">
            <Prohibit aria-hidden="true" size={18} /> Not for me
          </button>
          <button
            aria-label="Shape idea"
            aria-pressed={shaped}
            className={styles.shapeButton}
            onClick={onShape}
            type="button"
          >
            <MagicWand aria-hidden="true" size={18} />
            {shaped ? "Shaped" : "Shape idea"}
          </button>
        </div>
      ) : null}
    </article>
  );
}
