import { ensureWorkspace, loadDesk } from "@radar/db";

export async function requireUser() {
  const { user, workspace } = await ensureWorkspace();
  return { userId: user.id, workspaceId: workspace.id };
}

export async function requireDesk() {
  const user = await requireUser();
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
