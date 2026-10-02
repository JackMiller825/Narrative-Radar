import { auth } from "@/auth";
import { loadDesk, workspaceForUser } from "@radar/db";

export async function requireUser() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const workspace = await workspaceForUser(userId);
  return { userId, workspaceId: workspace.id, session };
}

export async function requireDesk() {
  const user = await requireUser();
  if (!user) return null;
  const desk = await loadDesk(user.userId);
  return JSON.parse(JSON.stringify(desk)) as Awaited<ReturnType<typeof loadDesk>> & {
    settings: { nextDueAt: string | null; lastAttemptedAt: string | null; lastSuccessfulAt: string | null; monitoringStartedAt: string | null };
    worker: { beatAt: string | null };
  };
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
