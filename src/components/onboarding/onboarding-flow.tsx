"use client";

import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  ChalkboardTeacher,
  Check,
  Clock,
  InstagramLogo,
  LockSimple,
  MusicNotes,
  Sparkle,
  TiktokLogo,
  YoutubeLogo,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useSyncExternalStore, type ReactNode } from "react";

import type {
  ContentPlatform,
  CreatorArchetype,
} from "@/domain/schema";
import type { CreatorOutcome } from "@/lib/demo/fixtures";
import { buildStarterWorkspace } from "@/lib/demo/starter-workspace";
import { useMuseboardStore } from "@/lib/store/museboard-store";

import styles from "./onboarding-flow.module.css";

const ONBOARDING_STORAGE_KEY = "museboard-onboarding-draft-v1";
const ONBOARDING_CHANGE_EVENT = "museboard:onboarding-change";
const TOTAL_STEPS = 8;
const STEP_LABELS = [
  "First win",
  "Creative lane",
  "Audience",
  "Formats",
  "Capacity",
  "Voice",
  "Boundaries",
  "First hook",
] as const;
let volatileDraft: string | null = null;

interface OnboardingDraft {
  step: number;
  name: string;
  outcome?: CreatorOutcome;
  archetype?: CreatorArchetype;
  audience: string;
  platforms: ContentPlatform[];
  weeklyCapacityMinutes: number;
  voice: string;
  boundaries: string;
  firstHook: string;
}

const DEFAULT_DRAFT: OnboardingDraft = {
  step: 0,
  name: "",
  audience: "",
  platforms: [],
  weeklyCapacityMinutes: 240,
  voice: "",
  boundaries: "",
  firstHook: "",
};

const ARCHETYPE_DEFAULTS: Record<
  CreatorArchetype,
  Pick<OnboardingDraft, "audience" | "platforms" | "voice" | "boundaries" | "firstHook">
> = {
  music: {
    audience: "Independent artists building a repeatable release habit",
    platforms: ["instagram_reels"],
    voice: "Warm, specific, and honest about the process",
    boundaries: "Avoid fake urgency, borrowed authority, and empty trend chasing",
    firstHook: "Your unfinished chorus is already worth sharing.",
  },
  tech_education: {
    audience: "Curious builders who want useful ideas without the jargon",
    platforms: ["youtube_shorts"],
    voice: "Clear, practical, and quietly confident",
    boundaries: "Avoid hype, unexplained jargon, and claims without a concrete example",
    firstHook: "The useful part of this tool takes less than a minute.",
  },
  lifestyle_business: {
    audience: "Independent creators building calmer, more sustainable businesses",
    platforms: ["instagram_reels"],
    voice: "Grounded, generous, and direct",
    boundaries: "Avoid hustle theatre, shame, and unrealistic overnight results",
    firstHook: "Consistency gets easier when the system asks less of you.",
  },
};

const platformOptions = [
  {
    value: "instagram_reels" as const,
    label: "Instagram Reels",
    Icon: InstagramLogo,
  },
  {
    value: "tiktok_video" as const,
    label: "TikTok video",
    Icon: TiktokLogo,
  },
  {
    value: "youtube_shorts" as const,
    label: "YouTube Shorts",
    Icon: YoutubeLogo,
  },
];

const outcomeLabels: Record<CreatorOutcome, string> = {
  plan_week: "A realistic week",
  find_ideas: "Five relevant ideas",
  build_system: "A repeatable system",
};

const archetypeLabels: Record<CreatorArchetype, string> = {
  music: "Music creator",
  tech_education: "Tech & education",
  lifestyle_business: "Lifestyle & business",
};

function parseDraft(raw: string): OnboardingDraft {
  if (!raw) return DEFAULT_DRAFT;

  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    return {
      ...DEFAULT_DRAFT,
      ...parsed,
      step: Math.min(TOTAL_STEPS - 1, Math.max(0, Number(parsed.step) || 0)),
      platforms: Array.isArray(parsed.platforms)
        ? parsed.platforms.filter((platform): platform is ContentPlatform =>
            platformOptions.some(({ value }) => value === platform),
          )
        : [],
    };
  } catch {
    return DEFAULT_DRAFT;
  }
}

