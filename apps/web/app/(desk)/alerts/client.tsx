"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLiveDesk } from "@/lib/use-live-desk";
import { enableDesktopAlerts, notifyEnabled } from "@/lib/person-news";
import { deskAction, formatWhen, isPublishedSnapshot } from "@/lib/utils";
import type { DeskData } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AlertsDesk({ desk }: { desk: DeskData }) {
  const router = useRouter();
  const liveDesk = useLiveDesk(desk);
  const [message, setMessage] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  async function act(body: Record<string, unknown>) {
    try {
      const result = await deskAction(body);
      setMessage(result.instructions || result.reason || "Saved.");
      if (!isPublishedSnapshot()) router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed.");
    }
  }
  function enableBrowser() {
    if (!("Notification" in window)) {
      setMessage("This browser does not expose notifications.");
      return;
    }
    void enableDesktopAlerts().then((granted) => {
      if (granted) notifyEnabled();
      setMessage(granted
        ? "Desktop alerts are on. Auto mode pings only for a major new token narrative, and stays quiet when nothing is stronger or newer. Keep this tab open."
        : "Permission was not granted.");
    });
  }
  function enableSound() {
    setSoundOn(true);
    const context = new AudioContext();
    const osc = context.createOscillator();
    osc.frequency.value = 660;
    osc.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + 0.08);
    setMessage("Sound is armed in this tab only.");
  }
  return (
    <div className="space-y-5">
      <h1 className="display text-4xl">Alerts</h1>
      <p className="max-w-2xl text-sm text-muted">The inbox is on by default. Desktop notifications fire only for a major new Ethereum-friendly token narrative that is materially stronger or newer than ones already reported. They stay quiet otherwise, and they stop after this tab is closed.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={enableBrowser}>Enable browser notifications</Button>
        <Button type="button" variant="outline" onClick={enableSound}>{soundOn ? "Sound armed" : "Enable sound"}</Button>
        <Button type="button" onClick={() => act({ action: "telegram-start" })}>Start Telegram pairing</Button>
        <Button type="button" variant="outline" onClick={() => act({ action: "telegram-check" })}>Check pairing</Button>
        <Button type="button" variant="outline" onClick={() => act({ action: "telegram-test" })}>Send test alert</Button>
      </div>
      <p className="text-sm text-muted">Telegram bot {liveDesk.telegram.configured ? "token is set on the server" : "is not configured"}. Chat {liveDesk.telegram.paired ? `paired${liveDesk.telegram.username ? ` as @${liveDesk.telegram.username}` : ""}` : "not paired"}.</p>
      {liveDesk.telegram.pairingCode ? <p className="rounded-2xl bg-card p-3 text-sm">Send <code>/start {liveDesk.telegram.pairingCode}</code> to your bot, then check pairing.</p> : null}
      {message ? <p className="text-sm text-mint" role="status">{message}</p> : null}
      <ul className="space-y-3">
        {liveDesk.alerts.length === 0 ? <li className="rounded-3xl border border-dashed border-line p-6 text-sm text-muted">The inbox is empty.</li> : null}
        {liveDesk.alerts.map((alert) => (
          <li key={alert.id} className="rounded-3xl border border-line bg-card p-4">
            <div className="flex flex-wrap gap-2">
              <Badge>{alert.status}</Badge>
              <Badge>{alert.eventType}</Badge>
              <span className="text-xs text-muted">{formatWhen(alert.createdAt, liveDesk.settings.timezone)}</span>
            </div>
            <h2 className="mt-2 font-medium">{alert.title}</h2>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-muted">{alert.body}</pre>
            {!alert.readAt && alert.status !== "suppressed" ? <Button type="button" size="sm" className="mt-2" variant="outline" onClick={() => act({ action: "alert-read", alertId: alert.id })}>Mark read</Button> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
