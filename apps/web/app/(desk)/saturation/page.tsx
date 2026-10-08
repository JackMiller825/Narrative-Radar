import { SaturationDesk } from "./client";
import { requireDesk } from "@/lib/guard";
import type { DeskData } from "@/lib/types";

export default async function SaturationPage() {
  const desk = await requireDesk();
  return <SaturationDesk narratives={(desk as unknown as DeskData).narratives} />;
}
