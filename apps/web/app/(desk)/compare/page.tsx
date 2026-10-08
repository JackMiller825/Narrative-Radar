import { CompareDesk } from "./client";
import { requireDesk } from "@/lib/guard";
import type { DeskData } from "@/lib/types";
import { Suspense } from "react";

export default async function ComparePage() {
  const desk = await requireDesk();
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading comparison.</p>}>
      <CompareDesk narratives={(desk as unknown as DeskData).narratives} />
    </Suspense>
  );
}
