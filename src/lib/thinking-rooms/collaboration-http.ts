import { NextResponse } from "next/server";

import {
  ThinkingCollaborationConflictError,
  ThinkingCollaborationNotFoundError,
  ThinkingCollaborationPermissionError,
  ThinkingCollaborationValidationError,
} from "@/lib/thinking-rooms/presence-repository";

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export function collaborationErrorResponse(error: unknown) {
  if (error instanceof SyntaxError) return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400, headers: noStoreHeaders });
  if (error instanceof ThinkingCollaborationPermissionError) return NextResponse.json({ error: error.message }, { status: 403, headers: noStoreHeaders });
  if (error instanceof ThinkingCollaborationNotFoundError) return NextResponse.json({ error: error.message }, { status: 404, headers: noStoreHeaders });
  if (error instanceof ThinkingCollaborationConflictError) return NextResponse.json({ code: "collaboration_conflict", error: error.message }, { status: 409, headers: noStoreHeaders });
  if (error instanceof ThinkingCollaborationValidationError) return NextResponse.json({ error: error.message }, { status: 400, headers: noStoreHeaders });
  return undefined;
}

export const noStoreHeaders = { "Cache-Control": "private, no-store" };
