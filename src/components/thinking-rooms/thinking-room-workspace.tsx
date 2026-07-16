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
  contributionReactionSchema,
  createSynthesisRevision,
  thinkingContributionSchema,
  thinkingRoomSchema,
  thinkingSynthesisRevisionSchema,
  toggleContributionReaction,
  type ContributionReaction,
  type ThinkingContribution,
  type ThinkingLens,
  type ThinkingRoom,
  type ThinkingSynthesisRevision,
} from "@/domain/thinking-rooms";
import { useThinkingRoomStore } from "@/lib/store/thinking-room-store";
import { useMuseboardStore } from "@/lib/store/museboard-store";
import type { ThinkingRoomAggregate } from "@/lib/thinking-rooms/repository";

import {
  THINKING_LENS_LABELS,
  ThinkingContributionComposer,
} from "./thinking-contribution-composer";
import { ThinkingSynthesisRail } from "./thinking-synthesis-rail";
import styles from "./thinking-rooms.module.css";

const roomAggregateSchema: z.ZodType<ThinkingRoomAggregate> = z.object({
  room: thinkingRoomSchema,
  contributions: z.array(thinkingContributionSchema),
  reactions: z.array(contributionReactionSchema),
  synthesisRevisions: z.array(thinkingSynthesisRevisionSchema),
});
const roomResponseSchema = z.object({ aggregate: roomAggregateSchema });

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

type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";
type LoadState = "loading" | "ready" | "missing" | "permission" | "offline" | "error";

export interface ThinkingRoomLiveContext {
  userId: string;
  displayName: string;
  canEdit: boolean;
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
  reactions: ContributionReaction[];
  actorId?: string;
  canReact: boolean;
  onReact: (contribution: ThinkingContribution, kind: ContributionReaction["kind"], active: boolean) => void;
}

