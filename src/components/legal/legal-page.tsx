import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./legal-page.module.css";

export type LegalDocumentId = "privacy" | "terms" | "data-policy";

export interface LegalSection {
  id: string;
  title: string;
  content: ReactNode;
}

interface LegalPageProps {
  documentId: LegalDocumentId;
  eyebrow: string;
  title: string;
  lede: string;
  sections: LegalSection[];
}

const legalDocuments: Array<{ id: LegalDocumentId; label: string; href: string }> = [
  { id: "privacy", label: "Privacy", href: "/privacy" },
  { id: "terms", label: "Terms", href: "/terms" },
  { id: "data-policy", label: "Data policy", href: "/data-policy" },
];

export function LegalPage({ documentId, eyebrow, title, lede, sections }: LegalPageProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} href="/">
            <Sparkle aria-hidden="true" className={styles.brandIcon} size={21} weight="fill" />
            Museboard
          </Link>
          <Link className={styles.backLink} href="/">
            <ArrowLeft aria-hidden="true" size={16} weight="bold" />
            Back to Museboard
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero} aria-labelledby="legal-page-title">
          <div className={styles.draftNotice} role="note" aria-label="Document review status">
            <span className={styles.draftLabel}>
              <WarningCircle aria-hidden="true" size={17} weight="fill" />
              Pre-launch draft · pending legal review
            </span>
            <span className={styles.draftCopy}>
              This product explanation is not legal advice or a final legal agreement.
            </span>
          </div>

          <div>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1 className={styles.title} id="legal-page-title">{title}</h1>
          </div>
          <p className={styles.lede}>{lede}</p>

          <div className={styles.trustStrip} aria-label="Document principles">
            <div className={styles.trustItem}>
              <strong>Plain language</strong>
              <span>Product behavior first, legal shorthand second.</span>
            </div>
            <div className={styles.trustItem}>
              <strong>Mode-aware</strong>
              <span>Sample data and configured services are never presented as the same thing.</span>
            </div>
            <div className={styles.trustItem}>
              <strong>Creator control</strong>
              <span>Rights, export, deletion, and publishing choices stay visible.</span>
            </div>
          </div>
        </section>

        <div className={styles.bodyGrid}>
          <aside className={styles.sideNav}>
            <p className={styles.sideLabel}>Trust center</p>
            <nav aria-label="Legal documents" className={styles.documentNav}>
              {legalDocuments.map((document) => (
                <Link
                  aria-current={document.id === documentId ? "page" : undefined}
                  className={styles.documentLink}
                  href={document.href}
                  key={document.id}
                >
                  {document.label}
                  {document.id === documentId ? (
                    <CheckCircle aria-hidden="true" size={16} weight="fill" />
                  ) : null}
                </Link>
              ))}
            </nav>
          </aside>

          <article className={styles.document}>
            {sections.map((section) => (
              <section className={styles.section} id={section.id} key={section.id}>
                <h2>{section.title}</h2>
                {section.content}
              </section>
            ))}

            <section className={styles.footerCard} aria-labelledby="trust-status-title">
              <div>
                <h2 id="trust-status-title">A transparent pre-launch build</h2>
                <p>
                  The support channel is not yet published. Until launch operations are reviewed,
                  these pages describe intended product behavior and must not be treated as approved policy.
                </p>
              </div>
              <Link className={styles.productLink} href="/onboarding">
                Open sample workspace
                <ArrowRight aria-hidden="true" size={16} weight="bold" />
              </Link>
            </section>
          </article>
        </div>
      </main>
    </div>
  );
}
