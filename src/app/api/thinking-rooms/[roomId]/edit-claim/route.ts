import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { collaborationErrorResponse, isSameOrigin, noStoreHeaders } from "@/lib/thinking-rooms/collaboration-http";
import { createThinkingRoomPresenceRepository } from "@/lib/thinking-rooms/presence-repository";
import type { SupabaseThinkingRoomClient } from "@/lib/thinking-rooms/repository";

export async function PUT(request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed" }, { status: 403, headers: noStoreHeaders });
    const workspace = await getAuthenticatedWorkspace();
    if (!workspace) return NextResponse.json({ error: "Sign in to claim this edit" }, { status: 401, headers: noStoreHeaders });
    if (workspace.role === "viewer") return NextResponse.json({ error: "Viewers cannot edit contributions" }, { status: 403, headers: noStoreHeaders });
    const roomId = z.uuid().parse((await context.params).roomId);
    const body = z.object({ contributionId: z.uuid(), sessionId: z.uuid(), active: z.boolean() }).strict().parse(await request.json());
    const repository = createThinkingRoomPresenceRepository(await createClient() as unknown as SupabaseThinkingRoomClient);
    const claim = await repository.setClaim({ organizationId: workspace.organizationId, roomId, ...body });
    return NextResponse.json({ claim }, { headers: noStoreHeaders });
  } catch (error) {
    const mapped = collaborationErrorResponse(error);
    if (mapped) return mapped;
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Edit claim data is invalid" }, { status: 400, headers: noStoreHeaders });
    return NextResponse.json({ error: "Edit claim could not be changed" }, { status: 500, headers: noStoreHeaders });
  }
}
