import { SourcesDesk } from "./client";
import { requireDesk } from "@/lib/guard";
import type { DeskData } from "@/lib/types";
import { redirect } from "next/navigation";

export default async function SourcesPage() {
  const desk = await requireDesk();
  if (!desk) redirect("/login");
  return <SourcesDesk desk={desk as unknown as DeskData} />;
}
