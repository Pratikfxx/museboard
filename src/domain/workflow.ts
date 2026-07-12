import type {
  ContentItem,
  ContentVersion,
  WorkflowStage,
} from "@/domain/schema";

export type WorkflowAction =
  | {
      type: "EDIT";
      field: "angle" | "hook" | "script";
      value: string;
      at: string;
    }
  | { type: "MOVE"; stage: WorkflowStage; at: string };

function currentVersion(item: ContentItem): ContentVersion {
  const version = item.versions.find(
    (candidate) => candidate.id === item.currentVersionId,
  );

  if (!version) {
    throw new Error(`Current version ${item.currentVersionId} does not exist`);
  }

  return version;
}

export function transitionStage(
  item: ContentItem,
  action: WorkflowAction,
): ContentItem {
  if (action.type === "MOVE") {
    return {
      ...item,
      stage: action.stage,
      updatedAt: action.at,
    };
  }

  const priorVersion = currentVersion(item);
  const number =
    Math.max(...item.versions.map((version) => version.number), 0) + 1;
  const version: ContentVersion = {
    ...priorVersion,
    id: `${item.id}-v${number}`,
    number,
    createdAt: action.at,
    ...(action.field === "angle" ? { angle: action.value } : {}),
    ...(action.field === "hook" ? { selectedHookId: action.value } : {}),
    ...(action.field === "script" ? { script: action.value } : {}),
  };

  return {
    ...item,
    currentVersionId: version.id,
    versions: [...item.versions, version],
    approval: item.approval
      ? { ...item.approval, status: "stale" }
      : undefined,
    updatedAt: action.at,
  };
}

export function approveCurrentVersion(
  item: ContentItem,
  approvedBy: string,
  approvedAt: string,
): ContentItem {
  currentVersion(item);

  return {
    ...item,
    approval: {
      status: "approved",
      versionId: item.currentVersionId,
      approvedBy,
      approvedAt,
    },
    updatedAt: approvedAt,
  };
}
