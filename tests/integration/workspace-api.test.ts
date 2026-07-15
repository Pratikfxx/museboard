import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDemoState } from "@/lib/demo/fixtures";

const mocks = vi.hoisted(() => ({
  getAuthenticatedWorkspace: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  getAuthenticatedWorkspace: mocks.getAuthenticatedWorkspace,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { GET, PUT } from "@/app/api/workspace/route";

const organizationId = "4f0b3ec4-d507-4726-974c-9b1ea51f73b9";
const owner = {
  userId: "8fef70b0-c52b-4312-b6e7-8fac5ed73510",
  email: "maya@example.com",
  organizationId,
  organizationName: "Maya's studio",
  organizationSlug: "maya-studio",
  role: "owner",
  displayName: "Maya Chen",
  plan: "creator",
};

function request(method: "GET" | "PUT", body?: unknown) {
  return new Request("http://localhost/api/workspace", {
    method,
    headers: {
      Origin: "http://localhost",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("authenticated workspace snapshot API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedWorkspace.mockResolvedValue(owner);
  });

  it("fails closed without an authenticated workspace", async () => {
    mocks.getAuthenticatedWorkspace.mockResolvedValue(null);
    const response = await GET(request("GET"));
    expect(response.status).toBe(401);
  });

  it("rejects cross-organization and viewer writes before touching storage", async () => {
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue({ from: vi.fn(), rpc });

    const crossOrganization = await PUT(request("PUT", {
      organizationId: "a1bc23da-e517-49a5-9392-2b056d77ceec",
      expectedRevision: 0,
      payload: createDemoState(),
    }));
    expect(crossOrganization.status).toBe(403);

    mocks.getAuthenticatedWorkspace.mockResolvedValue({ ...owner, role: "viewer" });
    const viewer = await PUT(request("PUT", {
      organizationId,
      expectedRevision: 0,
      payload: createDemoState(),
    }));
    expect(viewer.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("persists a server-normalized creator workspace and returns its revision", async () => {
    const rpc = vi.fn(async () => ({ data: 1, error: null }));
    mocks.createClient.mockResolvedValue({ from: vi.fn(), rpc });

    const response = await PUT(request("PUT", {
      organizationId,
      expectedRevision: 0,
      payload: createDemoState(),
    }));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({ revision: 1, payload: { dataMode: "live" } });
    expect(rpc).toHaveBeenCalledWith("save_workspace_snapshot", expect.objectContaining({
      p_organization_id: organizationId,
      p_expected_revision: 0,
      p_payload: expect.objectContaining({
        dataMode: "live",
        entitlementUsage: expect.objectContaining({ plan: "creator" }),
      }),
    }));
  });

  it("returns a recoverable conflict without overwriting newer data", async () => {
    mocks.createClient.mockResolvedValue({
      from: vi.fn(),
      rpc: vi.fn(async () => ({
        data: null,
        error: { code: "40001", message: "workspace revision conflict" },
      })),
    });

    const response = await PUT(request("PUT", {
      organizationId,
      expectedRevision: 2,
      payload: createDemoState(),
    }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "revision_conflict" });
  });
});
