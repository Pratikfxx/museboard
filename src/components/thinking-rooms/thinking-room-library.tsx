"use client";

import {
  ArrowRight,
  CheckCircle,
  Clock,
  Plus,
  Sparkle,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { z } from "zod";

import {
  thinkingRoomSchema,
  type ThinkingRoom,
  type ThinkingRoomState,
} from "@/domain/thinking-rooms";
import { useThinkingRoomStore } from "@/lib/store/thinking-room-store";
import { useMuseboardStore } from "@/lib/store/museboard-store";

import styles from "./thinking-rooms.module.css";

type LibraryFilter = "all" | "active" | "decided";
type LoadState = "loading" | "ready" | "permission" | "offline" | "conflict" | "error";

export interface LiveThinkingRoomContext {
  organizationId: string;
  workspaceId: string;
  userId: string;
  displayName: string;
  canCreate: boolean;
}

const roomListResponseSchema = z.object({ rooms: z.array(thinkingRoomSchema) });
const activeStates: readonly ThinkingRoomState[] = ["exploring", "synthesizing"];
const decidedStates: readonly ThinkingRoomState[] = ["decided", "converted"];

const stateLabels: Record<ThinkingRoomState, string> = {
  exploring: "Exploring",
  synthesizing: "Synthesizing",
  decided: "Decided",
  converted: "Content direction created",
  archived: "Archived",
};

function loadStateFromResponse(status: number): LoadState {
  if (status === 401 || status === 403) return "permission";
  if (status === 409) return "conflict";
  return "error";
}

function failureMessage(state: LoadState): string {
  if (state === "permission") return "You no longer have permission to view these Thinking Rooms.";
  if (state === "offline") return "You appear to be offline. Reconnect and try again.";
  if (state === "conflict") return "This room list changed elsewhere. Reload it before continuing.";
  return "Thinking Rooms could not be loaded.";
}

function relativeDate(value: string): string {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(value));
}

function RoomLink({ room, featured = false }: { room: ThinkingRoom; featured?: boolean }) {
  return (
    <Link
      className={featured ? styles.featuredRoom : styles.roomRow}
      data-room-id={room.id}
      href={`/app/thinking/${room.id}`}
    >
      <span className={styles.roomCopy}>
        <span className={styles.roomMeta}>
          <span data-status={room.status}>{stateLabels[room.status]}</span>
          <time dateTime={room.updatedAt}>Updated {relativeDate(room.updatedAt)}</time>
        </span>
        <strong>{room.question}</strong>
        {room.context ? <small>{room.context}</small> : null}
      </span>
      <ArrowRight aria-hidden="true" size={featured ? 24 : 20} />
    </Link>
  );
}

function RoomGroup({
  title,
  eyebrow,
  rooms,
  featured,
}: {
  title: string;
  eyebrow: string;
  rooms: ThinkingRoom[];
  featured?: boolean;
}) {
  if (!rooms.length) return null;
  return (
    <section className={styles.roomGroup}>
      <header>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </header>
      <div className={featured ? styles.activeRooms : styles.decidedRooms}>
        {rooms.map((room, index) => (
          <RoomLink featured={Boolean(featured && index === 0)} key={room.id} room={room} />
        ))}
      </div>
    </section>
  );
}

