import type { Metadata } from "next";

import { LegalPage, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Data policy",
  description: "Museboard's pre-launch data modes, AI boundaries, exports, and deletion controls.",
};

const sections: LegalSection[] = [
  {
    id: "modes",
    title: "Sample workspace and configured services",
    content: (
      <>
        <p>
          In the credential-free sample, sample workspace data stays in this browser. It is not synced to
          a Museboard cloud account, connected to a social profile, or submitted to a live billing flow.
          Clearing browser storage can remove it, so creators should not rely on sample mode as a backup.
        </p>
        <p>
          When production is configured, providers such as Supabase and Stripe may handle authentication,
          workspace records, subscription status, and payment operations. The product should fail closed
          when required configuration is incomplete and should never silently replace production records
          with sample content.
        </p>
      </>
    ),
  },
  {
    id: "ai",
    title: "How AI uses creator inputs",
    content: (
      <>
        <p>
          A requested AI feature may receive the creator profile, selected source material, content draft,
          voice guidance, and boundaries needed to produce that result. Creator content is not used by
          Museboard to train a shared model. That statement does not override a configured provider&apos;s own
          terms; provider retention and training settings must be verified and disclosed before live use.
        </p>
        <p>
          AI output remains a suggestion. Museboard should preserve its provenance, label generated or
          curated content, and avoid presenting unsupported claims, model guesses, or sample opportunities
          as verified live evidence.
        </p>
      </>
    ),
  },
  {
    id: "minimization",
    title: "Collection and minimization",
    content: (
      <p>
        Museboard should collect only what is needed for the chosen workflow: creator preferences, workspace
        content, collaboration records, export and publishing metadata, imported performance metrics, plan
        state, and narrowly scoped operational events. Private content bodies, full payment details, and
        credentials should not appear in general application logs.
      </p>
    ),
  },
  {
    id: "export-delete",
    title: "Export and deletion controls",
    content: (
      <>
        <p>
          The intended account export includes creator-controlled workspace records in a readable format.
          A production deletion flow requires explicit confirmation, reports job status, and removes account
          data from active systems subject to verified backup, fraud-prevention, billing-record, dispute,
          safety, and legal retention requirements.
        </p>
        <p>
          In sample mode, export is local and deletion means clearing the sample workspace from this browser.
          Production timelines and exceptions are not promised until infrastructure and legal review are complete.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Rights, sources, and platform data",
    content: (
      <p>
        Creator uploads remain creator-controlled. Source links, evidence labels, observed times, and rights
        notes travel with recommendations and exports where relevant. Museboard does not claim ownership of
        platform audio, download social media for redistribution, or treat a creator&apos;s inspiration board as
        proof that a topic is trending. Platform-native rules still govern connected or exported content.
      </p>
    ),
  },
  {
    id: "support",
    title: "Questions, incidents, and support status",
    content: (
      <p>
        The support channel is not yet published. Launch requires a verified route for privacy questions,
        access and deletion requests, security reports, and account recovery, plus documented ownership and
        response handling. This draft intentionally provides no invented email, address, or service-level promise.
      </p>
    ),
  },
];

export default function DataPolicyPage() {
  return (
    <LegalPage
      documentId="data-policy"
      eyebrow="Data boundaries"
      lede="A concrete view of where creator data lives, when providers may be involved, what AI receives, and which controls must exist before launch."
      sections={sections}
      title="Know where the work goes."
    />
  );
}
