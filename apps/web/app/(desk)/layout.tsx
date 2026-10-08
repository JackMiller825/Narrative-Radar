import { Shell } from "@/components/shell";
import { requireDesk } from "@/lib/guard";
import { readInitialTheme } from "@/lib/theme";
import type { DeskData } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const desk = await requireDesk();
  const initialTheme = await readInitialTheme();
  return (
    <Shell desk={desk as unknown as DeskData} initialTheme={initialTheme} published={process.env.GITHUB_PAGES === "1"}>
      {children}
    </Shell>
  );
}
