import { NextResponse } from "next/server";
import { z } from "zod";

import { thinkingRoomPresenceAreaSchema } from "@/domain/thinking-room-presence";
import { getAuthenticatedWorkspace } from "@/lib/auth/workspace";
import { collaborationErrorResponse, isSameOrigin, noStoreHeaders } from "@/lib/thinking-rooms/collaboration-http";
import { createThinkingRoomPresenceRepository } from "@/lib/thinking-rooms/presence-repository";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseThinkingRoomClient } from "@/lib/thinking-rooms/repository";

interface Context { params: Promise<{ roomId: string }> }

export async function POST(request: Request, context: Context) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed" }, { status: 403, headers: noStoreHeaders });
    const workspace = await getAuthenticatedWorkspace();
    if (!workspace) return NextResponse.json({ error: "Sign in to share presence" }, { status: 401, headers: noStoreHeaders });
    const roomId = z.uuid().parse((await context.params).roomId);
    const body = z.object({ sessionId: z.uuid(), area: thinkingRoomPresenceAreaSchema, isComposing: z.boolean() }).strict().parse(await request.json());
    const repository = createThinkingRoomPresenceRepository(await createClient() as unknown as SupabaseThinkingRoomClient);
    const snapshot = await repository.sync({ organizationId: workspace.organizationId, roomId, sessionId: body.sessionId, area: body.area, isComposing: body.isComposing });
    return NextResponse.json(snapshot, { headers: noStoreHeaders });
  } catch (error) {
    const mapped = collaborationErrorResponse(error);
    if (mapped) return mapped;
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Presence data is invalid" }, { status: 400, headers: noStoreHeaders });
    return NextResponse.json({ error: "Presence could not be synchronized" }, { status: 500, headers: noStoreHeaders });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed" }, { status: 403, headers: noStoreHeaders });
    const workspace = await getAuthenticatedWorkspace();
    if (!workspace) return NextResponse.json({ error: "Sign in to leave presence" }, { status: 401, headers: noStoreHeaders });
    const roomId = z.uuid().parse((await context.params).roomId);
    const body = z.object({ sessionId: z.uuid() }).strict().parse(await request.json());
    const repository = createThinkingRoomPresenceRepository(await createClient() as unknown as SupabaseThinkingRoomClient);
    await repository.leave({ organizationId: workspace.organizationId, roomId, sessionId: body.sessionId });
    return new NextResponse(null, { status: 204, headers: noStoreHeaders });
  } catch (error) {
    const mapped = collaborationErrorResponse(error);
    if (mapped) return mapped;
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Presence data is invalid" }, { status: 400, headers: noStoreHeaders });
    return NextResponse.json({ error: "Presence could not be cleared" }, { status: 500, headers: noStoreHeaders });
  }
}
