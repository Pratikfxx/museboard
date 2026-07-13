"use client";

import {
  BookOpen,
  CalendarBlank,
  Compass,
  GearSix,
  House,
  PencilSimple,
  UsersThree,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

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

function NavigationLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const links = mobile ? navigation.slice(0, 5) : navigation;

  return links.map(({ href, label, Icon }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        aria-current={active ? "page" : undefined}
        className={mobile ? styles.mobileNavLink : styles.navLink}
        data-active={active}
        href={href}
        key={href}
      >
        <Icon aria-hidden="true" size={mobile ? 21 : 22} weight={active ? "fill" : "regular"} />
        <span>{label}</span>
      </Link>
    );
  });
}

export function AppShell({ children }: { children: ReactNode }) {
  const creator = useMuseboardStore((state) => state.creator);
  const creatorName = creator?.name ?? "Sample creator";
  const creatorLane = creator?.contentPillars[0] ?? "Creator workspace";

  return (
    <div className={styles.shell}>
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

      <main className={styles.main}>{children}</main>

      <nav aria-label="Mobile primary" className={styles.mobileNav}>
        <NavigationLinks mobile />
      </nav>
    </div>
  );
}
