import { ShortlistBoard } from "@/components/shortlist-board";
import { requireDesk } from "@/lib/guard";
import type { DeskData } from "@/lib/types";
import { redirect } from "next/navigation";

export default async function ShortlistPage() {
  const desk = await requireDesk();
  if (!desk) redirect("/login");
  return <ShortlistBoard narratives={(desk as unknown as DeskData).narratives} />;
}
