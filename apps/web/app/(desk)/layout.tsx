import { Shell } from "@/components/shell";
import { requireDesk } from "@/lib/guard";
import type { DeskData } from "@/lib/types";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const desk = await requireDesk();
  if (!desk) redirect("/login");
  const initialTheme = (await cookies()).get("radar-theme")?.value === "light" ? "light" : "dark";
  return <Shell desk={desk as unknown as DeskData} initialTheme={initialTheme}>{children}</Shell>;
}
