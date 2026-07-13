import type { Metadata } from "next";

import { AccountDataWorkspace } from "@/components/account/account-data-workspace";

export const metadata: Metadata = {
  title: "Data settings · Museboard",
};

export default function DataSettingsPage() {
  return <AccountDataWorkspace />;
}
