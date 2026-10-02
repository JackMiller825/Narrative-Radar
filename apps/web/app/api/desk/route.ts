import { sameOrigin, requireUser } from "@/lib/guard";
import {
  addFeed,
  addNote,
  analyzeUrl,
  applyRetention,
  checkNames,
  completeTelegramPairing,
  cyclePalette,
  markAlertRead,
  queueImage,
  recordFeedback,
  removeFeed,
  replayDemo,
  runScan,
  saveRule,
  saveSettings,
  sendTestAlert,
  setBoard,
  startTelegramPairing,
  undoBoard,
  updateBranding,
} from "@radar/db";
import type { AlertRuleInput, NarrativeView, SchedulePreset } from "@radar/core";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") return Response.json({ error: "Missing action" }, { status: 400 });
  const workspaceId = user.workspaceId;
  try {
    switch (body.action) {
      case "scan":
        return Response.json(await runScan(workspaceId, "manual"));
      case "settings":
        await saveSettings(workspaceId, {
          mode: body.mode as "demo" | "live" | undefined,
          chainPreference: stringField(body.chainPreference),
          schedulePreset: body.schedulePreset as SchedulePreset | undefined,
          customIntervalSeconds: numberField(body.customIntervalSeconds),
          paused: boolField(body.paused),
          timezone: stringField(body.timezone),
          namingStyle: stringField(body.namingStyle),
          freshnessHours: numberField(body.freshnessHours),
          excludedKeywords: stringList(body.excludedKeywords),
          watchedEntities: stringList(body.watchedEntities),
          categories: stringList(body.categories),
          languages: stringList(body.languages),
          scoreWeights: body.scoreWeights as Record<string, number> | undefined,
          dailyRequestLimit: numberField(body.dailyRequestLimit),
          textBudgetUsd: nullableNumber(body.textBudgetUsd),
          imageBudgetUsd: nullableNumber(body.imageBudgetUsd),
          imageQueueCap: numberField(body.imageQueueCap),
          pauseOnBudget: boolField(body.pauseOnBudget),
          retentionDays: numberField(body.retentionDays),
          alertSound: boolField(body.alertSound),
          browserNotifications: boolField(body.browserNotifications),
        });
        return Response.json({ ok: true });
      case "board":
        return Response.json(await setBoard(workspaceId, String(body.narrativeId), String(body.board) as NarrativeView["board"], user.userId));
      case "undo":
        await undoBoard(workspaceId, String(body.auditId));
        return Response.json({ ok: true });
      case "note":
        await addNote(workspaceId, String(body.narrativeId), String(body.body ?? "").slice(0, 2000));
        return Response.json({ ok: true });
      case "feedback":
        return Response.json({ ok: true, ...(await recordFeedback(workspaceId, String(body.narrativeId), String(body.kind))) });
      case "branding":
        await updateBranding(workspaceId, String(body.narrativeId), {
          nameId: stringField(body.nameId),
          name: stringField(body.name),
          ticker: stringField(body.ticker),
          pinned: boolField(body.pinned),
          regenerate: body.regenerate === true,
          style: stringField(body.style) as NarrativeView["names"][number]["style"] | undefined,
        });
        return Response.json({ ok: true });
      case "palette":
        await cyclePalette(workspaceId, String(body.narrativeId));
        return Response.json({ ok: true });
      case "image":
        return Response.json(await queueImage(workspaceId, String(body.narrativeId), body.kind === "banner" ? "banner" : "logo"));
      case "check-names":
        return Response.json(await checkNames(workspaceId, String(body.narrativeId)));
      case "analyze":
        return Response.json(await analyzeUrl(workspaceId, String(body.url ?? ""), stringField(body.pastedText)));
      case "feed-add":
        await addFeed(workspaceId, String(body.url ?? ""), String(body.title ?? ""));
        return Response.json({ ok: true });
      case "feed-remove":
        await removeFeed(workspaceId, String(body.id));
        return Response.json({ ok: true });
      case "rule":
        await saveRule(workspaceId, body.rule as AlertRuleInput);
        return Response.json({ ok: true });
      case "alert-read":
        await markAlertRead(workspaceId, String(body.alertId));
        return Response.json({ ok: true });
      case "telegram-start":
        return Response.json(await startTelegramPairing(workspaceId));
      case "telegram-check":
        return Response.json(await completeTelegramPairing(workspaceId));
      case "telegram-test":
        return Response.json(await sendTestAlert(workspaceId));
      case "replay":
        return Response.json(await replayDemo(workspaceId));
      case "retention":
        return Response.json({ ok: true, ...(await applyRetention(workspaceId)) });
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed.";
    const status = /not found|interval|must be/i.test(message) ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}

function stringField(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
function numberField(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function boolField(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}
function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 40) : undefined;
}
function nullableNumber(value: unknown) {
  if (value === null) return null;
  return numberField(value);
}
