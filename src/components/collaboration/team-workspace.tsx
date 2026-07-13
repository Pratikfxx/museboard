"use client";

import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle,
  ClockCounterClockwise,
  Crown,
  PaperPlaneTilt,
  UserPlus,
  UsersThree,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { occupiedSeatCount, seatLimitMessage } from "@/domain/collaboration";
import { PLAN_CATALOG } from "@/domain/entitlements";
import { useMuseboardStore } from "@/lib/store/museboard-store";

import styles from "./team.module.css";

type TeamTab = "people" | "review" | "inbox";

const tabMeta = {
  people: { label: "People", Icon: UsersThree },
  review: { label: "Review", Icon: CheckCircle },
  inbox: { label: "Inbox", Icon: Bell },
} as const;

export function TeamWorkspace({
  initialTab = "people",
  focusId,
}: {
  initialTab?: TeamTab;
  focusId?: string;
}) {
  const [tab, setTab] = useState<TeamTab>(initialTab);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p>Sample workspace · local collaboration</p>
          <h1>Team studio</h1>
          <span>Make the handoff as considered as the idea.</span>
        </div>
        <span className={styles.localBadge}>No emails are sent in demo mode</span>
      </header>

      <nav aria-label="Team workspace" className={styles.tabs}>
        {(Object.keys(tabMeta) as TeamTab[]).map((candidate) => {
          const { label, Icon } = tabMeta[candidate];
          return (
            <button
              aria-current={tab === candidate ? "page" : undefined}
              data-active={tab === candidate}
              key={candidate}
              onClick={() => setTab(candidate)}
              type="button"
            >
              <Icon aria-hidden="true" size={20} />
              {label}
            </button>
          );
        })}
      </nav>

      {tab === "people" ? <PeopleDesk focusId={focusId} /> : null}
      {tab === "review" ? <ReviewDesk /> : null}
      {tab === "inbox" ? <InboxDesk /> : null}
    </div>
  );
}

