import type { Metadata } from "next";

import { LegalPage, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms",
  description: "Pre-launch draft terms for the Museboard creator workspace.",
};

const sections: LegalSection[] = [
  {
    id: "status",
    title: "Product and account status",
    content: (
      <>
        <p>
          Museboard currently includes a credential-free sample workspace. Sample content, billing states,
          social connections, opportunities, and outcomes are demonstrations and are labeled as not live.
          Access to production accounts, provider-powered features, and paid plans depends on those services
          being configured and launch operations being approved.
        </p>
        <p>
          The launch assumption is for people aged 13 or older. Parent or guardian consent and stricter
          regional age rules may apply and require review before public launch.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your content and product permissions",
    content: (
      <p>
        You keep ownership of your original content. To provide the features you choose, you would give
        Museboard a limited permission to store, process, adapt, display, and export that content for you
        and authorized workspace collaborators. This does not transfer ownership to Museboard. You remain
        responsible for having permission to use uploaded music, images, footage, trademarks, and other
        third-party material.
      </p>
    ),
  },
  {
    id: "responsibilities",
    title: "Publishing and disclosure responsibilities",
    content: (
      <>
        <p>
          You control the final editorial decision and native platform post. You are responsible for the
          accuracy, legality, safety, and platform compliance of what you publish, including sponsorship,
          affiliate, and material-connection disclosures. Rights marked unknown are not cleared by a
          Museboard suggestion or export note.
        </p>
        <p>
          Do not use the service to violate another person&apos;s rights, evade platform protections, distribute
          malware, harass people, impersonate others, or create unlawful or deceptively manipulated content.
        </p>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI assistance needs creator review",
    content: (
      <p>
        AI and deterministic recommendations can be incomplete, outdated, or wrong. They are creative and
        operational assistance, not a promise of virality, revenue, factual accuracy, rights clearance, or
        professional advice. Review sources, claims, platform rules, and generated language before use.
      </p>
    ),
  },
  {
    id: "subscriptions",
    title: "Subscriptions and cancellation",
    content: (
      <>
        <p>
          Free manual planning is intended to remain usable without a payment card. Paid service limits,
          prices, renewal cadence, taxes, trial terms, and provider-powered quotas must be shown before an
          actual checkout. The current sample billing controls do not charge a card.
        </p>
        <p>
          For an active paid subscription, cancellation takes effect at the end of the current paid billing
          period unless law requires a different result. Access and service limits may then move to the Free
          plan. Refund, price-change, failed-payment, and region-specific renewal rules remain pending legal
          and operational review.
        </p>
      </>
    ),
  },
  {
    id: "availability",
    title: "Availability, moderation, and support",
    content: (
      <p>
        Museboard may need to limit or suspend access to protect creators, collaborators, providers, or the
        service. A production policy must define notice, appeal, data access, service continuity, and any
        legally required exceptions. The support channel is not yet published and no response time is
        promised by this draft.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      documentId="terms"
      eyebrow="Product terms"
      lede="The practical boundaries between creator control, collaborative use, AI assistance, paid services, and the platform responsibilities Museboard cannot take on for you."
      sections={sections}
      title="Clear rules for making together."
    />
  );
}
