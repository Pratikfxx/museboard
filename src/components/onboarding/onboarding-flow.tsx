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

import type { Opportunity } from "@/domain/opportunities";
import type {
  ContentPlatform,
  CreatorArchetype,
} from "@/domain/schema";
import { DEMO_NOW } from "@/lib/demo/fixtures";
import { useMuseboardStore } from "@/lib/store/museboard-store";

const ONBOARDING_STORAGE_KEY = "museboard-onboarding-draft-v1";
const ONBOARDING_CHANGE_EVENT = "museboard:onboarding-change";
const TOTAL_STEPS = 8;
let volatileDraft: string | null = null;

type Outcome = "plan_week" | "find_ideas" | "build_system";

interface OnboardingDraft {
  step: number;
  outcome?: Outcome;
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

const OPPORTUNITY_TITLES: Record<CreatorArchetype, readonly string[]> = {
  music: [
    "Let listeners choose the chorus turn",
    "The eight seconds before the hook",
    "One sound, three different moods",
    "The lyric that changed the track",
    "Build the drop with your audience",
  ],
  tech_education: [
    "Teach the shortcut through one real task",
    "The mistake your first version made",
    "One concept, three visual examples",
    "The tiny system behind the result",
    "Make the jargon pass the plain-language test",
  ],
  lifestyle_business: [
    "The ritual that makes starting lighter",
    "Show the system behind a calm week",
    "A boundary that improved the work",
    "One small decision with a visible result",
    "Turn the weekly reset into a conversation",
  ],
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

function createStarterOpportunities(
  archetype: CreatorArchetype,
  audience: string,
): Opportunity[] {
  const platforms: ContentPlatform[] = [
    "instagram_reels",
    "tiktok_video",
    "youtube_shorts",
  ];

  return OPPORTUNITY_TITLES[archetype].map((title, index) => ({
    id: `starter-${archetype}-${index + 1}`,
    title,
    summary: `A sample angle for ${audience.toLocaleLowerCase()} that can become a concrete short-form post.`,
    platform: platforms[index % platforms.length],
    archetypes: [archetype],
    signals: {
      relevance: 94 - index * 2,
      momentum: 82 - index,
      originality: 78 + index * 2,
      creatorFit: 96 - index,
    },
    provenance: {
      provider: "museboard-onboarding",
      mode: "sample",
      fetchedAt: DEMO_NOW,
    },
  }));
}

function ChoiceButton({
  children,
  description,
  disabled,
  Icon,
  onClick,
}: {
  children: ReactNode;
  description: string;
  disabled?: boolean;
  Icon: typeof Sparkle;
  onClick: () => void;
}) {
  return (
    <button
      className="group flex min-h-24 w-full items-start gap-4 rounded-2xl border border-border bg-surface p-4 text-left text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-coral hover:shadow-md disabled:cursor-wait disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-butter/35 text-warning">
        <Icon aria-hidden="true" size={22} weight="regular" />
      </span>
      <span className="flex-1">
        <span className="block font-semibold">{children}</span>
        <span className="mt-1 block text-sm leading-6 text-muted">{description}</span>
      </span>
      <ArrowRight
        aria-hidden="true"
        className="mt-3 shrink-0 transition group-hover:translate-x-1"
        size={18}
      />
    </button>
  );
}

function QuestionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-7">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">{eyebrow}</p>
      <h1 className="mt-2 font-display text-4xl leading-none text-ink sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{description}</p>
    </div>
  );
}

function ContinueButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      className="mt-7 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-bold text-background transition hover:bg-coral disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
      <ArrowRight aria-hidden="true" size={18} weight="bold" />
    </button>
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
    if (!draft.archetype) return;

    const opportunities = createStarterOpportunities(draft.archetype, draft.audience);
    useMuseboardStore.getState().completeOnboarding({
      name: `${draft.archetype.replaceAll("_", " ")} creator`,
      archetype: draft.archetype,
      weeklyCapacityMinutes: draft.weeklyCapacityMinutes,
    });
    useMuseboardStore.setState({
      opportunities,
      selectedOpportunityId: opportunities[0].id,
      plannerTasks: [
        {
          id: `starter-${draft.archetype}-hook`,
          title: `Shape the hook: ${draft.firstHook}`,
          estimatedMinutes: 30,
          priority: 95,
          opportunityScore: 92,
        },
        {
          id: `starter-${draft.archetype}-outline`,
          title: "Outline the first short-form post",
          estimatedMinutes: 45,
          priority: 86,
          opportunityScore: 90,
        },
        {
          id: `starter-${draft.archetype}-record`,
          title: "Record a rough first take",
          estimatedMinutes: 60,
          priority: 78,
          opportunityScore: 84,
        },
      ],
    });
    clearDraft();
    router.push("/app/today");
  }

  const back =
    draft.step > 0 ? (
      <button
        aria-label="Previous question"
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-muted transition hover:bg-surface hover:text-ink"
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
    <main className="min-h-screen bg-background text-ink">
      <header className="border-b border-border/80 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <Link className="font-display text-2xl" href="/">
            Museboard
          </Link>
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-surface px-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">
            <Sparkle aria-hidden="true" className="text-coral" size={15} weight="fill" />
            Sample workspace · not live
          </span>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-4.25rem)] max-w-6xl lg:grid-cols-[17rem_1fr]">
        <aside className="border-b border-border/80 px-4 py-4 sm:px-6 lg:border-b-0 lg:border-r lg:py-8">
          <div className="flex items-center justify-between gap-3 lg:block">
            {back}
            <div className="text-right lg:mt-10 lg:text-left">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
                Your setup
              </p>
              <p className="mt-1 text-sm font-semibold">
                Question {draft.step + 1} of {TOTAL_STEPS}
              </p>
            </div>
          </div>
          <div
            aria-label={`Onboarding progress: question ${draft.step + 1} of ${TOTAL_STEPS}`}
            aria-valuemax={TOTAL_STEPS}
            aria-valuemin={1}
            aria-valuenow={draft.step + 1}
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-border lg:mt-4"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-coral transition-[width]"
              style={{ width: `${((draft.step + 1) / TOTAL_STEPS) * 100}%` }}
            />
          </div>

          {draft.step > 0 ? (
            <div className="mt-5 hidden rounded-2xl bg-sage/20 p-4 text-sm leading-6 text-muted lg:block">
              <LockSimple aria-hidden="true" className="mb-2 text-success" size={20} />
              Social accounts stay disconnected. Connect one only after your first plan, if you choose.
            </div>
          ) : null}
        </aside>

        <section className="flex items-center px-4 py-10 sm:px-8 lg:px-14 lg:py-16">
          <div className="mx-auto w-full max-w-3xl">
            {draft.step === 0 ? (
              <div>
                <QuestionHeader
                  description="Pick the result that would make this setup useful today. You can change every inferred detail before we build anything."
                  eyebrow="Start with value"
                  title="What should Museboard help you do first?"
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <ChoiceButton
                    description="Turn your capacity into a realistic first plan."
                    disabled={!isHydrated}
                    Icon={Clock}
                    onClick={() => updateDraft({ outcome: "plan_week", step: 1 })}
                  >
                    Plan my next week
                  </ChoiceButton>
                  <ChoiceButton
                    description="Start from five relevant sample opportunities."
                    disabled={!isHydrated}
                    Icon={Sparkle}
                    onClick={() => updateDraft({ outcome: "find_ideas", step: 1 })}
                  >
                    Find my next ideas
                  </ChoiceButton>
                  <ChoiceButton
                    description="Create a repeatable path from signal to publish."
                    disabled={!isHydrated}
                    Icon={Check}
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
                <div className="grid gap-3 sm:grid-cols-3">
                  <ChoiceButton
                    description="Artists, producers, songwriters, and music storytellers."
                    Icon={MusicNotes}
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
                  description="We inferred a starting audience from your lane. Make it sound like the people you actually want to reach."
                  eyebrow="Editable suggestion"
                  title="Who do you make things for?"
                />
                <label className="block font-semibold" htmlFor="creator-audience">
                  Who do you make things for?
                </label>
                <textarea
                  className="mt-3 min-h-32 w-full rounded-2xl border border-border bg-surface p-4 text-base text-ink shadow-sm placeholder:text-muted/70"
                  id="creator-audience"
                  onChange={(event) => updateDraft({ audience: event.target.value })}
                  value={draft.audience}
                />
                <ContinueButton
                  disabled={!draft.audience.trim()}
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
