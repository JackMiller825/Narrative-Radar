import { AlertsDesk } from "./client";
import { requireDesk } from "@/lib/guard";
import type { DeskData } from "@/lib/types";
export default async function AlertsPage() {
  const desk = await requireDesk();
  return <AlertsDesk desk={desk as unknown as DeskData} />;
}
