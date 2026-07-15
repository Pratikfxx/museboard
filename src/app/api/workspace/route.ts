import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import {
  createSupabaseWorkspaceSnapshotStore,
  entitlementResetAt,
  loadCanonicalWorkspace,
  saveCanonicalWorkspace,
  WorkspaceRevisionConflictError,
  type SupabaseWorkspaceSnapshotClient,
} from "@/lib/workspace/repository";
import { workspaceSnapshotSaveSchema } from "@/lib/workspace/snapshot";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

function authority(workspace: NonNullable<Awaited<ReturnType<typeof getAuthenticatedWorkspace>>>) {
  return {
    userId: workspace.userId,
    email: workspace.email,
    displayName: workspace.displayName,
    plan: workspace.plan,
    resetAt: entitlementResetAt(workspace.plan),
  };
}

async function authenticatedContext() {
  const workspace = await getAuthenticatedWorkspace();
  if (!workspace) return null;
  const supabase = await createClient();
  const store = createSupabaseWorkspaceSnapshotStore(
    supabase as unknown as SupabaseWorkspaceSnapshotClient,
  );
  return { workspace, store };
}

export async function GET(request?: Request) {
  void request;
  try {
    const context = await authenticatedContext();
    if (!context) {
      return NextResponse.json({ error: "Sign in to load this workspace" }, { status: 401 });
    }
    const snapshot = await loadCanonicalWorkspace(
      context.store,
      context.workspace.organizationId,
      authority(context.workspace),
    );
    if (!snapshot) {
      return NextResponse.json({ workspace: null }, { status: 404 });
    }
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Workspace could not be loaded" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!sameOrigin(request)) {
      return NextResponse.json({ error: "Request origin is not allowed" }, { status: 403 });
    }
    const input = workspaceSnapshotSaveSchema.parse(await request.json());
    const context = await authenticatedContext();
    if (!context) {
      return NextResponse.json({ error: "Sign in to save this workspace" }, { status: 401 });
    }
    if (
      input.organizationId !== context.workspace.organizationId ||
      !["owner", "editor"].includes(context.workspace.role)
    ) {
      return NextResponse.json({ error: "You cannot edit this workspace" }, { status: 403 });
    }
    const snapshot = await saveCanonicalWorkspace(
      context.store,
      input,
      authority(context.workspace),
    );
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof WorkspaceRevisionConflictError) {
      return NextResponse.json(
        { code: "revision_conflict", error: error.message },
        { status: 409 },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Workspace data is invalid" }, { status: 400 });
    }
    return NextResponse.json({ error: "Workspace could not be saved" }, { status: 500 });
  }
}
