import { RadarApp } from "@/components/radar-app";
import { requireDesk } from "@/lib/guard";
import type { DeskData } from "@/lib/types";
export default async function RadarPage() {
  const desk = await requireDesk();
  return <RadarApp desk={desk as unknown as DeskData} now={new Date().toISOString()} />;
}
