import { NextResponse } from "next/server";
import { z } from "zod";

import { contributionReactionKindSchema } from "@/domain/thinking-rooms";
import { getAuthenticatedWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import {
  createSupabaseThinkingRoomRepository,
  ThinkingRoomNotFoundError,
  ThinkingRoomPermissionError,
  ThinkingRoomValidationError,
  type SupabaseThinkingRoomClient,
} from "@/lib/thinking-rooms/repository";

interface RoomRouteContext {
  params: Promise<{ roomId: string }>;
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export async function PUT(request: Request, routeContext: RoomRouteContext) {
  try {
    if (!sameOrigin(request)) {
      return NextResponse.json({ error: "Request origin is not allowed" }, { status: 403 });
    }
    const { roomId } = await routeContext.params;
    z.uuid().parse(roomId);
    const workspace = await getAuthenticatedWorkspace();
    if (!workspace) {
      return NextResponse.json({ error: "Sign in to react in this Thinking Room" }, { status: 401 });
    }
    const body = z.object({
      contributionId: z.uuid(),
      kind: contributionReactionKindSchema,
      active: z.boolean(),
      reactionId: z.uuid(),
    }).parse(await request.json());
    const supabase = await createClient();
    const repository = createSupabaseThinkingRoomRepository(
      supabase as unknown as SupabaseThinkingRoomClient,
    );
    const result = await repository.setReaction({
      organizationId: workspace.organizationId,
      roomId,
      contributionId: body.contributionId,
      kind: body.kind,
      active: body.active,
      reactionId: body.reactionId,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof ThinkingRoomPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ThinkingRoomNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ThinkingRoomValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Reaction data is invalid" }, { status: 400 });
    }
    return NextResponse.json({ error: "Reaction could not be saved" }, { status: 500 });
  }
}
