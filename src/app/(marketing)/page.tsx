import {
  ArrowRight,
  CalendarBlank,
  Check,
  Compass,
  PencilSimpleLine,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import approvedTodayLight from "../../../docs/design/museboard-approved-today-light.png";
import { MarketingShell } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = {
  title: "Know what to make next",
  description: "Museboard turns creator signals into a focused hook and a realistic weekly plan.",
};

const principles = [
  {
    Icon: Compass,
    title: "See the useful signal",
    body: "Start with five relevant opportunities, each clearly labeled as sample—not a fake live trend feed.",
  },
  {
    Icon: PencilSimpleLine,
    title: "Shape your angle",
    body: "Turn one signal into a hook that sounds like you and respects the boundaries you set.",
  },
  {
    Icon: CalendarBlank,
    title: "Plan for your real week",
    body: "Match the work to your capacity, with unlimited manual planning on the Free plan.",
  },
];

export default function MarketingPage() {
  return (
    <MarketingShell>
      <main>
        <section className="overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.12fr_0.88fr] lg:gap-16">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-butter/25 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-warning">
                <Sparkle aria-hidden="true" size={16} weight="fill" />
                A creator operating system
              </p>
              <h1 className="mt-7 max-w-4xl font-display text-6xl leading-[0.92] tracking-[-0.03em] sm:text-7xl lg:text-8xl">
                Know what to make next.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-muted sm:text-xl">
                Museboard turns the noise around your work into one relevant opportunity, one strong opening, and a plan your week can actually hold.
              </p>
              <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <Link
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-coral px-6 py-3 font-bold text-white transition hover:bg-ink hover:text-background"
                  href="/onboarding"
                >
                  Try the sample workspace
                  <ArrowRight aria-hidden="true" size={19} weight="bold" />
                </Link>
                <Link
                  className="inline-flex min-h-12 items-center rounded-full px-5 py-3 font-bold text-cobalt underline-offset-4 hover:underline"
                  href="/pricing"
                >
                  See transparent pricing
                </Link>
              </div>
              <p className="mt-4 text-sm text-muted">No card. No social connection. Sample data is always labeled.</p>
            </div>

            <figure className="overflow-hidden rounded-[2rem] border border-border bg-surface p-2 shadow-xl sm:p-3">
              <Image
                alt="Approved Museboard Today workspace in light theme"
                className="h-auto w-full rounded-[1.4rem]"
                placeholder="blur"
                priority
                sizes="(min-width: 1024px) 50vw, (min-width: 640px) 80vw, calc(100vw - 2rem)"
                src={approvedTodayLight}
              />
              <figcaption className="px-3 pb-2 pt-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                Approved product direction · Today workspace
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="border-y border-border bg-surface px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="workflow-heading">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">From possibility to practice</p>
            <h2 className="mt-3 max-w-3xl font-display text-4xl leading-tight sm:text-6xl" id="workflow-heading">
              Strategy that ends in something you can make.
            </h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {principles.map(({ Icon, body, title }) => (
                <article className="rounded-3xl border border-border bg-background p-6" key={title}>
                  <Icon aria-hidden="true" className="text-cobalt" size={28} />
                  <h3 className="mt-6 text-lg font-bold">{title}</h3>
                  <p className="mt-3 leading-7 text-muted">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-8 rounded-[2rem] bg-ink p-7 text-background sm:p-12 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-butter">Start with your real constraints</p>
              <h2 className="mt-3 max-w-3xl font-display text-4xl leading-tight sm:text-6xl">A useful week is better than an impossible content calendar.</h2>
              <ul className="mt-7 grid gap-3 text-sm sm:grid-cols-2">
                {[
                  "Eight short setup questions",
                  "Every inferred field stays editable",
                  "Five personalized sample opportunities",
                  "No account connection before value",
                ].map((item) => (
                  <li className="flex items-center gap-2" key={item}>
                    <Check aria-hidden="true" className="text-sage" size={18} weight="bold" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-background px-6 py-3 font-bold text-ink transition hover:bg-butter" href="/onboarding">
              Build my sample
              <ArrowRight aria-hidden="true" size={19} weight="bold" />
            </Link>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
