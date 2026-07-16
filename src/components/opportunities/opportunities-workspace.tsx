"use client";

import {
  ArrowRight,
  CheckCircle,
  File,
  ImageSquare,
  LinkSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import Link from "next/link";
import {
  type ChangeEvent,
  type FormEvent,
  useMemo,
  useRef,
  useState,
} from "react";

import { CraftGuideDrawer } from "@/components/opportunities/craft-guide-drawer";
import { OpportunityStory } from "@/components/opportunities/opportunity-story";
import {
  personalizeOpportunityScore,
} from "@/domain/creator-intelligence";
import {
  rankOpportunities,
  type IdeaRecord,
} from "@/domain/opportunities";
import type { WorkflowStage } from "@/domain/schema";
import {
  ALLOWED_VISION_MIME_TYPES,
  CRAFT_GUIDES,
  VISION_WORKSPACE_QUOTA_BYTES,
  matchCraftGuides,
  preflightVisionFile,
  type CreatorStage,
  type VisionReferenceInput,
} from "@/lib/providers/opportunities";
import { DEMO_NOW } from "@/lib/demo/fixtures";
import { useMuseboardStore } from "@/lib/store/museboard-store";
import { useThinkingRoomStore } from "@/lib/store/thinking-room-store";

import styles from "./opportunities.module.css";

export type OpportunityView = "for-you" | "ideas" | "vision";
type IdeaGrouping = "pillar" | "format" | "readiness" | "goal";

const viewLinks: Array<{
  view: OpportunityView;
  href: string;
  label: string;
}> = [
  { view: "for-you", href: "/app/opportunities", label: "For You" },
  {
    view: "ideas",
    href: "/app/opportunities/ideas",
    label: "Idea Board",
  },
  {
    view: "vision",
    href: "/app/opportunities/vision",
    label: "Vision Board",
  },
];

const pageCopy: Record<OpportunityView, [string, string]> = {
  "for-you": [
    "Opportunities",
    "Source-backed openings, ranked for your creative lane.",
  ],
  ideas: ["Idea Board", "Shape a signal before it becomes production work."],
  vision: [
    "Vision Board",
    "Keep rights-aware reference metadata close to the strategy.",
  ],
};

function formatLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (letter) => letter.toLocaleUpperCase());
}

function creatorStage(contentCount: number): CreatorStage {
  if (contentCount >= 20) return "established";
  if (contentCount >= 5) return "growing";
  return "starter";
}

function craftStage(stage?: WorkflowStage) {
  if (
    !stage ||
    stage === "published" ||
    stage === "measured" ||
    stage === "archived"
  ) {
    return "ready" as const;
  }
  return stage;
}

