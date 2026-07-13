import { THEME_BOOTSTRAP_SCRIPT } from "@/components/ui/theme-bootstrap";

export function GET() {
  return new Response(THEME_BOOTSTRAP_SCRIPT, {
    headers: {
      "cache-control": "no-store",
      "content-type": "text/javascript; charset=utf-8",
    },
  });
}