function PeopleDesk({ focusId }: { focusId?: string }) {
  const memberships = useMuseboardStore((state) => state.memberships);
  const assignments = useMuseboardStore((state) => state.assignments);
  const content = useMuseboardStore((state) => state.content);
  const plan = useMuseboardStore((state) => state.entitlementUsage.plan);
  const inviteMember = useMuseboardStore((state) => state.inviteMember);
  const updateInvitationStatus = useMuseboardStore((state) => state.updateInvitationStatus);
  const resendInvitation = useMuseboardStore((state) => state.resendInvitation);
  const removeMember = useMuseboardStore((state) => state.removeMember);
  const transferOwnership = useMuseboardStore((state) => state.transferOwnership);
  const assignStage = useMuseboardStore((state) => state.assignStage);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [message, setMessage] = useState("");
  const limit = PLAN_CATALOG[plan].members;
  const occupied = occupiedSeatCount(memberships);
  const activeMembers = memberships.filter(({ status }) => status === "active");
  const activeContent = content[0];
  const assignment = assignments.find(({ contentId }) => contentId === activeContent?.id);

  function submitInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = inviteMember(email, role);
    if (result.ok) {
      setMessage("Invite saved locally. No email was sent.");
      setEmail("");
    } else {
      setMessage(result.message);
    }
  }

  return (
    <div className={styles.peopleLayout}>
      <main>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.kicker}>Roster</p>
            <h2>{occupied} of {limit} seats in use</h2>
          </div>
          <span>{PLAN_CATALOG[plan].name} plan · owner included</span>
        </div>
        <div className={styles.roster}>
          {memberships.map((member) => (
            <article data-focus={focusId === member.id} key={member.id}>
              <div className={styles.initials} aria-hidden="true">
                {member.displayNameSnapshot.split(" ").map((part) => part[0]).slice(0, 2).join("")}
              </div>
              <div className={styles.personCopy}>
                <strong>{member.displayNameSnapshot}</strong>
                <span>{member.email}</span>
                {member.status === "removed" ? <small>Past activity still shows this name.</small> : null}
              </div>
              <div className={styles.personState}>
                <span data-status={member.status}>{member.status}</span>
                <small>{member.role}</small>
              </div>
              <div className={styles.personActions}>
                {member.status === "pending" ? (
                  <>
                    <button onClick={() => updateInvitationStatus(member.id, "active")} type="button">Activate sample</button>
                    <button onClick={() => updateInvitationStatus(member.id, "revoked")} type="button">Revoke</button>
                  </>
                ) : null}
                {["declined", "revoked", "expired"].includes(member.status) ? (
                  <button onClick={() => { const result = resendInvitation(member.id); setMessage(result.ok ? "Invite renewed locally. No email was sent." : seatLimitMessage(plan)); }} type="button">Resend locally</button>
                ) : null}
                {member.status === "active" && member.role !== "owner" ? (
                  <>
                    <button onClick={() => transferOwnership(member.id)} type="button"><Crown aria-hidden="true" size={16} /> Transfer ownership</button>
                    <button onClick={() => removeMember(member.id)} type="button">Remove</button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </main>

      <aside className={styles.peopleRail}>
        <form onSubmit={submitInvite}>
          <UserPlus aria-hidden="true" size={24} />
          <h2>Invite a collaborator</h2>
          <p>Pending invitations reserve a seat. This local demo records the invite but never claims delivery.</p>
          <label>Email<input aria-label="Collaborator email" onChange={(event) => setEmail(event.target.value)} placeholder="editor@example.com" type="email" value={email} /></label>
          <label>Role<select aria-label="Collaborator role" onChange={(event) => setRole(event.target.value as "editor" | "viewer")} value={role}><option value="editor">Editor</option><option value="viewer">Viewer</option></select></label>
          <button className={styles.primaryButton} type="submit">Save local invite <ArrowRight aria-hidden="true" size={18} /></button>
          <p aria-live="polite" className={styles.formMessage}>{message || (occupied >= limit ? seatLimitMessage(plan) : `${limit - occupied} seat${limit - occupied === 1 ? "" : "s"} available.`)}</p>
        </form>

        {activeContent ? (
          <section className={styles.assignmentDesk}>
            <p className={styles.kicker}>Current handoff</p>
            <h2>{activeContent.title}</h2>
            <label>Assignee<select aria-label="Stage assignee" onChange={(event) => assignStage({ contentId: activeContent.id, stage: "review", assigneeMembershipId: event.target.value || undefined, reviewerMembershipId: assignment?.reviewerMembershipId })} value={assignment?.assigneeMembershipId ?? ""}><option value="">Unassigned</option>{activeMembers.map((member) => <option key={member.id} value={member.id}>{member.displayNameSnapshot}</option>)}</select></label>
            <label>Reviewer<select aria-label="Stage reviewer" onChange={(event) => assignStage({ contentId: activeContent.id, stage: "review", assigneeMembershipId: assignment?.assigneeMembershipId, reviewerMembershipId: event.target.value || undefined })} value={assignment?.reviewerMembershipId ?? ""}><option value="">No reviewer</option>{activeMembers.map((member) => <option key={member.id} value={member.id}>{member.displayNameSnapshot}</option>)}</select></label>
          </section>
        ) : null}
      </aside>
    </div>
  );
}

function ReviewDesk() {
  const content = useMuseboardStore((state) => state.content);
  const memberships = useMuseboardStore((state) => state.memberships);
  const comments = useMuseboardStore((state) => state.reviewComments);
  const approvals = useMuseboardStore((state) => state.approvals);
  const plan = useMuseboardStore((state) => state.entitlementUsage.plan);
  const addReviewComment = useMuseboardStore((state) => state.addReviewComment);
  const toggleReviewComment = useMuseboardStore((state) => state.toggleReviewComment);
  const requestApproval = useMuseboardStore((state) => state.requestApproval);
  const decideApproval = useMuseboardStore((state) => state.decideApproval);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const item = content[0];
  const currentVersion = item?.versions.find(({ id }) => id === item.currentVersionId);
  const versionComments = comments.filter(({ contentId, versionId }) => contentId === item?.id && versionId === item?.currentVersionId);
  const latestApproval = useMemo(() => [...approvals].reverse().find(({ contentId }) => contentId === item?.id), [approvals, item?.id]);
  const reviewer = memberships.find(({ role, status }) => role !== "owner" && status === "active") ?? memberships.find(({ role, status }) => role === "owner" && status === "active");
  const enabled = PLAN_CATALOG[plan].commentsAndApprovals;

  if (!item || !currentVersion) {
    return <section className={styles.empty}><h2>No draft is waiting for review.</h2><Link href="/app/opportunities">Shape an opportunity</Link></section>;
  }

  function postComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (addReviewComment(item.id, body)) {
      setBody("");
      setMessage("Comment attached to this version.");
    } else {
      setMessage("Comments and approvals are available on Pro and Studio.");
    }
  }

  const approvalState = latestApproval?.versionId === item.currentVersionId ? latestApproval.status : "stale";

  return (
    <div className={styles.reviewLayout}>
      <main className={styles.reviewMain}>
        {approvalState === "stale" ? (
          <div className={styles.staleBanner} role="status"><ClockCounterClockwise aria-hidden="true" size={22} /><div><strong>Approval needs review again</strong><span>The draft changed after the last decision. Comments remain on their original versions.</span></div></div>
        ) : null}
        <div className={styles.reviewHeader}>
          <div><p className={styles.kicker}>Version {currentVersion.number} · {item.stage}</p><h2>{item.title}</h2></div>
          <Link href={`/app/create/${item.id}?stage=review&version=${item.currentVersionId}`}>Open full workshop <ArrowRight aria-hidden="true" size={18} /></Link>
        </div>
        <article className={styles.manuscript}>
          <blockquote>{currentVersion.selectedHookText ?? "A calm opening is still being shaped."}</blockquote>
          <p>{currentVersion.script || "The script is ready for the team to shape together."}</p>
          <small>Review is bound to immutable version {currentVersion.number}</small>
        </article>

        <section className={styles.comments}>
          <div className={styles.sectionHeading}><div><p className={styles.kicker}>Margin notes</p><h2>{versionComments.filter(({ resolvedAt }) => !resolvedAt).length} open comments</h2></div></div>
          {versionComments.length ? versionComments.map((comment) => (
            <article data-resolved={Boolean(comment.resolvedAt)} key={comment.id}>
              <div><strong>{comment.authorDisplayNameSnapshot}</strong><small>{comment.resolvedAt ? "Resolved" : `On version ${currentVersion.number}`}</small></div>
              <p>{comment.body}</p>
              <button onClick={() => toggleReviewComment(comment.id)} type="button">{comment.resolvedAt ? "Reopen" : "Resolve"}</button>
            </article>
          )) : <p className={styles.emptyNote}>No notes on this version yet. Add only feedback that helps the next decision.</p>}
          <form className={styles.commentForm} onSubmit={postComment}>
            <label>Add review comment<textarea aria-label="Add review comment" onChange={(event) => setBody(event.target.value)} placeholder="Write a precise note. Mention @Sam to create an inbox item." rows={4} value={body} /></label>
            <button className={styles.primaryButton} disabled={!body.trim()} type="submit"><PaperPlaneTilt aria-hidden="true" size={18} /> Post comment</button>
          </form>
          <p aria-live="polite" className={styles.formMessage}>{message}</p>
        </section>
      </main>

      <aside className={styles.decisionRail}>
        <p className={styles.kicker}>Decision</p>
        <h2>{approvalState === "approved" ? "Approved for this version" : approvalState === "changes_requested" ? "Changes requested" : approvalState === "requested" ? "Review requested" : "Fresh review needed"}</h2>
        <p>{enabled ? "A decision applies only to this immutable version." : "Upgrade to Pro or Studio to request and record version-bound approvals."}</p>
        {approvalState !== "requested" ? <button className={styles.primaryButton} disabled={!enabled || !reviewer} onClick={() => reviewer && requestApproval(item.id, reviewer.id)} type="button">Request fresh review</button> : null}
        {approvalState === "requested" ? (
          <div className={styles.decisionButtons}>
            <button className={styles.approveButton} onClick={() => decideApproval(item.id, "approved", "Approved in the team desk.")} type="button"><Check aria-hidden="true" size={18} /> Approve version</button>
            <button onClick={() => decideApproval(item.id, "changes_requested", "Please address the open margin notes.")} type="button"><X aria-hidden="true" size={18} /> Request changes</button>
          </div>
        ) : null}
        <ol className={styles.approvalHistory}>
          {approvals.filter(({ contentId }) => contentId === item.id).map((event) => <li key={event.id}><span data-status={event.status}>{event.status.replace("_", " ")}</span><small>{event.actorDisplayNameSnapshot} · Version {item.versions.find(({ id }) => id === event.versionId)?.number ?? "archived"}</small></li>)}
        </ol>
      </aside>
    </div>
  );
}

function InboxDesk() {
  const notifications = useMuseboardStore((state) => state.notifications);
  const ownerId = useMuseboardStore((state) => state.memberships.find(({ role }) => role === "owner")?.id);
  const openNotification = useMuseboardStore((state) => state.openNotification);
  const inbox = notifications.filter(({ recipientMembershipId }) => !recipientMembershipId || recipientMembershipId === ownerId);

  return (
    <div className={styles.inbox}>
      <div className={styles.sectionHeading}><div><p className={styles.kicker}>Exact destinations</p><h2>Review inbox</h2></div><span>{inbox.filter(({ readAt }) => !readAt).length} unread</span></div>
      {inbox.length ? inbox.map((notification) => (
        <Link data-read={Boolean(notification.readAt)} href={notification.href} key={notification.id} onClick={() => openNotification(notification.id, notification.href)}>
          <span className={styles.notificationIcon}>{notification.kind === "review" ? <CheckCircle aria-hidden="true" size={21} /> : notification.kind === "mention" ? <PaperPlaneTilt aria-hidden="true" size={21} /> : notification.kind === "assignment" ? <UsersThree aria-hidden="true" size={21} /> : <Bell aria-hidden="true" size={21} />}</span>
          <span><strong>{notification.title}</strong><small>{notification.detail}</small><em>{notification.readAt ? "Read" : "Unread"}</em></span>
          <ArrowRight aria-hidden="true" size={19} />
        </Link>
      )) : <div className={styles.empty}><CheckCircle aria-hidden="true" size={32} /><h2>Nothing needs your eye.</h2><p>Assignments, mentions, reviews, and team changes will land here with an exact destination.</p></div>}
      <div className={styles.inboxNote}><WarningCircle aria-hidden="true" size={19} /><span>A notification is marked read only when its saved destination opens from this inbox.</span></div>
    </div>
  );
}
