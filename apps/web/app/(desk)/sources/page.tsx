import { SourcesDesk } from "./client";
import { requireDesk } from "@/lib/guard";
import type { DeskData } from "@/lib/types";
export default async function SourcesPage() {
  const desk = await requireDesk();
  return <SourcesDesk desk={desk as unknown as DeskData} />;
}
