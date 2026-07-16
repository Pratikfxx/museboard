import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import {
  createSupabaseThinkingRoomRepository,
  ThinkingRoomNotFoundError,
  ThinkingRoomPermissionError,
  ThinkingRoomRevisionConflictError,
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

export async function POST(request: Request, routeContext: RoomRouteContext) {
  try {
    if (!sameOrigin(request)) {
      return NextResponse.json({ error: "Request origin is not allowed" }, { status: 403 });
    }
    const { roomId } = await routeContext.params;
    z.uuid().parse(roomId);
    const workspace = await getAuthenticatedWorkspace();
    if (!workspace) {
      return NextResponse.json({ error: "Sign in to create this direction" }, { status: 401 });
    }
    if (workspace.role === "viewer") {
      return NextResponse.json({ error: "You cannot create a direction from this room" }, { status: 403 });
    }
    const body = z.object({
      synthesisRevisionId: z.uuid(),
      ideaId: z.uuid(),
      expectedRevision: z.number().int().positive(),
    }).parse(await request.json());
    const supabase = await createClient();
    const repository = createSupabaseThinkingRoomRepository(
      supabase as unknown as SupabaseThinkingRoomClient,
    );
    const result = await repository.convert({
      organizationId: workspace.organizationId,
      roomId,
      ...body,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof ThinkingRoomRevisionConflictError) {
      return NextResponse.json(
        { code: "revision_conflict", error: error.message },
        { status: 409 },
      );
    }
    if (error instanceof ThinkingRoomPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ThinkingRoomNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof z.ZodError || error instanceof ThinkingRoomValidationError) {
      return NextResponse.json({ error: "Conversion data is invalid" }, { status: 400 });
    }
    return NextResponse.json({ error: "The direction could not be created" }, { status: 500 });
  }
}