function getDraftSnapshot(): string {
  if (volatileDraft !== null) {
    const currentDraft = volatileDraft;
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, currentDraft);
      volatileDraft = null;
    } catch {
      return currentDraft;
    }
  }

  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribeToDraft(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(ONBOARDING_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(ONBOARDING_CHANGE_EVENT, onStoreChange);
  };
}

function subscribeToHydration(): () => void {
  return () => undefined;
}

function persistDraft(draft: OnboardingDraft): void {
  const serializedDraft = JSON.stringify(draft);
  volatileDraft = serializedDraft;
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, serializedDraft);
    volatileDraft = null;
  } catch {
    // The in-memory snapshot keeps the current tab usable without persistence.
  }
  window.dispatchEvent(new Event(ONBOARDING_CHANGE_EVENT));
}

function clearDraft(): void {
  volatileDraft = null;
  try {
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {
    // Completion does not depend on storage cleanup.
  }
  window.dispatchEvent(new Event(ONBOARDING_CHANGE_EVENT));
}

function ChoiceButton({
  children,
  description,
  disabled,
  Icon,
  index,
  onClick,
}: {
  children: ReactNode;
  description: string;
  disabled?: boolean;
  Icon: typeof Sparkle;
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      className={styles.choiceButton}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span aria-hidden="true" className={styles.choiceIndex}>
        {String(index).padStart(2, "0")}
      </span>
      <span className={styles.choiceIcon}>
        <Icon aria-hidden="true" size={24} weight="regular" />
      </span>
      <span className={styles.choiceCopy}>
        <span>{children}</span>
        <small>{description}</small>
      </span>
      <ArrowRight
        aria-hidden="true"
        className={styles.choiceArrow}
        size={18}
      />
    </button>
  );
}

function QuestionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className={styles.questionHeader}>
      <p>{eyebrow}</p>
      <h1>{title}</h1>
      <span>{description}</span>
    </div>
  );
}

function ContinueButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      className={styles.continueButton}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
      <ArrowRight aria-hidden="true" size={18} weight="bold" />
    </button>
  );
}

function SetupPreview({ draft }: { draft: OnboardingDraft }) {
  const direction = draft.outcome
    ? outcomeLabels[draft.outcome]
    : "Your first useful week";
  const lane = draft.archetype
    ? archetypeLabels[draft.archetype]
    : "Your creative lane";
  const hook = draft.firstHook.trim() || "One clear idea, ready to shape.";

  return (
    <section aria-label="Workspace preview" className={styles.previewPanel}>
      <header>
        <span>Live workspace preview</span>
        <b>{draft.step + 1}/8</b>
      </header>
      <div className={styles.previewCard}>
        <small>YOUR NEXT POST</small>
        <strong>{hook}</strong>
        <span>{draft.audience.trim() || "Personalized to the audience you choose"}</span>
      </div>
      <dl className={styles.previewFacts}>
        <div>
          <dt>Direction</dt>
          <dd>{direction}</dd>
        </div>
        <div>
          <dt>Lane</dt>
          <dd>{lane}</dd>
        </div>
        <div>
          <dt>Weekly pace</dt>
          <dd>{draft.weeklyCapacityMinutes / 60} focused hours</dd>
        </div>
      </dl>
      <div aria-label="Starter workflow" className={styles.previewFlow}>
        <span data-ready={draft.step >= 1}>Signal</span>
        <i aria-hidden="true" />
        <span data-ready={draft.step >= 5}>Shape</span>
        <i aria-hidden="true" />
        <span data-ready={draft.step >= 7}>Plan</span>
      </div>
    </section>
  );
}