function WorkspaceHeader({
  view,
  guides,
}: {
  view: OpportunityView;
  guides: ReturnType<typeof matchCraftGuides>;
}) {
  const [title, description] = pageCopy[view];
  return (
    <>
      <header className={styles.workspaceHeader}>
        <div>
          <p className={styles.sampleMode}>Sample workspace · not live</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className={styles.headerActions}>
          <CraftGuideDrawer guides={guides} />
        </div>
      </header>
      <nav aria-label="Opportunity views" className={styles.viewNav}>
        {viewLinks.map((link) => (
          <Link
            aria-current={view === link.view ? "page" : undefined}
            data-active={view === link.view}
            href={link.href}
            key={link.view}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

function ForYouView({
  onActivateOpportunity,
}: {
  onActivateOpportunity: (opportunityId: string) => void;
}) {
  const opportunities = useMuseboardStore((state) => state.opportunities);
  const decisions = useMuseboardStore((state) => state.opportunityDecisions);
  const ideas = useMuseboardStore((state) => state.ideas);
  const saveOpportunity = useMuseboardStore((state) => state.saveOpportunity);
  const restoreOpportunity = useMuseboardStore(
    (state) => state.restoreOpportunity,
  );
  const shapeOpportunity = useMuseboardStore(
    (state) => state.shapeOpportunity,
  );
  const opportunityFeedback = useMuseboardStore((state) => state.opportunityFeedback);
  const recordOpportunityFeedback = useMuseboardStore((state) => state.recordOpportunityFeedback);
  const [status, setStatus] = useState("");
  const ranked = useMemo(
    () =>
      rankOpportunities(opportunities).filter(
        ({ id, provenance }) =>
          decisions[id] !== "dismissed" &&
          new Date(provenance.expiresAt).getTime() >
            new Date(DEMO_NOW).getTime(),
      ).sort((left, right) => personalizeOpportunityScore(right, opportunityFeedback).score - personalizeOpportunityScore(left, opportunityFeedback).score),
    [decisions, opportunities, opportunityFeedback],
  );
  const dismissed = opportunities.filter(
    ({ id }) => decisions[id] === "dismissed",
  );

  if (!ranked.length) {
    return (
      <section className={styles.emptyState}>
        <h2>You&apos;ve reviewed every sample signal.</h2>
        <p>Restore one below or return after adding a curated preview.</p>
        {dismissed.map((opportunity) => (
          <button
            key={opportunity.id}
            onClick={() => restoreOpportunity(opportunity.id)}
            type="button"
          >
            Restore {opportunity.title}
          </button>
        ))}
      </section>
    );
  }

  return (
    <section aria-label="For You opportunities" className={styles.forYouView}>
      <div className={styles.opportunityFeed}>
        {ranked.map((opportunity) => (
          <OpportunityStory
            decision={decisions[opportunity.id]}
            key={opportunity.id}
            onDismiss={() => {
              recordOpportunityFeedback(opportunity.id, "not_for_me");
              setStatus(`Removed ${opportunity.title} and tuned future fits.`);
            }}
            onMoreLikeThis={() => {
              recordOpportunityFeedback(opportunity.id, "more_like_this");
              setStatus(`Museboard will favor more ${formatLabel(opportunity.format)} ideas in ${opportunity.pillar}.`);
            }}
            onSave={() => {
              saveOpportunity(opportunity.id);
              setStatus(`Saved ${opportunity.title}.`);
            }}
            onShape={() => {
              const id = shapeOpportunity(opportunity.id);
              if (id) onActivateOpportunity(opportunity.id);
              setStatus(
                id
                  ? `Shaped ${opportunity.title} on the Idea Board.`
                  : "This dismissed signal cannot be shaped until it is restored.",
              );
            }}
            opportunity={opportunity}
            personalizedFit={personalizeOpportunityScore(opportunity, opportunityFeedback)}
            shaped={ideas.some(
              (idea) => idea.opportunityId === opportunity.id,
            )}
          />
        ))}
      </div>
      <aside className={styles.forYouAside}>
        <p className={styles.asideEyebrow}>How to read this</p>
        <h2>A decision aid, not a virality promise.</h2>
        <p>
          Scores disclose four editorial factors. Missing evidence caps ranking,
          and expired signals leave the recommendation set.
        </p>
        <dl>
          <div>
            <dt>Source class</dt>
            <dd>Curated metadata only</dd>
          </div>
          <div>
            <dt>Sample behavior</dt>
            <dd>Saved in this browser</dd>
          </div>
          <div>
            <dt>Cloud ingestion</dt>
            <dd>Not connected</dd>
          </div>
        </dl>
        {dismissed.length ? (
          <details>
            <summary>{dismissed.length} dismissed</summary>
            {dismissed.map((opportunity) => (
              <button
                key={opportunity.id}
                onClick={() => restoreOpportunity(opportunity.id)}
                type="button"
              >
                Restore {opportunity.title}
              </button>
            ))}
          </details>
        ) : null}
      </aside>
      <p aria-live="polite" className={styles.workspaceStatus} role="status">
        {status}
      </p>
    </section>
  );
}

function groupedIdeas(ideas: IdeaRecord[], grouping: IdeaGrouping) {
  return ideas.reduce<Record<string, IdeaRecord[]>>((groups, idea) => {
    const key = idea[grouping];
    groups[key] = [...(groups[key] ?? []), idea];
    return groups;
  }, {});
}

function IdeaBoardView({
  onActivateOpportunity,
}: {
  onActivateOpportunity: (opportunityId: string) => void;
}) {
  const ideas = useMuseboardStore((state) => state.ideas);
  const synthesisRevisions = useThinkingRoomStore((state) => state.synthesisRevisions);
  const promoteIdea = useMuseboardStore((state) => state.promoteIdea);
  const [grouping, setGrouping] = useState<IdeaGrouping>("pillar");
  const [status, setStatus] = useState("");
  const groups = groupedIdeas(ideas, grouping);

  return (
    <section className={styles.ideaBoard}>
      <div className={styles.ideaToolbar}>
        <label htmlFor="idea-grouping">Group ideas by</label>
        <select
          id="idea-grouping"
          onChange={(event) => setGrouping(event.target.value as IdeaGrouping)}
          value={grouping}
        >
          <option value="pillar">Pillar</option>
          <option value="format">Format</option>
          <option value="readiness">Readiness</option>
          <option value="goal">Goal</option>
        </select>
        <p>
          Promotion keeps source provenance and begins at Angle. Nothing is
          generated or published automatically.
        </p>
      </div>

      {ideas.length ? (
        <div className={styles.ideaGroups}>
          {Object.entries(groups).map(([group, groupIdeas]) => (
            <section className={styles.ideaGroup} key={group}>
              <header>
                <h2>{formatLabel(group)}</h2>
                <span>{groupIdeas.length} idea{groupIdeas.length === 1 ? "" : "s"}</span>
              </header>
              {groupIdeas.map((idea) => (
                <article aria-labelledby={`${idea.id}-title`} id={`idea-${idea.id}`} key={idea.id}>
                  <div>
                    <p>
                      {formatLabel(idea.format)} · {formatLabel(idea.readiness)} ·{" "}
                      {formatLabel(idea.goal)}
                    </p>
                    <h3 id={`${idea.id}-title`}>{idea.title}</h3>
                    <p>{idea.summary}</p>
                    {idea.provenance.thinkingRoomOrigin ? (() => {
                      const origin = idea.provenance.thinkingRoomOrigin;
                      const confidence = synthesisRevisions.find(
                        ({ id, roomId }) => id === origin.synthesisRevisionId && roomId === origin.roomId,
                      )?.confidence;
                      return (
                        <aside aria-label="Thinking Room source" className={styles.ideaOrigin}>
                          <strong>From Thinking Room</strong>
                          <p>{origin.question}</p>
                          {confidence ? <span>{formatLabel(confidence)} confidence</span> : null}
                          <Link href={`/app/thinking/${origin.roomId}`}>Open room</Link>
                        </aside>
                      );
                    })() : (
                      <small>
                        Source preserved from {idea.provenance.provider} ·{" "}
                        {idea.provenance.mode}
                      </small>
                    )}
                  </div>
                  <div className={styles.ideaActions}>
                    <button
                      onClick={() => {
                        const contentId = promoteIdea(idea.id);
                        if (contentId && idea.opportunityId) {
                          onActivateOpportunity(idea.opportunityId);
                        }
                        setStatus(
                          contentId
                            ? `${idea.title} is ready in the Angle workshop.`
                            : "This idea could not be promoted.",
                        );
                      }}
                      type="button"
                    >
                      <CheckCircle aria-hidden="true" size={18} />
                      {idea.promotedContentId
                        ? "Promoted to workshop"
                        : "Promote to workshop"}
                    </button>
                    {idea.promotedContentId ? (
                      <Link
                        href={`/app/create/${idea.promotedContentId}?stage=angle`}
                      >
                        Open in workshop <ArrowRight aria-hidden="true" size={17} />
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <section className={styles.emptyState}>
          <ImageSquare aria-hidden="true" size={30} />
          <h2>No shaped ideas yet.</h2>
          <p>Shape one source-backed signal; it will arrive here with provenance.</p>
          <Link href="/app/opportunities">Find an opportunity</Link>
        </section>
      )}
      <p aria-live="polite" className={styles.workspaceStatus} role="status">
        {status}
      </p>
    </section>
  );
}

function bytesLabel(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function sha256(file: globalThis.File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export type VisionFileHasher = (file: globalThis.File) => Promise<string>;

export function VisionBoardView({
  hashFile = sha256,
}: {
  hashFile?: VisionFileHasher;
}) {
  const references = useMuseboardStore((state) => state.visionReferences);
  const selectedIds = useMuseboardStore((state) => state.selectedReferenceIds);
  const addReference = useMuseboardStore((state) => state.addVisionReference);
  const removeReference = useMuseboardStore(
    (state) => state.removeVisionReference,
  );
  const toggleSelection = useMuseboardStore(
    (state) => state.toggleReferenceSelection,
  );
  const [kind, setKind] = useState<"url" | "file">("url");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [fileMeta, setFileMeta] = useState<{
    fileName: string;
    sizeBytes: number;
    mimeType: string;
  }>();
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  const [hash, setHash] = useState("");
  const [hashing, setHashing] = useState(false);
  const [rights, setRights] = useState<VisionReferenceInput["rightsStatus"]>(
    "unknown",
  );
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const fileRequestId = useRef(0);
  const usedBytes = references.reduce(
    (total, reference) => total + reference.sizeBytes,
    0,
  );

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const requestId = ++fileRequestId.current;
    const file = event.target.files?.[0];
    setHash("");
    setError("");
    setStatus("");
    setHashing(false);
    setFileMeta(undefined);
    if (!file) {
      return;
    }
    const preflight = preflightVisionFile(file, usedBytes);
    if (!preflight.ok) {
      setError(preflight.error);
      return;
    }
    setTitle((current) => current || file.name.replace(/\.[^.]+$/u, ""));
    setMimeType(preflight.mimeType);
    setFileMeta({
      fileName: file.name,
      sizeBytes: file.size,
      mimeType: preflight.mimeType,
    });
    setHashing(true);
    setStatus(`Hashing ${file.name} locally…`);
    try {
      const digest = (await hashFile(file)).trim().toLowerCase();
      if (requestId !== fileRequestId.current) return;
      if (!/^[a-f\d]{64}$/u.test(digest)) {
        setError("This browser returned an invalid SHA-256 hash.");
        setStatus("");
        return;
      }
      setHash(digest);
      setStatus(
        `${file.name} metadata and SHA-256 prepared locally. Nothing uploaded.`,
      );
    } catch {
      if (requestId !== fileRequestId.current) return;
      setHash("");
      setStatus("");
      setError("This browser could not calculate the local SHA-256 hash.");
    } finally {
      if (requestId === fileRequestId.current) setHashing(false);
    }
  }

  function chooseReferenceKind(nextKind: "url" | "file") {
    ++fileRequestId.current;
    setKind(nextKind);
    setHash("");
    setFileMeta(undefined);
    setHashing(false);
    setError("");
    setStatus("");
  }

  function submitReference(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    const result = addReference({
      kind,
      title,
      url: kind === "url" ? url : undefined,
      fileName: kind === "file" ? fileMeta?.fileName : undefined,
      mimeType: kind === "file" ? fileMeta?.mimeType ?? mimeType : mimeType,
      sizeBytes: kind === "file" ? fileMeta?.sizeBytes ?? 0 : 0,
      sha256: hash,
      rightsStatus: rights,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStatus(
      result.reused
        ? "Already in this board — reused existing reference metadata."
        : "Metadata added locally — no file or media was uploaded.",
    );
  }

  return (
    <section className={styles.visionBoard}>
      <form className={styles.referenceComposer} onSubmit={submitReference}>
        <div className={styles.composerIntro}>
          <div>
            <p className={styles.asideEyebrow}>Add a reference</p>
            <h2>Metadata, not a copied media library.</h2>
          </div>
          <p>
            Local metadata only. Museboard does not upload a file or copy an
            article body in this sample workspace.
          </p>
        </div>

        <fieldset className={styles.kindPicker}>
          <legend>Reference type</legend>
          <label>
            <input
              checked={kind === "url"}
              name="reference-kind"
              onChange={() => chooseReferenceKind("url")}
              type="radio"
            />
            <LinkSimple aria-hidden="true" size={18} /> URL
          </label>
          <label>
            <input
              checked={kind === "file"}
              name="reference-kind"
              onChange={() => chooseReferenceKind("file")}
              type="radio"
            />
            <File aria-hidden="true" size={18} /> File metadata
          </label>
        </fieldset>

        <div className={styles.composerFields}>
          <label>
            Reference title
            <input
              onChange={(event) => setTitle(event.target.value)}
              required
              type="text"
              value={title}
            />
          </label>
          {kind === "url" ? (
            <label>
              Reference URL
              <input
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://"
                required
                type="url"
                value={url}
              />
            </label>
          ) : (
            <label>
              Choose local file
              <input
                accept={ALLOWED_VISION_MIME_TYPES.join(",")}
                onChange={handleFile}
                required
                type="file"
              />
            </label>
          )}
          {kind === "url" ? (
            <label>
              Media type
              <select
                onChange={(event) => setMimeType(event.target.value)}
                value={mimeType}
              >
                {ALLOWED_VISION_MIME_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            Content hash (SHA-256)
            <input
              onChange={(event) => setHash(event.target.value)}
              placeholder="64 hexadecimal characters"
              readOnly={kind === "file"}
              required
              type="text"
              value={hash}
            />
          </label>
          <label>
            Rights status
            <select
              onChange={(event) =>
                setRights(event.target.value as VisionReferenceInput["rightsStatus"])
              }
              value={rights}
            >
              <option value="unknown">Unknown — cannot select</option>
              <option value="owned">Owned</option>
              <option value="licensed">Licensed</option>
              <option value="permission">Permission granted</option>
              <option value="public_domain">Public domain</option>
            </select>
          </label>
        </div>

        <div className={styles.composerFooter}>
          <div>
            <strong>{bytesLabel(usedBytes)} of 2 GB</strong>
            <span>Demo quota semantics · metadata is browser-local</span>
          </div>
          <button
            disabled={
              kind === "file" && (hashing || !fileMeta || hash.length !== 64)
            }
            type="submit"
          >
            <Plus aria-hidden="true" size={18} /> Add reference metadata
          </button>
        </div>
        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}
        <p aria-live="polite" className={styles.formStatus} role="status">
          {status}
        </p>
      </form>

      {references.length ? (
        <div className={styles.referenceList}>
          {references.map((reference) => {
            const selected = selectedIds.includes(reference.id);
            return (
              <article aria-label={reference.title} key={reference.id}>
                <div className={styles.referenceIcon}>
                  {reference.kind === "url" ? (
                    <LinkSimple aria-hidden="true" size={23} />
                  ) : (
                    <File aria-hidden="true" size={23} />
                  )}
                </div>
                <div>
                  <p>{reference.kind} · {reference.mimeType}</p>
                  <h2>{reference.title}</h2>
                  <p>
                    {reference.rightsStatus.replaceAll("_", " ")} rights ·{" "}
                    {bytesLabel(reference.sizeBytes)} · SHA-256{" "}
                    {reference.sha256.slice(0, 10)}…
                  </p>
                  <small>Local sample metadata · no cloud upload</small>
                </div>
                <div className={styles.referenceActions}>
                  <label>
                    <input
                      aria-label="Use in strategy"
                      checked={selected}
                      disabled={reference.rightsStatus === "unknown"}
                      onChange={() => toggleSelection(reference.id)}
                      type="checkbox"
                    />
                    Use in strategy
                  </label>
                  <button
                    aria-label="Remove reference"
                    onClick={() => removeReference(reference.id)}
                    type="button"
                  >
                    <Trash aria-hidden="true" size={18} /> Remove
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className={styles.emptyState}>
          <ImageSquare aria-hidden="true" size={30} />
          <h2>No references yet.</h2>
          <p>Add a rights-aware URL or local file metadata to begin.</p>
        </section>
      )}

      {references.length ? (
        <aside className={styles.selectionDock}>
          <strong>{selectedIds.length} selected for strategy</strong>
          <span>Selection is explicit and persisted in this browser only.</span>
        </aside>
      ) : null}
      <progress
        aria-label="Vision Board quota used"
        max={VISION_WORKSPACE_QUOTA_BYTES}
        value={usedBytes}
      />
    </section>
  );
}

export function OpportunitiesWorkspace({ view }: { view: OpportunityView }) {
  const opportunities = useMuseboardStore((state) => state.opportunities);
  const selectedOpportunityId = useMuseboardStore(
    (state) => state.selectedOpportunityId,
  );
  const content = useMuseboardStore((state) => state.content);
  const ideas = useMuseboardStore((state) => state.ideas);
  const selectOpportunity = useMuseboardStore(
    (state) => state.selectOpportunity,
  );
  const [activeContextId, setActiveContextId] = useState(
    selectedOpportunityId ?? opportunities[0]?.id,
  );
  const active =
    opportunities.find(({ id }) => id === activeContextId) ??
    opportunities.find(({ id }) => id === selectedOpportunityId) ??
    opportunities[0];
  const activeContent = content.find(
    ({ opportunityId }) => opportunityId === active?.id,
  );
  const guides = active
    ? matchCraftGuides(CRAFT_GUIDES, {
        stage: activeContent?.stage
          ? craftStage(activeContent.stage)
          : ideas.some(({ opportunityId }) => opportunityId === active.id)
            ? "angle"
            : "signal",
        platform: active.platform,
        format: active.format,
        creatorStage: creatorStage(content.length),
      })
    : [];

  function activateOpportunity(opportunityId: string) {
    setActiveContextId(opportunityId);
    selectOpportunity(opportunityId);
  }

  return (
    <div className={styles.opportunitiesPage}>
      <WorkspaceHeader guides={guides} view={view} />
      {view === "for-you" ? (
        <ForYouView onActivateOpportunity={activateOpportunity} />
      ) : null}
      {view === "ideas" ? (
        <IdeaBoardView onActivateOpportunity={activateOpportunity} />
      ) : null}
      {view === "vision" ? <VisionBoardView /> : null}
    </div>
  );
}