function ContributionNote({ contribution, reactions, actorId, canReact, onReact }: ContributionNoteProps) {
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
      <p>{contribution.body}</p>
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
  const sampleSynthesis = useThinkingRoomStore((state) => state.synthesisRevisions);
  const addSampleContribution = useThinkingRoomStore((state) => state.addContribution);
  const toggleSampleReaction = useThinkingRoomStore((state) => state.toggleReaction);
  const updateSampleRoomStatus = useThinkingRoomStore((state) => state.updateRoomStatus);
  const addSampleSynthesis = useThinkingRoomStore((state) => state.addSynthesisRevision);
  const memberships = useMuseboardStore((state) => state.memberships);
  const currentActorMembershipId = useMuseboardStore((state) => state.currentActorMembershipId);

  const sampleRoom = sampleRooms.find(({ id }) => id === roomId);
  const sampleAggregate = useMemo<ThinkingRoomAggregate | undefined>(() => sampleRoom ? ({
    room: sampleRoom,
    contributions: sampleContributions.filter((contribution) => contribution.roomId === roomId && !contribution.deletedAt),
    reactions: sampleReactions.filter((reaction) => reaction.roomId === roomId),
    synthesisRevisions: sampleSynthesis.filter((revision) => revision.roomId === roomId),
  }) : undefined, [roomId, sampleContributions, sampleReactions, sampleRoom, sampleSynthesis]);

  const [liveAggregate, setLiveAggregate] = useState<ThinkingRoomAggregate>();
  const [loadState, setLoadState] = useState<LoadState>(mode === "live" ? "loading" : "ready");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [retryAction, setRetryAction] = useState<(() => Promise<void>)>();
  const [activeLens, setActiveLens] = useState<ThinkingLens>("audience_tensions");
  const [composerLens, setComposerLens] = useState<ThinkingLens>("audience_tensions");
  const [draft, setDraft] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const narrow = useNarrowRoomCanvas();

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
    ? memberships.find(({ id }) => id === currentActorMembershipId && status === "active")
      ?? memberships.find(({ role, status }) => role === "owner" && status === "active")
    : liveContext ? {
      id: liveContext.userId,
      displayNameSnapshot: liveContext.displayName,
      role: liveContext.canEdit ? "editor" : "viewer",
      status: "active",
    } : undefined;
  const canEdit = Boolean(actor && (mode === "sample" ? actor.role !== "viewer" : liveContext?.canEdit));
  const currentSynthesis = aggregate?.synthesisRevisions.toSorted((left, right) => left.number - right.number).at(-1);
  const challenges = aggregate?.contributions.filter(({ lens }) => lens === "challenges") ?? [];

  function announceSaved() {
    setSaveState("saved");
    window.setTimeout(() => setSaveState((state) => state === "saved" ? "idle" : state), 2400);
  }

  async function saveLive(next: ThinkingRoomAggregate, retry: () => Promise<void>) {
    const previous = liveAggregate;
    if (!previous) return false;
    setRetryAction(() => retry);
    setSaveState("saving");
    setLiveAggregate(next);
    try {
      const response = await fetch(`/api/thinking-rooms/${encodeURIComponent(roomId)}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision: previous.room.revision, aggregate: next }),
      });
      if (!response.ok) {
        setLiveAggregate(previous);
        setSaveState(response.status === 409 ? "conflict" : "error");
        return false;
      }
      const parsed = roomResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        setLiveAggregate(previous);
        setSaveState("error");
        return false;
      }
      setLiveAggregate(parsed.data.aggregate);
      setRetryAction(undefined);
      announceSaved();
      return true;
    } catch {
      setLiveAggregate(previous);
      setSaveState("error");
      return false;
    }
  }

  async function addContribution(body = draft, lens = composerLens) {
    if (!aggregate || !actor || !body.trim()) return;
    if (mode === "sample") {
      setSaveState("saving");
      addSampleContribution({
        roomId,
        lens,
        body: body.trim(),
        authorMembershipId: actor.id,
        authorDisplayNameSnapshot: actor.displayNameSnapshot,
      });
      await Promise.resolve();
      setDraft("");
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
    }, { id: crypto.randomUUID(), at: now });
    const next = { ...aggregate, contributions: [...aggregate.contributions, contribution] };
    const saved = await saveLive(next, () => addContribution(body, lens));
    if (saved) setDraft("");
    composerRef.current?.focus();
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
    const reactions = toggleContributionReaction(aggregate.reactions, {
      roomId,
      contributionId: contribution.id,
      membershipId: actor.id,
      kind,
      active,
    }, { id: crypto.randomUUID(), at: new Date().toISOString() });
    await saveLive({ ...aggregate, reactions }, () => react(contribution, kind, active));
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
    const next = {
      ...aggregate,
      room: { ...aggregate.room, status: "synthesizing" as const, updatedAt: new Date().toISOString() },
    };
    await saveLive(next, beginSynthesis);
  }

  async function saveSynthesis(input: {
    belief: string;
    confidence: ThinkingSynthesisRevision["confidence"];
    openChallengeIds: string[];
  }) {
    if (!aggregate || !actor) return;
    const current = aggregate.synthesisRevisions.toSorted((left, right) => left.number - right.number).at(-1);
    const audienceTension = aggregate.contributions.find(({ lens }) => lens === "audience_tensions")?.body ?? aggregate.room.question;
    const angle = aggregate.contributions.find(({ lens }) => lens === "possibilities")?.body ?? input.belief;
    const keyChallenge = aggregate.contributions.find(({ lens }) => lens === "challenges")?.body;
    const revisionInput = {
      roomId,
      belief: input.belief,
      unknowns: current?.unknowns ?? [],
      confidence: input.confidence,
      chosenDirection: current?.chosenDirection ?? {
        title: input.belief,
        audienceTension,
        angle,
        ...(keyChallenge ? { keyChallenge } : {}),
        evidenceReferenceIds: aggregate.contributions.flatMap(({ sourceReferenceId }) => sourceReferenceId ? [sourceReferenceId] : []),
        basis: "creator_experience" as const,
      },
      openChallengeIds: input.openChallengeIds,
      sourceContributionIds: aggregate.contributions.map(({ id }) => id),
      createdByMembershipId: actor.id,
      status: "draft" as const,
      ...(current ? { baseRevisionId: current.id } : {}),
    };
    if (mode === "sample") {
      setSaveState("saving");
      addSampleSynthesis(revisionInput);
      await Promise.resolve();
      announceSaved();
      return;
    }
    const revision = createSynthesisRevision(aggregate.synthesisRevisions, revisionInput, {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
    });
    await saveLive({ ...aggregate, synthesisRevisions: [...aggregate.synthesisRevisions, revision] }, () => saveSynthesis(input));
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

  const participants = mode === "sample" ? memberships.filter(({ status }) => status === "active") : actor ? [actor] : [];

  return (
    <main className={styles.roomWorkspace}>
      <Link className={styles.backLink} href="/app/thinking"><ArrowLeft aria-hidden="true" size={17} /> All rooms</Link>

      {saveState === "conflict" ? (
        <section className={styles.conflictBanner} role="alert">
          <WarningCircle aria-hidden="true" size={22} />
          <div><strong>This room changed elsewhere.</strong><p>Your draft is safe here. Review it, then retry after checking the latest room.</p></div>
          <button onClick={() => void retryAction?.()} type="button">Retry save</button>
        </section>
      ) : null}
      {saveState === "error" ? (
        <section className={styles.saveError} role="alert">
          <WarningCircle aria-hidden="true" size={20} /> <strong>Couldn’t save — retry</strong>
          <button onClick={() => void retryAction?.()} type="button">Retry save</button>
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
          <div aria-label={`${participants.length} room participant${participants.length === 1 ? "" : "s"}`} className={styles.avatars}>
            {participants.slice(0, 4).map((participant) => (
              <span key={participant.id} title={participant.displayNameSnapshot}>{participant.displayNameSnapshot.slice(0, 1).toUpperCase()}</span>
            ))}
            <strong><Users aria-hidden="true" size={16} /> {participants.length} participant{participants.length === 1 ? "" : "s"}</strong>
          </div>
          <small>{mode === "sample" ? "Presence is not live in sample mode." : "You are here. Realtime teammate presence is not enabled."}</small>
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
                        canReact={Boolean(actor)}
                        contribution={contribution}
                        key={contribution.id}
                        onReact={(note, kind, active) => void react(note, kind, active)}
                        reactions={aggregate.reactions}
                      />
                    )) : (
                      <p className={styles.lensEmpty}><ChatCircleDots aria-hidden="true" size={19} /> No notes yet. Start with one precise observation.</p>
                    )}
                  </div>
                  <button className={styles.addToLens} disabled={!canEdit} onClick={() => chooseComposer(lens)} type="button">
                    <Lightbulb aria-hidden="true" size={17} /> Add {THINKING_LENS_LABELS[lens].toLocaleLowerCase()}
                  </button>
                </section>
              );
            })}
          </div>

          <ThinkingContributionComposer
            disabled={!canEdit}
            lens={composerLens}
            onChange={setDraft}
            onSubmit={() => addContribution()}
            ref={composerRef}
            saving={saveState === "saving"}
            value={draft}
          />
        </div>

        <ThinkingSynthesisRail
          canEdit={canEdit}
          challenges={challenges}
          current={currentSynthesis}
          key={`${aggregate.room.id}-${aggregate.room.status}-${currentSynthesis?.id ?? "new"}-${challenges.map(({ id }) => id).join("-")}`}
          onBegin={beginSynthesis}
          onSave={saveSynthesis}
          room={aggregate.room}
          saving={saveState === "saving"}
        />
      </div>

      <div aria-live="polite" className={styles.saveToast} data-state={saveState} role="status">
        {saveState === "saving" ? "Saving…" : saveState === "saved" ? <><Check aria-hidden="true" size={16} /> Saved</> : null}
      </div>
    </main>
  );
}
