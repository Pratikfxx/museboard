import type { Metadata } from "next";

import { DemoAccess } from "@/components/marketing/demo-access";

export const metadata: Metadata = { title: "Sample access" };

export default function LoginPage() {
  return <DemoAccess mode="login" />;
}