export function OnboardingFlow() {
  const router = useRouter();
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const rawDraft = useSyncExternalStore(subscribeToDraft, getDraftSnapshot, () => "");
  const [localDraft, setLocalDraft] = useState<OnboardingDraft | null>(null);
  const draft = localDraft ?? parseDraft(rawDraft);

  function updateDraft(updates: Partial<OnboardingDraft>) {
    const nextDraft = { ...draft, ...updates };
    setLocalDraft(nextDraft);
    persistDraft(nextDraft);
  }

  function finishOnboarding() {
    if (!draft.archetype || !draft.outcome) return;

    const workspace = buildStarterWorkspace({
      name: draft.name,
      outcome: draft.outcome,
      archetype: draft.archetype,
      audience: draft.audience,
      platforms: draft.platforms,
      weeklyCapacityMinutes: draft.weeklyCapacityMinutes,
      voice: draft.voice,
      boundaries: draft.boundaries,
      firstHook: draft.firstHook,
      now: new Date().toISOString(),
    });
    useMuseboardStore.getState().completeOnboarding(workspace);
    clearDraft();
    router.push("/app/today");
  }

  const back =
    draft.step > 0 ? (
      <button
        aria-label="Previous question"
        className={styles.backButton}
        onClick={() => updateDraft({ step: draft.step - 1 })}
        type="button"
      >
        <ArrowLeft aria-hidden="true" size={18} />
        Back
      </button>
    ) : (
      <span />
    );

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div>
          <Link className={styles.wordmark} href="/">
            Museboard
          </Link>
          <span className={styles.sampleBadge}>
            <Sparkle aria-hidden="true" className="text-coral" size={15} weight="fill" />
            Sample workspace · not live
          </span>
        </div>
      </header>

      <div className={styles.setupShell}>
        <aside className={styles.setupRail}>
          <div className={styles.railHeading}>
            {back}
            <div>
              <p>Your setup</p>
              <strong>
                {String(draft.step + 1).padStart(2, "0")} / {String(TOTAL_STEPS).padStart(2, "0")}
              </strong>
            </div>
          </div>
          <div
            aria-label={`Onboarding progress: question ${draft.step + 1} of ${TOTAL_STEPS}`}
            aria-valuemax={TOTAL_STEPS}
            aria-valuemin={1}
            aria-valuenow={draft.step + 1}
            className={styles.progressTrack}
            role="progressbar"
          >
            <div
              className={styles.progressValue}
              style={{ width: `${((draft.step + 1) / TOTAL_STEPS) * 100}%` }}
            />
          </div>

          <ol aria-label="Setup steps" className={styles.stepList}>
            {STEP_LABELS.map((label, index) => (
              <li
                data-state={index < draft.step ? "complete" : index === draft.step ? "active" : "next"}
                key={label}
              >
                <span>{index < draft.step ? <Check aria-hidden="true" size={13} weight="bold" /> : index + 1}</span>
                <b>{label}</b>
              </li>
            ))}
          </ol>
          <SetupPreview draft={draft} />
          <p className={styles.privacyNote}>
            <LockSimple aria-hidden="true" size={17} />
            No account connection or card required.
          </p>
        </aside>

        <section className={styles.questionStage}>
          <div className={styles.questionFrame}>
            {draft.step === 0 ? (
              <div>
                <QuestionHeader
                  description="Pick the result that would make this setup useful today. You can change every inferred detail before we build anything."
                  eyebrow="Start with value"
                  title="What should Museboard help you do first?"
                />
                <div className={styles.choiceList}>
                  <ChoiceButton
                    description="Turn your capacity into a realistic first plan."
                    disabled={!isHydrated}
                    Icon={Clock}
                    index={1}
                    onClick={() => updateDraft({ outcome: "plan_week", step: 1 })}
                  >
                    Plan my next week
                  </ChoiceButton>
                  <ChoiceButton
                    description="Start from five relevant sample opportunities."
                    disabled={!isHydrated}
                    Icon={Sparkle}
                    index={2}
                    onClick={() => updateDraft({ outcome: "find_ideas", step: 1 })}
                  >
                    Find my next ideas
                  </ChoiceButton>
                  <ChoiceButton
                    description="Create a repeatable path from signal to publish."
                    disabled={!isHydrated}
                    Icon={Check}
                    index={3}
                    onClick={() => updateDraft({ outcome: "build_system", step: 1 })}
                  >
                    Grow with a clear system
                  </ChoiceButton>
                </div>
              </div>
            ) : null}

            {draft.step === 1 ? (
              <div>
                <QuestionHeader
                  description="This shapes the starter opportunities and language. It is a starting point, not a permanent label."
                  eyebrow="Your creative lane"
                  title="What kind of creator are you?"
                />
                <div className={styles.choiceList}>
                  <ChoiceButton
                    description="Artists, producers, songwriters, and music storytellers."
                    Icon={MusicNotes}
                    index={1}
                    onClick={() =>
                      updateDraft({
                        archetype: "music",
                        ...ARCHETYPE_DEFAULTS.music,
                        step: 2,
                      })
                    }
                  >
                    Music creator
                  </ChoiceButton>
                  <ChoiceButton
                    description="Teachers, builders, reviewers, and explainers."
                    Icon={ChalkboardTeacher}
                    index={2}
                    onClick={() =>
                      updateDraft({
                        archetype: "tech_education",
                        ...ARCHETYPE_DEFAULTS.tech_education,
                        step: 2,
                      })
                    }
                  >
                    Tech & education creator
                  </ChoiceButton>
                  <ChoiceButton
                    description="Operators, coaches, founders, and lifestyle creators."
                    Icon={Briefcase}
                    index={3}
                    onClick={() =>
                      updateDraft({
                        archetype: "lifestyle_business",
                        ...ARCHETYPE_DEFAULTS.lifestyle_business,
                        step: 2,
                      })
                    }
                  >
                    Lifestyle & business creator
                  </ChoiceButton>
                </div>
              </div>
            ) : null}

            {draft.step === 2 ? (
              <div>
                <QuestionHeader
                  description="Tell us what to call you, then make the inferred audience sound like the people you actually want to reach."
                  eyebrow="Your starting profile"
                  title="Who are you creating for?"
                />
                <label className="block font-semibold" htmlFor="creator-name">
                  What should we call you?
                </label>
                <input
                  autoComplete="name"
                  className="mt-3 min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base text-ink shadow-sm placeholder:text-muted/70"
                  id="creator-name"
                  onChange={(event) => updateDraft({ name: event.target.value })}
                  placeholder="Your name or creator name"
                  value={draft.name}
                />
                <label className="mt-6 block font-semibold" htmlFor="creator-audience">
                  Who do you make things for?
                </label>
                <textarea
                  className="mt-3 min-h-32 w-full rounded-2xl border border-border bg-surface p-4 text-base text-ink shadow-sm placeholder:text-muted/70"
                  id="creator-audience"
                  onChange={(event) => updateDraft({ audience: event.target.value })}
                  value={draft.audience}
                />
                <ContinueButton
                  disabled={!draft.name.trim() || !draft.audience.trim()}
                  onClick={() => updateDraft({ step: 3 })}
                >
                  Continue to formats
                </ContinueButton>
              </div>
            ) : null}

            {draft.step === 3 ? (
              <div>
                <QuestionHeader
                  description="Choose every short-form format you want in your starter workspace. You can change this later."
                  eyebrow="Where you create"
                  title="Which formats belong in your week?"
                />
                <fieldset>
                  <legend className="sr-only">Short-form formats</legend>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {platformOptions.map(({ Icon, label, value }) => {
                      const checked = draft.platforms.includes(value);
                      return (
                        <label
                          className="flex min-h-20 items-center gap-3 rounded-2xl border border-border bg-surface p-4 font-semibold transition hover:border-coral has-[:checked]:border-coral has-[:checked]:bg-coral/10"
                          key={value}
                        >
                          <input
                            checked={checked}
                            className="size-5 accent-coral"
                            onChange={() =>
                              updateDraft({
                                platforms: checked
                                  ? draft.platforms.filter((platform) => platform !== value)
                                  : [...draft.platforms, value],
                              })
                            }
                            type="checkbox"
                          />
                          <Icon aria-hidden="true" size={22} />
                          <span>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <ContinueButton
                  disabled={draft.platforms.length === 0}
                  onClick={() => updateDraft({ step: 4 })}
                >
                  Continue to capacity
                </ContinueButton>
              </div>
            ) : null}

            {draft.step === 4 ? (
              <div>
                <QuestionHeader
                  description="Museboard plans to about 80% of this time so your week still has room to breathe."
                  eyebrow="A realistic pace"
                  title="How much time can content get each week?"
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  {[120, 240, 360].map((minutes) => (
                    <button
                      className="min-h-20 rounded-2xl border border-border bg-surface px-5 text-left font-semibold transition hover:border-coral hover:bg-coral/10"
                      key={minutes}
                      onClick={() =>
                        updateDraft({ weeklyCapacityMinutes: minutes, step: 5 })
                      }
                      type="button"
                    >
                      {minutes / 60} hours per week
                      <span className="mt-1 block text-sm font-normal text-muted">
                        Plan up to {(minutes * 0.8) / 60} focused hours
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {draft.step === 5 ? (
              <div>
                <QuestionHeader
                  description="Edit the suggestion until it feels like a collaborator who understands your tone."
                  eyebrow="Editable suggestion"
                  title="How should your work sound?"
                />
                <label className="block font-semibold" htmlFor="creator-voice">
                  Describe your voice
                </label>
                <textarea
                  className="mt-3 min-h-32 w-full rounded-2xl border border-border bg-surface p-4 text-base text-ink shadow-sm"
                  id="creator-voice"
                  onChange={(event) => updateDraft({ voice: event.target.value })}
                  value={draft.voice}
                />
                <ContinueButton
                  disabled={!draft.voice.trim()}
                  onClick={() => updateDraft({ step: 6 })}
                >
                  Continue to boundaries
                </ContinueButton>
              </div>
            ) : null}

            {draft.step === 6 ? (
              <div>
                <QuestionHeader
                  description="Good strategy also knows what not to recommend. Keep, remove, or rewrite our starting boundaries."
                  eyebrow="Protect the work"
                  title="What should Museboard avoid?"
                />
                <label className="block font-semibold" htmlFor="creator-boundaries">
                  What should Museboard avoid?
                </label>
                <textarea
                  className="mt-3 min-h-32 w-full rounded-2xl border border-border bg-surface p-4 text-base text-ink shadow-sm"
                  id="creator-boundaries"
                  onChange={(event) => updateDraft({ boundaries: event.target.value })}
                  value={draft.boundaries}
                />
                <ContinueButton
                  disabled={!draft.boundaries.trim()}
                  onClick={() => updateDraft({ step: 7 })}
                >
                  Continue to your first hook
                </ContinueButton>
              </div>
            ) : null}

            {draft.step === 7 ? (
              <div>
                <QuestionHeader
                  description="This gives your sample plan a real first move. Edit it freely—nothing is posted or connected."
                  eyebrow="Your first value"
                  title="What could your next post open with?"
                />
                <label className="block font-semibold" htmlFor="creator-hook">
                  Write your first hook
                </label>
                <textarea
                  className="mt-3 min-h-28 w-full rounded-2xl border border-border bg-surface p-4 text-lg text-ink shadow-sm"
                  id="creator-hook"
                  onChange={(event) => updateDraft({ firstHook: event.target.value })}
                  value={draft.firstHook}
                />
                <div className="mt-5 flex items-start gap-3 rounded-2xl bg-sage/20 p-4 text-sm leading-6 text-muted">
                  <LockSimple aria-hidden="true" className="mt-0.5 shrink-0 text-success" size={20} />
                  <p>
                    No social account or card is needed. This creates a local sample workspace and never publishes anything.
                  </p>
                </div>
                <ContinueButton
                  disabled={!draft.firstHook.trim()}
                  onClick={finishOnboarding}
                >
                  Create sample workspace
                </ContinueButton>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
