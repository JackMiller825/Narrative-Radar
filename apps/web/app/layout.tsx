import { readInitialTheme } from "@/lib/theme";
import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: "Narrative Radar",
  description: "A private research desk for emerging token narrative ideas. Scores describe signals and creative fit, not expected returns.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await readInitialTheme();
  const className = [theme === "dark" ? "dark" : "", outfit.variable, fraunces.variable].filter(Boolean).join(" ");
  const published = process.env.GITHUB_PAGES === "1";
  return (
    <html lang="en" className={className} data-pages={published ? "static" : undefined}>
      <body>{children}</body>
    </html>
  );
}
