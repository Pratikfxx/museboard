"use client";

import { Eye, LockKey, ShieldCheck } from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";

import { OpportunityStory } from "@/components/opportunities/opportunity-story";
import type { Opportunity } from "@/domain/opportunities";
import { previewCuratedOpportunity } from "@/lib/providers/opportunities";

import styles from "./opportunities.module.css";

const initialDraft = {
  title: "A public product note worth teaching",
  summary:
    "Turn one documented platform change into a practical short-form lesson.",
  sourceLabel: "YouTube Creators",
  sourceUrl: "https://support.google.com/youtube/",
  sourceClass: "official_platform",
  observedAt: "2026-07-13T06:00",
  expiresAt: "2026-07-15T06:00",
  geography: "Global",
  platform: "youtube_shorts",
  format: "tutorial",
  readiness: "shape",
  goal: "trust",
  pillar: "Useful concepts made clear",
  evidenceSummary:
    "The public product note creates a concrete, teachable workflow change.",
  relevance: "88",
  momentum: "80",
  originality: "74",
  creatorFit: "91",
} as const;

type Draft = { [Key in keyof typeof initialDraft]: string };

function isoFromLocal(value: string): string {
  return `${value}:00.000Z`;
}

export function OwnerOpportunityConsole() {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [preview, setPreview] = useState<Opportunity>();
  const [error, setError] = useState("");

  function update<Key extends keyof Draft>(key: Key, value: Draft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const result = previewCuratedOpportunity(
      {
        title: draft.title,
        summary: draft.summary,
        platform: draft.platform,
        archetypes: ["tech_education"],
        format: draft.format,
        pillar: draft.pillar,
        readiness: draft.readiness,
        goal: draft.goal,
        geography: draft.geography,
        signals: {
          relevance: Number(draft.relevance),
          momentum: Number(draft.momentum),
          originality: Number(draft.originality),
          creatorFit: Number(draft.creatorFit),
        },
        sourceClass: draft.sourceClass,
        sourceLabel: draft.sourceLabel,
        sourceUrl: draft.sourceUrl,
        observedAt: isoFromLocal(draft.observedAt),
        expiresAt: isoFromLocal(draft.expiresAt),
        evidenceSummary: draft.evidenceSummary,
      },
      new Date().toISOString(),
    );
    if (!result.ok) {
      setPreview(undefined);
      setError(result.error);
      return;
    }
    setPreview(result.opportunity);
  }

  return (
    <div className={styles.operatorPage}>
      <header className={styles.operatorHeader}>
        <div className={styles.ownerBadge}>
          <LockKey aria-hidden="true" size={18} /> Owner-only operator view
        </div>
        <h1>Curated opportunity preview</h1>
        <p>
          Validate public metadata against the exact For You presentation. No
          ingestion endpoint is connected in this local sample.
        </p>
      </header>

      <div className={styles.operatorGrid}>
        <form className={styles.operatorForm} onSubmit={submit}>
          <div className={styles.operatorNotice}>
            <ShieldCheck aria-hidden="true" size={21} />
            <span>
              Store source metadata and an operator-authored evidence summary.
              Never paste an article or media body.
            </span>
          </div>

          <fieldset>
            <legend>Opportunity</legend>
            <label>
              Opportunity title
              <input
                onChange={(event) => update("title", event.target.value)}
                required
                value={draft.title}
              />
            </label>
            <label>
              Summary
              <textarea
                maxLength={280}
                onChange={(event) => update("summary", event.target.value)}
                required
                rows={3}
                value={draft.summary}
              />
            </label>
            <div className={styles.formPair}>
              <label>
                Platform
                <select
                  onChange={(event) => update("platform", event.target.value)}
                  value={draft.platform}
                >
                  <option value="instagram_reels">Instagram Reels</option>
                  <option value="tiktok_video">TikTok video</option>
                  <option value="youtube_shorts">YouTube Shorts</option>
                </select>
              </label>
              <label>
                Format
                <select
                  onChange={(event) => update("format", event.target.value)}
                  value={draft.format}
                >
                  <option value="tutorial">Tutorial</option>
                  <option value="behind_scenes">Behind the scenes</option>
                  <option value="story">Story</option>
                  <option value="demonstration">Demonstration</option>
                </select>
              </label>
            </div>
            <label>
              Content pillar
              <input
                onChange={(event) => update("pillar", event.target.value)}
                required
                value={draft.pillar}
              />
            </label>
            <div className={styles.formPair}>
              <label>
                Readiness
                <select
                  onChange={(event) => update("readiness", event.target.value)}
                  value={draft.readiness}
                >
                  <option value="spark">Spark</option>
                  <option value="shape">Shape</option>
                  <option value="ready">Ready</option>
                </select>
              </label>
              <label>
                Goal
                <select
                  onChange={(event) => update("goal", event.target.value)}
                  value={draft.goal}
                >
                  <option value="reach">Reach</option>
                  <option value="trust">Trust</option>
                  <option value="community">Community</option>
                  <option value="conversion">Conversion</option>
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Curated source contract</legend>
            <div className={styles.formPair}>
              <label>
                Source label
                <input
                  onChange={(event) => update("sourceLabel", event.target.value)}
                  required
                  value={draft.sourceLabel}
                />
              </label>
              <label>
                Allowed source class
                <select
                  onChange={(event) => update("sourceClass", event.target.value)}
                  value={draft.sourceClass}
                >
                  <option value="official_platform">Official platform</option>
                  <option value="public_research">Public research</option>
                  <option value="creator_submission">Creator submission</option>
                  <option value="licensed_editorial">Licensed editorial</option>
                </select>
              </label>
            </div>
            <label>
              Public HTTPS source URL
              <input
                onChange={(event) => update("sourceUrl", event.target.value)}
                required
                type="url"
                value={draft.sourceUrl}
              />
            </label>
            <div className={styles.formPair}>
              <label>
                Observed at (UTC)
                <input
                  onChange={(event) => update("observedAt", event.target.value)}
                  required
                  type="datetime-local"
                  value={draft.observedAt}
                />
              </label>
              <label>
                Expires at (UTC)
                <input
                  onChange={(event) => update("expiresAt", event.target.value)}
                  required
                  type="datetime-local"
                  value={draft.expiresAt}
                />
              </label>
            </div>
            <label>
              Geography
              <input
                onChange={(event) => update("geography", event.target.value)}
                required
                value={draft.geography}
              />
            </label>
            <label>
              Operator-authored evidence summary
              <textarea
                maxLength={280}
                onChange={(event) =>
                  update("evidenceSummary", event.target.value)
                }
                required
                rows={3}
                value={draft.evidenceSummary}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>Factor breakdown (0–100)</legend>
            <div className={styles.factorInputs}>
              {(["relevance", "momentum", "originality", "creatorFit"] as const).map(
                (factor) => (
                  <label key={factor}>
                    {formatLabel(factor)}
                    <input
                      max="100"
                      min="0"
                      onChange={(event) => update(factor, event.target.value)}
                      required
                      type="number"
                      value={draft[factor]}
                    />
                  </label>
                ),
              )}
            </div>
          </fieldset>

          <button className={styles.previewButton} type="submit">
            <Eye aria-hidden="true" size={19} /> Preview exact opportunity
          </button>
          {error ? (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          ) : null}
        </form>

        <section
          aria-label="Exact For You preview"
          className={styles.operatorPreview}
        >
          <header>
            <p>Presentation contract</p>
            <h2>Exact For You preview</h2>
            <span>Preview only · not ingested</span>
          </header>
          {preview ? (
            <OpportunityStory opportunity={preview} preview />
          ) : (
            <div className={styles.previewEmpty}>
              <Eye aria-hidden="true" size={28} />
              <p>Validate the source contract to render the exact public row.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (letter) => letter.toLocaleUpperCase());
}
