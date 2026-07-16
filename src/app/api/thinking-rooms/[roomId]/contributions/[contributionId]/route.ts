import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { collaborationErrorResponse, isSameOrigin, noStoreHeaders } from "@/lib/thinking-rooms/collaboration-http";
import { ThinkingCollaborationConflictError, createThinkingRoomPresenceRepository } from "@/lib/thinking-rooms/presence-repository";
import { createSupabaseThinkingRoomRepository, type SupabaseThinkingRoomClient } from "@/lib/thinking-rooms/repository";

export async function PATCH(request: Request, context: { params: Promise<{ roomId: string; contributionId: string }> }) {
  let organizationId: string | undefined;
  let roomId: string | undefined;
  let contributionId: string | undefined;
  let client: SupabaseThinkingRoomClient | undefined;
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed" }, { status: 403, headers: noStoreHeaders });
    const workspace = await getAuthenticatedWorkspace();
    if (!workspace) return NextResponse.json({ error: "Sign in to edit this contribution" }, { status: 401, headers: noStoreHeaders });
    if (workspace.role === "viewer") return NextResponse.json({ error: "Viewers cannot edit contributions" }, { status: 403, headers: noStoreHeaders });
    organizationId = workspace.organizationId;
    const params = await context.params;
    roomId = z.uuid().parse(params.roomId);
    contributionId = z.uuid().parse(params.contributionId);
    const body = z.object({ sessionId: z.uuid(), expectedRevision: z.number().int().positive(), body: z.string().trim().min(1).max(20000), sourceReferenceId: z.string().trim().min(1).max(2000).optional() }).strict().parse(await request.json());
    client = await createClient() as unknown as SupabaseThinkingRoomClient;
    const result = await createThinkingRoomPresenceRepository(client).edit({ organizationId, roomId, contributionId, ...body });
    return NextResponse.json(result, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof ThinkingCollaborationConflictError && organizationId && roomId && contributionId && client) {
      const aggregate = await createSupabaseThinkingRoomRepository(client).load(organizationId, roomId);
      const latestContribution = aggregate?.contributions.find(({ id }) => id === contributionId);
      return NextResponse.json({ code: "edit_conflict", error: error.message, latestContribution }, { status: 409, headers: noStoreHeaders });
    }
    const mapped = collaborationErrorResponse(error);
    if (mapped) return mapped;
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Contribution edit data is invalid" }, { status: 400, headers: noStoreHeaders });
    return NextResponse.json({ error: "Contribution could not be edited" }, { status: 500, headers: noStoreHeaders });
  }
}
