import type { Metadata } from "next";

import { TodayWorkspace } from "@/components/today/today-workspace";

export const metadata: Metadata = {
  title: "Today",
  description: "Choose one strong hook and protect a realistic creative week.",
};

export default function TodayPage() {
  return <TodayWorkspace />;
}
