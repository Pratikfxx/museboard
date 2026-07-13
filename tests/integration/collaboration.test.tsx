import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { TeamWorkspace } from "@/components/collaboration/team-workspace";
import { seatLimitMessage } from "@/domain/collaboration";
import { createDemoState } from "@/lib/demo/fixtures";
import { useMuseboardStore } from "@/lib/store/museboard-store";

describe("creator team review", () => {
  beforeEach(() => {
    localStorage.clear();
    useMuseboardStore.getState().resetDemo();
  });

  it("counts active and pending seats, including the owner, against exact plan limits", () => {
    const store = useMuseboardStore.getState();
    useMuseboardStore.setState({
      entitlementUsage: { ...store.entitlementUsage, plan: "free" },
    });

    expect(useMuseboardStore.getState().inviteMember("new@example.com", "editor")).toMatchObject({
      ok: false,
      reason: "seat_limit",
      message: "Free includes 1 member including the owner. Upgrade to Pro for 2 seats or Studio for 6.",
    });

    useMuseboardStore.setState({
      entitlementUsage: { ...store.entitlementUsage, plan: "pro" },
      memberships: store.memberships.filter(({ role }) => role === "owner"),
    });
    expect(useMuseboardStore.getState().inviteMember("new@example.com", "editor")).toMatchObject({
      ok: true,
      delivery: "not_sent",
    });
    expect(useMuseboardStore.getState().inviteMember("third@example.com", "viewer")).toMatchObject({
      ok: false,
      reason: "seat_limit",
    });
    expect(seatLimitMessage("studio")).toMatch(/remove or revoke/i);
    expect(seatLimitMessage("studio")).not.toMatch(/upgrade to pro/i);

    useMuseboardStore.setState({
      entitlementUsage: { ...useMuseboardStore.getState().entitlementUsage, plan: "free" },
    });
    expect(useMuseboardStore.getState().assignStage({ contentId: "content-desk", stage: "review", reviewerMembershipId: "member-owner" })).toBe(false);
  });

  it("keeps append-only version approval history and invalidates review after an edit", () => {
    useMuseboardStore.setState({
      entitlementUsage: {
        ...useMuseboardStore.getState().entitlementUsage,
        plan: "studio",
      },
      approvals: [],
    });
    const contentId = useMuseboardStore.getState().content[0].id;
    const versionId = useMuseboardStore.getState().content[0].currentVersionId;

    expect(useMuseboardStore.getState().requestApproval(contentId, "member-sam")).toBe(true);
    useMuseboardStore.setState({
      memberships: useMuseboardStore.getState().memberships.map((member) =>
        member.id === "member-sam" ? { ...member, status: "removed" as const } : member,
      ),
    });
    expect(useMuseboardStore.getState().decideApproval(contentId, "approved", "Wrong actor.")).toBe(false);
    useMuseboardStore.setState({
      memberships: useMuseboardStore.getState().memberships.map((member) =>
        member.id === "member-sam" ? { ...member, status: "active" as const } : member,
      ),
    });
    expect(useMuseboardStore.getState().decideApproval(contentId, "approved", "Looks ready.")).toBe(true);
    expect(useMuseboardStore.getState().approvals.map(({ status }) => status)).toEqual([
      "requested",
      "approved",
    ]);

    expect(
      useMuseboardStore.getState().saveWorkshopVersion({
        contentId,
        patch: { script: "A later creator edit." },
        at: "2026-07-13T12:00:00.000Z",
      }),
    ).toBe(true);

    const state = useMuseboardStore.getState();
    expect(state.approvals.map(({ status }) => status)).toEqual([
      "requested",
      "approved",
      "stale",
    ]);
    expect(state.approvals.at(-1)?.versionId).toBe(versionId);
    expect(state.content[0].approval?.status).toBe("stale");
  });

  it("supports contextual comments and a visible review decision without claiming email delivery", async () => {
    const user = userEvent.setup();
    const demo = createDemoState();
    useMuseboardStore.setState({
      entitlementUsage: { ...demo.entitlementUsage, plan: "studio" },
    });
    render(<TeamWorkspace initialTab="review" />);

    expect(screen.getByText(/sample workspace · local collaboration/i)).toBeVisible();
    expect(screen.getByText(/approval needs review again/i)).toBeVisible();

    await user.type(screen.getByRole("textbox", { name: /add review comment/i }), "Tighten the final line @Sam");
    await user.click(screen.getByRole("button", { name: /post comment/i }));
    expect(screen.getByText("Tighten the final line @Sam")).toBeVisible();
    expect(useMuseboardStore.getState().notifications.at(-1)).toMatchObject({
      recipientMembershipId: "member-sam",
      href: expect.stringMatching(/version=.*&comment=/),
    });

    await user.click(screen.getByRole("button", { name: /request fresh review/i }));
    await user.click(screen.getByRole("button", { name: /^approve version/i }));
    expect(screen.getByText(/approved for this version/i)).toBeVisible();
  });
});
