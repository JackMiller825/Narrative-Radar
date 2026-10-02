import { CandidateDetail } from "@/components/candidate-detail";
import { requireDesk } from "@/lib/guard";
import type { DeskData } from "@/lib/types";
import { notFound, redirect } from "next/navigation";

export default async function NarrativePage({ params }: { params: Promise<{ id: string }> }) {
  const desk = await requireDesk();
  if (!desk) redirect("/login");
  const { id } = await params;
  const narrative = (desk as unknown as DeskData).narratives.find((item) => item.id === id);
  if (!narrative) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <CandidateDetail narrative={narrative} />
    </div>
  );
}
