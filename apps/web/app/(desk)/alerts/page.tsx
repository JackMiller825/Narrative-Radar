import { AlertsDesk } from "./client";
import { requireDesk } from "@/lib/guard";
import type { DeskData } from "@/lib/types";
import { redirect } from "next/navigation";

export default async function AlertsPage() {
  const desk = await requireDesk();
  if (!desk) redirect("/login");
  return <AlertsDesk desk={desk as unknown as DeskData} />;
}