export function ThinkingRoomLibrary({
  mode,
  liveContext,
}: {
  mode: "sample" | "live";
  liveContext?: LiveThinkingRoomContext;
}) {
  const sampleRooms = useThinkingRoomStore((state) => state.rooms);
  const createSampleRoom = useThinkingRoomStore((state) => state.createRoom);
  const memberships = useMuseboardStore((state) => state.memberships);
  const currentActorMembershipId = useMuseboardStore((state) => state.currentActorMembershipId);
  const [liveRooms, setLiveRooms] = useState<ThinkingRoom[]>([]);
  const [loadState, setLoadState] = useState<LoadState>(mode === "live" ? "loading" : "ready");
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [questionError, setQuestionError] = useState<string>();
  const [createError, setCreateError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [pendingFocusId, setPendingFocusId] = useState<string>();
  const questionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (mode !== "live") return;
    const controller = new AbortController();
    void fetch("/api/thinking-rooms", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          setLoadState(loadStateFromResponse(response.status));
          return;
        }
        const parsed = roomListResponseSchema.safeParse(await response.json());
        if (!parsed.success) {
          setLoadState("error");
          return;
        }
        setLiveRooms(parsed.data.rooms);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadState(error instanceof TypeError ? "offline" : "error");
      });
    return () => controller.abort();
  }, [mode, reloadKey]);

  useEffect(() => {
    if (!formOpen) return;
    const frame = window.requestAnimationFrame(() => questionRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [formOpen]);

  useEffect(() => {
    if (!pendingFocusId) return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-room-id="${CSS.escape(pendingFocusId)}"]`)?.focus();
      setPendingFocusId(undefined);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingFocusId, sampleRooms, liveRooms]);

  const rooms = (mode === "sample" ? sampleRooms : liveRooms)
    .filter(({ status }) => status !== "archived")
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  const activeRooms = rooms.filter(({ status }) => activeStates.includes(status));
  const decidedRooms = rooms.filter(({ status }) => decidedStates.includes(status));
  const visibleActive = filter === "decided" ? [] : activeRooms;
  const visibleDecided = filter === "active" ? [] : decidedRooms;
  const canCreate = mode === "sample" || liveContext?.canCreate === true;

  async function createLiveRoom(trimmedQuestion: string, trimmedContext: string) {
    if (!liveContext) throw new Error("Live workspace identity is unavailable");
    const createdAt = new Date().toISOString();
    const room: ThinkingRoom = {
      id: crypto.randomUUID(),
      organizationId: liveContext.organizationId,
      workspaceId: liveContext.workspaceId,
      question: trimmedQuestion,
      templateId: "content-direction",
      status: "exploring",
      facilitatorMembershipId: liveContext.userId,
      decisionOwnerMembershipId: liveContext.userId,
      ...(trimmedContext ? { context: trimmedContext } : {}),
      revision: 1,
      createdAt,
      updatedAt: createdAt,
    };
    const response = await fetch("/api/thinking-rooms", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        aggregate: { room, contributions: [], reactions: [], synthesisRevisions: [] },
      }),
    });
    if (!response.ok) {
      setLoadState(loadStateFromResponse(response.status));
      throw new Error("Thinking Room could not be created");
    }
    const payload = z.object({ aggregate: z.object({ room: thinkingRoomSchema }) }).safeParse(await response.json());
    if (!payload.success) throw new Error("Thinking Room response was invalid");
    setLiveRooms((current) => [payload.data.aggregate.room, ...current]);
    return payload.data.aggregate.room.id;
  }

  async function submitRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    const trimmedContext = context.trim();
    if (!trimmedQuestion) {
      setQuestionError("Add the strategic question you want to resolve.");
      questionRef.current?.focus();
      return;
    }
    setQuestionError(undefined);
    setCreateError(undefined);
    setCreating(true);
    try {
      let id: string | undefined;
      if (mode === "sample") {
        const actor = memberships.find(({ id: memberId }) => memberId === currentActorMembershipId)
          ?? memberships.find(({ role }) => role === "owner");
        if (!actor) throw new Error("An active room facilitator is required");
        id = createSampleRoom({
          organizationId: "organization-sample",
          workspaceId: "workspace-sample",
          question: trimmedQuestion,
          templateId: "content-direction",
          facilitatorMembershipId: actor.id,
          decisionOwnerMembershipId: actor.id,
          ...(trimmedContext ? { context: trimmedContext } : {}),
        });
      } else {
        id = await createLiveRoom(trimmedQuestion, trimmedContext);
      }
      if (!id) throw new Error("Thinking Room could not be created");
      setFilter("all");
      setFormOpen(false);
      setQuestion("");
      setContext("");
      setPendingFocusId(id);
    } catch (error) {
      if (mode === "live" && error instanceof TypeError) setLoadState("offline");
      setCreateError(
        mode === "live" && error instanceof TypeError
          ? "You appear to be offline. Your question is still here — reconnect and try again."
          : "Your room was not created. Your question is still here — try again.",
      );
    } finally {
      setCreating(false);
    }
  }

  if (mode === "live" && loadState === "loading") {
    return (
      <div className={styles.library}>
        <section aria-label="Loading Thinking Rooms" className={styles.loading} role="status">
          <span aria-hidden="true" />
          <p>Loading Thinking Rooms</p>
          <div aria-hidden="true" className={styles.loadingLines}><i /><i /><i /></div>
        </section>
      </div>
    );
  }

  if (mode === "live" && loadState !== "ready") {
    return (
      <div className={styles.library}>
        <section className={styles.failure} role="alert">
          <WarningCircle aria-hidden="true" size={30} weight="duotone" />
          <span><strong>Thinking paused</strong><p>{failureMessage(loadState)}</p></span>
          <button onClick={() => {
            setLoadState("loading");
            setReloadKey((key) => key + 1);
          }} type="button">Try again</button>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.library}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}><Sparkle aria-hidden="true" size={16} /> Thinking Rooms</span>
          <h1>Bring the question you cannot settle in a comment thread.</h1>
          <p>Collect distinct perspectives, test the evidence, and leave with a content direction your team can explain.</p>
        </div>
        <button
          aria-expanded={formOpen}
          className={styles.heroAction}
          disabled={!canCreate}
          onClick={() => setFormOpen(true)}
          type="button"
        >
          <Plus aria-hidden="true" size={19} weight="bold" /> New Thinking Room
        </button>
        {!canCreate ? <small className={styles.permissionNote}>Viewers can read rooms but cannot create them.</small> : null}
      </header>

      {formOpen ? (
        <section aria-label="Create a Thinking Room" className={styles.createPanel}>
          <div className={styles.createHeading}>
            <span><small>One question, held with care</small><h2>Open a room</h2></span>
            <button aria-label="Close room form" onClick={() => setFormOpen(false)} type="button"><X aria-hidden="true" size={20} /></button>
          </div>
          <form noValidate onSubmit={submitRoom}>
            <label htmlFor="thinking-question">Strategic question</label>
            <textarea
              aria-describedby={questionError ? "thinking-question-error" : "thinking-question-hint"}
              aria-invalid={Boolean(questionError)}
              id="thinking-question"
              maxLength={2000}
              onChange={(event) => {
                setQuestion(event.target.value);
                if (questionError) setQuestionError(undefined);
              }}
              placeholder="What do we need to understand before choosing a direction?"
              ref={questionRef}
              rows={3}
              value={question}
            />
            {questionError ? <p className={styles.fieldError} id="thinking-question-error">{questionError}</p> : <small id="thinking-question-hint">Make it open enough to investigate and narrow enough to resolve.</small>}
            <label htmlFor="thinking-context">Optional context</label>
            <textarea id="thinking-context" maxLength={2000} onChange={(event) => setContext(event.target.value)} placeholder="Audience, platform, deadline, or the choice this needs to unlock" rows={2} value={context} />
            {createError ? <p className={styles.createError} role="alert">{createError}</p> : null}
            <div className={styles.formActions}>
              <button onClick={() => setFormOpen(false)} type="button">Cancel</button>
              <button disabled={creating} type="submit">{creating ? "Creating…" : "Create room"}</button>
            </div>
          </form>
        </section>
      ) : null}

      <section aria-label="Room library" className={styles.libraryBody}>
        <div className={styles.libraryHeader}>
          <div><span>Your decision desk</span><h2>Recent rooms</h2></div>
          <div aria-label="Filter rooms" className={styles.filters} role="group">
            {(["all", "active", "decided"] as const).map((value) => (
              <button aria-pressed={filter === value} key={value} onClick={() => setFilter(value)} type="button">
                {value[0].toLocaleUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {!rooms.length ? (
          <section className={styles.emptyState}>
            <span aria-hidden="true"><Clock size={28} /></span>
            <div>
              <h2>Start with the decision your next content direction depends on.</h2>
              <p>A useful room might ask which audience tension to lead with, what evidence is missing, or which risk is worth taking.</p>
            </div>
            {canCreate ? <button onClick={() => setFormOpen(true)} type="button">Open your first room <ArrowRight aria-hidden="true" size={18} /></button> : null}
          </section>
        ) : (
          <>
            <RoomGroup eyebrow="Questions still moving" featured rooms={visibleActive} title="In progress" />
            <RoomGroup eyebrow="Reasoning worth returning to" rooms={visibleDecided} title="Decisions made" />
            {!visibleActive.length && !visibleDecided.length ? (
              <p className={styles.noMatches}><CheckCircle aria-hidden="true" size={20} /> No rooms match this view yet.</p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
