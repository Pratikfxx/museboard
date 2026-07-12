import type { Metadata } from "next";
import { Instrument_Serif, Manrope } from "next/font/google";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/ui/theme-provider";

import "./globals.css";

const displayFont = Instrument_Serif({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  weight: "400",
});

const productFont = Manrope({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-manrope",
});

const themeBootstrapScript = `
(() => {
  const key = "museboard-theme";
  let preference = "system";
  try {
    const stored = localStorage.getItem(key);
    if (stored === "light" || stored === "dark" || stored === "system") {
      preference = stored;
    }
  } catch {}
  const darkSystem = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  const theme = preference === "system" ? (darkSystem ? "dark" : "light") : preference;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
`;

export const metadata: Metadata = {
  title: {
    default: "Museboard",
    template: "%s · Museboard",
  },
  description: "A creator operating system for turning signals into published work.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      className={`${displayFont.variable} ${productFont.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
