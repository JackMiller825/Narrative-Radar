import { requireUser } from "@/lib/guard";
import { eventsAfter } from "@radar/db";
import { planEventCatchup } from "@radar/core";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  if (url.searchParams.get("poll") === "1") {
    const after = Number(url.searchParams.get("after") ?? 0);
    const page = await eventsAfter(user.workspaceId, Number.isFinite(after) ? after : 0);
    const plan = planEventCatchup(after, page.events.map((event) => event.seq), page.oldest);
    return Response.json({ plan, events: page.events });
  }
  const encoder = new TextEncoder();
  let last = Number(request.headers.get("last-event-id") ?? 0);
  const stream = new ReadableStream({
    async start(controller) {
      const send = (id: number, event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      let primed = last > 0;
      const tick = async () => {
        // A brand-new tab already has the server-rendered desk. Replaying
        // history would paint a false "new updates" banner. Prime even when
        // the log is empty so later events are not skipped.
        if (!primed) {
          const page = await eventsAfter(user.workspaceId, 0);
          const newest = page.events.at(-1)?.seq ?? 0;
          last = newest;
          primed = true;
          send(newest, "synced", { seq: newest });
          return;
        }
        const page = await eventsAfter(user.workspaceId, last);
        const plan = planEventCatchup(last, page.events.map((event) => event.seq), page.oldest);
        if (plan === "snapshot" && last > 0) {
          send(page.events.at(-1)?.seq ?? last, "snapshot", { refresh: true });
          last = page.events.at(-1)?.seq ?? last;
          return;
        }
        if (page.events.length === 0) {
          controller.enqueue(encoder.encode(`: ping\n\n`));
          return;
        }
        for (const event of page.events) {
          send(event.seq, event.type, event.payload);
          last = event.seq;
        }
      };
      const timer = setInterval(() => {
        tick().catch(() => undefined);
      }, 2000);
      request.signal.addEventListener("abort", () => {
        clearInterval(timer);
        controller.close();
      });
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
