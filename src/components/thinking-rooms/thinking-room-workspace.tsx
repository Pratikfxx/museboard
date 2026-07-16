"use client";

import {
  ArrowLeft,
  Check,
  ChatCircleDots,
  Lightbulb,
  LinkSimple,
  Smiley,
  ThumbsUp,
  Users,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { z } from "zod";

import {
  addThinkingContribution,
  appendSynthesisRevision,
  createContributionLink,
  resolveContributionLink,
  contributionLinkSchema,
  contributionReactionSchema,
  roomCanConvert,
  thinkingContributionSchema,
  thinkingRoomContentOriginSchema,
  thinkingRoomSchema,
  thinkingSynthesisRevisionSchema,
  type ContributionLink,
  type ContributionReaction,
  type ChosenContentDirection,
  type ThinkingContribution,
  type ThinkingLens,
  type ThinkingRoom,
  type ThinkingSynthesisRevision,
} from "@/domain/thinking-rooms";
import { useThinkingRoomStore } from "@/lib/store/thinking-room-store";
import { useMuseboardStore } from "@/lib/store/museboard-store";
import type { ThinkingRoomAggregate } from "@/lib/thinking-rooms/repository";
import type { ThinkingContributionEditClaim, ThinkingRoomPresenceArea } from "@/domain/thinking-room-presence";

import {
  THINKING_LENS_LABELS,
  ThinkingContributionComposer,
} from "./thinking-contribution-composer";
import { ThinkingSynthesisRail } from "./thinking-synthesis-rail";
import { useThinkingRoomPresence } from "./use-thinking-room-presence";
import styles from "./thinking-rooms.module.css";

const roomAggregateSchema: z.ZodType<ThinkingRoomAggregate> = z.object({
  room: thinkingRoomSchema,
  contributions: z.array(thinkingContributionSchema),
  reactions: z.array(contributionReactionSchema),
  links: z.array(contributionLinkSchema).default([]),
  synthesisRevisions: z.array(thinkingSynthesisRevisionSchema),
  contentOrigins: z.array(thinkingRoomContentOriginSchema).default([]),
});
const roomResponseSchema = z.object({ aggregate: roomAggregateSchema });
const conversionResponseSchema = z.object({
  origin: thinkingRoomContentOriginSchema,
  roomRevision: z.number().int().positive(),
});
const reactionMutationResponseSchema = z.object({
  roomRevision: z.number().int().positive(),
  reaction: contributionReactionSchema.nullable(),
});
const contributionEditResponseSchema = z.object({
  roomRevision: z.number().int().positive(),
  contribution: thinkingContributionSchema,
});

const LENSES: readonly ThinkingLens[] = [
  "audience_tensions",
  "evidence",
  "challenges",
  "possibilities",
];

const LENS_COPY: Record<ThinkingLens, { index: string; prompt: string }> = {
  audience_tensions: {
    index: "01",
    prompt: "What does the audience want, fear, assume, or struggle to say out loud?",
  },
  evidence: {
    index: "02",
    prompt: "Which observation, source, reply, or lived experience strengthens or weakens this?",
  },
  challenges: {
    index: "03",
    prompt: "What could make this direction wrong, incomplete, risky, or too easy?",
  },
  possibilities: {
    index: "04",
    prompt: "What angle, combination, or small experiment becomes possible from here?",
  },
};

const ROOM_STATUS_LABELS: Record<ThinkingRoom["status"], string> = {
  exploring: "Exploring",
  synthesizing: "Synthesizing",
  decided: "Decided",
  converted: "Direction created",
  archived: "Archived",
};

const REACTIONS: readonly {
  kind: ContributionReaction["kind"];
  label: string;
  icon: typeof ThumbsUp;
}[] = [
  { kind: "agree", label: "Agree", icon: ThumbsUp },
  { kind: "concern", label: "Concern", icon: WarningCircle },
  { kind: "needs_evidence", label: "Needs evidence", icon: LinkSimple },
  { kind: "promising", label: "Promising", icon: Smiley },
];

type SaveState = "idle" | "saving" | "saved" | "error" | "conflict" | "permission";
type LoadState = "loading" | "ready" | "missing" | "permission" | "offline" | "error";

export interface ThinkingRoomLiveContext {
  userId: string;
  displayName: string;
  canEdit: boolean;
  presenceEnabled?: boolean;
}

function useNarrowRoomCanvas() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 720px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function activeReactionCount(
  reactions: readonly ContributionReaction[],
  contributionId: string,
  kind: ContributionReaction["kind"],
) {
  return reactions.filter((reaction) => reaction.contributionId === contributionId && reaction.kind === kind).length;
}

function RoomUnavailable({ missing = false }: { missing?: boolean }) {
  return (
    <main className={styles.roomFailure}>
      <span aria-hidden="true"><WarningCircle size={30} weight="duotone" /></span>
      <small>Thinking Room</small>
      <h1>{missing ? "This Thinking Room is not here." : "This room could not be opened."}</h1>
      <p>{missing
        ? "It may have been archived, removed, or opened from an outdated link. Your other rooms are still available."
        : "Your work has not been changed. Return to the room library and try again when the connection is ready."}</p>
      <Link href="/app/thinking"><ArrowLeft aria-hidden="true" size={18} /> Back to Thinking Rooms</Link>
    </main>
  );
}

interface ContributionNoteProps {
  contribution: ThinkingContribution;
  contributions: ThinkingContribution[];
  links: ContributionLink[];
  reactions: ContributionReaction[];
  actorId?: string;
  canReact: boolean;
  canEdit: boolean;
  claim?: ThinkingContributionEditClaim;
  mode: "sample" | "live";
  roomId: string;
  roomStatus: ThinkingRoom["status"];
  sessionId: string;
  onClaim: (contributionId: string, active: boolean) => Promise<Response>;
  onEdited: (result: z.infer<typeof contributionEditResponseSchema>) => void;
  onComposingChange: (composing: boolean) => void;
  onEditingChange: (contributionId?: string) => void;
  onFocusAreaChange: (area?: ThinkingLens) => void;
  onReact: (contribution: ThinkingContribution, kind: ContributionReaction["kind"], active: boolean) => void;
}

function ContributionNote({
  contribution, contributions, links, reactions, actorId, canReact, canEdit, claim,
  mode, roomId, roomStatus, sessionId, onClaim, onEdited, onComposingChange, onEditingChange, onFocusAreaChange, onReact,
}: ContributionNoteProps) {
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(contribution.body);
  const [sourceDraft, setSourceDraft] = useState(contribution.sourceReferenceId ?? "");
  const [editState, setEditState] = useState<"idle" | "claiming" | "saving" | "conflict" | "permission" | "offline" | "error">("idle");
  const [editExpectedRevision, setEditExpectedRevision] = useState(contribution.revision);
  const [latest, setLatest] = useState<ThinkingContribution>();
  const recoveryKey = `museboard-thinking-edit:${roomId}:${contribution.id}:${actorId ?? "anonymous"}`;
  const otherClaim = claim && claim.actorUserId !== actorId ? claim : undefined;
  const mayEdit = mode === "live" && canEdit && actorId === contribution.authorMembershipId &&
    ["exploring", "synthesizing"].includes(roomStatus) && !otherClaim;
  const relatedLinks = links.filter(({ fromContributionId, toContributionId }) =>
    fromContributionId === contribution.id || toContributionId === contribution.id,
  );
  const persistRecovery = (body: string, sourceReferenceId: string) => window.localStorage.setItem(recoveryKey, JSON.stringify({ body, sourceReferenceId }));
  const copyDraft = () => navigator.clipboard.writeText(contribution.lens === "evidence"
    ? `${editDraft}\n\nSource: ${sourceDraft}`
    : editDraft);

  async function beginEdit() {
    setEditState("claiming");
    const response = await onClaim(contribution.id, true);
    if (response.status === 401 || response.status === 403) return setEditState("permission");
    if (response.status === 409) return setEditState("conflict");
    if (!response.ok) return setEditState("error");
    const recovered = window.localStorage.getItem(recoveryKey);
    let recoveredDraft: { body: string; sourceReferenceId: string } | undefined;
    try {
      const parsedRecovery = recovered
        ? z.object({ body: z.string(), sourceReferenceId: z.string() }).safeParse(JSON.parse(recovered))
        : undefined;
      recoveredDraft = parsedRecovery?.success ? parsedRecovery.data : undefined;
    } catch {
      window.localStorage.removeItem(recoveryKey);
    }
    setEditDraft(recoveredDraft?.body ?? contribution.body);
    setSourceDraft(recoveredDraft?.sourceReferenceId ?? contribution.sourceReferenceId ?? "");
    setEditExpectedRevision(contribution.revision);
    setEditing(true);
    onEditingChange(contribution.id);
    setEditState("idle");
  }

  async function cancelEdit() {
    setEditing(false);
    setLatest(undefined);
    setEditState("idle");
    onComposingChange(false);
    onFocusAreaChange(undefined);
    onEditingChange(undefined);
    window.localStorage.removeItem(recoveryKey);
    await onClaim(contribution.id, false);
  }

  async function saveEdit(expectedRevision = editExpectedRevision) {
    setEditState("saving");
    let response: Response;
    try {
      response = await fetch(`/api/thinking-rooms/${encodeURIComponent(roomId)}/contributions/${encodeURIComponent(contribution.id)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          expectedRevision,
          body: editDraft,
          ...(contribution.lens === "evidence" ? { sourceReferenceId: sourceDraft } : {}),
        }),
      });
    } catch {
      setEditState("offline");
      return;
    }
    if (response.status === 401 || response.status === 403) {
      setEditState("permission");
      onEditingChange(undefined);
      return;
    }
    if (response.status === 409) {
      const payload = await response.json().catch(() => undefined) as { latestContribution?: unknown } | undefined;
      const parsedLatest = thinkingContributionSchema.safeParse(payload?.latestContribution);
      setLatest(parsedLatest.success ? parsedLatest.data : undefined);
      setEditState("conflict");
      return;
    }
    const parsed = response.ok ? contributionEditResponseSchema.safeParse(await response.json()) : undefined;
    if (!parsed?.success) return setEditState("error");
    window.localStorage.removeItem(recoveryKey);
    setEditing(false);
    setLatest(undefined);
    setEditState("idle");
    onComposingChange(false);
    onFocusAreaChange(undefined);
    onEditingChange(undefined);
    onEdited(parsed.data);
  }

  return (
    <article className={styles.contributionNote}>
      <header>
        <span aria-hidden="true">{contribution.authorDisplayNameSnapshot.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>{contribution.authorDisplayNameSnapshot}</strong>
          <time dateTime={contribution.createdAt}>{timeLabel(contribution.createdAt)}</time>
        </div>
        {contribution.sourceReferenceId ? <em><LinkSimple aria-hidden="true" size={14} /> Source noted</em> : null}
      </header>
      {otherClaim ? <small>{otherClaim.displayName} is editing this note</small> : null}
      {editing ? (
        <div className={styles.noteEditor}>
          <label>
            <span>Edit contribution</span>
            <textarea
              aria-label="Edit contribution"
              maxLength={20000}
              onBlur={() => { onComposingChange(false); onFocusAreaChange(undefined); }}
              onChange={(event) => {
                setEditDraft(event.target.value);
                persistRecovery(event.target.value, sourceDraft);
                onComposingChange(Boolean(event.target.value.trim()));
              }}
              onFocus={() => { onFocusAreaChange(contribution.lens); onComposingChange(Boolean(editDraft.trim())); }}
              value={editDraft}
            />
          </label>
          {contribution.lens === "evidence" ? <label><span>Source reference</span><input maxLength={2000} onBlur={() => onFocusAreaChange(undefined)} onChange={(event) => { setSourceDraft(event.target.value); persistRecovery(editDraft, event.target.value); }} onFocus={() => { onFocusAreaChange(contribution.lens); onComposingChange(false); }} value={sourceDraft} /></label> : null}
          {editState === "conflict" ? (
            <div role="alert">
              <strong>This note changed elsewhere. Your version is still safe.</strong>
              {latest ? <p>Latest: {latest.body}</p> : null}
              <button onClick={() => { if (latest) { setEditDraft(latest.body); setSourceDraft(latest.sourceReferenceId ?? ""); setEditExpectedRevision(latest.revision); window.localStorage.removeItem(recoveryKey); setEditState("idle"); } }} type="button">Use latest</button>
              <button disabled={!latest} onClick={() => { if (latest) void saveEdit(latest.revision); }} type="button">Try my version</button>
              <button onClick={() => void copyDraft()} type="button">Copy my draft</button>
            </div>
          ) : null}
          {editState === "permission" ? <div role="alert"><strong>Your edit access changed. Your draft is still here.</strong><button onClick={() => void copyDraft()} type="button">Copy my draft</button></div> : null}
          {editState === "offline" ? <div role="alert"><strong>You are offline. Your edit is still here.</strong><button onClick={() => void saveEdit()} type="button">Retry edit</button><button onClick={() => void copyDraft()} type="button">Copy my draft</button></div> : null}
          {editState === "error" ? <p role="alert">This edit could not be saved. Your draft is still here.</p> : null}
          <div>
            <button disabled={!editDraft.trim() || editState === "saving"} onClick={() => void saveEdit()} type="button">Save edit</button>
            <button disabled={editState === "saving"} onClick={() => void cancelEdit()} type="button">Cancel</button>
          </div>
        </div>
      ) : <p>{contribution.body}</p>}
      {!editing && mayEdit ? <button disabled={editState === "claiming"} onClick={() => void beginEdit()} type="button">Edit note</button> : null}
      {!editing && editState === "conflict" ? <small role="alert">This note is being edited in another tab.</small> : null}
      {!editing && editState === "permission" ? <small role="alert">You no longer have permission to edit this note.</small> : null}
      {relatedLinks.map((link) => {
        const targetId = link.fromContributionId === contribution.id
          ? link.toContributionId
          : link.fromContributionId;
        const target = contributions.find(({ id }) => id === targetId);
        const resolver = contributions.find(
          ({ authorMembershipId }) => authorMembershipId === link.resolvedByMembershipId,
        )?.authorDisplayNameSnapshot ?? link.resolvedByMembershipId;
        return (
          <div aria-label={`Relationships for ${contribution.body}`} className={styles.relationshipDetails} key={link.id} role="group">
            <strong>{link.relationship.slice(0, 1).toUpperCase()}{link.relationship.slice(1)}</strong>
            {target && target.id !== contribution.id ? <span>{target.body}</span> : null}
            {link.resolutionStatus === "resolved" ? (
              <>
                <p>{link.resolutionNote}</p>
                <small>Resolved by {resolver}</small>
                <time dateTime={link.resolvedAt}>{link.resolvedAt ? timeLabel(link.resolvedAt) : null}</time>
              </>
            ) : <small>Open relationship</small>}
          </div>
        );
      })}
      <div aria-label={`Reactions to note by ${contribution.authorDisplayNameSnapshot}`} className={styles.reactions} role="group">
        {REACTIONS.map(({ kind, label, icon: Icon }) => {
          const active = Boolean(actorId && reactions.some((reaction) =>
            reaction.contributionId === contribution.id &&
            reaction.membershipId === actorId &&
            reaction.kind === kind,
          ));
          const count = activeReactionCount(reactions, contribution.id, kind);
          return (
            <button
              aria-label={`${label}, ${count} reaction${count === 1 ? "" : "s"}`}
              aria-pressed={active}
              disabled={!canReact}
              key={kind}
              onClick={() => onReact(contribution, kind, !active)}
              type="button"
            >
              <Icon aria-hidden="true" size={15} /> <span>{label}</span>{count ? <b>{count}</b> : null}
            </button>
          );
        })}
      </div>
    </article>
  );
}

export function ThinkingRoomWorkspace({
  roomId,
  mode,
  liveContext,
}: {
  roomId: string;
  mode: "sample" | "live";
  liveContext?: ThinkingRoomLiveContext;
}) {
  const sampleRooms = useThinkingRoomStore((state) => state.rooms);
  const sampleContributions = useThinkingRoomStore((state) => state.contributions);
  const sampleReactions = useThinkingRoomStore((state) => state.reactions);
  const sampleLinks = useThinkingRoomStore((state) => state.links);
  const sampleSynthesis = useThinkingRoomStore((state) => state.synthesisRevisions);
  const addSampleContribution = useThinkingRoomStore((state) => state.addContribution);
  const toggleSampleReaction = useThinkingRoomStore((state) => state.toggleReaction);
  const createSampleLink = useThinkingRoomStore((state) => state.createLink);
  const resolveSampleLink = useThinkingRoomStore((state) => state.resolveLink);
  const updateSampleRoomStatus = useThinkingRoomStore((state) => state.updateRoomStatus);
  const addSampleSynthesis = useThinkingRoomStore((state) => state.addSynthesisRevision);
  const createIdeaFromThinkingRoom = useMuseboardStore((state) => state.createIdeaFromThinkingRoom);
  const createIdeaFromThinkingRoomOrigin = useMuseboardStore((state) => state.createIdeaFromThinkingRoomOrigin);
  const ideas = useMuseboardStore((state) => state.ideas);
  const memberships = useMuseboardStore((state) => state.memberships);
  const currentActorMembershipId = useMuseboardStore((state) => state.currentActorMembershipId);

  const sampleRoom = sampleRooms.find(({ id }) => id === roomId);
  const sampleAggregate = useMemo<ThinkingRoomAggregate | undefined>(() => sampleRoom ? ({
    room: sampleRoom,
    contributions: sampleContributions.filter((contribution) => contribution.roomId === roomId && !contribution.deletedAt),
    reactions: sampleReactions.filter((reaction) => reaction.roomId === roomId),
    links: sampleLinks.filter((link) => link.roomId === roomId),
    synthesisRevisions: sampleSynthesis.filter((revision) => revision.roomId === roomId),
    contentOrigins: [],
  }) : undefined, [roomId, sampleContributions, sampleLinks, sampleReactions, sampleRoom, sampleSynthesis]);

  const [liveAggregate, setLiveAggregate] = useState<ThinkingRoomAggregate>();
  const [loadState, setLoadState] = useState<LoadState>(mode === "live" ? "loading" : "ready");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [recoverableDraft, setRecoverableDraft] = useState("");
  const [retryAction, setRetryAction] = useState<(() => Promise<void>)>();
  const [conversionState, setConversionState] = useState<"idle" | "offline" | "permission" | "error">("idle");
  const [activeLens, setActiveLens] = useState<ThinkingLens>("audience_tensions");
  const [composerLens, setComposerLens] = useState<ThinkingLens>("audience_tensions");
  const [draft, setDraft] = useState("");
  const [inlineComposing, setInlineComposing] = useState(false);
  const [focusedPresenceArea, setFocusedPresenceArea] = useState<ThinkingRoomPresenceArea>("room");
  const [editingContributionId, setEditingContributionId] = useState<string>();
  const [sourceReferenceDraft, setSourceReferenceDraft] = useState("");
  const [relationshipTargetId, setRelationshipTargetId] = useState("");
  const [relationship, setRelationship] = useState<"supports" | "challenges" | "extends" | "combines">("supports");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const conversionIdeaIds = useRef(new Map<string, string>());
  const narrow = useNarrowRoomCanvas();
  const router = useRouter();

  useEffect(() => {
    composerRef.current?.focus();
  }, [composerLens]);

  useEffect(() => {
    if (mode !== "live") return;
    const controller = new AbortController();
    void fetch(`/api/thinking-rooms/${encodeURIComponent(roomId)}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    }).then(async (response) => {
      if (response.status === 404) return setLoadState("missing");
      if (response.status === 401 || response.status === 403) return setLoadState("permission");
      if (!response.ok) return setLoadState("error");
      const parsed = roomResponseSchema.safeParse(await response.json());
      if (!parsed.success) return setLoadState("error");
      setLiveAggregate(parsed.data.aggregate);
      setLoadState("ready");
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadState(error instanceof TypeError ? "offline" : "error");
    });
    return () => controller.abort();
  }, [mode, roomId]);

  const aggregate = mode === "sample" ? sampleAggregate : liveAggregate;
  const actor = mode === "sample"
    ? memberships.find(({ id, status }) => id === currentActorMembershipId && status === "active")
      ?? memberships.find(({ role, status }) => role === "owner" && status === "active")
    : liveContext ? {
      id: liveContext.userId,
      displayNameSnapshot: liveContext.displayName,
      role: liveContext.canEdit ? "editor" : "viewer",
      status: "active",
    } : undefined;
  const presence = useThinkingRoomPresence({
    enabled: mode === "live" && liveContext?.presenceEnabled === true && loadState === "ready" && Boolean(aggregate),
    roomId,
    area: focusedPresenceArea,
    isComposing: inlineComposing,
    editingContributionId,
  });
  const effectiveSaveState: SaveState = presence.revoked ? "permission" : saveState;
  const canEdit = Boolean(effectiveSaveState !== "permission" && actor && (mode === "sample" ? actor.role !== "viewer" : liveContext?.canEdit));
  const canMutateContent = Boolean(canEdit && aggregate && ["exploring", "synthesizing"].includes(aggregate.room.status));
  const canReact = Boolean(effectiveSaveState !== "permission" && actor && aggregate && ["exploring", "synthesizing"].includes(aggregate.room.status));
  const currentSynthesis = aggregate?.synthesisRevisions.toSorted((left, right) => left.number - right.number).at(-1);
  const challenges = aggregate?.contributions.filter(({ lens }) => lens === "challenges") ?? [];
  const suggestedBelief = useMemo(() => {
    if (!aggregate) return undefined;
    const reactionWeight: Record<ContributionReaction["kind"], number> = {
      promising: 3,
      agree: 2,
      needs_evidence: -1,
      concern: -2,
    };
    const candidate = aggregate.contributions
      .filter(({ deletedAt, lens }) => !deletedAt && (lens === "possibilities" || lens === "evidence"))
      .map((contribution) => ({
        contribution,
        score: aggregate.reactions
          .filter(({ contributionId }) => contributionId === contribution.id)
          .reduce((total, { kind }) => total + reactionWeight[kind], 0),
      }))
      .toSorted((left, right) =>
        right.score - left.score ||
        Number(right.contribution.lens === "possibilities") - Number(left.contribution.lens === "possibilities") ||
        left.contribution.createdAt.localeCompare(right.contribution.createdAt) ||
        left.contribution.id.localeCompare(right.contribution.id),
      )[0]?.contribution.body.replace(/\s+/gu, " ").trim();
    if (!candidate) return undefined;
    return candidate.length <= 220 ? candidate : `${candidate.slice(0, 217).trimEnd()}…`;
  }, [aggregate]);
  const convertedIdea = ideas.find(({ provenance }) =>
    provenance.thinkingRoomOrigin?.synthesisRevisionId === currentSynthesis?.id,
  );
  const convertedOrigin = aggregate?.contentOrigins?.find(
    ({ synthesisRevisionId }) => synthesisRevisionId === currentSynthesis?.id,
  );
  const hasEvidenceSupport = Boolean(aggregate?.contributions.some(
    ({ deletedAt, lens }) => !deletedAt && lens === "evidence",
  ));

  useEffect(() => {
    if (mode !== "live" || !canEdit || !aggregate || !currentSynthesis || !convertedOrigin || convertedIdea) return;
    createIdeaFromThinkingRoomOrigin({
      room: aggregate.room,
      synthesis: currentSynthesis,
      contributorCount: new Set(aggregate.contributions.map(({ authorMembershipId }) => authorMembershipId)).size,
      origin: convertedOrigin,
    });
  }, [aggregate, canEdit, convertedIdea, convertedOrigin, createIdeaFromThinkingRoomOrigin, currentSynthesis, mode]);

  function announceSaved() {
    setRecoverableDraft("");
    setSaveState("saved");
    window.setTimeout(() => setSaveState((state) => state === "saved" ? "idle" : state), 2400);
  }

  async function writeLiveAgainst(
    base: ThinkingRoomAggregate,
    rebase: (latest: ThinkingRoomAggregate) => ThinkingRoomAggregate,
    onSaved?: () => void,
  ) {
    const next = rebase(base);
    setSaveState("saving");
    setLiveAggregate(next);
    try {
      const response = await fetch(`/api/thinking-rooms/${encodeURIComponent(roomId)}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision: base.room.revision, aggregate: next }),
      });
      if (!response.ok) {
        setLiveAggregate(base);
        setSaveState(response.status === 409 ? "conflict" : response.status === 401 || response.status === 403 ? "permission" : "error");
        return false;
      }
      const parsed = roomResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        setLiveAggregate(base);
        setSaveState("error");
        return false;
      }
      setLiveAggregate(parsed.data.aggregate);
      setRetryAction(undefined);
      onSaved?.();
      announceSaved();
      return true;
    } catch {
      setLiveAggregate(base);
      setSaveState("error");
      return false;
    }
  }

  async function recoverLive(
    rebase: (latest: ThinkingRoomAggregate) => ThinkingRoomAggregate,
    onSaved?: () => void,
  ) {
    setSaveState("saving");
    try {
      const response = await fetch(`/api/thinking-rooms/${encodeURIComponent(roomId)}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) {
        setSaveState("error");
        return false;
      }
      const parsed = roomResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        setSaveState("error");
        return false;
      }
      setLiveAggregate(parsed.data.aggregate);
      return writeLiveAgainst(parsed.data.aggregate, rebase, onSaved);
    } catch {
      setSaveState("error");
      return false;
    }
  }

  async function saveLive(
    rebase: (latest: ThinkingRoomAggregate) => ThinkingRoomAggregate,
    onSaved?: () => void,
  ) {
    const base = liveAggregate;
    if (!base) return false;
    setRetryAction(() => () => recoverLive(rebase, onSaved).then(() => undefined));
    return writeLiveAgainst(base, rebase, onSaved);
  }

  async function addContribution(body = draft, lens = composerLens) {
    if (!aggregate || !actor || !body.trim()) return;
    const sourceReferenceId = sourceReferenceDraft.trim() || undefined;
    if (lens === "evidence" && !sourceReferenceId) return;
    setRecoverableDraft(body.trim());
    if (mode === "sample") {
      setSaveState("saving");
      const contributionId = addSampleContribution({
        roomId,
        lens,
        body: body.trim(),
        authorMembershipId: actor.id,
        authorDisplayNameSnapshot: actor.displayNameSnapshot,
        ...(sourceReferenceId ? { sourceReferenceId } : {}),
      });
      const targetId = relationshipTargetId || (lens === "challenges" ? contributionId : "");
      if (contributionId && targetId) createSampleLink({
        roomId,
        fromContributionId: contributionId,
        toContributionId: targetId,
        relationship: lens === "challenges" ? "challenges" : relationship,
        createdByMembershipId: actor.id,
      });
      await Promise.resolve();
      setDraft("");
      setSourceReferenceDraft("");
      setRelationshipTargetId("");
      announceSaved();
      composerRef.current?.focus();
      return;
    }
    const now = new Date().toISOString();
    const contribution = addThinkingContribution({
      roomId,
      lens,
      body: body.trim(),
      authorMembershipId: actor.id,
      authorDisplayNameSnapshot: actor.displayNameSnapshot,
      ...(sourceReferenceId ? { sourceReferenceId } : {}),
    }, { id: crypto.randomUUID(), at: now });
    const targetId = relationshipTargetId || (lens === "challenges" ? contribution.id : "");
    const link = targetId ? createContributionLink({
      roomId,
      fromContributionId: contribution.id,
      toContributionId: targetId,
      relationship: lens === "challenges" ? "challenges" : relationship,
      createdByMembershipId: actor.id,
    }, { id: crypto.randomUUID(), at: now }) : undefined;
    const rebase = (latest: ThinkingRoomAggregate): ThinkingRoomAggregate => ({
      ...latest,
      contributions: latest.contributions.some(({ id }) => id === contribution.id)
        ? latest.contributions
        : [...latest.contributions, contribution],
      links: link && !latest.links.some(({ id }) => id === link.id) ? [...latest.links, link] : latest.links,
    });
    await saveLive(rebase, () => {
      setDraft("");
      setSourceReferenceDraft("");
      setRelationshipTargetId("");
      composerRef.current?.focus();
    });
  }

  async function react(contribution: ThinkingContribution, kind: ContributionReaction["kind"], active: boolean) {
    if (!aggregate || !actor) return;
    if (mode === "sample") {
      setSaveState("saving");
      toggleSampleReaction({ roomId, contributionId: contribution.id, membershipId: actor.id, kind, active });
      await Promise.resolve();
      announceSaved();
      return;
    }
    const reactionId = crypto.randomUUID();
    setSaveState("saving");
    try {
      const response = await fetch(`/api/thinking-rooms/${encodeURIComponent(roomId)}/reactions`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contributionId: contribution.id, kind, active, reactionId }),
      });
      if (!response.ok) {
        setSaveState("error");
        return;
      }
      const parsed = reactionMutationResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        setSaveState("error");
        return;
      }
      setLiveAggregate((latest) => latest ? {
        ...latest,
        room: { ...latest.room, revision: parsed.data.roomRevision },
        reactions: [
          ...latest.reactions.filter((reaction) => !(
            reaction.contributionId === contribution.id &&
            reaction.membershipId === actor.id &&
            reaction.kind === kind
          )),
          ...(parsed.data.reaction ? [parsed.data.reaction] : []),
        ],
      } : latest);
      announceSaved();
    } catch {
      setSaveState("error");
    }
  }

  async function beginSynthesis() {
    if (!aggregate) return;
    if (mode === "sample") {
      setSaveState("saving");
      updateSampleRoomStatus(roomId, "synthesizing");
      await Promise.resolve();
      announceSaved();
      return;
    }
    const at = new Date().toISOString();
    await saveLive((latest) => ({
      ...latest,
      room: { ...latest.room, status: "synthesizing" as const, updatedAt: at },
    }));
  }

  async function saveSynthesis(input: {
    belief: string;
    confidence: ThinkingSynthesisRevision["confidence"];
    openChallengeIds: string[];
    challengeResolutionNotes: Record<string, string>;
    basis: ChosenContentDirection["basis"];
  }) {
    if (!aggregate || !actor) return;
    setRecoverableDraft(JSON.stringify({
      kind: "thinking-room-synthesis-draft",
      roomId,
      belief: input.belief,
      confidence: input.confidence,
      basis: input.basis,
      openChallengeIds: input.openChallengeIds,
      challengeResolutionNotes: input.challengeResolutionNotes,
    }, null, 2));
    const revisionInputFor = (base: ThinkingRoomAggregate) => {
      const current = base.synthesisRevisions.toSorted((left, right) => left.number - right.number).at(-1);
      const acceptedByDecisionOwner = actor.id === base.room.decisionOwnerMembershipId;
      const audienceTension = base.contributions.find(({ lens }) => lens === "audience_tensions")?.body ?? base.room.question;
      const angle = base.contributions.find(({ lens }) => lens === "possibilities")?.body ?? input.belief;
      const keyChallenge = base.contributions.find(({ lens }) => lens === "challenges")?.body;
      return {
        roomId,
        belief: input.belief,
        unknowns: current?.unknowns ?? [],
        confidence: input.confidence,
        chosenDirection: {
          title: input.belief,
          audienceTension,
          angle,
          ...(keyChallenge ? { keyChallenge } : {}),
          evidenceReferenceIds: base.contributions.flatMap(({ deletedAt, lens, sourceReferenceId }) =>
            lens === "evidence" && !deletedAt && sourceReferenceId ? [sourceReferenceId] : [],
          ),
          evidenceContributionIds: base.contributions.flatMap(({ id, lens, deletedAt }) =>
            lens === "evidence" && !deletedAt ? [id] : [],
          ),
          basis: input.basis,
        },
        openChallengeIds: input.openChallengeIds,
        sourceContributionIds: base.contributions.map(({ id }) => id),
        createdByMembershipId: actor.id,
        status: acceptedByDecisionOwner ? "accepted" as const : "proposed" as const,
        ...(acceptedByDecisionOwner ? { acceptedByMembershipId: actor.id } : {}),
        ...(current ? { baseRevisionId: current.id } : {}),
      };
    };
    if (mode === "sample") {
      setSaveState("saving");
      const revisionInput = revisionInputFor(aggregate);
      for (const [challengeId, note] of Object.entries(input.challengeResolutionNotes)) {
        const link = aggregate.links.find((candidate) => candidate.relationship === "challenges" && candidate.resolutionStatus === "open" && (candidate.fromContributionId === challengeId || candidate.toContributionId === challengeId));
        if (link && !revisionInput.openChallengeIds.includes(challengeId)) resolveSampleLink(link.id, note, actor.id);
      }
      addSampleSynthesis(revisionInput);
      if (revisionInput.status === "accepted") {
        updateSampleRoomStatus(roomId, "decided");
      }
      await Promise.resolve();
      announceSaved();
      return;
    }
    const revisionId = crypto.randomUUID();
    const at = new Date().toISOString();
    await saveLive((latest) => {
      if (latest.synthesisRevisions.some(({ id }) => id === revisionId)) return latest;
      const revisions = appendSynthesisRevision(latest.synthesisRevisions, revisionInputFor(latest), {
        id: revisionId,
        at,
      });
      const links = latest.links.map((link) => {
        const challengeId = [link.fromContributionId, link.toContributionId].find((id) => input.challengeResolutionNotes[id]);
        return challengeId && !input.openChallengeIds.includes(challengeId) && link.resolutionStatus === "open"
          ? resolveContributionLink(link, { resolutionNote: input.challengeResolutionNotes[challengeId], resolvedByMembershipId: actor.id }, { at })
          : link;
      });
      return {
        ...latest,
        room: revisions.at(-1)?.status === "accepted"
          ? { ...latest.room, status: "decided" as const, updatedAt: at }
          : latest.room,
        synthesisRevisions: revisions,
        links,
      };
    });
  }

  async function convertToIdea() {
    if (convertedIdea || convertedOrigin || !aggregate || !currentSynthesis || !roomCanConvert(aggregate.room, aggregate.synthesisRevisions)) return;
    if (mode === "sample") {
      const ideaId = createIdeaFromThinkingRoom(roomId);
      if (ideaId) router.push(`/app/opportunities/ideas#idea-${encodeURIComponent(ideaId)}`);
      return;
    }

    const synthesisRevisionId = currentSynthesis.id;
    const ideaId = conversionIdeaIds.current.get(synthesisRevisionId) ?? crypto.randomUUID();
    conversionIdeaIds.current.set(synthesisRevisionId, ideaId);
    const attempt = async (base: ThinkingRoomAggregate, allowReload: boolean): Promise<void> => {
      setSaveState("saving");
      setConversionState("idle");
      try {
        const response = await fetch(`/api/thinking-rooms/${encodeURIComponent(roomId)}/convert`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ synthesisRevisionId, ideaId, expectedRevision: base.room.revision }),
        });
        if (response.status === 409 && allowReload) {
          const latestResponse = await fetch(`/api/thinking-rooms/${encodeURIComponent(roomId)}`, {
            cache: "no-store",
            credentials: "same-origin",
          });
          const latest = latestResponse.ok
            ? roomResponseSchema.safeParse(await latestResponse.json())
            : undefined;
          if (!latest?.success) {
            setSaveState("error");
            setConversionState("error");
            return;
          }
          setLiveAggregate(latest.data.aggregate);
          await attempt(latest.data.aggregate, false);
          return;
        }
        if (response.status === 401 || response.status === 403) {
          setSaveState("idle");
          setConversionState("permission");
          return;
        }
        if (!response.ok) {
          setSaveState("idle");
          setConversionState("error");
          return;
        }
        const parsed = conversionResponseSchema.safeParse(await response.json());
        if (!parsed.success) {
          setSaveState("idle");
          setConversionState("error");
          return;
        }
        const synthesis = base.synthesisRevisions.find(({ id }) => id === parsed.data.origin.synthesisRevisionId);
        if (!synthesis) {
          setSaveState("idle");
          setConversionState("error");
          return;
        }
        const materializedId = createIdeaFromThinkingRoomOrigin({
          room: base.room,
          synthesis,
          contributorCount: new Set(base.contributions.map(({ authorMembershipId }) => authorMembershipId)).size,
          origin: parsed.data.origin,
        });
        if (!materializedId) {
          setSaveState("idle");
          setConversionState("error");
          return;
        }
        setLiveAggregate({
          ...base,
          room: { ...base.room, status: "converted", revision: parsed.data.roomRevision },
          contentOrigins: [
            ...(base.contentOrigins ?? []).filter(({ synthesisRevisionId: id }) => id !== synthesisRevisionId),
            parsed.data.origin,
          ],
        });
        announceSaved();
        router.push(`/app/opportunities/ideas#idea-${encodeURIComponent(materializedId)}`);
      } catch (error) {
        setSaveState("idle");
        setConversionState(error instanceof TypeError ? "offline" : "error");
      }
    };
    await attempt(aggregate, true);
  }

  function chooseComposer(lens: ThinkingLens) {
    setActiveLens(lens);
    setComposerLens(lens);
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % LENSES.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + LENSES.length) % LENSES.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = LENSES.length - 1;
    else return;
    event.preventDefault();
    tabRefs.current[next]?.focus();
  }

  if (mode === "live" && loadState === "loading") {
    return <main aria-label="Loading Thinking Room" className={styles.roomLoading} role="status"><span /><p>Opening the Thinking Room…</p><div><i /><i /><i /></div></main>;
  }
  if ((mode === "sample" && !aggregate) || loadState === "missing") return <RoomUnavailable missing />;
  if (mode === "live" && loadState !== "ready") return <RoomUnavailable />;
  if (!aggregate) return <RoomUnavailable missing />;

  const participants = mode === "sample"
    ? memberships.filter(({ status }) => status === "active").map(({ id, displayNameSnapshot }) => ({ actorUserId: id, displayName: displayNameSnapshot, area: "room" as const, isComposing: false }))
    : presence.snapshot.presence;
  const areaLabel = (area: string) => area === "synthesis"
    ? "Synthesis"
    : area === "room"
      ? "Room overview"
      : THINKING_LENS_LABELS[area as ThinkingLens];

  return (
    <main className={styles.roomWorkspace}>
      <Link className={styles.backLink} href="/app/thinking"><ArrowLeft aria-hidden="true" size={17} /> All rooms</Link>

      {effectiveSaveState === "conflict" ? (
        <section className={styles.conflictBanner} role="alert">
          <WarningCircle aria-hidden="true" size={22} />
          <div><strong>This room changed elsewhere.</strong><p>Your draft is safe here. Review it, then retry after checking the latest room.</p></div>
          <button onClick={() => void retryAction?.()} type="button">Retry save</button>
        </section>
      ) : null}
      {effectiveSaveState === "error" ? (
        <section className={styles.saveError} role="alert">
          <WarningCircle aria-hidden="true" size={20} /> <strong>Couldn’t save — retry</strong>
          <button onClick={() => void retryAction?.()} type="button">Retry save</button>
        </section>
      ) : null}
      {effectiveSaveState === "permission" ? (
        <section className={styles.saveError} role="alert">
          <WarningCircle aria-hidden="true" size={20} />
          <div><strong>Your access changed before this save.</strong><p>Your draft remains in this tab. Copy it before leaving or reloading.</p></div>
          <button onClick={() => void navigator.clipboard.writeText(recoverableDraft || draft)} type="button">Copy draft</button>
        </section>
      ) : null}

      <header className={styles.roomHeader}>
        <div className={styles.roomStatusLine}>
          <span data-status={aggregate.room.status}>{ROOM_STATUS_LABELS[aggregate.room.status]}</span>
          <small>{mode === "sample" ? "Sample workspace · saved on this device" : "Live workspace · refresh to see teammate changes"}</small>
        </div>
        <h1>{aggregate.room.question}</h1>
        {aggregate.room.context ? <p>{aggregate.room.context}</p> : null}
        <div className={styles.roomPeople}>
          <div aria-label={`${participants.length} ${mode === "sample" ? "preview" : "active room"} participant${participants.length === 1 ? "" : "s"}`} className={styles.avatars}>
            {participants.slice(0, 4).map((participant) => (
              <span key={participant.actorUserId} title={mode === "sample" ? participant.displayName : `${participant.displayName} · ${areaLabel(participant.area)}`}>{participant.displayName.slice(0, 1).toUpperCase()}</span>
            ))}
            <strong><Users aria-hidden="true" size={16} /> {participants.length} {mode === "sample" ? "preview" : "live"}</strong>
          </div>
          <small>{mode === "sample" ? "Preview only · no one is live" : "You are here. Live presence refreshes while this room is open."}</small>
          {mode === "live" ? <Link href="/app/team">Invite a collaborator</Link> : null}
          {mode === "live" ? (
            <div aria-live="polite" className={styles.presenceActivity} role="status">
              {participants.filter(({ isComposing }) => isComposing).map((participant) => (
                <span key={participant.actorUserId}>{participant.displayName} is composing in {areaLabel(participant.area)}</span>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <div aria-label="Choose a thinking lens" className={styles.lensTabs} role="tablist">
        {LENSES.map((lens, index) => (
          <button
            aria-label={THINKING_LENS_LABELS[lens]}
            aria-controls={`thinking-lens-${lens}`}
            aria-selected={activeLens === lens}
            key={lens}
            onClick={() => setActiveLens(lens)}
            onKeyDown={(event) => navigateTabs(event, index)}
            ref={(node) => { tabRefs.current[index] = node; }}
            role="tab"
            tabIndex={activeLens === lens ? 0 : -1}
            type="button"
          >
            <span>{LENS_COPY[lens].index}</span>{THINKING_LENS_LABELS[lens]}
          </button>
        ))}
      </div>

      <div className={styles.roomLayout}>
        <div className={styles.canvasColumn}>
          <div className={styles.lensGrid}>
            {LENSES.map((lens) => {
              const contributions = aggregate.contributions.filter((contribution) => contribution.lens === lens && !contribution.deletedAt);
              return (
                <section
                  aria-label={THINKING_LENS_LABELS[lens]}
                  className={styles.lensSection}
                  data-lens={lens}
                  hidden={narrow && activeLens !== lens}
                  id={`thinking-lens-${lens}`}
                  key={lens}
                  role="region"
                >
                  <header>
                    <span>{LENS_COPY[lens].index}</span>
                    <div><h2>{THINKING_LENS_LABELS[lens]}</h2><p>{LENS_COPY[lens].prompt}</p></div>
                  </header>
                  <div className={styles.notesList}>
                    {contributions.length ? contributions.map((contribution) => (
                      <ContributionNote
                        actorId={actor?.id}
                        canEdit={canEdit}
                        canReact={canReact}
                        claim={presence.snapshot.claims.find(({ contributionId }) => contributionId === contribution.id)}
                        contribution={contribution}
                        contributions={aggregate.contributions}
                        key={contribution.id}
                        links={aggregate.links}
                        mode={mode}
                        onClaim={presence.changeClaim}
                        onComposingChange={setInlineComposing}
                        onEditingChange={setEditingContributionId}
                        onEdited={(result) => setLiveAggregate((current) => current ? {
                          ...current,
                          room: { ...current.room, revision: result.roomRevision },
                          contributions: current.contributions.map((item) => item.id === result.contribution.id ? result.contribution : item),
                        } : current)}
                        onReact={(note, kind, active) => void react(note, kind, active)}
                        onFocusAreaChange={(area) => setFocusedPresenceArea(area ?? "room")}
                        reactions={aggregate.reactions}
                        roomId={aggregate.room.id}
                        roomStatus={aggregate.room.status}
                        sessionId={presence.sessionId}
                      />
                    )) : (
                      <p className={styles.lensEmpty}><ChatCircleDots aria-hidden="true" size={19} /> No notes yet. Start with one precise observation.</p>
                    )}
                  </div>
                  <button className={styles.addToLens} disabled={!canMutateContent} onClick={() => chooseComposer(lens)} type="button">
                    <Lightbulb aria-hidden="true" size={17} /> Add {THINKING_LENS_LABELS[lens].toLocaleLowerCase()}
                  </button>
                </section>
              );
            })}
          </div>

          <ThinkingContributionComposer
            contributions={aggregate.contributions.filter(({ deletedAt }) => !deletedAt)}
            disabled={!canMutateContent}
            lens={composerLens}
            onChange={setDraft}
            onComposingChange={setInlineComposing}
            onFocusChange={(focused) => setFocusedPresenceArea(focused ? composerLens : "room")}
            onRelationshipChange={setRelationship}
            onRelationshipTargetChange={setRelationshipTargetId}
            onSourceReferenceChange={setSourceReferenceDraft}
            onSubmit={() => addContribution()}
            ref={composerRef}
            saving={effectiveSaveState === "saving"}
            relationship={relationship}
            relationshipTargetId={relationshipTargetId}
            sourceReferenceId={sourceReferenceDraft}
            value={draft}
          />
        </div>

        <ThinkingSynthesisRail
          canEdit={canEdit}
          canConvert={roomCanConvert(aggregate.room, aggregate.synthesisRevisions)}
          challenges={challenges}
          links={aggregate.links}
          conversionState={conversionState}
          converted={Boolean(convertedIdea || convertedOrigin)}
          current={currentSynthesis}
          hasEvidenceSupport={hasEvidenceSupport}
          key={`${aggregate.room.id}-${aggregate.room.status}-${currentSynthesis?.id ?? "new"}-${challenges.map(({ id }) => id).join("-")}`}
          onBegin={beginSynthesis}
          onConvert={convertToIdea}
          onComposingChange={setInlineComposing}
          onFocusChange={(focused) => setFocusedPresenceArea(focused ? "synthesis" : "room")}
          onSave={saveSynthesis}
          room={aggregate.room}
          saving={effectiveSaveState === "saving"}
          suggestedBelief={suggestedBelief}
        />
      </div>

      <div aria-live="polite" className={styles.saveToast} data-state={effectiveSaveState} role="status">
        {effectiveSaveState === "saving" ? "Saving…" : effectiveSaveState === "saved" ? <><Check aria-hidden="true" size={16} /> Saved</> : null}
      </div>
    </main>
  );
}
