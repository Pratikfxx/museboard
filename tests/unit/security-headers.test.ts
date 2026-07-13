import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("application security headers", () => {
  it("applies the sellable baseline without enabling HSTS on local builds", async () => {
    const rules = await nextConfig.headers?.();
    const values = Object.fromEntries(
      (rules?.find(({ source }) => source === "/(.*)")?.headers ?? []).map(
        ({ key, value }) => [key, value],
      ),
    );

    expect(values).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
    expect(values).not.toHaveProperty("Strict-Transport-Security");
  });
});
