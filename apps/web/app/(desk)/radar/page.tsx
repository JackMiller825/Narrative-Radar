import { RadarApp } from "@/components/radar-app";
import { requireDesk } from "@/lib/guard";
import type { DeskData } from "@/lib/types";
export default async function RadarPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const desk = await requireDesk();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  return <RadarApp key={query} desk={desk as unknown as DeskData} now={new Date().toISOString()} initialQuery={query} />;
}
