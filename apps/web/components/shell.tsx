"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { enableDesktopAlerts } from "@/lib/person-news";
import { useLiveDesk } from "@/lib/use-live-desk";
import { deskAction, formatWhen } from "@/lib/utils";
import type { DeskData } from "@/lib/types";
import { Bell, Bookmark, Radar, Rss, Settings, SunMedium, MoonStar, Waves } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

const themeListeners = new Set<() => void>();
function subscribeTheme(callback: () => void) {
  themeListeners.add(callback);
  return () => themeListeners.delete(callback);
}
function emitTheme() {
  themeListeners.forEach((callback) => callback());
}
function getTheme() {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

const LINKS = [
  { href: "/radar", label: "Live Radar", icon: Radar },
  { href: "/shortlist", label: "Shortlist", icon: Bookmark },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/sources", label: "Sources", icon: Rss },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/saturation", label: "Saturation", icon: Waves },
];

function normalizePath(value: string) {
  if (value.length > 1 && value.endsWith("/")) return value.slice(0, -1);
  return value;
}

export function Shell({ desk, children, initialTheme = "dark", published = false }: { desk: DeskData; children: React.ReactNode; initialTheme?: "dark" | "light"; published?: boolean }) {
  const pathname = normalizePath(usePathname());
  const router = useRouter();
  const liveDesk = useLiveDesk(desk);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => initialTheme);
  const unread = liveDesk.alerts.filter((alert) => !alert.readAt && alert.status !== "suppressed").length;
  const auto = liveDesk.settings.autoScan === true;
  const status = liveDesk.settings.paused ? "Paused" : auto ? "Auto" : "Manual";
  const tone = liveDesk.settings.paused ? "text-amber-300" : "text-mint";

  async function startAuto() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const granted = await enableDesktopAlerts();
      const result = await deskAction({ action: "watch", enabled: true });
      setNotice(typeof result.reason === "string" ? result.reason : "Auto mode is on.");
      if (!granted) setError("Auto mode is running, but notification permission was not granted.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start auto mode.");
    } finally {
      setBusy(false);
    }
  }

  async function stopAuto() {
    setBusy(true);
    setError(null);
    try {
      const result = await deskAction({ action: "watch", enabled: false });
      setNotice(typeof result.reason === "string" ? result.reason : "Manual mode.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not stop auto mode.");
    } finally {
      setBusy(false);
    }
  }

  async function scan() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await deskAction({ action: "scan" });
      setNotice(typeof result.reason === "string" ? result.reason : "Scan finished.");
      if (!published) router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Scan failed.");
    } finally {
      setBusy(false);
    }
  }

  async function changeInterval(schedulePreset: string) {
    setBusy(true);
    setError(null);
    try {
      await deskAction({ action: "settings", schedulePreset });
      setNotice(`Interval set to ${schedulePreset}.`);
      if (!published) router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not change the interval.");
    } finally {
      setBusy(false);
    }
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    document.cookie = `radar-theme=${next}; path=/; max-age=31536000; samesite=lax`;
    window.localStorage.setItem("radar-theme", next);
    emitTheme();
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-line md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 px-4 py-4 md:px-5">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-card text-mint" aria-hidden>
            <Radar size={18} />
          </span>
          <div>
            <p className="display text-lg leading-none">Narrative Radar</p>
            <p className="text-xs text-muted">{liveDesk.workspace.mode === "demo" ? "Demo mode" : "Live mode"}</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1 md:px-3" aria-label="Primary">
          {LINKS.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link key={link.href} href={link.href} className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm ${active ? "bg-card text-foreground" : "text-muted hover:bg-card/70"}`}>
                <Icon size={16} aria-hidden />
                {link.label}
                {link.href === "/alerts" && unread > 0 ? <Badge>{unread}</Badge> : null}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div>
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line bg-background/85 px-4 py-3 backdrop-blur">
          <p className={`text-sm font-medium ${tone}`} title="A connected event stream is not treated as proof that sources are healthy.">{status}</p>
          <form action="/radar" method="get" className="min-w-40 flex-1">
            <input name="q" aria-label="Search the desk" placeholder="Search title, name, ticker" className="h-8 w-full rounded-full border border-line bg-card px-3 text-sm" />
          </form>
          <p className="text-xs text-muted">Next scan {formatWhen(liveDesk.settings.nextDueAt, liveDesk.settings.timezone)}</p>
          <p className="text-xs text-muted">Last success {formatWhen(liveDesk.settings.lastSuccessfulAt, liveDesk.settings.timezone)}</p>
          <p className="text-xs text-muted">Last attempt {formatWhen(liveDesk.settings.lastAttemptedAt, liveDesk.settings.timezone)}</p>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs text-muted">
              <select
                aria-label="Scan interval"
                className="h-8 rounded-full border border-line bg-card px-2 text-xs text-foreground"
                value={liveDesk.settings.schedulePreset}
                disabled={busy}
                onChange={(event) => changeInterval(event.target.value)}
              >
                <option value="1m">1m</option>
                <option value="5m">5m</option>
                <option value="15m">15m</option>
                <option value="1h">1h</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <Button type="button" variant="outline" size="sm" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
              {theme === "dark" ? <SunMedium size={16} /> : <MoonStar size={16} />}
            </Button>
            {published && auto ? <Button type="button" variant="outline" size="sm" onClick={stopAuto} disabled={busy}>Stop</Button> : null}
            {published && !auto ? <Button type="button" size="sm" onClick={startAuto} disabled={busy}>Start</Button> : null}
            <Button type="button" size="sm" onClick={scan} disabled={busy}>{busy ? "Scanning…" : "Scan now"}</Button>
          </div>
          {error ? <p className="w-full text-sm text-red-300" role="alert">{error}</p> : null}
          {notice ? <p className="w-full text-sm text-mint" role="status">{notice}</p> : null}
        </header>
        <div className="px-4 py-5 md:px-6">
          {published ? (
            <p className="mb-4 rounded-2xl border border-line bg-card px-4 py-3 text-sm text-muted">
              This desk runs in your browser. Headlines are about famous people who can move Ethereum, such as Vitalik Buterin, Elon Musk, Donald Trump, and Jerome Powell. Manual mode checks when you press Scan now. Start repeats that check on your interval and notifies you when a new headline appears. Keep this tab open.
            </p>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
