"use client";

import {
  Bell,
  CalendarBlank,
  ChartBar,
  Check,
  CheckCircle,
  Clock,
  LightbulbFilament,
  NotePencil,
  Target,
  TrendUp,
  VideoCamera,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { lazy, Suspense, useMemo, useState } from "react";

import { IdeaSculptureFallback } from "@/components/today/idea-sculpture-fallback";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { ContentPlatform } from "@/domain/schema";
import { DEMO_NOW } from "@/lib/demo/fixtures";
import { useMuseboardStore } from "@/lib/store/museboard-store";

import styles from "./today-workspace.module.css";

const LazyIdeaSculpture = lazy(() => import("./idea-sculpture"));

const hookKinds = ["Contrarian", "Confession", "Open loop"] as const;
const platformLabels: Record<ContentPlatform, string> = {
  instagram_reels: "Instagram Reels",
  tiktok_video: "TikTok",
  youtube_shorts: "YouTube Shorts",
};

function formatDay(date: Date) {
  return {
    day: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: "UTC",
    })
      .format(date)
      .toUpperCase(),
    date: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date),
  };
}

function weekDays() {
  const start = new Date(DEMO_NOW);
  start.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date;
  });
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function TodayWorkspace() {
  const creator = useMuseboardStore((state) => state.creator);
  const opportunities = useMuseboardStore((state) => state.opportunities);
  const selectedOpportunityId = useMuseboardStore(
    (state) => state.selectedOpportunityId,
  );
  const content = useMuseboardStore((state) => state.content);
  const hooks = useMuseboardStore((state) => state.hooks);
  const plannerTasks = useMuseboardStore((state) => state.plannerTasks);
  const learnings = useMuseboardStore((state) => state.learnings);
  const chooseHook = useMuseboardStore((state) => state.chooseHook);
  const moveTask = useMuseboardStore((state) => state.moveTask);

  const selectedOpportunity = useMemo(
    () =>
      opportunities.find(({ id }) => id === selectedOpportunityId) ??
      opportunities.find(({ id }) => id === content[0]?.opportunityId) ??
      opportunities[0],
    [content, opportunities, selectedOpportunityId],
  );
  const activeContent = useMemo(
    () =>
      content.find(
        ({ opportunityId }) => opportunityId === selectedOpportunity?.id,
      ) ?? content[0],
    [content, selectedOpportunity?.id],
  );
  const currentVersion = useMemo(
    () =>
      activeContent?.versions.find(
        ({ id }) => id === activeContent.currentVersionId,
      ) ?? activeContent?.versions.at(-1),
    [activeContent],
  );
  const activeHooks = useMemo(
    () => hooks.filter(({ contentId }) => contentId === activeContent?.id),
    [activeContent?.id, hooks],
  );
  const activeTasks = useMemo(
    () =>
      plannerTasks
        .filter(({ contentId }) => contentId === activeContent?.id)
        .sort((left, right) =>
          (left.scheduledFor ?? "").localeCompare(right.scheduledFor ?? ""),
        ),
    [activeContent?.id, plannerTasks],
  );
  const initialHookId =
    activeHooks.find(({ id }) => id === currentVersion?.selectedHookId)?.id ??
    activeHooks[0]?.id ??
    "";
  const [selectedHookId, setSelectedHookId] = useState(initialHookId);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriteDraft, setRewriteDraft] = useState(
    activeHooks.find(({ id }) => id === initialHookId)?.text ?? "",
  );
  const [status, setStatus] = useState("");

  const effectiveSelectedHookId = activeHooks.some(
    ({ id }) => id === selectedHookId,
  )
    ? selectedHookId
    : initialHookId;
  const selectedHook =
    activeHooks.find(({ id }) => id === effectiveSelectedHookId) ?? activeHooks[0];
  const firstName = creator?.name.trim().split(/\s+/u)[0] ?? "Creator";
  const fit = selectedOpportunity?.signals.creatorFit ?? 0;
  const calendarDays = useMemo(() => weekDays(), []);

  if (!creator || !selectedOpportunity || !activeContent || !currentVersion) {
    return (
      <section className={styles.emptyState}>
        <p>Sample workspace · not live</p>
        <h1>Build your first daily decision.</h1>
        <p>Tell Museboard who you create for, then return to one focused hook.</p>
        <Link href="/onboarding">Set up my workspace</Link>
      </section>
    );
  }

  function handleChooseHook() {
    if (!selectedHook) return;
    chooseHook(activeContent.id, selectedHook.id);
    moveTask(activeContent.id, "outline");
    setStatus("Hook chosen · Outline is next");
  }

  function handleRewrite() {
    setRewriteDraft(selectedHook?.text ?? "");
    setRewriteOpen((open) => !open);
  }

  return (
    <div className={styles.page}>
      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <p className={styles.dateLine}>Mon, July 13, 2026</p>
            <p className={styles.sampleMode}>Sample workspace · not live</p>
          </div>
          <div className={styles.topbarActions}>
            <ThemeToggle />
            <button
              aria-label="Notifications, no new alerts"
              className={styles.iconButton}
              type="button"
            >
              <Bell aria-hidden="true" size={22} />
            </button>
          </div>
        </header>

        <div className={styles.decisionGrid}>
          <div className={styles.decisionColumn}>
            <h1 className={styles.greeting}>Good morning, {firstName}</h1>
            <p className={styles.eyebrow}>Today&apos;s top opportunity</p>
            <h2 className={styles.opportunityTitle}>{selectedOpportunity.title}</h2>

            <div className={styles.signalRow}>
              <span className={styles.risingSignal}>
                <TrendUp aria-hidden="true" size={19} /> Rising for your audience
              </span>
              <span>
                <VideoCamera aria-hidden="true" size={18} /> {platformLabels[selectedOpportunity.platform]}
              </span>
              <span>
                <Clock aria-hidden="true" size={18} /> Sample signal
              </span>
              <span className={styles.fitSignal}>
                <Target aria-hidden="true" size={18} /> {fit}% audience fit
              </span>
            </div>

            <section aria-label="Next planned block" className={styles.mobileAgenda}>
              <CalendarBlank aria-hidden="true" size={20} />
              <span>
                <small>Your next block</small>
                <strong>{activeTasks[0]?.title ?? "Protect an open buffer"}</strong>
              </span>
              <small>{activeTasks[0] ? durationLabel(activeTasks[0].estimatedMinutes) : "Open"}</small>
            </section>

            <section className={styles.evidence} aria-labelledby="why-now-heading">
              <h3 id="why-now-heading">Why now</h3>
              <p>{selectedOpportunity.summary}</p>
              <p className={styles.audienceLine}>
                For {creator.audience}
              </p>
            </section>

            <div className={styles.angleField}>
              <span>Your angle</span>
              <strong>{currentVersion.angle}</strong>
              <NotePencil aria-hidden="true" size={18} />
            </div>

            <ol aria-label="Content workflow" className={styles.stageSpine}>
              <li data-state="complete">
                <CheckCircle aria-hidden="true" size={30} weight="fill" />
                <span><strong>Signal</strong><small>Complete</small></span>
              </li>
              <li data-state="complete">
                <CheckCircle aria-hidden="true" size={30} weight="fill" />
                <span><strong>Angle</strong><small>Complete</small></span>
              </li>
              <li data-state="active">
                <span className={styles.stageNumber}>3</span>
                <span><strong>Hook</strong><small>Active</small></span>
              </li>
              <li data-state="next">
                <span className={styles.stageNumber}>4</span>
                <span><strong>Outline</strong><small>Next</small></span>
              </li>
            </ol>

            <fieldset className={styles.hookPicker}>
              <legend>Pick the hook that opens best for your audience.</legend>
              <div className={styles.hookList}>
                {activeHooks.map((hook, index) => {
                  const selected = hook.id === effectiveSelectedHookId;
                  return (
                    <label className={styles.hookOption} data-selected={selected} key={hook.id}>
                      <input
                        aria-label={`${hookKinds[index] ?? "Hook"}: ${hook.text}`}
                        checked={selected}
                        name="daily-hook"
                        onChange={() => {
                          setSelectedHookId(hook.id);
                          setStatus("");
                        }}
                        type="radio"
                        value={hook.id}
                      />
                      <span className={styles.radioMark} aria-hidden="true">
                        {selected ? <Check size={12} weight="bold" /> : null}
                      </span>
                      <span className={styles.hookCopy}>
                        <small>{hookKinds[index] ?? `Hook ${index + 1}`}</small>
                        <strong>{hook.text}</strong>
                      </span>
                      <span className={styles.prediction}>
                        Predicted fit: {index === 0 ? "High" : "Medium"}
                        <ChartBar aria-hidden="true" size={22} weight={index === 0 ? "fill" : "regular"} />
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {rewriteOpen ? (
              <section className={styles.rewritePanel} aria-label="Rewrite selected hook">
                <label htmlFor="hook-rewrite">Rewrite selected hook</label>
                <textarea
                  id="hook-rewrite"
                  onChange={(event) => setRewriteDraft(event.target.value)}
                  rows={2}
                  value={rewriteDraft}
                />
                <p>
                  Voice cues:{" "}
                  {new Intl.ListFormat("en", {
                    style: "long",
                    type: "conjunction",
                  }).format(creator.voiceTraits)}
                </p>
              </section>
            ) : null}

            <div className={styles.primaryActions}>
              <button className={styles.chooseButton} onClick={handleChooseHook} type="button">
                Choose a hook
                <span aria-hidden="true">→</span>
              </button>
              <button className={styles.rewriteButton} onClick={handleRewrite} type="button">
                <NotePencil aria-hidden="true" size={19} />
                {rewriteOpen ? "Close rewrite" : "Rewrite in my voice"}
              </button>
            </div>
            <p aria-live="polite" className={styles.status}>{status}</p>
          </div>

          <aside className={styles.contextColumn} aria-label="Idea and collaborator context">
            <div className={styles.desktopSculpture}>
              <Suspense fallback={<IdeaSculptureFallback reason="loading" />}>
                <LazyIdeaSculpture />
              </Suspense>
            </div>

            <section className={styles.collaborators}>
              <p className={styles.eyebrow}>Collaborators</p>
              <div className={styles.collaborator}>
                <Image alt="Sam" height={44} src="/assets/avatar-sam.png" width={44} />
                <span><strong>Sam reviewing</strong><small>Left feedback · sample</small></span>
              </div>
              <div className={styles.collaborator}>
                <Image alt="Priya" height={44} src="/assets/avatar-priya.png" width={44} />
                <span><strong>Priya editing</strong><small>Next handoff · sample</small></span>
              </div>
              <div className={styles.commentPreview}>
                <strong>Unresolved comment</strong>
                <p>Can we lean more into the moment you almost ditched it?</p>
                <small>Sample activity · not live</small>
              </div>
            </section>
          </aside>
        </div>
      </section>

      <aside aria-labelledby="week-heading" className={styles.weekPlanner}>
        <div className={styles.weekHeading}>
          <CalendarBlank aria-hidden="true" size={19} />
          <h2 id="week-heading">Your week</h2>
          <span>Jul 13–19</span>
        </div>
        <ol className={styles.weekList}>
          {calendarDays.map((date) => {
            const dateKey = date.toISOString().slice(0, 10);
            const task = activeTasks.find(
              ({ scheduledFor }) => scheduledFor?.slice(0, 10) === dateKey,
            );
            const formatted = formatDay(date);
            return (
              <li key={dateKey}>
                <span className={styles.dayLabel}>
                  <strong>{formatted.day}</strong>
                  <small>{formatted.date}</small>
                </span>
                <span className={styles.dayTask} data-open={!task}>
                  <strong>{task?.title ?? "Open buffer"}</strong>
                  <small>{task ? durationLabel(task.estimatedMinutes) : "Protected"}</small>
                </span>
              </li>
            );
          })}
        </ol>
        <div className={styles.rhythmNote}>
          <TrendUp aria-hidden="true" size={28} />
          <p>
            <strong>You&apos;re protecting the work.</strong>
            {activeTasks.length} focused blocks leave room for the rest of your week.
          </p>
        </div>
      </aside>

      <section aria-labelledby="learning-heading" className={styles.learningStrip}>
        <div className={styles.learningLabel}>
          <LightbulbFilament aria-hidden="true" size={28} />
          <span>
            <strong id="learning-heading">What your audience taught us</strong>
            <small>{learnings.length ? "Measured results" : "Learning starts after results"}</small>
          </span>
        </div>
        <div className={styles.learningStatement}>
          <p>{learnings[0]?.statement ?? "Your first measured learning is waiting."}</p>
          <small>
            {learnings[0]
              ? `${learnings[0].metricDefinition} · ${learnings[0].sampleSize} samples · ${learnings[0].confidence} confidence`
              : "0 measured posts · confidence unavailable · no result has been inferred"}
          </small>
        </div>
      </section>
    </div>
  );
}
