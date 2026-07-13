import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DataPolicyPage from "@/app/data-policy/page";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { ThemeProvider } from "@/components/ui/theme-provider";

const DRAFT_BANNER = "Pre-launch draft · pending legal review";

describe("legal trust surfaces", () => {
  it.each([
    ["Privacy", PrivacyPage],
    ["Terms", TermsPage],
    ["Data policy", DataPolicyPage],
  ])("labels the %s page as an unapproved pre-launch draft", (_name, Page) => {
    render(<Page />);

    expect(screen.getByText(DRAFT_BANNER)).toBeInTheDocument();
    expect(screen.getByText(/not legal advice or a final legal agreement/i)).toBeInTheDocument();
    expect(screen.queryByText(/effective date/i)).not.toBeInTheDocument();
  });

  it("explains sample mode, configured providers, AI data use, export, deletion, and support status", () => {
    render(<DataPolicyPage />);

    expect(screen.getByRole("heading", { name: /sample workspace and configured services/i })).toBeInTheDocument();
    expect(screen.getByText(/sample workspace data stays in this browser/i)).toBeInTheDocument();
    expect(screen.getByText(/supabase and stripe/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /how ai uses creator inputs/i })).toBeInTheDocument();
    expect(screen.getByText(/not used by museboard to train a shared model/i)).toBeInTheDocument();
    expect(screen.getByText(/export and deletion controls/i)).toBeInTheDocument();
    expect(screen.getAllByText(/support channel is not yet published/i)).not.toHaveLength(0);
  });

  it("sets transparent creator responsibilities and commercial expectations", () => {
    render(<TermsPage />);

    expect(screen.getByText(/you keep ownership of your original content/i)).toBeInTheDocument();
    expect(screen.getByText(/sponsorship, affiliate, and material-connection disclosures/i)).toBeInTheDocument();
    expect(screen.getByText(/launch assumption is for people aged 13 or older/i)).toBeInTheDocument();
    expect(screen.getByText(/cancellation takes effect at the end of the current paid billing period/i)).toBeInTheDocument();
  });

  it("provides semantic cross-navigation and a clear return to the product", () => {
    render(<PrivacyPage />);

    const nav = screen.getByRole("navigation", { name: /legal documents/i });
    expect(within(nav).getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(within(nav).getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(within(nav).getByRole("link", { name: "Data policy" })).toHaveAttribute("href", "/data-policy");
    expect(screen.getByRole("link", { name: /back to museboard/i })).toHaveAttribute("href", "/");
  });

  it("keeps every trust document reachable from the public product footer", () => {
    render(<ThemeProvider><MarketingShell><main>Product</main></MarketingShell></ThemeProvider>);
    const footer = screen.getByRole("navigation", { name: "Footer" });

    expect(within(footer).getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(within(footer).getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(within(footer).getByRole("link", { name: "Data policy" })).toHaveAttribute("href", "/data-policy");
  });
});
