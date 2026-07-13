import { describe, expect, it } from "vitest";

import { GET } from "@/app/theme-init.js/route";
import { THEME_BOOTSTRAP_SCRIPT } from "@/components/ui/theme-bootstrap";

describe("theme bootstrap route", () => {
  it("serves the shared bootstrap as executable no-store JavaScript", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/javascript; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe(THEME_BOOTSTRAP_SCRIPT);
  });
});
