import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: "Narrative Radar",
  description: "A private research desk for emerging token narrative ideas. Scores describe signals and creative fit, not expected returns.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("radar-theme")?.value === "light" ? "light" : "dark";
  const className = [theme === "dark" ? "dark" : "", outfit.variable, fraunces.variable].filter(Boolean).join(" ");
  return (
    <html lang="en" className={className}>
      <body>{children}</body>
    </html>
  );
}
