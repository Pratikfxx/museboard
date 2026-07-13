import type { Metadata } from "next";
import { Instrument_Serif, Manrope } from "next/font/google";
import Script from "next/script";
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
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <Script src="/theme-init.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
