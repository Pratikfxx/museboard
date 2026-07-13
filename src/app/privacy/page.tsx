import type { Metadata } from "next";

import { LegalPage, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy",
  description: "A plain-language pre-launch explanation of Museboard privacy behavior.",
};

const sections: LegalSection[] = [
  {
    id: "scope",
    title: "What this draft covers",
    content: (
      <>
        <p>
          This draft explains how Museboard is intended to handle information when you explore the
          sample workspace or use a future account with configured services. Those modes have different
          storage and processing behavior, and the interface should label the active mode.
        </p>
        <p>
          The sample workspace is a local product demonstration. It does not represent a live social
          connection, a production account, or a promise that paid services are enabled.
        </p>
      </>
    ),
  },
  {
    id: "information",
    title: "Information the product may handle",
    content: (
      <ul>
        <li><strong>Creator setup:</strong> niches, audiences, goals, platforms, capacity, voice traits, and content boundaries.</li>
        <li><strong>Creator work:</strong> ideas, scripts, shot lists, assets, comments, approvals, schedules, exports, publish receipts, and imported metrics.</li>
        <li><strong>Account operations:</strong> identity, workspace membership, plan state, payment status, and security or reliability events when production providers are configured.</li>
        <li><strong>Sources and provenance:</strong> links, timestamps, rights notes, and labels used to distinguish creator-provided, curated, sample, and live information.</li>
      </ul>
    ),
  },
  {
    id: "purpose",
    title: "Why the information is used",
    content: (
      <p>
        Museboard uses creator information to personalize opportunities, shape drafts in the creator&apos;s
        stated voice, plan work against available capacity, support collaboration, produce exports, record
        creator-entered publishing results, and derive transparent learnings. It should not silently turn a
        vision-board reference into trend evidence or treat a generated suggestion as a verified fact.
      </p>
    ),
  },
  {
    id: "providers",
    title: "Storage, providers, and AI",
    content: (
      <>
        <p>
          In sample mode, workspace state is stored on the device through browser storage. In a configured
          production environment, account and workspace records may be processed by infrastructure,
          authentication, payment, and AI providers needed for the requested feature.
        </p>
        <p>
          AI inputs can include the creator context and content selected for a requested strategist action.
          Museboard&apos;s intended rule is to send only the context needed for that action and to retain
          provenance for generated output. Provider-specific retention and training terms require review
          before live AI services are marketed.
        </p>
      </>
    ),
  },
  {
    id: "choices",
    title: "Your controls",
    content: (
      <p>
        The launch workflow is intended to provide an account export and a confirmed deletion request.
        Clearing the local sample workspace removes its browser-stored creator state from that device.
        Production export and deletion timing, backups, legal holds, and billing-record retention must be
        verified against the configured providers before launch.
      </p>
    ),
  },
  {
    id: "safety",
    title: "Security, age, and support",
    content: (
      <p>
        Museboard is being designed with workspace-scoped access and least-privilege service boundaries.
        No service can promise absolute security. The launch assumption is for people aged 13 or older,
        with additional age and regional requirements still subject to legal review. The support channel
        is not yet published, so this draft does not invent a contact method or response commitment.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      documentId="privacy"
      eyebrow="Privacy overview"
      lede="A readable map of what Museboard may handle, why it is needed, and where the pre-launch product still needs operational and legal confirmation."
      sections={sections}
      title="Privacy without the fog."
    />
  );
}
