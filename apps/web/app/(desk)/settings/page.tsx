import { SettingsForm } from "./client";
import { requireDesk } from "@/lib/guard";
import type { DeskData } from "@/lib/types";
export default async function SettingsPage() {
  const desk = await requireDesk();
  return <SettingsForm desk={desk as unknown as DeskData} />;
}
