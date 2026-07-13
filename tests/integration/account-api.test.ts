import { describe, expect, it } from "vitest";

import { POST as deleteAccount } from "@/app/api/account/delete/route";
import { POST as exportAccount } from "@/app/api/account/export/route";

describe("account job API boundaries", () => {
  it.each([
    ["export", exportAccount],
    ["delete", deleteAccount],
  ])("fails closed for %s until authenticated persistence exists", async (_name, handler) => {
    const response = await handler();

    expect(response.status).toBe(409);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      error: "sample_local_only",
      retryable: false,
    });
  });
});
