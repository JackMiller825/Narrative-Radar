import { CandidateDetail } from "@/components/candidate-detail";
import { requireDesk } from "@/lib/guard";
import { staticNarrativeIds } from "@/lib/static-desk";
import type { DeskData } from "@/lib/types";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  if (process.env.GITHUB_PAGES !== "1") return [];
  return staticNarrativeIds().map((id) => ({ id }));
}

export const dynamicParams = true;

export default async function NarrativePage({ params }: { params: Promise<{ id: string }> }) {
  const desk = await requireDesk();
  const { id } = await params;
  const narrative = (desk as unknown as DeskData).narratives.find((item) => item.id === id);
  if (!narrative) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <CandidateDetail narrative={narrative} />
    </div>
  );
}
