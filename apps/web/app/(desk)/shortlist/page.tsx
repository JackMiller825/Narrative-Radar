import { ShortlistBoard } from "@/components/shortlist-board";
import { requireDesk } from "@/lib/guard";
import type { DeskData } from "@/lib/types";
export default async function ShortlistPage() {
  const desk = await requireDesk();
  return <ShortlistBoard narratives={(desk as unknown as DeskData).narratives} />;
}
