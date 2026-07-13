"use client";

import {
  BookOpen,
  CalendarBlank,
  Compass,
  DotsThree,
  GearSix,
  House,
  PencilSimple,
  ShieldCheck,
  X,
  UsersThree,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

import { useMuseboardStore } from "@/lib/store/museboard-store";

import styles from "./app-shell.module.css";

const navigation = [
  { href: "/app/today", label: "Today", Icon: House },
  { href: "/app/opportunities", label: "Opportunities", Icon: Compass },
  { href: "/app/create/new", label: "Create", Icon: PencilSimple },
  { href: "/app/plan", label: "Plan", Icon: CalendarBlank },
  { href: "/app/learn", label: "Learn", Icon: BookOpen },
  { href: "/app/team", label: "Team", Icon: UsersThree },
] as const;

const mobileNavigation = navigation.slice(0, 4);

function NavigationLinks() {
  const pathname = usePathname();

  return navigation.map(({ href, label, Icon }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        aria-current={active ? "page" : undefined}
        className={styles.navLink}
        data-active={active}
        href={href}
        key={href}
      >
        <Icon aria-hidden="true" size={22} weight={active ? "fill" : "regular"} />
        <span>{label}</span>
      </Link>
    );
  });
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const creator = useMuseboardStore((state) => state.creator);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const moreSheetRef = useRef<HTMLElement>(null);
  const creatorName = creator?.name ?? "Sample creator";
  const creatorLane = creator?.contentPillars[0] ?? "Creator workspace";

  useEffect(() => {
    if (!moreOpen) return;
    const trigger = moreTriggerRef.current;
    const frame = window.requestAnimationFrame(() => {
      moreSheetRef.current?.querySelector<HTMLElement>("button, a[href]")?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      trigger?.focus();
    };
  }, [moreOpen]);

  function keepFocusInMoreSheet(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setMoreOpen(false);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]"),
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const moreActive = ["/app/learn", "/app/team", "/app/settings"].some(
    (href) => pathname.startsWith(href),
  );

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#workspace-main">
        Skip to workspace
      </a>
      <aside aria-label="Primary" className={styles.rail}>
        <Link className={styles.wordmark} href="/app/today">
          Museboard
        </Link>
        <nav className={styles.nav}>
          <NavigationLinks />
        </nav>
        <div className={styles.profile}>
          <Image
            alt=""
            className={styles.avatar}
            height={48}
            priority
            src="/assets/avatar-maya.png"
            width={48}
          />
          <span className={styles.profileCopy}>
            <strong>{creatorName}</strong>
            <small>{creatorLane}</small>
          </span>
        </div>
        <Link className={styles.settingsLink} href="/app/settings/billing">
          <GearSix aria-hidden="true" size={18} />
          Settings
        </Link>
      </aside>

      <header className={styles.mobileHeader}>
        <Link className={styles.mobileWordmark} href="/app/today">
          Museboard
        </Link>
        <Link aria-label="Team and profile" className={styles.mobileAvatarLink} href="/app/team">
          <Image alt="" height={36} src="/assets/avatar-maya.png" width={36} />
        </Link>
      </header>

      <main className={styles.main} id="workspace-main" tabIndex={-1}>{children}</main>

      <nav aria-label="Mobile primary" className={styles.mobileNav}>
        {mobileNavigation.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={styles.mobileNavLink}
              data-active={active}
              href={href}
              key={href}
            >
              <Icon aria-hidden="true" size={21} weight={active ? "fill" : "regular"} />
              <span>{label}</span>
            </Link>
          );
        })}
        <button
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          aria-label="More"
          className={styles.mobileNavLink}
          data-active={moreActive || moreOpen}
          onClick={() => setMoreOpen(true)}
          ref={moreTriggerRef}
          type="button"
        >
          <DotsThree aria-hidden="true" size={22} weight="bold" />
          <span>More</span>
        </button>
      </nav>

      {moreOpen ? (
        <div className={styles.sheetBackdrop} onMouseDown={() => setMoreOpen(false)}>
          <section
            aria-label="More Museboard destinations"
            aria-modal="true"
            className={styles.moreSheet}
            onKeyDown={keepFocusInMoreSheet}
            onMouseDown={(event) => event.stopPropagation()}
            ref={moreSheetRef}
            role="dialog"
          >
            <div className={styles.sheetHeading}>
              <div><small>Workspace</small><h2>More</h2></div>
              <button aria-label="Close More menu" onClick={() => setMoreOpen(false)} type="button">
                <X aria-hidden="true" size={22} />
              </button>
            </div>
            <nav aria-label="More destinations" className={styles.moreLinks}>
              <Link href="/app/learn" onClick={() => setMoreOpen(false)}><BookOpen aria-hidden="true" size={22} /><span><strong>Learn</strong><small>Turn measured results into patterns</small></span></Link>
              <Link href="/app/team" onClick={() => setMoreOpen(false)}><UsersThree aria-hidden="true" size={22} /><span><strong>Team</strong><small>Assignments, reviews, and collaborators</small></span></Link>
              <Link href="/app/settings/billing" onClick={() => setMoreOpen(false)}><GearSix aria-hidden="true" size={22} /><span><strong>Billing</strong><small>Plan and sample mode controls</small></span></Link>
              <Link href="/app/settings/data" onClick={() => setMoreOpen(false)}><ShieldCheck aria-hidden="true" size={22} /><span><strong>Data controls</strong><small>Export or clear this workspace</small></span></Link>
            </nav>
          </section>
        </div>
      ) : null}
    </div>
  );
}
