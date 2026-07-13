import type { Metadata } from "next";

import { DemoAccess } from "@/components/marketing/demo-access";

export const metadata: Metadata = { title: "Start a sample workspace" };

export default function SignupPage() {
  return <DemoAccess mode="signup" />;
}
